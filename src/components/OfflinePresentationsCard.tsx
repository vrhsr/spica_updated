'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, HardDrive, Trash2, Loader, ArrowRight } from 'lucide-react';
import { listOfflinePresentations, getStorageEstimate, formatBytes } from '@/lib/offline-storage';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

export function OfflinePresentationsCard() {
    const [offlineCount, setOfflineCount] = useState(0);
    const [storageUsed, setStorageUsed] = useState(0);
    const [storageQuota, setStorageQuota] = useState(100 * 1024 * 1024);
    const [loading, setLoading] = useState(true);

    const loadOfflineData = async () => {
        try {
            const presentations = await listOfflinePresentations();
            const estimate = await getStorageEstimate();
            setOfflineCount(presentations.length);
            setStorageUsed(estimate.usage);
            setStorageQuota(estimate.quota);
        } catch (error) {
            console.error('Error loading offline data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOfflineData();

        // Listen for offline updates
        const handleOfflineUpdate = () => loadOfflineData();
        window.addEventListener('offline-updated', handleOfflineUpdate);

        return () => window.removeEventListener('offline-updated', handleOfflineUpdate);
    }, []);

    const storagePercentage = Math.min((storageUsed / storageQuota) * 100, 100);

    return (
        <Card className="relative overflow-hidden border rounded-lg transition-all duration-200 hover:border-accent hover:bg-accent/5 hover:shadow-md">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <Download className="h-4 w-4" />
                            Offline Presentations
                        </CardTitle>
                    </div>
                    <HardDrive className="h-5 w-5 text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                ) : (
                    <>
                        {/* Count Display */}
                        <div className="text-3xl font-bold">
                            {offlineCount}
                        </div>

                        {/* Storage Usage */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Storage Used</span>
                                <span className="font-medium">
                                    {formatBytes(storageUsed)} / {formatBytes(storageQuota)}
                                </span>
                            </div>
                            <Progress value={storagePercentage} className="h-1.5" />
                            <p className="text-[10px] text-muted-foreground/60">
                                *Space allocated by system for this app
                            </p>
                        </div>

                        {/* Action Button */}
                        <Button asChild variant="outline" className="w-full">
                            <Link href="/rep/doctors">
                                Manage Downloads
                            </Link>
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
