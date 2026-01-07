'use client';

import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SyncStatusIndicatorProps {
    outdatedCount: number;
    onSyncClick?: () => void;
    isSyncing?: boolean;
}

export function SyncStatusIndicator({ outdatedCount, onSyncClick, isSyncing }: SyncStatusIndicatorProps) {
    if (outdatedCount === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-3 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            <div className="flex items-center gap-2 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">{outdatedCount} Updates Available</span>
            </div>
            {onSyncClick && (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                    onClick={onSyncClick}
                    disabled={isSyncing}
                >
                    {isSyncing ? (
                        <>
                            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                            Syncing...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Update All
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}
