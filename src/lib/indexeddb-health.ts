/**
 * IndexedDB Health Check Utility
 * WHATSAPP-STYLE: Verifies database accessibility on app startup
 * Rehydrates all state from storage, not memory
 */

import { getDB, resetDB, isRecoverableError, STORES } from './indexeddb-utils';
import { verifyAllOfflinePDFs, rebuildLocalStorageFlags } from './offline-pdf-store';
import { syncManager } from './sync-manager';

export interface HealthCheckResult {
    healthy: boolean;
    dbAccessible: boolean;
    storesAccessible: boolean;
    pdfCount: number;
    verifiedPdfCount: number;
    failedPdfCount: number;
    lastSyncTime: number | null;
    // NEW: Pending sync resume info
    hasPendingSync: boolean;
    pendingSyncCount: number;
    error?: string;
    recoveryAttempted?: boolean;
    recoverySuccessful?: boolean;
}

/**
 * WHATSAPP-STYLE: Full app startup rehydration
 * 
 * App Launch
 * ↓
 * Open IndexedDB
 * ↓
 * Load PDF metadata
 * ↓
 * Verify all PDFs (check blob exists, size > 0)
 * ↓
 * Rebuild localStorage from source of truth
 * ↓
 * Initialize SyncManager (check for pending resume)
 * ↓
 * Return ready state for UI rendering
 */
export async function checkIndexedDBHealth(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
        healthy: false,
        dbAccessible: false,
        storesAccessible: false,
        pdfCount: 0,
        verifiedPdfCount: 0,
        failedPdfCount: 0,
        lastSyncTime: null,
        hasPendingSync: false,
        pendingSyncCount: 0,
    };

    try {
        // Step 1: Can we open the database?
        console.log('[Startup] Opening IndexedDB...');
        const db = await getDB();
        result.dbAccessible = true;

        // Step 2: Can we access the stores?
        const tx = db.transaction([STORES.PDFS, STORES.SYNC_STATE], 'readonly');

        // Count PDFs
        const pdfStore = tx.objectStore(STORES.PDFS);
        const pdfs = await pdfStore.getAll();
        result.pdfCount = pdfs.length;

        // Get sync state
        const syncStore = tx.objectStore(STORES.SYNC_STATE);
        const syncState = await syncStore.get('current_session');
        result.lastSyncTime = syncState?.lastSyncTime || null;

        await tx.done;
        result.storesAccessible = true;

        // Step 3: WHATSAPP-STYLE - Verify all PDFs on launch
        // This eliminates "ghost PDFs" and ensures UI shows truth
        console.log('[Startup] Verifying all offline PDFs...');
        const verification = await verifyAllOfflinePDFs();
        result.verifiedPdfCount = verification.verified;
        result.failedPdfCount = verification.failed;

        // Step 4: Rebuild localStorage from IndexedDB (source of truth)
        // UI must be DERIVED from storage, not remembered
        console.log('[Startup] Rebuilding localStorage from IndexedDB...');
        await rebuildLocalStorageFlags();

        // Step 5: KILL-RESILIENT - Initialize SyncManager and check for pending resume
        console.log('[Startup] Initializing SyncManager...');
        await syncManager.init();
        const syncStatus = syncManager.getSyncStatus();
        result.hasPendingSync = syncStatus.hasPendingResume;
        result.pendingSyncCount = syncStatus.pendingCount;

        result.healthy = true;

        console.log('[Startup] ✅ App ready from storage', {
            pdfCount: result.pdfCount,
            verified: result.verifiedPdfCount,
            failed: result.failedPdfCount,
            lastSync: result.lastSyncTime ? new Date(result.lastSyncTime).toISOString() : 'Never',
            pendingSync: result.hasPendingSync ? result.pendingSyncCount : 'None'
        });

    } catch (error: any) {
        console.error('[Startup] ❌ Health check failed:', error);
        result.error = error?.message || 'Unknown error';

        // Attempt recovery if error is recoverable
        if (isRecoverableError(error)) {
            console.log('[Startup] 🔄 Attempting recovery...');
            result.recoveryAttempted = true;

            try {
                await resetDB();
                // Verify recovery worked
                const db = await getDB();
                result.dbAccessible = true;
                result.recoverySuccessful = true;
                result.healthy = true;
                console.log('[Startup] ✅ Recovery successful');
            } catch (recoveryError: any) {
                console.error('[Startup] ❌ Recovery failed:', recoveryError);
                result.recoverySuccessful = false;
            }
        }
    }

    return result;
}

/**
 * Quick check if IndexedDB is available (no recovery attempt)
 * Use this for fast UI decisions
 */
export async function isIndexedDBAvailable(): Promise<boolean> {
    try {
        await getDB();
        return true;
    } catch {
        return false;
    }
}

/**
 * Log diagnostic info to console for debugging
 */
export async function logDiagnostics(): Promise<void> {
    console.group('📊 IndexedDB Diagnostics');

    // Browser support check
    console.log('IndexedDB supported:', 'indexedDB' in window);

    // Storage estimate
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        console.log('Storage quota:', {
            usage: `${((estimate.usage || 0) / 1024 / 1024).toFixed(2)} MB`,
            quota: `${((estimate.quota || 0) / 1024 / 1024).toFixed(2)} MB`,
            percentUsed: `${(((estimate.usage || 0) / (estimate.quota || 1)) * 100).toFixed(1)}%`
        });
    }

    // Persistence check
    if ('storage' in navigator && 'persisted' in navigator.storage) {
        const persisted = await navigator.storage.persisted();
        console.log('Storage persisted:', persisted);
    }

    // Health check
    const health = await checkIndexedDBHealth();
    console.log('Health check result:', health);

    console.groupEnd();
}
