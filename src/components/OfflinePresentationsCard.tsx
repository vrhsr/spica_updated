'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, HardDrive, Trash2 } from 'lucide-react';
import { listOfflinePresentations, getStorageUsage, formatBytes } from '@/lib/offline-storage';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

const STORAGE_LIMIT = 100 * 1024 * 1024; // 100MB estimated limit

export function OfflinePresentationsCard() {
    const [offlineCount, setOfflineCount] = useState(0);
    const [storageUsed, setStorageUsed] = useState(0);
    const [loading, setLoading] = useState(true);

    const loadOfflineData = async () => {
        try {
            const presentations = await listOfflinePresentations();
            const usage = await getStorageUsage();
            setOfflineCount(presentations.length);
            setStorageUsed(usage);
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

    const storagePercentage = Math.min((storageUsed / STORAGE_LIMIT) * 100, 100);

    return (
        <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5 text-blue-500" />
                            Offline Presentations
                        </CardTitle>
                        <CardDescription>Ready for offline viewing</CardDescription>
                    </div>
                    <HardDrive className="h-8 w-8 text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                    <>
                        {/* Count Display */}
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold">{offlineCount}</span>
                            <span className="text-muted-foreground">saved</span>
                        </div>

                        {/* Storage Usage */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Storage Used</span>
                                <span className="font-medium">
                                    {formatBytes(storageUsed)} / {formatBytes(STORAGE_LIMIT)}
                                </span>
                            </div>
                            <Progress value={storagePercentage} className="h-2" />
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
