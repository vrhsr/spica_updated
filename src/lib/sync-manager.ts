/**
 * Smart Sync Manager
 * Handles the "Morning Sync" protocol for offline reliability.
 */

import { getDB, STORES } from './indexeddb-utils';
import { savePDFOffline, hasOfflinePDF, getOfflinePDF } from './offline-pdf-store';

export type SyncStatus = 'IDLE' | 'CHECKING' | 'SYNCING' | 'PAUSED' | 'COMPLETED' | 'ERROR';

export interface SyncState {
    status: SyncStatus;
    total: number;
    completed: number;
    failed: number;
    errors: Array<{ doctorId: string; error: string }>;
    lastSyncTime: number | null;
}

export interface SyncItem {
    doctorId: string;
    doctorName: string;
    pdfUrl: string;
    updatedAt: number; // Timestamp of last PDF update
}

class SyncManager {
    private static instance: SyncManager;
    private state: SyncState = {
        status: 'IDLE',
        total: 0,
        completed: 0,
        failed: 0,
        errors: [],
        lastSyncTime: null
    };

    private listeners: Array<(state: SyncState) => void> = [];

    private constructor() {
        this.loadState();
    }

    public static getInstance(): SyncManager {
        if (!SyncManager.instance) {
            SyncManager.instance = new SyncManager();
        }
        return SyncManager.instance;
    }

    /**
     * Start the "Start Day" sync protocol
     */
    public async startDaySync(items: SyncItem[]) {
        if (this.state.status === 'SYNCING') return;

        this.updateState({
            status: 'CHECKING',
            total: items.length,
            completed: 0,
            failed: 0,
            errors: []
        });

        try {
            // Identify items that need downloading
            const toDownload: SyncItem[] = [];

            for (const item of items) {
                // Skip if no PDF URL
                if (!item.pdfUrl) continue;

                const isCached = await hasOfflinePDF(item.doctorId);
                if (!isCached) {
                    toDownload.push(item);
                } else {
                    // Check if stale
                    const cached = await getOfflinePDF(item.doctorId);
                    if (cached && cached.downloadedAt < item.updatedAt) {
                        // It's stale, re-download
                        toDownload.push(item);
                    } else {
                        // Already ready
                        this.updateState({
                            completed: this.state.completed + 1
                        });
                    }
                }
            }

            // Start Syncing
            this.updateState({ status: 'SYNCING' });

            // Process sequentially to be nice to network/storage
            // using a while loop to allow retries on same index
            let i = 0;
            while (i < toDownload.length) {
                const item = toDownload[i];

                // Network check before attempt
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    this.updateState({ status: 'PAUSED' });
                    await this.waitForNetwork();
                    this.updateState({ status: 'SYNCING' });
                }

                try {
                    await savePDFOffline(item.doctorId, item.pdfUrl, item.doctorName, {
                        state: 'READY',
                        lastSyncAttempt: Date.now()
                    });

                    this.updateState({
                        completed: this.state.completed + 1
                    });
                    i++; // Success, move next
                } catch (error: any) {
                    // Check if failure was due to network
                    if (typeof navigator !== 'undefined' && !navigator.onLine) {
                        this.updateState({ status: 'PAUSED' });
                        await this.waitForNetwork();
                        this.updateState({ status: 'SYNCING' });
                        // Don't increment i, retry same item
                        continue;
                    }

                    console.error(`Failed to sync ${item.doctorName}:`, error);
                    this.updateState({
                        failed: this.state.failed + 1,
                        errors: [...this.state.errors, { doctorId: item.doctorId, error: error.message }]
                    });
                    i++; // Failed (non-network), move next
                }
            }

            this.updateState({
                status: this.state.failed > 0 ? 'ERROR' : 'COMPLETED',
                lastSyncTime: Date.now()
            });

            await this.persistState();

        } catch (error: any) {
            console.error('Critical sync error:', error);
            this.updateState({
                status: 'ERROR',
                errors: [...this.state.errors, { doctorId: 'SYSTEM', error: 'Critical sync failure' }]
            });
        }
    }

    private waitForNetwork(): Promise<void> {
        return new Promise((resolve) => {
            const handleOnline = () => {
                window.removeEventListener('online', handleOnline);
                resolve();
            };
            window.addEventListener('online', handleOnline);
        });
    }

    /**
     * Get current state
     */
    public getSyncStatus(): SyncState {
        return { ...this.state };
    }

    /**
     * Subscribe to state changes
     */
    public subscribe(listener: (state: SyncState) => void) {
        this.listeners.push(listener);
        listener(this.state); // Initial emission
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private updateState(updates: Partial<SyncState>) {
        this.state = { ...this.state, ...updates };
        this.notifyListeners();
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.state));
    }

    private async loadState() {
        try {
            const db = await getDB();
            const record = await db.get(STORES.SYNC_STATE, 'current_session');
            if (record) {
                this.state = {
                    status: record.status === 'SYNCING' ? 'IDLE' : record.status, // Reset stuck state
                    total: record.totalDoctors,
                    completed: record.syncedCount,
                    failed: record.failedCount,
                    errors: [], // Errors not persisted for now
                    lastSyncTime: record.lastSyncTime
                };
                this.notifyListeners();
            }
        } catch (e) {
            console.warn('Failed to load sync state', e);
        }
    }

    private async persistState() {
        try {
            const db = await getDB();
            await db.put(STORES.SYNC_STATE, {
                id: 'current_session',
                lastSyncTime: this.state.lastSyncTime || 0,
                totalDoctors: this.state.total,
                syncedCount: this.state.completed,
                failedCount: this.state.failed,
                status: this.state.status
            });
        } catch (e) {
            console.warn('Failed to persist sync state', e);
        }
    }
}

export const syncManager = SyncManager.getInstance();
