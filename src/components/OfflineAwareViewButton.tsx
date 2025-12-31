'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Loader } from 'lucide-react';
import { getPresentationOffline, isAvailableOffline } from '@/lib/offline-storage';
import { useToast } from '@/hooks/use-toast';

interface OfflineAwareViewButtonProps {
    doctorId: string;
    doctorName: string;
    pdfUrl?: string;
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function OfflineAwareViewButton({
    doctorId,
    doctorName,
    pdfUrl,
    variant = 'outline',
    size = 'sm',
}: OfflineAwareViewButtonProps) {
    const [loading, setLoading] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        // Check online status
        setIsOffline(!navigator.onLine);
        setIsSaved(isAvailableOffline(doctorId));

        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        const handleOfflineUpdate = () => setIsSaved(isAvailableOffline(doctorId));

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('offline-updated', handleOfflineUpdate);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('offline-updated', handleOfflineUpdate);
        };
    }, [doctorId]);

    const handleView = async () => {
        // If online, open normal URL
        if (!isOffline && pdfUrl) {
            window.open(pdfUrl, '_blank');
            return;
        }

        // If offline but not saved
        if (isOffline && !isSaved) {
            toast({
                variant: 'destructive',
                title: 'Not Available Offline',
                description: 'Please download this presentation while online to view it offline.',
            });
            return;
        }

        // If offline and saved, load from IndexedDB
        if (isOffline && isSaved) {
            setLoading(true);
            try {
                const blob = await getPresentationOffline(doctorId);

                if (!blob) {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: 'Could not load offline presentation.',
                    });
                    setLoading(false);
                    return;
                }

                // Create object URL from blob and open in new tab
                const url = URL.createObjectURL(blob);
                const newWindow = window.open(url, '_blank');

                // Clean up the URL after a delay (window might still be loading)
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                }, 10000);

                if (!newWindow) {
                    toast({
                        variant: 'destructive',
                        title: 'Popup Blocked',
                        description: 'Please allow popups to view presentations.',
                    });
                }
            } catch (error) {
                console.error('Error opening offline presentation:', error);
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Failed to open offline presentation.',
                });
            } finally {
                setLoading(false);
            }
        }
    };

    const isDisabled = loading || (!pdfUrl && !isSaved);

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleView}
            disabled={isDisabled}
        >
            {loading ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Eye className="mr-2 h-4 w-4" />
            )}
            View
        </Button>
    );
}
