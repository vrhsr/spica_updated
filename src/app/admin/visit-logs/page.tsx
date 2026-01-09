'use client';

import React, { useMemo, useState } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader, MapPin, ExternalLink, FileQuestion, Calendar, RefreshCcw } from 'lucide-react';
import { useCollection, WithId } from '@/firebase/firestore/use-collection';
import { collection, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

type VisitLog = {
    id: string;
    doctorId: string;
    doctorName?: string;
    repId: string;
    repName: string;
    status: 'VISITED' | 'NOT_VISITED';
    timestamp: Timestamp;
    createdAt: Timestamp;
    latitude?: number;
    longitude?: number;
};

export default function AdminVisitLogsPage() {
    const firestore = useFirestore();
    const logsCollection = useMemo(() => firestore ? collection(firestore, 'visit_logs') : null, [firestore]);

    const { data: logs, isLoading, forceRefetch, error } = useCollection<VisitLog>(logsCollection);

    const sortedLogs = useMemo(() => {
        if (!logs) return [];
        return [...logs].sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());
    }, [logs]);

    const openInGoogleMaps = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    };

    // Handle permission errors
    if (error) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Visit Logs
                    </h1>
                </div>
                <Card className="shadow-sm border-destructive/50">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <FileQuestion className="h-12 w-12 text-destructive mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Permission Denied</h3>
                            <p className="text-sm text-muted-foreground max-w-md">
                                You don't have permission to view visit logs. Please ensure your account has the proper admin role assigned.
                            </p>
                            <p className="text-xs text-muted-foreground mt-4">
                                Error: {error.message || 'Insufficient permissions'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Visit Logs
                    </h1>
                    <p className="text-muted-foreground">
                        Track representative activity and captured location data.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-2 hover:border-primary/50 transition-all"
                    onClick={() => forceRefetch()}
                    disabled={isLoading}
                >
                    <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Activity History</CardTitle>
                    <CardDescription>
                        Logs are automatically uploaded after each presentation.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex h-64 items-center justify-center">
                            <Loader className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-4 text-muted-foreground">Loading visit logs...</p>
                        </div>
                    ) : sortedLogs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Doctor</TableHead>
                                        <TableHead>Representative</TableHead>
                                        <TableHead>Date & Time</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-medium">
                                                {log.doctorName || 'Unknown Doctor'}
                                                <p className="text-[10px] text-muted-foreground font-normal">ID: {log.doctorId}</p>
                                            </TableCell>
                                            <TableCell>{log.repName}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{format(log.timestamp.toDate(), 'PP')}</span>
                                                    <span className="text-xs text-muted-foreground">{format(log.timestamp.toDate(), 'pp')}</span>
                                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                                        {formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true })}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={log.status === 'VISITED' ? 'default' : 'secondary'} className="bg-green-100 text-green-800 border-green-200">
                                                    {log.status === 'VISITED' ? 'Visited' : 'Not Visited'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {log.latitude && log.longitude ? (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <MapPin className="h-3 w-3 text-primary" />
                                                        <span>{log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">No location captured</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {log.latitude && log.longitude && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openInGoogleMaps(log.latitude!, log.longitude!)}
                                                        title="View on Google Maps"
                                                    >
                                                        <ExternalLink className="h-4 w-4 mr-2" />
                                                        View Map
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold">No Visit Logs Yet</h3>
                            <p className="mt-1 text-sm">Location data will appear here once representatives complete presentations.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
