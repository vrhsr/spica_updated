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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Loader,
    MapPin,
    ExternalLink,
    FileQuestion,
    RefreshCcw,
    Download,
    Users,
    CalendarDays,
    Activity,
    TrendingUp,
    X,
} from 'lucide-react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, Timestamp } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { formatDistanceToNow, format, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';

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

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
    label,
    value,
    sub,
    icon: Icon,
    color,
}: {
    label: string;
    value: string | number;
    sub?: string;
    icon: React.ElementType;
    color: string;
}) {
    return (
        <Card className="border rounded-xl overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    <p className="text-2xl font-bold leading-tight">{value}</p>
                    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

// ─── CSV Export ────────────────────────────────────────────────────────────────
function exportToCSV(logs: VisitLog[], fromDate: string, toDate: string) {
    const headers = ['Doctor', 'Representative', 'Date', 'Time', 'Status', 'Latitude', 'Longitude'];
    const rows = logs.map(log => [
        log.doctorName || 'Unknown Doctor',
        log.repName,
        format(log.timestamp.toDate(), 'yyyy-MM-dd'),
        format(log.timestamp.toDate(), 'HH:mm:ss'),
        log.status,
        log.latitude?.toString() ?? '',
        log.longitude?.toString() ?? '',
    ]);
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = fromDate && toDate ? `_${fromDate}_to_${toDate}` : '';
    a.download = `visit_logs${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AdminVisitLogsPage() {
    const firestore = useFirestore();

    // Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [repFilter, setRepFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const logsCollection = useMemoFirebase(
        () => firestore ? collection(firestore, 'visit_logs') : null,
        [firestore]
    );
    const usersCollection = useMemoFirebase(
        () => firestore ? collection(firestore, 'users') : null,
        [firestore]
    );

    const { data: logs, isLoading, forceRefetch, error } = useCollection<VisitLog>(logsCollection);
    const { data: users } = useCollection<{ id: string; role: string; name?: string; displayName?: string }>(usersCollection);

    // Build unique rep list from logs (more reliable than users collection)
    const repList = useMemo(() => {
        if (!logs) return [];
        const map = new Map<string, string>();
        logs.forEach(l => { if (l.repId && l.repName) map.set(l.repId, l.repName); });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [logs]);

    // Filter logs
    const filteredLogs = useMemo(() => {
        if (!logs) return [];
        let result = [...logs].sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());

        // Date range filter
        if (fromDate) {
            const from = startOfDay(parseISO(fromDate));
            result = result.filter(l => l.timestamp.toDate() >= from);
        }
        if (toDate) {
            const to = endOfDay(parseISO(toDate));
            result = result.filter(l => l.timestamp.toDate() <= to);
        }

        // Rep filter
        if (repFilter !== 'all') {
            result = result.filter(l => l.repId === repFilter);
        }

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(l => l.status === statusFilter);
        }

        // Text search (doctor name or rep name)
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(l =>
                (l.doctorName || '').toLowerCase().includes(lower) ||
                l.repName.toLowerCase().includes(lower)
            );
        }

        return result;
    }, [logs, fromDate, toDate, repFilter, statusFilter, searchTerm]);

    // Stats from filtered logs
    const stats = useMemo(() => {
        const visited = filteredLogs.filter(l => l.status === 'VISITED').length;
        const uniqueReps = new Set(filteredLogs.map(l => l.repId)).size;
        const uniqueDoctors = new Set(filteredLogs.map(l => l.doctorId)).size;
        return { total: filteredLogs.length, visited, uniqueReps, uniqueDoctors };
    }, [filteredLogs]);

    // Per-rep breakdown
    const repBreakdown = useMemo(() => {
        const map = new Map<string, { name: string; total: number; visited: number }>();
        filteredLogs.forEach(l => {
            const existing = map.get(l.repId) || { name: l.repName, total: 0, visited: 0 };
            existing.total++;
            if (l.status === 'VISITED') existing.visited++;
            map.set(l.repId, existing);
        });
        return Array.from(map.values()).sort((a, b) => b.total - a.total);
    }, [filteredLogs]);

    const hasFilters = fromDate || toDate || repFilter !== 'all' || statusFilter !== 'all' || searchTerm;

    const clearFilters = () => {
        setFromDate('');
        setToDate('');
        setRepFilter('all');
        setStatusFilter('all');
        setSearchTerm('');
    };

    const openInGoogleMaps = (lat: number, lng: number) =>
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');

    if (error) {
        return (
            <div className="space-y-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Visit Logs</h1>
                <Card className="border-destructive/50">
                    <CardContent className="pt-6 flex flex-col items-center justify-center py-12 text-center">
                        <FileQuestion className="h-12 w-12 text-destructive mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Permission Denied</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Your account does not have permission to view visit logs.
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">{error.message}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-headline text-3xl font-bold tracking-tight">Visit Logs</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Track and export rep activity by date range.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => forceRefetch()}
                        disabled={isLoading}
                    >
                        <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => exportToCSV(filteredLogs, fromDate, toDate)}
                        disabled={filteredLogs.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV ({filteredLogs.length})
                    </Button>
                </div>
            </div>

            {/* ── Filter Bar ── */}
            <Card className="border-2">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary" />
                            Filter by Date &amp; Rep
                        </CardTitle>
                        {hasFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground h-7 px-2">
                                <X className="h-3.5 w-3.5 mr-1" /> Clear all
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                        {/* From date */}
                        <div>
                            <Label htmlFor="from-date" className="text-xs mb-1 block">From Date</Label>
                            <Input
                                id="from-date"
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                max={toDate || undefined}
                            />
                        </div>
                        {/* To date */}
                        <div>
                            <Label htmlFor="to-date" className="text-xs mb-1 block">To Date</Label>
                            <Input
                                id="to-date"
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                min={fromDate || undefined}
                            />
                        </div>
                        {/* Rep filter */}
                        <div>
                            <Label className="text-xs mb-1 block">Representative</Label>
                            <Select value={repFilter} onValueChange={setRepFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Reps" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Representatives</SelectItem>
                                    {repList.map(r => (
                                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Status filter */}
                        <div>
                            <Label className="text-xs mb-1 block">Status</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="VISITED">Visited</SelectItem>
                                    <SelectItem value="NOT_VISITED">Not Visited</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Search */}
                        <div>
                            <Label className="text-xs mb-1 block">Search</Label>
                            <Input
                                placeholder="Doctor or rep name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    {/* Active filter summary */}
                    {hasFilters && (
                        <p className="text-xs text-muted-foreground mt-3">
                            Showing <strong>{filteredLogs.length}</strong> of <strong>{logs?.length ?? 0}</strong> records
                            {fromDate && ` · From ${format(parseISO(fromDate), 'dd MMM yyyy')}`}
                            {toDate && ` · To ${format(parseISO(toDate), 'dd MMM yyyy')}`}
                            {repFilter !== 'all' && ` · Rep: ${repList.find(r => r.id === repFilter)?.name}`}
                            {statusFilter !== 'all' && ` · Status: ${statusFilter}`}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ── Stats Row ── */}
            {!isLoading && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Total Visits" value={stats.total} icon={Activity} color="bg-primary" sub={hasFilters ? 'in filtered range' : 'all time'} />
                    <StatCard label="Successful Visits" value={stats.visited} icon={TrendingUp} color="bg-green-500" sub={stats.total > 0 ? `${Math.round((stats.visited / stats.total) * 100)}% success rate` : undefined} />
                    <StatCard label="Active Reps" value={stats.uniqueReps} icon={Users} color="bg-violet-500" sub="in this view" />
                    <StatCard label="Doctors Visited" value={stats.uniqueDoctors} icon={CalendarDays} color="bg-amber-500" sub="unique doctors" />
                </div>
            )}

            {/* ── Per-Rep Breakdown ── */}
            {repBreakdown.length > 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Rep Performance Summary</CardTitle>
                        <CardDescription>Breakdown of visits per representative in the selected period.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {repBreakdown.map(rep => (
                                <div key={rep.name} className="flex items-center gap-3">
                                    <p className="w-40 text-sm font-medium truncate">{rep.name}</p>
                                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-primary h-full rounded-full transition-all"
                                            style={{ width: `${repBreakdown[0].total > 0 ? (rep.total / repBreakdown[0].total) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-muted-foreground w-24 text-right">
                                        {rep.visited}/{rep.total} visits
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Main Table ── */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Activity Log</CardTitle>
                    <CardDescription>
                        Detailed log of every presentation session. Click &quot;View Map&quot; to see the visit location.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex h-64 items-center justify-center">
                            <Loader className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-4 text-muted-foreground">Loading visit logs...</p>
                        </div>
                    ) : filteredLogs.length > 0 ? (
                        <div className="space-y-4">
                            {/* Desktop Table View */}
                            <div className="hidden lg:block overflow-x-auto bg-card rounded-xl border shadow-sm">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Doctor</TableHead>
                                            <TableHead>Representative</TableHead>
                                            <TableHead>Date &amp; Time</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLogs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="font-medium">
                                                    {log.doctorName || 'Unknown Doctor'}
                                                    <p className="text-[10px] text-muted-foreground font-normal">ID: {log.doctorId}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium">{log.repName}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{format(log.timestamp.toDate(), 'dd MMM yyyy')}</span>
                                                        <span className="text-xs text-muted-foreground">{format(log.timestamp.toDate(), 'hh:mm a')}</span>
                                                        <span className="text-[10px] text-muted-foreground mt-0.5">
                                                            {formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={log.status === 'VISITED' ? 'default' : 'secondary'}
                                                        className={log.status === 'VISITED'
                                                            ? 'bg-green-100 text-green-800 border-green-200'
                                                            : 'bg-gray-100 text-gray-600'}
                                                    >
                                                        {log.status === 'VISITED' ? 'Visited' : 'Not Visited'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {log.latitude && log.longitude ? (
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                                                            <span>{log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">No location</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {log.latitude && log.longitude && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openInGoogleMaps(log.latitude!, log.longitude!)}
                                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        >
                                                            <ExternalLink className="h-4 w-4 mr-1.5" />
                                                            Map
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="lg:hidden grid gap-3 grid-cols-1 sm:grid-cols-2">
                                {filteredLogs.map(log => (
                                    <Card key={log.id} className="overflow-hidden border rounded-xl shadow-sm">
                                        <CardContent className="p-0 flex flex-col h-full">
                                            <div className="bg-muted/10 p-3 border-b flex items-start justify-between gap-3 border-primary/5">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-headline text-[1.05rem] font-bold text-primary truncate leading-tight">
                                                        {log.doctorName || 'Unknown Doctor'}
                                                    </p>
                                                    <div className="flex items-center text-xs text-muted-foreground mt-1 gap-1 flex-wrap">
                                                        <span className="font-medium bg-primary/5 text-primary/80 px-1.5 py-0.5 rounded flex items-center">
                                                            <Users className="w-3 h-3 mr-1" />
                                                            {log.repName}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="shrink-0">
                                                    <Badge
                                                        variant={log.status === 'VISITED' ? 'default' : 'secondary'}
                                                        className={log.status === 'VISITED'
                                                            ? 'bg-green-100 text-green-800 border-green-200 text-[10px] uppercase tracking-widest'
                                                            : 'bg-gray-100 text-gray-600 text-[10px] uppercase tracking-widest'}
                                                    >
                                                        {log.status === 'VISITED' ? 'Visited' : 'Not Visited'}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="p-3 grid gap-2 mt-auto">
                                                <div className="flex justify-between items-center bg-muted/30 p-2 rounded-md mb-1 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarDays className="h-4 w-4 text-primary/70" />
                                                        <div>
                                                            <div className="font-medium text-foreground">{format(log.timestamp.toDate(), 'dd MMM yyyy, hh:mm a')}</div>
                                                            <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true })}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex justify-between items-center px-1">
                                                    <div className="flex-1">
                                                        {log.latitude && log.longitude ? (
                                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                                                                <span>{log.latitude.toFixed(3)}, {log.longitude.toFixed(3)}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic flex items-center gap-1"><MapPin className="h-3 w-3 opacity-50" /> No location saved</span>
                                                        )}
                                                    </div>
                                                    
                                                    {log.latitude && log.longitude && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openInGoogleMaps(log.latitude!, log.longitude!)}
                                                            className="text-xs h-7 px-2 text-blue-700 border-blue-200 hover:bg-blue-50"
                                                        >
                                                            <ExternalLink className="h-3 w-3 mr-1" /> Map
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                            <FileQuestion className="h-12 w-12 text-muted-foreground/50 mb-4" />
                            <h3 className="text-lg font-semibold">
                                {hasFilters ? 'No Results Found' : 'No Visit Logs Yet'}
                            </h3>
                            <p className="text-sm mt-1">
                                {hasFilters
                                    ? 'Try adjusting your date range or filters.'
                                    : 'Visit logs will appear here after representatives complete presentations.'}
                            </p>
                            {hasFilters && (
                                <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                                    <X className="mr-2 h-4 w-4" /> Clear Filters
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
