'use client';

import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  HeartPulse,
  Mail,
  PlusCircle,
  ArrowRight,
  Loader,
  FileCheck,
  MapPin,
  Stethoscope,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, Timestamp, doc } from 'firebase/firestore';
import { StartDayButton } from '@/components/StartDayButton';
import { OfflinePresentationsCard } from '@/components/OfflinePresentationsCard';
import { useOfflineReady } from '@/hooks/useOfflineReady';
import { format } from 'date-fns';

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
    const totalDoctors = doctors?.length || 0;

    return [
      {
        title: 'Presentations Ready',
        description: 'Available for your doctors',
        count: readyPpts.toString(),
        icon: FileCheck,
        href: '/rep/doctors',
        gradient: 'from-primary/10 to-primary/5',
        iconBg: 'bg-primary/15',
        iconColor: 'text-primary',
        badge: readyPpts > 0 ? 'View All' : null,
      },
      {
        title: 'Pending Requests',
        description: 'Awaiting admin review',
        count: pendingRequests.toString(),
        icon: Mail,
        href: '/rep/requests',
        gradient: 'from-amber-500/10 to-amber-500/5',
        iconBg: 'bg-amber-500/15',
        iconColor: 'text-amber-600',
        badge: pendingRequests > 0 ? `${pendingRequests} pending` : null,
      },
      {
        title: 'Total Doctors',
        description: 'In your district',
        count: totalDoctors.toString(),
        icon: Stethoscope,
        href: '/rep/doctors',
        gradient: 'from-emerald-500/10 to-emerald-500/5',
        iconBg: 'bg-emerald-500/15',
        iconColor: 'text-emerald-600',
        badge: null,
      },
    ];
  }, [doctors, requests, presentations]);

  if (isLoading) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center gap-3">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const today = format(new Date(), 'EEEE, d MMMM');

  return (
    <div className="space-y-6 pb-24">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{today}</p>
          <h1 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
            Hello, {firstName} 👋
          </h1>
          {repCity && (
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-sm text-muted-foreground">
                District: <span className="font-semibold text-foreground">{repCity}</span>
              </span>
            </div>
          )}
        </div>
        <div className="w-full sm:w-auto">
          <StartDayButton
            presentations={presentations || []}
            doctors={doctors || []}
          />
        </div>
      </div>

      {/* Stats Grid — 3 across on tablet, 1 per row on small mobile */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {dashboardStats.map((item) => (
          <Link key={item.title} href={item.href} className="group block">
            <Card className={`relative overflow-hidden border rounded-xl transition-all duration-200 hover:shadow-md hover:border-primary/30 active:scale-[0.98]`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${item.iconBg}`}>
                    <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors group-hover:translate-x-0.5 transform duration-150" />
                </div>
                <div className={`text-3xl font-bold font-headline ${item.iconColor}`}>
                  {item.count}
                </div>
                <p className="text-sm font-medium text-foreground mt-0.5">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Action */}
      <Link href="/rep/requests?action=propose">
        <Card className="border rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 border-primary/20 transition-all duration-200 hover:shadow-md cursor-pointer active:scale-[0.99]">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <PlusCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Propose a Change</p>
                <p className="text-xs text-muted-foreground">Add a new doctor or update slides</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-primary/60" />
          </CardContent>
        </Card>
      </Link>

      {/* Offline Presentations */}
      <OfflinePresentationsCard />

    </div>
  );
}
