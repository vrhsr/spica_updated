'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DownloadCloud, Play } from 'lucide-react';
import { syncManager, SyncItem } from '@/lib/sync-manager';
import { SyncProgressModal } from './SyncProgressModal';
import { Timestamp } from 'firebase/firestore';

interface StartDayButtonProps {
    presentations: any[];
    doctors: any[];
}

export function StartDayButton({ presentations, doctors }: StartDayButtonProps) {
    const [showModal, setShowModal] = useState(false);

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
            // Maybe show a toast?
            return;
        }

        // 2. Start Sync Manager
        setShowModal(true);
        await syncManager.startDaySync(syncItems);
    };

    return (
        <>
            <Button
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg transition-all active:scale-95"
                onClick={handleStartDay}
            >
                <Play className="mr-2 h-5 w-5 fill-current" />
                Start Day / Sync
            </Button>

            <SyncProgressModal open={showModal} onOpenChange={setShowModal} />
        </>
    );
}
