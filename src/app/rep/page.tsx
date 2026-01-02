'use client';

import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  HeartPulse,
  Mail,
  PlusCircle,
  ArrowRight,
  Loader,
  FileCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, Timestamp, doc } from 'firebase/firestore';
import { OfflinePresentationsCard } from '@/components/OfflinePresentationsCard';

// Force dynamic rendering (required for auth + PWA features)
export const dynamic = 'force-dynamic';

type Doctor = { id: string; city: string };
type Request = {
  id: string;
  repId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
};
type Presentation = {
  dirty: boolean;
  error?: string;
  pdfUrl?: string;
};
type UserProfile = {
  city: string;
};

export default function RepDashboardPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user?.uid]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const repCity = userProfile?.city;

  const doctorsQuery = useMemoFirebase(() => {
    if (!firestore || !repCity) return null;
    return query(collection(firestore, 'doctors'), where('city', '==', repCity));
  }, [firestore, repCity]);

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'requests'), where('repId', '==', user.uid));
  }, [firestore, user?.uid]);

  const presentationsQuery = useMemoFirebase(() => {
    if (!firestore || !repCity) return null;
    return query(collection(firestore, 'presentations'), where('city', '==', repCity));
  }, [firestore, repCity]);

  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsQuery);
  const { data: requests, isLoading: isLoadingRequests } = useCollection<Request>(requestsQuery);
  const { data: presentations, isLoading: isLoadingPresentations } = useCollection<Presentation>(presentationsQuery);

  const isLoading = isAuthLoading || isProfileLoading || isLoadingDoctors || isLoadingRequests || isLoadingPresentations;

  const dashboardStats = useMemo(() => {
    const pendingRequests = requests?.filter(r => r.status === 'pending').length || 0;
    const readyPpts = presentations?.filter(p => p.pdfUrl && !p.dirty && !p.error).length || 0;

    return [
      {
        title: 'Presentations Ready',
        description: 'View and download presentations for your doctors',
        count: readyPpts.toString(),
        icon: FileCheck,
        href: '/rep/doctors',
        color: 'text-primary',
      },
      {
        title: 'Pending Requests',
        description: 'Track updates you have submitted for review',
        count: pendingRequests.toString(),
        icon: Mail,
        href: '/rep/requests',
        color: 'text-yellow-500',
      },
      {
        title: 'Propose a Change',
        description: 'Add a new doctor or update slides',
        count: '+',
        icon: PlusCircle,
        href: '/rep/requests',
        color: 'text-accent',
      },
    ];
  }, [doctors, requests, presentations]);

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Dashboard
        </h1>
      </div>

      {/* Top Row - Stats + Offline Card */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {dashboardStats.map((item) => (
          <Card
            key={item.title}
            className="group flex flex-col transition-all hover:border-primary/50 hover:shadow-lg"
          >
            <Link href={item.href} className="flex h-full flex-col">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="font-headline text-xl">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-xs">{item.description}</CardDescription>
                </div>
                <item.icon className={`h-6 w-6 ${item.color}`} />
              </CardHeader>
              <CardContent className="flex flex-grow items-end justify-between">
                <p className={`text-3xl font-bold ${item.count === '+' ? 'text-muted-foreground' : ''}`}>{item.count}</p>
                <div className="flex items-center text-xs text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary">
                  View <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
        <OfflinePresentationsCard />
      </div>
    </div>
  );
}
