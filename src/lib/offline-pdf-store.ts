/**
 * PDF Offline Storage
 * All IndexedDB operations go through indexeddb-utils.ts ONLY
 */

import { getDB, STORES, PDFRecord } from './indexeddb-utils';

/**
 * Save PDF Offline (Cloud → Local)
 */
export async function savePDFOffline(
    doctorId: string,
    pdfUrl: string,
    doctorName: string,
    metadata?: { state?: 'READY' | 'FAILED' | 'STALE', lastSyncAttempt?: number, checksum?: string }
) {
    if (!pdfUrl) throw new Error("No PDF URL provided");

    try {
        // Download the PDF
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error(`Failed to download PDF: ${response.statusText}`);

        const blob = await response.blob();
        const pdfSize = blob.size;

        // Check storage quota
        const { hasEnoughStorage } = await import('./storage-quota');
        const hasSpace = await hasEnoughStorage(pdfSize, 10);

        if (!hasSpace) {
            throw new Error(
                `Insufficient storage. PDF size: ${formatBytes(pdfSize)}. ` +
                `Please delete old presentations to free up space.`
            );
        }

        // Save to IndexedDB
        const db = await getDB();
        await db.put(STORES.PDFS, {
            doctorId,
            fileBlob: blob,
            doctorName,
            fileSize: blob.size,
            downloadedAt: Date.now(),
            ...metadata
        });

        // Mark in localStorage for quick sync check
        localStorage.setItem(`offline-${doctorId}`, 'true');
        localStorage.setItem(`offline-name-${doctorId}`, doctorName);

        return true;
    } catch (error: any) {
        // Clean up localStorage if operation failed
        localStorage.removeItem(`offline-${doctorId}`);
        localStorage.removeItem(`offline-name-${doctorId}`);

        throw new Error(`Failed to save PDF offline: ${error.message}`);
    }
}

/**
 * Check if PDF is stored offline
 */
export async function hasOfflinePDF(doctorId: string): Promise<boolean> {
    // Try localStorage first for speed
    if (typeof window !== 'undefined' && localStorage.getItem(`offline-${doctorId}`) === 'true') {
        return true;
    }

    try {
        const db = await getDB();
        const record = await db.get(STORES.PDFS, doctorId);
        return !!record;
    } catch (error: any) {
        console.error('Error checking offline PDF:', error);
        return false;
    }
}

/**
 * Retrieve PDF for offline use
 */
export async function getOfflinePDF(doctorId: string) {
    try {
        const db = await getDB();
        return await db.get(STORES.PDFS, doctorId);
    } catch (error: any) {
        console.error('Error retrieving offline PDF:', error);
        throw new Error(`Failed to retrieve offline PDF: ${error.message}`);
    }
}

/**
 * Remove PDF from offline storage
 */
export async function removePDFOffline(doctorId: string) {
    try {
        const db = await getDB();
        await db.delete(STORES.PDFS, doctorId);

        localStorage.removeItem(`offline-${doctorId}`);
        localStorage.removeItem(`offline-name-${doctorId}`);

        return true;
    } catch (error: any) {
        // Clean up localStorage even if DB operation failed
        localStorage.removeItem(`offline-${doctorId}`);
        localStorage.removeItem(`offline-name-${doctorId}`);

        console.error('Error removing offline PDF:', error);
        throw new Error(`Failed to remove offline PDF: ${error.message}`);
    }
}

/**
 * List all offline PDFs
 */
export async function listOfflinePDFs() {
    try {
        const db = await getDB();
        return await db.getAll(STORES.PDFS);
    } catch (error: any) {
        console.error('Error listing offline PDFs:', error);
        return [];
    }
}

/**
 * WHATSAPP-STYLE: Verify all PDFs on app startup
 * Checks that blobs exist and are valid, marks any failures
 * This ensures UI is always derived from verified storage state
 */
export async function verifyAllOfflinePDFs(): Promise<{
    verified: number;
    failed: number;
    failedIds: string[];
}> {
    const result = { verified: 0, failed: 0, failedIds: [] as string[] };

    try {
        const db = await getDB();
        const allPdfs = await db.getAll(STORES.PDFS);

        for (const pdf of allPdfs) {
            const isValid = await verifyPDFRecord(pdf);

            if (isValid) {
                result.verified++;
            } else {
                result.failed++;
                result.failedIds.push(pdf.doctorId);

                // Mark as FAILED in storage
                await db.put(STORES.PDFS, {
                    ...pdf,
                    state: 'FAILED',
                    lastSyncAttempt: Date.now()
                });

                // Update localStorage flag
                localStorage.removeItem(`offline-${pdf.doctorId}`);
            }
        }

        console.log('[PDF Verify] Verification complete:', result);
        return result;
    } catch (error) {
        console.error('[PDF Verify] Verification failed:', error);
        return result;
    }
}

/**
 * Verify a single PDF record is valid
 */
async function verifyPDFRecord(record: PDFRecord): Promise<boolean> {
    try {
        // Check 1: Blob exists
        if (!record.fileBlob) {
            console.warn(`[PDF Verify] Missing blob for ${record.doctorId}`);
            return false;
        }

        // Check 2: Blob has content
        if (record.fileBlob.size === 0) {
            console.warn(`[PDF Verify] Empty blob for ${record.doctorId}`);
            return false;
        }

        // Check 3: Blob size matches stored size (if available)
        if (record.fileSize && record.fileBlob.size !== record.fileSize) {
            console.warn(`[PDF Verify] Size mismatch for ${record.doctorId}: expected ${record.fileSize}, got ${record.fileBlob.size}`);
            return false;
        }

        // Check 4: State is not already FAILED
        if (record.state === 'FAILED') {
            return false;
        }

        return true;
    } catch (error) {
        console.error(`[PDF Verify] Error verifying ${record.doctorId}:`, error);
        return false;
    }
}

/**
 * Rebuild localStorage flags from IndexedDB (source of truth)
 * Call this on app startup to sync quick-access flags
 */
export async function rebuildLocalStorageFlags(): Promise<void> {
    try {
        // Clear all offline flags first
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('offline-')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Rebuild from IndexedDB
        const db = await getDB();
        const allPdfs = await db.getAll(STORES.PDFS);

        for (const pdf of allPdfs) {
            if (pdf.state !== 'FAILED') {
                localStorage.setItem(`offline-${pdf.doctorId}`, 'true');
                localStorage.setItem(`offline-name-${pdf.doctorId}`, pdf.doctorName);
            }
        }

        console.log(`[PDF Store] Rebuilt localStorage flags for ${allPdfs.length} PDFs`);
    } catch (error) {
        console.error('[PDF Store] Failed to rebuild localStorage flags:', error);
    }
}

// Helper function
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
