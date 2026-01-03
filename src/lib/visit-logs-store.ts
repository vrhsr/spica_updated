/**
 * Visit Logs Storage
 * Stores post-presentation feedback offline
 */

import { v4 as uuidv4 } from 'uuid';
import { getDB, STORES } from './indexeddb-utils';
import { Geolocation } from '@capacitor/geolocation';

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
            timestamp: Date.now(),
            status,
            latitude,
            longitude,
            synced: 0 // 0 = false (pending upload)
        });

        console.log(`[Visit Log] Saved log for ${doctorId}: ${status}`);
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
