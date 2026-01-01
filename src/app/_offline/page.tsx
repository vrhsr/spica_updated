'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflineFallback() {
    const router = useRouter();
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        const checkOnline = () => {
            setIsOnline(navigator.onLine);
            if (navigator.onLine) {
                // If back online, try to navigate
                router.push('/rep/offline');
            }
        };

        checkOnline();
        window.addEventListener('online', checkOnline);
        window.addEventListener('offline', checkOnline);

        return () => {
            window.removeEventListener('online', checkOnline);
            window.removeEventListener('offline', checkOnline);
        };
    }, [router]);

    const handleRetry = () => {
        if (navigator.onLine) {
            router.push('/rep/offline');
        } else {
            window.location.reload();
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <div className="text-center space-y-6 max-w-md">
                <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                    <WifiOff className="h-10 w-10 text-muted-foreground" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">You're Offline</h1>
                    <p className="text-muted-foreground">
                        {isOnline
                            ? "Connection restored! Click below to continue."
                            : "No internet connection detected. The app is trying to load your offline content."}
                    </p>
                </div>

                <div className="space-y-3">
                    <Button
                        onClick={handleRetry}
                        className="w-full"
                        variant={isOnline ? "default" : "outline"}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {isOnline ? "Continue" : "Retry"}
                    </Button>

                    {!isOnline && (
                        <p className="text-xs text-muted-foreground">
                            If you have downloaded presentations, they should be accessible even without internet.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
