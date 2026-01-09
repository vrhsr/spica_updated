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
import { StartDayButton } from '@/components/StartDayButton';
import { OfflinePresentationsCard } from '@/components/OfflinePresentationsCard';
import { useOfflineReady } from '@/hooks/useOfflineReady';

type Doctor = { id: string; city: string; name: string };
type Request = {
  id: string;
  repId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
};
type Presentation = {
  doctorId: string;
  dirty: boolean;
  error?: string;
  pdfUrl?: string;
  updatedAt: Timestamp;
};
type UserProfile = {
  city: string;
};

export default function RepDashboardPage() {
  // Initialize offline storage and sync manager on dashboard load
  // This ensures pending sync state is detected from IndexedDB
  useOfflineReady();

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
        description: 'Presentations for doctors',
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
        href: '/rep/requests?action=propose',
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Dashboard
        </h1>
        <div className="w-full md:w-auto">
          <StartDayButton
            presentations={presentations || []}
            doctors={doctors || []}
          />
        </div>
      </div>

      {/* Top Row - Stats + Offline Card */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {dashboardStats.map((item) => (
          <Card
            key={item.title}
            className="group relative overflow-hidden border rounded-lg transition-all duration-200 hover:border-accent hover:bg-accent/5 hover:shadow-md"
          >
            <Link href={item.href} className="flex h-full flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {item.title}
                </CardTitle>
                <div className={`p-2 rounded-lg bg-${item.color.replace('text-', '')}/10`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{item.count}</div>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </CardContent>
            </Link>
          </Card>
        ))}
        <OfflinePresentationsCard />
      </div>
    </div>
  );
}
