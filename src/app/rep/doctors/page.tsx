'use client';

import React, { useMemo, useState } from 'react';
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
import { Loader, Search, FileQuestion, Eye, Download } from 'lucide-react';
import Link from 'next/link';
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
  const [searchTerm, setSearchTerm] = useState('');

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

  const getStatusBadge = (presentation: EnrichedPresentation) => {
     if (presentation.error) {
        return <Badge variant="destructive" title={presentation.error}>Failed</Badge>;
     }
     if (presentation.dirty) {
        return <Badge variant="secondary">Pending Update</Badge>;
    }
    if (presentation.pdfUrl) {
        return <Badge className="bg-green-100 text-green-800">Ready</Badge>;
    }
    return <Badge variant="outline">Not Generated</Badge>;
  }


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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Doctor Presentations {repCity && <span className="text-primary">({repCity})</span>}
        </h1>
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
       <Card>
        <CardHeader>
          <CardTitle>Your Assigned Doctors</CardTitle>
          <CardDescription>View and download presentations.</CardDescription>
        </CardHeader>
        <CardContent>
           {presentationsError ? (
                <div className="py-8 text-center text-destructive">
                    Failed to load presentations. This may be a security rule issue.
                </div>
            ) : (
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
                        {getStatusBadge(p)}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button asChild variant="outline" size="sm" disabled={!p.pdfUrl}>
                        <a href={p.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <Eye className="mr-2 h-4 w-4" /> View
                        </a>
                      </Button>
                      <Button asChild variant="default" size="sm" disabled={!p.pdfUrl}>
                        <a href={p.pdfUrl} download={`${p.doctorName?.replace(/ /g, '_')}_presentation.pdf`}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </a>
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
                        <FileQuestion className="h-12 w-12 text-muted-foreground/50"/>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
