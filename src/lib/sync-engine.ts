import { listOfflinePresentations } from './offline-storage';
import { Timestamp } from 'firebase/firestore';

export type SyncStatus = 'LATEST' | 'OUTDATED' | 'MISSING';

export interface SyncCheckResult {
    doctorId: string;
    status: SyncStatus;
    localDate?: number;
    cloudDate?: number;
}

export type SyncResultMap = Map<string, SyncCheckResult>;

/**
 * Checks for updates by comparing cloud presentations with local offline storage.
 * @param cloudPresentations List of presentations from Firestore
 */
export async function checkForUpdates(
    cloudPresentations: Array<{ doctorId: string; updatedAt: Timestamp, id: string; }>
): Promise<SyncResultMap> {
    const offlinePresentations = await listOfflinePresentations();
    const offlineMap = new Map(offlinePresentations.map(p => [p.doctorId, p]));

    const results = new Map<string, SyncCheckResult>();

    for (const cloudP of cloudPresentations) {
        const localP = offlineMap.get(cloudP.doctorId);

        // Default to MISSING
        let status: SyncStatus = 'MISSING';
        let localDate: number | undefined = undefined;
        let cloudDate: number | undefined = undefined;

        if (cloudP.updatedAt) {
            cloudDate = cloudP.updatedAt.toMillis();
        }

        if (localP) {
            localDate = new Date(localP.downloadedAt).getTime();
            status = 'LATEST';

            // If we have both dates, compare them
            // We give a small buffer (e.g., 10 seconds) to avoid false positives due to clock skew
            if (cloudDate && localDate && cloudDate > (localDate + 10000)) {
                status = 'OUTDATED';
            }
        }

        results.set(cloudP.doctorId, {
            doctorId: cloudP.doctorId,
            status,
            localDate,
            cloudDate
        });
    }

    return results;
}

/**
 * Helper to get summary stats
 */
export function getSyncStats(results: SyncResultMap) {
    let outdated = 0;
    let missing = 0;
    let latest = 0;

    results.forEach(r => {
        if (r.status === 'OUTDATED') outdated++;
        if (r.status === 'MISSING') missing++;
        if (r.status === 'LATEST') latest++;
    });

    return { outdated, missing, latest, total: results.size };
}
