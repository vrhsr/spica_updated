/**
 * IndexedDB Utilities - SINGLE ENTRY POINT
 * This is the ONLY file allowed to call openDB() or indexedDB.open()
 */

import { openDB, IDBPDatabase, DBSchema } from 'idb';

const DB_NAME = 'rep-offline-db'; // Rep-specific database (isolated from admin)
const DB_VERSION = 1;

export const STORES = {
    PDFS: 'pdfs',
} as const;

interface PDFRecord {
    doctorId: string;
    fileBlob: Blob;
    doctorName: string;
    fileSize: number;
    downloadedAt: number;
}

interface SpicasgDB extends DBSchema {
    pdfs: {
        key: string;
        value: PDFRecord;
    };
}

// Singleton promise - ensures only ONE db connection
let dbPromise: Promise<IDBPDatabase<SpicasgDB>> | null = null;

/**
 * Get the database instance (ONLY entry point for IndexedDB)
 * This function MUST be used by all other files
 * 
 * Security: Only allows access for rep role
 */
export async function getDB(): Promise<IDBPDatabase<SpicasgDB>> {
    // Role guard: Only reps can access offline storage
    if (typeof window !== 'undefined') {
        try {
            // Check localStorage for cached role (set by Firebase auth)
            const userRole = localStorage.getItem('userRole');

            if (userRole && userRole !== 'rep') {
                throw new Error(
                    'Offline storage is only available for field representatives. ' +
                    'Admin users should use the online portal.'
                );
            }
        } catch (e) {
            // If localStorage fails, continue (don't block functionality)
            console.warn('Could not verify user role for IndexedDB access:', e);
        }
    }

    if (!dbPromise) {
        dbPromise = openDB<SpicasgDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains(STORES.PDFS)) {
                    db.createObjectStore(STORES.PDFS, { keyPath: 'doctorId' });
                }
            },
        });
    }
    return dbPromise;
}

/**
 * Reset the database - delete and recreate
 * Used for recovery from corrupted state
 */
export async function resetDB(): Promise<void> {
    try {
        // CRITICAL FIX: Nullify promise FIRST before closing
        // This prevents concurrent getDB() calls from getting a closing connection
        const oldPromise = dbPromise;
        dbPromise = null; // ← Set to null IMMEDIATELY

        // Close the old connection (if it exists)
        if (oldPromise) {
            try {
                const db = await oldPromise;
                db.close();
            } catch (e) {
                // Ignore errors - connection might already be broken
                console.warn('Error closing old DB connection:', e);
            }
        }

        // Delete the database
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DB_NAME);

            request.onsuccess = () => {
                console.log(`Successfully deleted database: ${DB_NAME}`);
                resolve();
            };

            request.onerror = () => {
                console.error(`Failed to delete database: ${DB_NAME}`, request.error);
                // Don't reject - allow continuation even if delete fails
                resolve();
            };

            request.onblocked = () => {
                console.warn(`Delete blocked for database: ${DB_NAME}. It will complete when other tabs close.`);
                // Don't reject - the delete will complete eventually
                resolve();
            };
        });

        // Small delay to let browser finish cleanup
        await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
        console.error('Error resetting database:', error);
        // Ensure promise is nullified even on error
        dbPromise = null;
        throw error;
    }
}

/**
 * Check if error is recoverable by resetting
 */
export function isRecoverableError(error: any): boolean {
    const message = error?.message || error?.name || '';
    return (
        message.includes('UnknownError') ||
        message.includes('backing store') ||
        message.includes('VersionError') ||
        message.includes('InvalidStateError') ||
        message.includes('connection is closing')
    );
}
