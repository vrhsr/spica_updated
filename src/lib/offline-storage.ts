/**
 * Offline Storage Service
 * Manages offline presentation storage using IndexedDB
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema
interface OfflineDB extends DBSchema {
    presentations: {
        key: string; // doctorId
        value: {
            doctorId: string;
            doctorName: string;
            pdfBlob: Blob;
            downloadedAt: Date;
            fileSize: number;
        };
    };
}

const DB_NAME = 'offline-presentations';
const DB_VERSION = 1;
const STORE_NAME = 'presentations';

/**
 * Initialize and return the IndexedDB database
 */
export async function initDB(): Promise<IDBPDatabase<OfflineDB>> {
    return openDB<OfflineDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
}

/**
 * Save a presentation for offline access
 */
export async function savePresentationOffline(
    doctorId: string,
    pdfUrl: string,
    doctorName: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Fetch the PDF
        const response = await fetch(pdfUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }

        const pdfBlob = await response.blob();
        const fileSize = pdfBlob.size;

        // Save to IndexedDB
        const db = await initDB();
        await db.put(STORE_NAME, {
            doctorId,
            doctorName,
            pdfBlob,
            downloadedAt: new Date(),
            fileSize,
        }, doctorId);

        // Mark as offline in localStorage for quick access
        localStorage.setItem(`offline-${doctorId}`, 'true');
        localStorage.setItem(`offline-name-${doctorId}`, doctorName);

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
        const db = await initDB();
        const presentation = await db.get(STORE_NAME, doctorId);
        return presentation?.pdfBlob || null;
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
        const db = await initDB();
        await db.delete(STORE_NAME, doctorId);

        // Remove from localStorage
        localStorage.removeItem(`offline-${doctorId}`);
        localStorage.removeItem(`offline-name-${doctorId}`);

        return true;
    } catch (error) {
        console.error('Error removing offline presentation:', error);
        return false;
    }
}

/**
 * Check if a presentation is available offline
 */
export function isAvailableOffline(doctorId: string): boolean {
    return localStorage.getItem(`offline-${doctorId}`) === 'true';
}

/**
 * List all offline presentations (metadata only)
 */
export async function listOfflinePresentations(): Promise<
    Array<{ doctorId: string; doctorName: string; downloadedAt: Date; fileSize: number }>
> {
    try {
        const db = await initDB();
        const allKeys = await db.getAllKeys(STORE_NAME);

        const presentations = await Promise.all(
            allKeys.map(async (key) => {
                const data = await db.get(STORE_NAME, key);
                if (!data) return null;
                return {
                    doctorId: data.doctorId,
                    doctorName: data.doctorName,
                    downloadedAt: data.downloadedAt,
                    fileSize: data.fileSize,
                };
            })
        );

        return presentations.filter((p): p is NonNullable<typeof p> => p !== null);
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
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
