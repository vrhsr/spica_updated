/**
 * IndexedDB Utilities - SINGLE ENTRY POINT
 * This is the ONLY file allowed to call openDB() or indexedDB.open()
 */

import { openDB, IDBPDatabase, DBSchema } from 'idb';

const DB_NAME = 'spicasg-offline-db';
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
 */
export async function getDB(): Promise<IDBPDatabase<SpicasgDB>> {
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
        // Close existing connection
        if (dbPromise) {
            const db = await dbPromise;
            db.close();
            dbPromise = null;
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
                reject(request.error);
            };

            request.onblocked = () => {
                console.warn(`Delete blocked for database: ${DB_NAME}. Close other tabs.`);
                // Don't reject - the delete will complete when tabs close
                resolve();
            };
        });

        // Force new connection on next getDB() call
        dbPromise = null;
    } catch (error) {
        console.error('Error resetting database:', error);
        // Force reset promise anyway
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
        message.includes('InvalidStateError')
    );
}
