'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { resetDB } from '@/lib/indexeddb-utils';
import { useToast } from '@/hooks/use-toast';

interface IndexedDBErrorProps {
    error: Error;
    onRetry?: () => void;
}

/**
 * User-friendly error display for IndexedDB issues
 * Provides actionable steps for users to resolve the problem
 */
export function IndexedDBError({ error, onRetry }: IndexedDBErrorProps) {
    const { toast } = useToast();
    const [isResetting, setIsResetting] = React.useState(false);

    const handleReset = async () => {
        setIsResetting(true);

        try {
            await resetDB();
            const success = true;

            if (success) {
                toast({
                    title: 'Database Reset',
                    description: 'Storage has been cleared. Please refresh the page.',
                });

                // Wait a moment then reload
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                toast({
                    title: 'Reset Failed',
                    description: 'Please try the manual steps below.',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Error resetting database:', err);
            toast({
                title: 'Reset Failed',
                description: 'Please try the manual steps below.',
                variant: 'destructive',
            });
        } finally {
            setIsResetting(false);
        }
    };

    // Extract error details
    const errorMessage = error?.message || 'Unknown error';
    const isPrivateModeError = errorMessage.includes('Private') || errorMessage.includes('Incognito');
    const isBackingStoreError = errorMessage.includes('backing store');
    const isQuotaError = errorMessage.includes('quota');

    return (
        <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
                <div className="flex items-start gap-3">
                    <div className="mt-1">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base text-destructive">
                            Storage Unavailable
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            {errorMessage}
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Specific solutions based on error type */}
                {isPrivateModeError && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <p className="text-sm font-medium text-amber-900 mb-2">
                            Private/Incognito Mode Detected
                        </p>
                        <p className="text-xs text-amber-800">
                            Offline storage is not available in Private/Incognito mode. Please use a regular browser window.
                        </p>
                    </div>
                )}

                {isBackingStoreError && !isPrivateModeError && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Try these solutions:</p>
                        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                            <li>Close other tabs with this site open</li>
                            <li>Clear browser cache and reload</li>
                            <li>Restart your browser</li>
                            <li>Check if storage is enabled in browser settings</li>
                        </ol>
                    </div>
                )}

                {isQuotaError && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <p className="text-sm font-medium text-amber-900 mb-2">
                            Storage Quota Exceeded
                        </p>
                        <p className="text-xs text-amber-800">
                            Your device is out of storage space. Please delete old presentations or free up disk space.
                        </p>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                    {onRetry && (
                        <Button onClick={onRetry} variant="outline" size="sm">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Try Again
                        </Button>
                    )}

                    {!isPrivateModeError && (
                        <Button
                            onClick={handleReset}
                            variant="destructive"
                            size="sm"
                            disabled={isResetting}
                        >
                            {isResetting ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Resetting...
                                </>
                            ) : (
                                <>
                                    <Settings className="mr-2 h-4 w-4" />
                                    Reset Storage
                                </>
                            )}
                        </Button>
                    )}

                    <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                        size="sm"
                    >
                        Reload Page
                    </Button>
                </div>

                {/* Manual instructions */}
                <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                        Manual Fix Instructions
                    </summary>
                    <div className="mt-2 space-y-2 text-muted-foreground pl-4">
                        <p className="font-medium">To manually clear site data:</p>
                        <ol className="list-decimal list-inside space-y-1">
                            <li>Open Chrome DevTools (F12)</li>
                            <li>Go to Application tab</li>
                            <li>Click "Clear site data" in Storage section</li>
                            <li>Reload the page</li>
                        </ol>
                        <p className="mt-3 font-medium">Or via Chrome Settings:</p>
                        <ol className="list-decimal list-inside space-y-1">
                            <li>Go to Settings → Privacy → Site Settings</li>
                            <li>Search for this website</li>
                            <li>Click "Clear & reset"</li>
                            <li>Reload the page</li>
                        </ol>
                    </div>
                </details>

                {/* Debug info - only in dev mode */}
                {process.env.NODE_ENV === 'development' && (
                    <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-semibold">
                            Debug Information
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-auto max-h-32">
                            {JSON.stringify({
                                errorName: error?.name,
                                errorMessage: error?.message,
                                userAgent: navigator.userAgent,
                                indexedDBSupport: 'indexedDB' in window,
                                storageSupport: 'storage' in navigator,
                            }, null, 2)}
                        </pre>
                    </details>
                )}
            </CardContent>
        </Card>
    );
}
