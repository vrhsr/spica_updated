'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Service Worker Update Notification Component
 * Handles PWA update notifications and allows users to control when updates are applied
 */
export function UpdateNotification() {
    const [showUpdate, setShowUpdate] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            // Check for updates every 30 minutes
            const checkForUpdates = async () => {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg) {
                    reg.update().catch(err => {
                        console.error('Error checking for updates:', err);
                    });
                }
            };

            // Initial check
            checkForUpdates();

            // Periodic checks
            const interval = setInterval(checkForUpdates, 30 * 60 * 1000);

            // Listen for new service worker installations
            navigator.serviceWorker.ready.then(reg => {
                setRegistration(reg);

                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;

                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New version available!
                                setShowUpdate(true);

                                // Show toast notification
                                toast({
                                    title: "Update Available",
                                    description: "A new version of the app is available. Click to update.",
                                    duration: Infinity, // Don't auto-dismiss
                                });
                            }
                        });
                    }
                });
            });

            return () => {
                clearInterval(interval);
            };
        }
    }, [toast]);

    const handleUpdate = async () => {
        if (!registration || !registration.waiting) {
            return;
        }

        setIsUpdating(true);

        // Tell the waiting service worker to activate
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });

        // Listen for the controller change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // Reload the page to see the new version
            window.location.reload();
        });
    };

    const handleDismiss = () => {
        setShowUpdate(false);
        toast({
            title: "Update Postponed",
            description: "You'll be reminded about the update later.",
        });
    };

    if (!showUpdate) {
        return null;
    }

    return (
        <div className="fixed bottom-20 right-4 z-50 max-w-md">
            <Card className="border-primary shadow-lg">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Download className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Update Available</CardTitle>
                                <CardDescription className="text-xs">
                                    New features and improvements
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant="secondary" className="ml-2">
                            New
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        A new version of the app is ready. Update now for the latest features and bug fixes.
                    </p>

                    <div className="flex gap-2">
                        <Button
                            onClick={handleUpdate}
                            disabled={isUpdating}
                            className="flex-1"
                            size="sm"
                        >
                            {isUpdating ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Update Now
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={handleDismiss}
                            variant="outline"
                            size="sm"
                            disabled={isUpdating}
                        >
                            Later
                        </Button>
                    </div>

                    <p className="text-[10px] text-muted-foreground text-center">
                        The app will refresh automatically after updating
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
