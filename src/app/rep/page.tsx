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
        iconBg: 'bg-primary/15',
        iconColor: 'text-primary',
      },
      {
        title: 'Pending Requests',
        count: pendingRequests.toString(),
        icon: Mail,
        href: '/rep/requests',
        iconBg: 'bg-amber-500/15',
        iconColor: 'text-amber-600',
      },
      {
        title: 'Total Doctors',
        count: totalDoctors.toString(),
        icon: Stethoscope,
        href: '/rep/doctors',
        iconBg: 'bg-emerald-500/15',
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
    <div className="space-y-5 pb-28 md:pb-32">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wide">{today}</p>
          <h1 className="font-headline text-2xl md:text-4xl font-bold tracking-tight mt-1 text-primary">
            HELLO {firstName} 👋
          </h1>
          <p className="text-lg md:text-xl mt-1 text-foreground font-medium">Ready for another productive day?</p>
          {repCity && (
            <div className="flex items-center gap-1.5 mt-2">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
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

      {/* Stats Grid — Sleek 3-column balanced layout */}
      <div className="grid grid-cols-3 gap-2.5 md:gap-6 mt-6">
        {dashboardStats.map((item) => (
          <Link key={item.title} href={item.href} className="group block">
            <Card className="relative overflow-hidden border-0 rounded-2xl transition-all duration-300 hover:shadow-lg hover:translate-y-[-1px] active:scale-[0.97] h-full shadow-sm bg-white">
              <CardContent className="p-3 md:p-8 flex flex-col items-center md:items-start justify-between h-full min-h-[150px] md:min-h-[220px]">
                <div className={`p-2.5 md:p-5 rounded-xl md:rounded-2xl ${item.iconBg} mb-3 md:mb-6`}>
                  <item.icon className={`h-5 w-5 md:h-9 md:w-9 ${item.iconColor}`} />
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
              <div className={`absolute bottom-0 left-0 right-0 h-1 ${item.iconBg.replace('/15', '')} opacity-40`} />
            </Card>
          </Link>
        ))}
      </div>

      {/* Propose a Change — Prominent but well-sized CTA */}
      <div className="mt-8 pt-4 border-t border-slate-100">
        <Link href="/rep/requests?action=propose" className="block w-full">
          <Card className="border rounded-2xl md:rounded-3xl bg-gradient-to-r from-indigo-50/50 to-blue-50/50 border-indigo-100 transition-all duration-200 hover:shadow-md hover:border-indigo-300 cursor-pointer active:scale-[0.98] shadow-sm">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center justify-between gap-4 md:gap-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 md:h-16 md:w-16 rounded-[1rem] bg-indigo-600 shadow-md flex items-center justify-center shrink-0">
                    <PlusCircle className="h-7 w-7 md:h-8 md:w-8 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-lg md:text-xl text-indigo-950 mb-0.5">Propose a Change</p>
                    <p className="text-xs md:text-sm text-indigo-800/70 font-medium max-w-[200px] md:max-w-none">
                      Add a new doctor or update slides
                    </p>
                  </div>
                </div>
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:translate-x-1">
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
