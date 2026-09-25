/**
 * Visit Logs Storage
 * Stores post-presentation feedback offline
 */

import { v4 as uuidv4 } from 'uuid';
import { getDB, STORES } from './indexeddb-utils';
import { Geolocation } from '@capacitor/geolocation';
import { collection, setDoc, Timestamp, doc, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Helper to get firestore instance (avoiding circular deps if any)
const getFB = () => {
    const db = getFirestore();
    const auth = getAuth();
    return { db, auth };
};

export async function saveVisitLog(
    doctorId: string,
    status: 'VISITED' | 'NOT_VISITED', // 'VISITED' = Yes, 'NOT_VISITED' = No
    doctorName?: string
) {
    try {
        let latitude: number | undefined;
        let longitude: number | undefined;

        // Capture location if "VISITED" (Yes)
        if (status === 'VISITED') {
            try {
                // Determine if we have permission first to avoid slow timeouts?
                // Just try with a short timeout.
                // Note: On web this might prompt. On app with permissions it's seamless.
                const position = await Geolocation.getCurrentPosition({
                    enableHighAccuracy: true,
                    timeout: 5000, // 5 seconds max
                    maximumAge: 60000 // 1 minute old is fine
                });
                latitude = position.coords.latitude;
                longitude = position.coords.longitude;
            } catch (geoError) {
                console.warn('Failed to get location for visit log:', geoError);
                // Continue without location
            }
        }

        const db = await getDB();
        await db.put(STORES.VISIT_LOGS, {
            id: uuidv4(),
            doctorId,
            doctorName: doctorName || 'Unknown Doctor',
            timestamp: Date.now(),
            status,
            latitude,
            longitude,
            synced: 0 // 0 = false (pending upload)
        });

        console.log(`[Visit Log] Saved log for ${doctorId}: ${status}`);

        // Try immediate sync if online
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            syncVisitLogs().catch(err => console.warn('[Visit Log] Immediate sync failed:', err));
        }

        return true;
    } catch (error) {
        console.error('Error saving visit log:', error);
        return false;
    }
}

export async function getUnsyncedLogs() {
    const db = await getDB();
    return db.getAllFromIndex(STORES.VISIT_LOGS, 'by-synced', 0);
}


export async function markLogAsSynced(id: string) {
    const db = await getDB();
    const log = await db.get(STORES.VISIT_LOGS, id);
    if (log) {
        log.synced = 1; // 1 = true
        await db.put(STORES.VISIT_LOGS, log);
    }
}

export async function isVisitedToday(doctorId: string): Promise<boolean> {
    try {
        const db = await getDB();
        const logs = await db.getAll(STORES.VISIT_LOGS);
        const today = new Date().setHours(0, 0, 0, 0);

        return logs.some(log =>
            log.doctorId === doctorId &&
            log.status === 'VISITED' &&
            log.timestamp >= today
        );
    } catch (error) {
        console.error('Error checking visit status:', error);
        return false;
    }
}

let syncInFlight: Promise<void> | null = null;

/**
 * Syncs unsynced logs from IndexedDB to Firestore. Concurrent callers share
 * one run (init, save and resume can all trigger it at once).
 */
export function syncVisitLogs(): Promise<void> {
    if (!syncInFlight) {
        syncInFlight = runVisitLogSync().finally(() => {
            syncInFlight = null;
        });
    }
    return syncInFlight;
}

async function runVisitLogSync() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    try {
        const unsynced = await getUnsyncedLogs();
        if (unsynced.length === 0) return;

        console.log(`[Visit Log] Syncing ${unsynced.length} logs to Firestore...`);
        const { db, auth } = getFB();
        if (!auth.currentUser) {
            console.warn('[Visit Log] No user logged in, skipping sync');
            return;
        }

        const visitLogsCol = collection(db, 'visit_logs');

        for (const log of unsynced) {
            try {
                // Prepare document data
                const docData = {
                    doctorId: log.doctorId,
                    doctorName: log.doctorName || 'Unknown Doctor',
                    status: log.status,
                    // null, not undefined: Firestore rejects the whole write
                    // for an undefined field, so a visit where GPS timed out
                    // (common indoors) never uploaded and retried forever.
                    latitude: log.latitude ?? null,
                    longitude: log.longitude ?? null,
                    repId: auth.currentUser.uid,
                    repName: auth.currentUser.displayName || 'Unknown Rep',
                    createdAt: Timestamp.now(),
                    timestamp: Timestamp.fromMillis(log.timestamp)
                };

                // Keyed by the local log id, so a retry can never duplicate it.
                await setDoc(doc(visitLogsCol, log.id), docData);

                // Mark as synced locally
                await markLogAsSynced(log.id);
            } catch (err: any) {
                // Reps may create but not update visit logs, so re-writing an
                // id that already uploaded (e.g. the app closed before it was
                // marked synced) is denied — it's already on the server.
                if (err?.code === 'permission-denied') {
                    await markLogAsSynced(log.id).catch(() => {});
                } else {
                    console.error(`[Visit Log] Failed to sync log ${log.id}:`, err);
                }
            }
        }
        console.log('[Visit Log] Sync completed');
    } catch (error) {
        console.error('[Visit Log] Sync process error:', error);
    }
}

