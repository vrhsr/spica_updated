'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader, Search, FileQuestion, Monitor, MapPin, Clock, RefreshCw } from 'lucide-react';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { OfflineBadge } from '@/components/OfflineBadge';
import { SaveOfflineButton } from '@/components/SaveOfflineButton';
import { OfflineAwareViewButton } from '@/components/OfflineAwareViewButton';
import { BulkDownloadButton } from '@/components/BulkDownloadButton';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { checkForUpdates, SyncResultMap } from '@/lib/sync-engine';
import { isAvailableOffline } from '@/lib/offline-storage';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, doc } from 'firebase/firestore';

type Presentation = {
  id: string;
  doctorId: string;
  city: string;
  pdfUrl?: string;
  updatedAt: Timestamp;
  dirty: boolean;
  error?: string;
};

type Doctor = {
  id: string;
  name: string;
  city: string;      // district name
  subCity?: string;  // actual city within district
};

type UserProfile = {
  city: string;
}

type EnrichedPresentation = Presentation & {
  doctorName?: string;
  doctorSubCity?: string; // actual city of the doctor
};

export default function RepDoctorsPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncResultMap>(new Map());

  const userProfileRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user?.uid]
  );

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userProfileRef);

  const repCity = userProfile?.city?.trim().toUpperCase();

  const presentationsQuery = useMemoFirebase(() => {
    if (!firestore || !repCity) return null;
    return query(
      collection(firestore, 'presentations'),
      where('city', '==', repCity)
    );
  }, [firestore, repCity]);

  const doctorsQuery = useMemoFirebase(() => {
    if (!firestore || !repCity) return null;
    return query(
      collection(firestore, 'doctors'),
      where('city', '==', repCity)
    );
  }, [firestore, repCity]);

  const { data: presentations, isLoading: isLoadingPresentations, error: presentationsError } = useCollection<Presentation>(presentationsQuery);
  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsQuery);

  const isLoading = isAuthLoading || isLoadingProfile || isLoadingPresentations || isLoadingDoctors;

  const doctorsMap = useMemo(() => {
    if (!doctors) return new Map<string, { name: string; subCity?: string }>();
    return new Map(doctors.map(doc => [doc.id, { name: doc.name, subCity: doc.subCity }]));
  }, [doctors]);

  const enrichedPresentations = useMemo((): EnrichedPresentation[] => {
    if (!presentations) return [];
    const enriched = presentations
      .map(p => ({
        ...p,
        doctorName: doctorsMap.get(p.doctorId)?.name || 'Unknown Doctor',
        doctorSubCity: doctorsMap.get(p.doctorId)?.subCity,
      }))
      .sort((a, b) => b.updatedAt.toDate().getTime() - a.updatedAt.toDate().getTime());

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      return enriched.filter(p =>
        p.doctorName.toLowerCase().includes(lower) ||
        (p.doctorSubCity && p.doctorSubCity.toLowerCase().includes(lower))
      );
    }
    return enriched;

  }, [presentations, doctorsMap, searchTerm]);

  // Check for updates whenever presentations list changes
  useEffect(() => {
    const checkSync = async () => {
      if (enrichedPresentations.length > 0) {
        const validPresentations = enrichedPresentations.map(p => ({
          doctorId: p.doctorId,
          updatedAt: p.updatedAt,
          id: p.id
        }));
        const results = await checkForUpdates(validPresentations);
        setSyncStatus(results);
      }
    };
    checkSync();
  }, [enrichedPresentations]);

  const outdatedCount = useMemo(() => {
    return Array.from(syncStatus.values()).filter(r => r.status === 'OUTDATED').length;
  }, [syncStatus]);

  const getStatusBadge = (presentation: EnrichedPresentation) => {
    if (presentation.error) {
      return <Badge variant="destructive" title={presentation.error}>Failed</Badge>;
    }

    const sync = syncStatus.get(presentation.doctorId);
    if (sync?.status === 'OUTDATED') {
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Update Available</Badge>;
    }

    if (presentation.dirty) {
      return <Badge variant="secondary">Pending Update</Badge>;
    }
    if (presentation.pdfUrl) {
      return <Badge className="bg-green-100 text-green-800">Ready</Badge>;
    }
    return <Badge variant="outline">Not Generated</Badge>;
  }

  const handlePresentClick = (e: React.MouseEvent, doctorId: string, doctorName: string) => {
    e.preventDefault();
    if (isAvailableOffline(doctorId)) {
      router.push(`/rep/present/view?id=${doctorId}`);
    } else {
      toast({
        variant: "destructive",
        title: "Not Saved Offline",
        description: `Please save ${doctorName}'s presentation offline before presenting.`,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
        <p className="ml-4 text-muted-foreground">Loading presentations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 md:pb-32">
      <OfflineIndicator />

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">
              Doctor Presentations
            </h1>
            {repCity && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                District: <span className="font-semibold text-primary">{repCity}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SyncStatusIndicator outdatedCount={outdatedCount} />
            {doctors && enrichedPresentations && (
              <BulkDownloadButton
                presentations={enrichedPresentations}
                doctors={doctors}
                syncStatus={syncStatus}
              />
            )}
          </div>
        </div>

        {/* Search - full width */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by doctor name or city..."
            className="pl-9 h-11 text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {presentationsError ? (
        <Card className="border-destructive/50">
          <CardContent className="py-8 text-center text-destructive">
            Failed to load presentations. This may be a security rule issue.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table — only shown on large screens (≥1024px) */}
          <div className="hidden lg:block overflow-x-auto bg-card rounded-xl border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedPresentations.length > 0 ? (
                  enrichedPresentations.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.doctorName}</TableCell>
                      <TableCell>
                        {p.doctorSubCity ? (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            {p.doctorSubCity}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.updatedAt ? (
                          <span title={format(p.updatedAt.toDate(), 'PPP p')}>
                            {formatDistanceToNow(p.updatedAt.toDate(), { addSuffix: true })}
                          </span>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          {getStatusBadge(p)}
                          <OfflineBadge doctorId={p.doctorId} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <SaveOfflineButton
                          doctorId={p.doctorId}
                          pdfUrl={p.pdfUrl || ''}
                          doctorName={p.doctorName || 'Unknown'}
                        />
                        <OfflineAwareViewButton
                          doctorId={p.doctorId}
                          doctorName={p.doctorName || 'Unknown'}
                          pdfUrl={p.pdfUrl}
                        />
                        <Button
                          variant="default"
                          size="sm"
                          className="h-9"
                          onClick={(e) => handlePresentClick(e, p.doctorId, p.doctorName || 'Doctor')}
                        >
                          <Monitor className="mr-2 h-4 w-4" />
                          Present
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                      {searchTerm ? 'No doctors match your search.' : 'No presentations assigned to your district.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile + Tablet Card Grid — shown below 1024px */}
          <div className="lg:hidden grid gap-3 grid-cols-1 sm:grid-cols-2">
            {enrichedPresentations.length > 0 ? (
              enrichedPresentations.map((p) => (
                <Card key={p.id} className="overflow-hidden border rounded-xl shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99]">
                  <CardContent className="p-0">
                    {/* Card Header */}
                    <div className="p-4 pb-3 border-b bg-muted/10">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-headline text-base sm:text-lg font-bold text-foreground leading-tight truncate">
                            {p.doctorName}
                          </h3>
                          {p.doctorSubCity && (
                            <span className="inline-flex items-center text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium mt-1.5">
                              <MapPin className="mr-1 h-2.5 w-2.5" />{p.doctorSubCity}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                            <Clock className="h-3 w-3 shrink-0" />
                            {p.updatedAt
                              ? formatDistanceToNow(p.updatedAt.toDate(), { addSuffix: true })
                              : 'Not updated'}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {getStatusBadge(p)}
                          <OfflineBadge doctorId={p.doctorId} />
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <SaveOfflineButton
                          doctorId={p.doctorId}
                          pdfUrl={p.pdfUrl || ''}
                          doctorName={p.doctorName || 'Unknown'}
                        />
                        <OfflineAwareViewButton
                          doctorId={p.doctorId}
                          doctorName={p.doctorName || 'Unknown'}
                          pdfUrl={p.pdfUrl}
                        />
                      </div>
                      <Button
                        variant="default"
                        className="w-full h-12 text-base font-semibold rounded-lg"
                        onClick={(e) => handlePresentClick(e, p.doctorId, p.doctorName || 'Doctor')}
                      >
                        <Monitor className="mr-2 h-5 w-5" />
                        Start Presentation
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-16 text-center">
                <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-semibold text-muted-foreground">
                  {searchTerm ? 'No results found' : 'No Presentations Found'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchTerm
                    ? 'Try a different search term.'
                    : 'No presentations are currently assigned for your district.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
