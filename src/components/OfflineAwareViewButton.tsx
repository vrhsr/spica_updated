'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { isAvailableOffline } from '@/lib/offline-storage';
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
    const [isOffline, setIsOffline] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

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

    const handleView = () => {
        // Always view in-app via our own /rep/pdf/viewer — a scrollable,
        // all-slides document view (as opposed to the fullscreen one-slide
        // "Present" mode). IMPORTANT: never window.open() the raw pdfUrl —
        // it points at Cloudflare R2, a different origin than spicasg.in,
        // and the Android app's WebView (capacitor.config.json
        // allowNavigation only allows *spicasg.in*) silently blocks
        // navigation there, leaving a blank screen with no error. A plain
        // window.open() also isn't reliable in a Capacitor WebView at all
        // (no popup-window handling), which is why the offline/blob path
        // below routes in-app too instead of opening the blob URL in a
        // "new tab".
        if (!isOffline && pdfUrl) {
            router.push(`/rep/pdf/viewer?url=${encodeURIComponent(pdfUrl)}&name=${encodeURIComponent(doctorName)}`);
            return;
        }

        if (isOffline && !isSaved) {
            toast({
                variant: 'destructive',
                title: 'Not Available Offline',
                description: 'Please download this presentation while online to view it offline.',
            });
            return;
        }

        if (isOffline && isSaved) {
            router.push(`/rep/pdf/viewer?doctorId=${encodeURIComponent(doctorId)}&name=${encodeURIComponent(doctorName)}`);
        }
    };

    const isDisabled = !pdfUrl && !isSaved;

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleView}
            disabled={isDisabled}
        >
            <Eye className="mr-2 h-4 w-4" />
            View
        </Button>
    );
}
