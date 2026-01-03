/**
 * useOfflineReady Hook
 * WHATSAPP-STYLE: Ensures IndexedDB is ready and all state is rehydrated from storage
 * before rendering offline-dependent UI
 */

import { useState, useEffect, useCallback } from 'react';
import { checkIndexedDBHealth, HealthCheckResult } from '@/lib/indexeddb-health';
import { syncManager } from '@/lib/sync-manager';

interface OfflineReadyState {
    isReady: boolean;
    isLoading: boolean;
    error: string | null;
    healthCheck: HealthCheckResult | null;
    // Quick access to PDF counts for UI
    pdfCount: number;
    verifiedCount: number;
    failedCount: number;
    // NEW: Pending sync resume info
    hasPendingSync: boolean;
    pendingSyncCount: number;
    retry: () => Promise<void>;
    // NEW: Resume pending sync
    resumeSync: () => Promise<void>;
}

/**
 * WHATSAPP-STYLE: Hook to ensure app is fully rehydrated from storage before use
 * 
 * On mount, this hook:
 * 1. Opens IndexedDB
 * 2. Verifies all PDFs are valid (blob exists, size > 0)
 * 3. Rebuilds localStorage from IndexedDB (source of truth)
 * 4. Checks for pending sync to resume (kill-resilient)
 * 5. Returns ready state for UI rendering
 * 
 * Usage:
 * ```
 * const { isReady, isLoading, error, hasPendingSync, resumeSync } = useOfflineReady();
 * if (isLoading) return <Loading />;
 * if (error) return <Error onRetry={retry} />;
 * if (hasPendingSync) return <ResumeSyncPrompt onResume={resumeSync} />;
 * // Safe to use offline features - state is rehydrated from storage
 * ```
 */
export function useOfflineReady(): OfflineReadyState {
    const [state, setState] = useState<{
        isReady: boolean;
        isLoading: boolean;
        error: string | null;
        healthCheck: HealthCheckResult | null;
    }>({
        isReady: false,
        isLoading: true,
        error: null,
        healthCheck: null,
    });

    const performHealthCheck = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // This does the full WhatsApp-style rehydration:
            // - Opens DB
            // - Verifies all PDFs
            // - Rebuilds localStorage from source of truth
            // - Initializes SyncManager and checks for pending resume
            const result = await checkIndexedDBHealth();

            if (result.healthy) {
                setState({
                    isReady: true,
                    isLoading: false,
                    error: null,
                    healthCheck: result,
                });
            } else {
                setState({
                    isReady: false,
                    isLoading: false,
                    error: result.error || 'Database initialization failed',
                    healthCheck: result,
                });
            }
        } catch (error: any) {
            setState({
                isReady: false,
                isLoading: false,
                error: error?.message || 'Failed to check database health',
                healthCheck: null,
            });
        }
    }, []);

    const resumeSync = useCallback(async () => {
        await syncManager.resumeSync();
    }, []);

    useEffect(() => {
        performHealthCheck();
    }, [performHealthCheck]);

    return {
        ...state,
        pdfCount: state.healthCheck?.pdfCount || 0,
        verifiedCount: state.healthCheck?.verifiedPdfCount || 0,
        failedCount: state.healthCheck?.failedPdfCount || 0,
        hasPendingSync: state.healthCheck?.hasPendingSync || false,
        pendingSyncCount: state.healthCheck?.pendingSyncCount || 0,
        retry: performHealthCheck,
        resumeSync,
    };
}
