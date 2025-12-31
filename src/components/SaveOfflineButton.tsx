'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Loader } from 'lucide-react';
import {
    savePresentationOffline,
    removePresentationOffline,
    isAvailableOffline,
} from '@/lib/offline-storage';
import { useToast } from '@/hooks/use-toast';

interface SaveOfflineButtonProps {
    doctorId: string;
    pdfUrl: string;
    doctorName: string;
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function SaveOfflineButton({
    doctorId,
    pdfUrl,
    doctorName,
    variant = 'outline',
    size = 'sm',
}: SaveOfflineButtonProps) {
    const [loading, setLoading] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        setIsSaved(isAvailableOffline(doctorId));
    }, [doctorId]);

    const handleSaveOffline = async () => {
        if (!pdfUrl) {
            toast({
                variant: 'destructive',
                title: 'No PDF URL',
                description: 'This presentation cannot be saved offline.',
            });
            return;
        }

        setLoading(true);

        const result = await savePresentationOffline(doctorId, pdfUrl, doctorName);

        if (result.success) {
            setIsSaved(true);
            toast({
                title: '✅ Saved Offline!',
                description: `${doctorName}'s presentation is now available offline.`,
            });
            // Trigger custom event for other components
            window.dispatchEvent(new Event('offline-updated'));
        } else {
            toast({
                variant: 'destructive',
                title: 'Download Failed',
                description: result.error || 'Could not save presentation offline.',
            });
        }

        setLoading(false);
    };

    const handleRemoveOffline = async () => {
        setLoading(true);

        const success = await removePresentationOffline(doctorId);

        if (success) {
            setIsSaved(false);
            toast({
                title: 'Removed',
                description: `${doctorName}'s offline presentation has been removed.`,
            });
            window.dispatchEvent(new Event('offline-updated'));
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not remove offline presentation.',
            });
        }

        setLoading(false);
    };

    if (isSaved) {
        return (
            <Button
                variant={variant}
                size={size}
                onClick={handleRemoveOffline}
                disabled={loading}
            >
                {loading ? (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remove Offline
            </Button>
        );
    }

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleSaveOffline}
            disabled={loading}
        >
            {loading ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Download className="mr-2 h-4 w-4" />
            )}
            Save Offline
        </Button>
    );
}
