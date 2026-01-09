'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, RefreshCw, AlertCircle } from 'lucide-react';
import { syncManager, SyncItem, SyncState } from '@/lib/sync-manager';
import { SyncProgressModal } from './SyncProgressModal';
import { Timestamp } from 'firebase/firestore';

interface StartDayButtonProps {
    presentations: any[];
    doctors: any[];
}

export function StartDayButton({ presentations, doctors }: StartDayButtonProps) {
    const [showModal, setShowModal] = useState(false);
    const [syncState, setSyncState] = useState<SyncState>(syncManager.getSyncStatus());

    useEffect(() => {
        // Subscribe to sync manager updates
        const unsubscribe = syncManager.subscribe((state) => {
            setSyncState(state);
        });
        return unsubscribe;
    }, []);

    const handleStartDay = async () => {
        // 1. Prepare Sync Items
        const doctorsMap = new Map(doctors.map(d => [d.id, d.name]));

        const syncItems: SyncItem[] = presentations
            .filter(p => p.pdfUrl) // Only sync if PDF exists
            .map(p => ({
                doctorId: p.doctorId,
                doctorName: doctorsMap.get(p.doctorId) || 'Unknown Doctor',
                pdfUrl: p.pdfUrl,
                updatedAt: p.updatedAt instanceof Timestamp ? p.updatedAt.toMillis() : Date.now()
            }));

        if (syncItems.length === 0) {
            // Nothing to sync
            return;
        }

        // 2. Start Sync Manager
        setShowModal(true);
        await syncManager.startDaySync(syncItems);
    };

    const handleResumeSync = async () => {
        setShowModal(true);
        await syncManager.resumeSync();
    };

    // Check if there's a pending sync to resume
    const hasPendingSync = syncState.hasPendingResume && syncState.pendingCount > 0;
    const isSyncing = syncState.status === 'SYNCING' || syncState.status === 'PAUSED';

    return (
        <>
            {hasPendingSync ? (
                // Show Resume button when there's a pending sync
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{syncState.pendingCount} downloads pending from previous session</span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            size="lg"
                            className="flex-1 shadow-lg"
                            onClick={handleResumeSync}
                            disabled={isSyncing}
                        >
                            <RefreshCw className="mr-2 h-5 w-5" />
                            Resume Sync
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="flex-1"
                            onClick={handleStartDay}
                            disabled={isSyncing}
                        >
                            <Play className="mr-2 h-5 w-5" />
                            Start Fresh
                        </Button>
                    </div>
                </div>
            ) : (
                // Normal Start Day button
                <Button
                    size="lg"
                    className="w-full shadow-lg transition-all active:scale-95"
                    onClick={handleStartDay}
                    disabled={isSyncing}
                >
                    <Play className="mr-2 h-5 w-5 fill-current" />
                    {isSyncing ? 'Syncing...' : 'Start Day / Sync'}
                </Button>
            )}

            <SyncProgressModal open={showModal} onOpenChange={setShowModal} />
        </>
    );
}
