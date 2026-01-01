'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Wifi, WifiOff, RefreshCw, Database } from 'lucide-react';

export function PWADebugger() {
    const [isVisible, setIsVisible] = useState(false);
    const [swStatus, setSwStatus] = useState<string>('Checking...');
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [cacheKeys, setCacheKeys] = useState<string[]>([]);
    const [controllerState, setControllerState] = useState<string>('None');

    const checkStatus = async () => {
        // Check Online Status
        setIsOnline(navigator.onLine);

        // Check Service Worker
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
                setSwStatus(reg.active ? 'Active' : reg.installing ? 'Installing' : 'Waiting');
            } else {
                setSwStatus('Not Registered');
            }

            setControllerState(navigator.serviceWorker.controller ? 'Controlled' : 'No Controller');
        } else {
            setSwStatus('Not Supported');
        }

        // Check Caches
        if ('caches' in window) {
            const keys = await caches.keys();
            setCacheKeys(keys);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 2000); // Poll every 2s

        window.addEventListener('online', checkStatus);
        window.addEventListener('offline', checkStatus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', checkStatus);
            window.removeEventListener('offline', checkStatus);
        };
    }, []);

    // Hidden toggle (Triple click bottom right corner or something? For now just a small fixed button)
    if (!isVisible) {
        return (
            <Button
                variant="destructive"
                size="sm"
                className="fixed bottom-4 right-4 z-50 opacity-50 hover:opacity-100 text-xs"
                onClick={() => setIsVisible(true)}
            >
                Debug PWA
            </Button>
        );
    }

    return (
        <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-2xl border-red-200 bg-white/95 backdrop-blur">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 bg-red-50/50">
                <CardTitle className="text-sm font-bold text-red-900 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    PWA Diagnostics
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsVisible(false)}>
                    <X className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
                {/* Network Status */}
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Network:</span>
                    {isOnline ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <Wifi className="h-3 w-3 mr-1" /> Online
                        </Badge>
                    ) : (
                        <Badge variant="destructive">
                            <WifiOff className="h-3 w-3 mr-1" /> Offline
                        </Badge>
                    )}
                </div>

                {/* SW Status */}
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Service Worker:</span>
                    <span className={`font-mono font-medium ${swStatus === 'Active' ? 'text-green-600' : 'text-red-500'}`}>
                        {swStatus}
                    </span>
                </div>

                {/* Controller Status */}
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Page Controller:</span>
                    <span className={`font-mono font-medium ${controllerState === 'Controlled' ? 'text-green-600' : 'text-amber-600'}`}>
                        {controllerState}
                    </span>
                </div>

                {/* Cache Storage */}
                <div className="space-y-1">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-muted-foreground">Caches Found:</span>
                        <Badge variant="secondary">{cacheKeys.length}</Badge>
                    </div>
                    <div className="max-h-20 overflow-y-auto bg-muted/50 p-2 rounded border">
                        {cacheKeys.length > 0 ? (
                            cacheKeys.map(key => (
                                <div key={key} className="truncate text-[10px] text-muted-foreground font-mono">
                                    • {key}
                                </div>
                            ))
                        ) : (
                            <div className="text-red-500 italic">No caches found!</div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => window.location.reload()}
                    >
                        <RefreshCw className="h-3 w-3 mr-1" /> Reload Page
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={async () => {
                            if (window.confirm('Unregister SW and clear caches?')) {
                                const reg = await navigator.serviceWorker.getRegistration();
                                await reg?.unregister();
                                const keys = await caches.keys();
                                await Promise.all(keys.map(k => caches.delete(k)));
                                window.location.reload();
                            }
                        }}
                    >
                        Reset PWA
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
