'use client';

import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Loader2, XCircle } from 'lucide-react';
import { syncManager, SyncState } from '@/lib/sync-manager';

interface SyncProgressModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SyncProgressModal({ open, onOpenChange }: SyncProgressModalProps) {
    const [state, setState] = useState<SyncState>(syncManager.getSyncStatus());
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // Subscribe to sync manager updates
        const unsubscribe = syncManager.subscribe((newState) => {
            setState(newState);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (state.total > 0) {
            const percentage = (state.completed / state.total) * 100;
            setProgress(percentage);
        } else {
            setProgress(0);
        }
    }, [state.completed, state.total]);

    // Don't allowing closing while syncing (unless we add a cancel feature later)
    const handleOpenChange = (newOpen: boolean) => {
        if ((state.status === 'SYNCING' || state.status === 'PAUSED') && !newOpen) return;
        onOpenChange(newOpen);
    };

    const isComplete = state.status === 'COMPLETED';
    const isError = state.status === 'ERROR' || state.failed > 0;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {state.status === 'SYNCING' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                        {state.status === 'PAUSED' && <Loader2 className="h-5 w-5 text-amber-500" />}
                        {state.status === 'COMPLETED' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                        {(state.status === 'ERROR' || (state.status !== 'SYNCING' && state.status !== 'PAUSED' && state.failed > 0)) && <AlertTriangle className="h-5 w-5 text-amber-500" />}

                        {state.status === 'SYNCING' && 'Syncing Presentations...'}
                        {state.status === 'PAUSED' && 'Waiting for Network...'}
                        {state.status === 'CHECKING' && 'Checking for Updates...'}
                        {state.status === 'IDLE' && 'Ready to Sync'}
                        {state.status === 'COMPLETED' && 'Sync Complete'}
                        {state.status === 'ERROR' && 'Sync Encountered Issues'}
                    </DialogTitle>
                    <DialogDescription>
                        {state.status === 'SYNCING' && `Downloading ${state.completed + 1} of ${state.total} presentations.`}
                        {state.status === 'PAUSED' && 'Download paused. Resuming automatically when online.'}
                        {state.status === 'CHECKING' && 'Calculating required downloads...'}
                        {state.status === 'COMPLETED' && `Successfully downloaded ${state.completed} presentations.`}
                        {state.status === 'IDLE' && 'Preparing sync...'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <Progress value={progress} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{Math.round(progress)}% Complete</span>
                        <span>{state.completed}/{state.total} items</span>
                    </div>

                    {state.failed > 0 && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            <div className="flex items-center gap-2 font-medium mb-1">
                                <XCircle className="h-4 w-4" />
                                {state.failed} Failed Downloads
                            </div>
                            <ul className="list-disc pl-5 text-xs space-y-1">
                                {state.errors.slice(0, 3).map((e, i) => (
                                    <li key={i}>
                                        {e.doctorId === 'SYSTEM' ? 'System Error: ' : ''}
                                        {e.error}
                                    </li>
                                ))}
                                {state.errors.length > 3 && <li>...and {state.errors.length - 3} more</li>}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    {(isComplete || isError) && (
                        <Button onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
