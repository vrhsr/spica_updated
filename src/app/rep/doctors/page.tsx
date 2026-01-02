'use client';

// Force dynamic rendering (required for auth + PWA features)
export const dynamic = 'force-dynamic';

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
import { Loader, Search, FileQuestion, Monitor } from 'lucide-react';
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
  city: string;
};

type UserProfile = {
  city: string;
}

type EnrichedPresentation = Presentation & {
  doctorName?: string;
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

  const repCity = userProfile?.city;

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
    if (!doctors) return new Map<string, string>();
    return new Map(doctors.map(doc => [doc.id, doc.name]));
  }, [doctors]);

  const enrichedPresentations = useMemo((): EnrichedPresentation[] => {
    if (!presentations) return [];
    const enriched = presentations
      .map(p => ({
        ...p,
        doctorName: doctorsMap.get(p.doctorId) || 'Unknown Doctor',
      }))
      .sort((a, b) => b.updatedAt.toDate().getTime() - a.updatedAt.toDate().getTime());

    if (searchTerm) {
      return enriched.filter(p =>
        p.doctorName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return enriched;

  }, [presentations, doctorsMap, searchTerm]);

  // Check for updates whenever presentations list changes
  useEffect(() => {
    const checkSync = async () => {
      if (enrichedPresentations.length > 0) {
        // Only checking those with a valid id (though firestore docs always have id)
        // Only checking those with a valid id (though firestore docs always have id)
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

    // Check sync status first
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
    e.preventDefault(); // Prevent default if it was a link, though we use button now

    // Synchronous check using localStorage (via offline-storage lib)
    if (isAvailableOffline(doctorId)) {
      router.push(`/rep/present/${doctorId}`);
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
    <div className="space-y-6">
      <OfflineIndicator />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Doctor Presentations {repCity && <span className="text-primary">({repCity})</span>}
        </h1>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by doctor name..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle>Your Assigned Doctors</CardTitle>
            <CardDescription>View and download presentations.</CardDescription>
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
        </CardHeader>
        <CardContent>
          {presentationsError ? (
            <div className="py-8 text-center text-destructive">
              Failed to load presentations. This may be a security rule issue.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor Name</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedPresentations.length > 0 ? (
                    enrichedPresentations.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.doctorName}
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
                      <TableCell
                        colSpan={4}
                        className="h-48 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center justify-center">
                          <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                          <h3 className="mt-4 text-lg font-semibold">No Presentations Found</h3>
                          <p className="mt-1 text-sm">
                            No presentations are currently assigned for your city.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
