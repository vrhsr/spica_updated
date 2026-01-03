/**
 * IndexedDB Utilities - SINGLE ENTRY POINT
 * This is the ONLY file allowed to call openDB() or indexedDB.open()
 */

import { openDB, IDBPDatabase, DBSchema } from 'idb';

const DB_NAME = 'spicasg-offline-db';
const DB_VERSION = 2; // Bumped for new store

export const STORES = {
    PDFS: 'pdfs',
    SYNC_STATE: 'sync_state',
    SYNC_INTENT: 'sync_intent', // NEW: Kill-resilient sync tracking
} as const;

export interface PDFRecord {
    doctorId: string;
    fileBlob: Blob;
    doctorName: string;
    fileSize: number;
    downloadedAt: number;
    // Sync metadata
    state?: 'READY' | 'FAILED' | 'STALE';
    lastSyncAttempt?: number;
    checksum?: string;
}

export interface SyncStateRecord {
    id: string; // 'current_session'
    lastSyncTime: number;
    totalDoctors: number;
    syncedCount: number;
    failedCount: number;
    status: 'IDLE' | 'CHECKING' | 'SYNCING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
}

/**
 * KILL-RESILIENT: Persisted sync intent
 * Survives app kill and enables automatic resume on next launch
 */
export interface SyncIntentRecord {
    id: string; // 'current_intent'
    date: string; // e.g., '2026-01-03'
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
    startedAt: number;
    // All doctor IDs that need syncing
    allDoctorIds: string[];
    // All items with their metadata (needed for resume)
    items: Array<{
        doctorId: string;
        doctorName: string;
        pdfUrl: string;
        updatedAt: number;
    }>;
    // Tracking progress
    completedDoctorIds: string[];
    failedDoctorIds: string[];
}

export interface SpicasgDB extends DBSchema {
    pdfs: {
        key: string;
        value: PDFRecord;
    };
    sync_state: {
        key: string;
        value: SyncStateRecord;
    };
    sync_intent: {
        key: string;
        value: SyncIntentRecord;
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
            upgrade(db, oldVersion) {
                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains(STORES.PDFS)) {
                    db.createObjectStore(STORES.PDFS, { keyPath: 'doctorId' });
                }
                if (!db.objectStoreNames.contains(STORES.SYNC_STATE)) {
                    db.createObjectStore(STORES.SYNC_STATE, { keyPath: 'id' });
                }
                // NEW in version 2: sync_intent store
                if (!db.objectStoreNames.contains(STORES.SYNC_INTENT)) {
                    db.createObjectStore(STORES.SYNC_INTENT, { keyPath: 'id' });
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
