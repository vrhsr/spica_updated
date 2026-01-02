'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Wifi, WifiOff, RefreshCw, Database, HardDrive, Shield } from 'lucide-react';
import { checkStorageQuota, isPersistentStorage, requestPersistentStorage, getStorageStatus, type StorageQuotaInfo } from '@/lib/storage-quota';

export function PWADebugger() {
    const [isVisible, setIsVisible] = useState(false);
    const [swStatus, setSwStatus] = useState<string>('Checking...');
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [cacheKeys, setCacheKeys] = useState<string[]>([]);
    const [controllerState, setControllerState] = useState<string>('None');
    const [storageInfo, setStorageInfo] = useState<StorageQuotaInfo | null>(null);
    const [isPersistent, setIsPersistent] = useState<boolean>(false);
    const [connectionType, setConnectionType] = useState<string>('Unknown');

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

        // Check Storage Quota
        const quota = await checkStorageQuota();
        setStorageInfo(quota);

        // Check Persistent Storage
        const persistent = await isPersistentStorage();
        setIsPersistent(persistent);

        // Check Connection Type
        const connection = (navigator as any).connection;
        if (connection) {
            setConnectionType(connection.effectiveType || 'Unknown');
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

                {/* Storage Quota */}
                {storageInfo && (
                    <div className="space-y-1">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-muted-foreground">Storage Used:</span>
                            <Badge
                                variant={getStorageStatus(storageInfo.percentUsed) === 'critical' ? 'destructive' :
                                    getStorageStatus(storageInfo.percentUsed) === 'warning' ? 'secondary' : 'outline'}
                            >
                                <HardDrive className="h-3 w-3 mr-1" />
                                {storageInfo.percentUsed.toFixed(1)}%
                            </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground space-y-0.5">
                            <div>Used: {storageInfo.usageFormatted}</div>
                            <div>Total: {storageInfo.quotaFormatted}</div>
                        </div>
                    </div>
                )}

                {/* Persistent Storage */}
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Persistent:</span>
                    {isPersistent ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <Shield className="h-3 w-3 mr-1" /> Enabled
                        </Badge>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={async () => {
                                const granted = await requestPersistentStorage();
                                setIsPersistent(granted);
                            }}
                        >
                            Enable
                        </Button>
                    )}
                </div>

                {/* Connection Type */}
                {connectionType !== 'Unknown' && (
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Connection:</span>
                        <span className="font-mono text-xs font-medium">{connectionType.toUpperCase()}</span>
                    </div>
                )}

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
