/**
 * Offline Storage Service
 * Wrapper around offline-pdf-store for backward compatibility
 * All IndexedDB operations delegated to offline-pdf-store.ts
 */

import {
    savePDFOffline,
    getOfflinePDF,
    removePDFOffline,
    listOfflinePDFs
} from './offline-pdf-store';

/**
 * Save a presentation for offline access
 */
export async function savePresentationOffline(
    doctorId: string,
    pdfUrl: string,
    doctorName: string
) {
    try {
        await savePDFOffline(doctorId, pdfUrl, doctorName);
        return { success: true };
    } catch (error) {
        console.error('Error saving presentation offline:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get an offline presentation
 */
export async function getPresentationOffline(
    doctorId: string
): Promise<Blob | null> {
    try {
        const record = await getOfflinePDF(doctorId);
        return record?.fileBlob || null;
    } catch (error) {
        console.error('Error getting offline presentation:', error);
        return null;
    }
}

/**
 * Remove an offline presentation
 */
export async function removePresentationOffline(
    doctorId: string
): Promise<boolean> {
    try {
        await removePDFOffline(doctorId);
        return true;
    } catch (error) {
        console.error('Error removing offline presentation:', error);
        return false;
    }
}

/**
 * Check if a presentation is available offline (synchronous)
 */
export function isAvailableOffline(doctorId: string): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`offline-${doctorId}`) === 'true';
}

/**
 * List all offline presentations (metadata only)
 */
export async function listOfflinePresentations(): Promise<
    Array<{ doctorId: string; doctorName: string; downloadedAt: Date; fileSize: number }>
> {
    try {
        const allPDFs = await listOfflinePDFs();

        return allPDFs.map((data) => ({
            doctorId: data.doctorId,
            doctorName: data.doctorName,
            downloadedAt: new Date(data.downloadedAt),
            fileSize: data.fileSize,
        }));
    } catch (error) {
        console.error('Error listing offline presentations:', error);
        return [];
    }
}

/**
 * Get total storage used by offline presentations
 */
export async function getStorageUsage(): Promise<number> {
    try {
        const presentations = await listOfflinePresentations();
        return presentations.reduce((total, p) => total + p.fileSize, 0);
    } catch (error) {
        console.error('Error calculating storage usage:', error);
        return 0;
    }
}

/**
 * Get device storage estimation
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage || 0,
                quota: estimate.quota || 100 * 1024 * 1024, // 100MB fallback quota
            };
        } catch (e) {
            console.error('Error getting storage estimate:', e);
        }
    }
    // Fallback to local calculation if estimate API fails or is unavailable
    const usage = await getStorageUsage();
    return { usage, quota: 100 * 1024 * 1024 };
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
