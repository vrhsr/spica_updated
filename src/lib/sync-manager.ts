/**
 * Smart Sync Manager - KILL-RESILIENT VERSION
 * Handles the "Morning Sync" protocol for offline reliability.
 * 
 * WhatsApp-style: Sync intent is persisted to IndexedDB.
 * If app is killed mid-sync, next launch auto-resumes.
 */

import { getDB, STORES, SyncIntentRecord } from './indexeddb-utils';
import { savePDFOffline, hasOfflinePDF, getOfflinePDF } from './offline-pdf-store';

export type SyncStatus = 'IDLE' | 'CHECKING' | 'SYNCING' | 'PAUSED' | 'COMPLETED' | 'ERROR';

export interface SyncState {
    status: SyncStatus;
    total: number;
    completed: number;
    failed: number;
    errors: Array<{ doctorId: string; error: string }>;
    lastSyncTime: number | null;
    // NEW: Resume info
    hasPendingResume: boolean;
    pendingCount: number;
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
        lastSyncTime: null,
        hasPendingResume: false,
        pendingCount: 0
    };

    private listeners: Array<(state: SyncState) => void> = [];
    private initialized = false;

    private constructor() {
        // Don't load state in constructor - call init() separately
    }

    public static getInstance(): SyncManager {
        if (!SyncManager.instance) {
            SyncManager.instance = new SyncManager();
        }
        return SyncManager.instance;
    }

    /**
     * Initialize on app startup - checks for pending resume
     * MUST be called after IndexedDB is ready
     */
    public async init(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        await this.loadState();
        await this.checkForPendingResume();
    }

    /**
     * Check if there's an active sync intent from a previous session
     */
    private async checkForPendingResume(): Promise<void> {
        try {
            const db = await getDB();
            const intent = await db.get(STORES.SYNC_INTENT, 'current_intent');

            if (intent && intent.status === 'ACTIVE') {
                // Calculate remaining items
                const remaining = intent.allDoctorIds.filter(
                    id => !intent.completedDoctorIds.includes(id) && !intent.failedDoctorIds.includes(id)
                );

                if (remaining.length > 0) {
                    console.log(`[SyncManager] Found ${remaining.length} pending PDFs to resume`);
                    this.updateState({
                        hasPendingResume: true,
                        pendingCount: remaining.length,
                        total: intent.allDoctorIds.length,
                        completed: intent.completedDoctorIds.length,
                        failed: intent.failedDoctorIds.length,
                        status: navigator.onLine ? 'PAUSED' : 'PAUSED'
                    });
                } else {
                    // All done, mark as completed
                    await this.clearSyncIntent();
                }
            }
        } catch (e) {
            console.warn('[SyncManager] Failed to check for pending resume:', e);
        }
    }

    /**
     * Resume an interrupted sync
     * Call this when user is ready (e.g., after seeing "Resume sync?" prompt)
     * or automatically on app startup if online
     */
    public async resumeSync(): Promise<void> {
        if (this.state.status === 'SYNCING') return;

        try {
            const db = await getDB();
            const intent = await db.get(STORES.SYNC_INTENT, 'current_intent');

            if (!intent || intent.status !== 'ACTIVE') {
                console.log('[SyncManager] No active sync to resume');
                this.updateState({ hasPendingResume: false, pendingCount: 0 });
                return;
            }

            // Filter to only remaining items
            const remaining = intent.items.filter(
                item => !intent.completedDoctorIds.includes(item.doctorId) &&
                    !intent.failedDoctorIds.includes(item.doctorId)
            );

            if (remaining.length === 0) {
                await this.clearSyncIntent();
                return;
            }

            console.log(`[SyncManager] Resuming sync with ${remaining.length} items`);
            this.updateState({
                status: 'SYNCING',
                hasPendingResume: false
            });

            await this.processItems(remaining, intent);

        } catch (e) {
            console.error('[SyncManager] Resume failed:', e);
            this.updateState({ status: 'ERROR' });
        }
    }

    /**
     * Start the "Start Day" sync protocol
     */
    public async startDaySync(items: SyncItem[]): Promise<void> {
        if (this.state.status === 'SYNCING') return;

        // Create and persist sync intent FIRST (before any downloads)
        const today = new Date().toISOString().split('T')[0];
        const intent: SyncIntentRecord = {
            id: 'current_intent',
            date: today,
            status: 'ACTIVE',
            startedAt: Date.now(),
            allDoctorIds: items.map(i => i.doctorId),
            items: items,
            completedDoctorIds: [],
            failedDoctorIds: []
        };

        await this.persistSyncIntent(intent);

        this.updateState({
            status: 'CHECKING',
            total: items.length,
            completed: 0,
            failed: 0,
            errors: [],
            hasPendingResume: false,
            pendingCount: 0
        });

        try {
            // Identify items that need downloading
            const toDownload: SyncItem[] = [];

            for (const item of items) {
                // Skip if no PDF URL
                if (!item.pdfUrl) {
                    await this.markCompleted(item.doctorId);
                    continue;
                }

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
                        await this.markCompleted(item.doctorId);
                        this.updateState({
                            completed: this.state.completed + 1
                        });
                    }
                }
            }

            if (toDownload.length === 0) {
                // All already cached
                await this.completeSyncIntent();
                this.updateState({
                    status: 'COMPLETED',
                    lastSyncTime: Date.now()
                });
                return;
            }

            // Start Syncing
            this.updateState({ status: 'SYNCING' });

            // Get current intent for tracking
            const db = await getDB();
            const currentIntent = await db.get(STORES.SYNC_INTENT, 'current_intent');
            if (!currentIntent) throw new Error('Sync intent lost');

            await this.processItems(toDownload, currentIntent);

        } catch (error: any) {
            console.error('Critical sync error:', error);
            this.updateState({
                status: 'ERROR',
                errors: [...this.state.errors, { doctorId: 'SYSTEM', error: 'Critical sync failure' }]
            });
        }
    }

    /**
     * Process items sequentially with persistence after each
     */
    private async processItems(items: SyncItem[], intent: SyncIntentRecord): Promise<void> {
        let i = 0;
        while (i < items.length) {
            const item = items[i];

            // Network check before attempt
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                this.updateState({ status: 'PAUSED' });
                await this.updateSyncIntentStatus('ACTIVE'); // Keep as ACTIVE so it resumes
                await this.waitForNetwork();
                this.updateState({ status: 'SYNCING' });
            }

            try {
                await savePDFOffline(item.doctorId, item.pdfUrl, item.doctorName, {
                    state: 'READY',
                    lastSyncAttempt: Date.now()
                });

                // Persist success IMMEDIATELY
                await this.markCompleted(item.doctorId);

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

                // Persist failure IMMEDIATELY
                await this.markFailed(item.doctorId);

                this.updateState({
                    failed: this.state.failed + 1,
                    errors: [...this.state.errors, { doctorId: item.doctorId, error: error.message }]
                });
                i++; // Failed (non-network), move next
            }
        }

        // All items processed
        await this.completeSyncIntent();

        this.updateState({
            status: this.state.failed > 0 ? 'ERROR' : 'COMPLETED',
            lastSyncTime: Date.now()
        });

        await this.persistState();
    }

    /**
     * Mark a doctor as completed in the sync intent
     */
    private async markCompleted(doctorId: string): Promise<void> {
        try {
            const db = await getDB();
            const intent = await db.get(STORES.SYNC_INTENT, 'current_intent');
            if (intent && !intent.completedDoctorIds.includes(doctorId)) {
                intent.completedDoctorIds.push(doctorId);
                await db.put(STORES.SYNC_INTENT, intent);
            }
        } catch (e) {
            console.warn('[SyncManager] Failed to mark completed:', e);
        }
    }

    /**
     * Mark a doctor as failed in the sync intent
     */
    private async markFailed(doctorId: string): Promise<void> {
        try {
            const db = await getDB();
            const intent = await db.get(STORES.SYNC_INTENT, 'current_intent');
            if (intent && !intent.failedDoctorIds.includes(doctorId)) {
                intent.failedDoctorIds.push(doctorId);
                await db.put(STORES.SYNC_INTENT, intent);
            }
        } catch (e) {
            console.warn('[SyncManager] Failed to mark failed:', e);
        }
    }

    /**
     * Persist sync intent to IndexedDB
     */
    private async persistSyncIntent(intent: SyncIntentRecord): Promise<void> {
        try {
            const db = await getDB();
            await db.put(STORES.SYNC_INTENT, intent);
            console.log('[SyncManager] Sync intent persisted');
        } catch (e) {
            console.error('[SyncManager] Failed to persist sync intent:', e);
            throw e;
        }
    }

    /**
     * Update sync intent status
     */
    private async updateSyncIntentStatus(status: SyncIntentRecord['status']): Promise<void> {
        try {
            const db = await getDB();
            const intent = await db.get(STORES.SYNC_INTENT, 'current_intent');
            if (intent) {
                intent.status = status;
                await db.put(STORES.SYNC_INTENT, intent);
            }
        } catch (e) {
            console.warn('[SyncManager] Failed to update sync intent status:', e);
        }
    }

    /**
     * Mark sync as completed
     */
    private async completeSyncIntent(): Promise<void> {
        await this.updateSyncIntentStatus('COMPLETED');
        this.updateState({ hasPendingResume: false, pendingCount: 0 });
    }

    /**
     * Clear sync intent (after successful completion)
     */
    private async clearSyncIntent(): Promise<void> {
        try {
            const db = await getDB();
            await db.delete(STORES.SYNC_INTENT, 'current_intent');
            this.updateState({ hasPendingResume: false, pendingCount: 0 });
        } catch (e) {
            console.warn('[SyncManager] Failed to clear sync intent:', e);
        }
    }

    /**
     * Cancel ongoing sync
     */
    public async cancelSync(): Promise<void> {
        await this.updateSyncIntentStatus('CANCELLED');
        this.updateState({
            status: 'IDLE',
            hasPendingResume: false,
            pendingCount: 0
        });
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
                    ...this.state,
                    // Don't set status from old state - we'll determine from intent
                    total: record.totalDoctors,
                    completed: record.syncedCount,
                    failed: record.failedCount,
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
