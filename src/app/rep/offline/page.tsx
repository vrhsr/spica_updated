'use client';

import React, { useEffect, useState } from 'react';
import { listOfflinePresentations, formatBytes } from '@/lib/offline-storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Monitor, HardDrive, ArrowLeft, WifiOff, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useOfflineReady } from '@/hooks/useOfflineReady';

export default function OfflineDashboardPage() {
    const { isReady, isLoading: isDBLoading, error: dbError, retry } = useOfflineReady();
    const [presentations, setPresentations] = useState<Array<{ doctorId: string; doctorName: string; downloadedAt: Date; fileSize: number }>>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Only load presentations once IndexedDB is ready
        if (!isReady) return;

        const load = async () => {
            try {
                const data = await listOfflinePresentations();
                setPresentations(data);
            } catch (error) {
                console.error('[Offline Page] Failed to load presentations:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isReady]);

    const filtered = presentations.filter(p =>
        p.doctorName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
                        <WifiOff className="h-8 w-8 text-muted-foreground" />
                        Offline Mode
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Viewing presentations saved locally on this tablet. No internet required.
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/rep-login">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Login
                    </Link>
                </Button>
            </div>

            <div className="flex items-center gap-2 max-w-md">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search downloaded doctors..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Badge variant="secondary" className="h-10 px-3 py-0 flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    {presentations.length} Saved
                </Badge>
            </div>

            {/* Database Error State */}
            {dbError && (
                <div className="text-center py-20 bg-destructive/5 rounded-xl border-2 border-destructive/20">
                    <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                    <h2 className="mt-4 text-xl font-semibold text-destructive">Storage Error</h2>
                    <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                        Unable to access offline storage. This may be due to private browsing mode or storage restrictions.
                    </p>
                    <Button onClick={retry} variant="outline" className="mt-4">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </div>
            )}

            {/* Loading State */}
            {!dbError && (isDBLoading || loading) ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="animate-pulse">
                            <div className="h-32 bg-muted rounded-t-lg" />
                            <CardContent className="p-4 space-y-2">
                                <div className="h-4 bg-muted w-3/4" />
                                <div className="h-3 bg-muted w-1/2" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filtered.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((p) => (
                        <Card key={p.doctorId} className="group hover:border-primary transition-all">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg">{p.doctorName}</CardTitle>
                                    <Badge variant="outline" className="text-[10px]">
                                        {formatBytes(p.fileSize)}
                                    </Badge>
                                </div>
                                <CardDescription>
                                    Saved on {format(p.downloadedAt, 'MMM d, yyyy')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button asChild className="w-full h-11" variant="default">
                                    <Link href={`/rep/present/view?id=${p.doctorId}`}>
                                        <Monitor className="mr-2 h-4 w-4" />
                                        Present Now
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-muted/30 rounded-xl border-2 border-dashed">
                    <Monitor className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h2 className="mt-4 text-xl font-semibold">No offline presentations found</h2>
                    <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                        {searchTerm
                            ? "No downloads match your search."
                            : "Presentations you save for offline use will appear here for immediate access."}
                    </p>
                </div>
            )}
        </div>
    );
}
