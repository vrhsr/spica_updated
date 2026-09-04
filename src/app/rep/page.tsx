'use client';

import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Mail,
  PlusCircle,
  ArrowRight,
  Loader,
  FileCheck,
  MapPin,
  Stethoscope,
} from 'lucide-react';
import Link from 'next/link';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, Timestamp, doc } from 'firebase/firestore';
import { StartDayButton } from '@/components/StartDayButton';
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
        count: readyPpts.toString(),
        icon: FileCheck,
        href: '/rep/doctors',
        accentGradient: 'from-indigo-500 to-violet-600',
        iconColor: 'text-primary',
      },
      {
        title: 'Pending Requests',
        count: pendingRequests.toString(),
        icon: Mail,
        href: '/rep/requests',
        accentGradient: 'from-amber-400 to-orange-500',
        iconColor: 'text-amber-600',
      },
      {
        title: 'Total Doctors',
        count: totalDoctors.toString(),
        icon: Stethoscope,
        href: '/rep/doctors',
        accentGradient: 'from-emerald-400 to-teal-600',
        iconColor: 'text-emerald-600',
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

  const firstName = user?.displayName?.split(' ')[0] || 'Representative';
  const today = format(new Date(), 'EEEE, d MMMM');

  return (
    <div className="space-y-6 pb-28 md:pb-32">

      {/* Hero — brand gradient welcome banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-5 shadow-xl shadow-indigo-600/20 md:p-8">
        {/* Decorative depth — soft glow blobs, purely cosmetic */}
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-100/80 md:text-sm">{today}</p>
            <h1 className="font-headline text-2xl font-bold tracking-tight text-white mt-1.5 md:text-4xl">
              Hello, {firstName} 👋
            </h1>
            <p className="mt-1 text-sm font-medium text-indigo-100/90 md:text-lg">Ready for another productive day?</p>
            {repCity && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm">
                <MapPin className="h-3.5 w-3.5 text-white shrink-0" />
                <span className="text-xs font-semibold text-white md:text-sm">{repCity}</span>
              </div>
            )}
          </div>
          <div className="w-full sm:w-auto [&_button]:w-full [&_button]:bg-white [&_button]:text-indigo-700 [&_button]:shadow-lg [&_button]:shadow-black/10 [&_button]:hover:bg-indigo-50 sm:[&_button]:w-auto">
            <StartDayButton
              presentations={presentations || []}
              doctors={doctors || []}
            />
          </div>
        </div>
      </div>

      {/* Stats Grid — Sleek 3-column balanced layout */}
      <div className="grid grid-cols-3 gap-2.5 md:gap-6">
        {dashboardStats.map((item) => (
          <Link key={item.title} href={item.href} className="group block">
            <Card className="relative overflow-hidden border border-slate-100 rounded-2xl transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-transparent active:scale-[0.97] h-full shadow-sm bg-white">
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.accentGradient}`} />
              <CardContent className="p-3 md:p-8 flex flex-col items-center md:items-start justify-between h-full min-h-[150px] md:min-h-[220px]">
                <div className={`p-2.5 md:p-5 rounded-xl md:rounded-2xl bg-gradient-to-br ${item.accentGradient} shadow-md mb-3 md:mb-6 transition-transform duration-300 group-hover:scale-110`}>
                  <item.icon className="h-5 w-5 md:h-9 md:w-9 text-white" />
                </div>
                <div className="text-center md:text-left mt-auto">
                  <div className={`text-2xl md:text-6xl font-black tabular-nums leading-none ${item.iconColor}`}>
                    {item.count}
                  </div>
                  <p className="text-[10px] md:text-base font-bold text-slate-500 mt-2 md:mt-3 leading-tight uppercase tracking-tight md:tracking-wider">
                    {item.title.split(' ')[0]}<br/>{item.title.split(' ').slice(1).join(' ')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Propose a Change — Prominent but well-sized CTA */}
      <div className="pt-2">
        <Link href="/rep/requests?action=propose" className="group block w-full">
          <Card className="border border-indigo-100 rounded-2xl md:rounded-3xl bg-gradient-to-r from-indigo-50 to-blue-50/70 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-100 hover:border-indigo-200 cursor-pointer active:scale-[0.98] shadow-sm">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center justify-between gap-4 md:gap-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 md:h-16 md:w-16 rounded-[1rem] bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md shadow-indigo-600/30 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:rotate-6">
                    <PlusCircle className="h-7 w-7 md:h-8 md:w-8 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-lg md:text-xl text-indigo-950 mb-0.5">Propose a Change</p>
                    <p className="text-xs md:text-sm text-indigo-800/70 font-medium max-w-[200px] md:max-w-none">
                      Add a new doctor or update slides
                    </p>
                  </div>
                </div>
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white text-indigo-600 flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:translate-x-1">
                  <ArrowRight className="h-5 w-5 md:h-6 md:w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

    </div>
  );
}
