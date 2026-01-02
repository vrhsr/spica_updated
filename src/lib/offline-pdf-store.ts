/**
 * PDF Offline Storage
 * All IndexedDB operations go through indexeddb-utils.ts ONLY
 */

import { getDB, STORES } from './indexeddb-utils';

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

// Helper function
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
