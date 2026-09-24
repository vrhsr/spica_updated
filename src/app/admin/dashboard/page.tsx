'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  HeartPulse,
  Mail,
  Building,
  FileText,
  AlertTriangle,
  Loader,
  ShieldQuestion,
  ArrowRight,
  Plus,
  UserPlus,
  Presentation as PresentationIcon,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { AddUserDialog } from '@/app/admin/users/AddUserDialog';
import React, { useMemo } from 'react';
import { AddDoctorDialog } from '../doctors/AddDoctorDialog';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { sub, startOfDay, formatDistanceToNow, format } from 'date-fns';
import { listAllUsers } from '../users/actions';
import useSWR from 'swr';
import { Doctor, Presentation, CreateDoctorInput, Request } from '@/types';
import { cn } from '@/lib/utils';

type Tone = 'indigo' | 'violet' | 'sky' | 'emerald' | 'amber' | 'rose';

const TONES: Record<Tone, string> = {
  indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
};

type Stat = {
  title: string;
  value: number;
  icon: React.ElementType;
  tone: Tone;
  href?: string;
  /** Highlights the tile — only ever set when the count is actually > 0. */
  alert?: boolean;
};

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatTile({ stat }: { stat: Stat }) {
  const body = (
    <div
      className={cn(
        'flex h-full flex-col justify-between gap-2.5 rounded-2xl border bg-card p-3.5 shadow-sm transition-all sm:gap-3 sm:p-4',
        stat.href && 'hover:-translate-y-0.5 hover:shadow-md',
        stat.alert && 'border-rose-200 bg-rose-50/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl ring-1',
            TONES[stat.alert ? 'rose' : stat.tone]
          )}
        >
          <stat.icon className="h-[18px] w-[18px]" />
        </span>
        {stat.href && <ChevronRight className="h-4 w-4 text-muted-foreground/60" />}
      </div>
      <div>
        <div className={cn('text-2xl font-bold tabular-nums leading-none sm:text-3xl', stat.alert && 'text-rose-600')}>
          {stat.value}
        </div>
        <p className="mt-1.5 text-xs font-medium leading-tight text-muted-foreground sm:text-sm">{stat.title}</p>
      </div>
    </div>
  );
  return stat.href ? (
    <Link href={stat.href} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b bg-muted/30 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {action.label} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function EmptyRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <Icon className="h-8 w-8 text-emerald-500/70" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const firestore = useFirestore();
  const { user: currentUser, role: adminRole, isUserLoading } = useUser();
  const hasPortalAccess = adminRole === 'admin' || adminRole === 'manager';
  const isManager = adminRole === 'manager';

  // Using SWR to fetch users from the server action. listAllUsers needs a
  // fresh ID token to verify who's asking (and, for a Project Manager,
  // scopes the result to Representatives only).
  const { data: allUsers, isLoading: isLoadingUsersSWR, mutate: mutateUsers } = useSWR(
    hasPortalAccess && currentUser ? 'allUsers' : null,
    async () => listAllUsers(await currentUser!.getIdToken())
  );

  const doctorsCollection = useMemoFirebase(
    () => (firestore && hasPortalAccess ? collection(firestore, 'doctors') : null),
    [firestore, hasPortalAccess]
  );
  const presentationsCollection = useMemoFirebase(
    () => (firestore && hasPortalAccess ? collection(firestore, 'presentations') : null),
    [firestore, hasPortalAccess]
  );
  const citiesCollection = useMemoFirebase(
    () => (firestore && hasPortalAccess ? collection(firestore, 'cities') : null),
    [firestore, hasPortalAccess]
  );
  const requestsCollection = useMemoFirebase(
    () => (firestore && hasPortalAccess ? collection(firestore, 'requests') : null),
    [firestore, hasPortalAccess]
  );

  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsCollection);
  const { data: presentations, isLoading: isLoadingPresentations } = useCollection<Presentation>(presentationsCollection);
  const { data: cities, isLoading: isLoadingCities } = useCollection<{ id: string; name: string }>(citiesCollection);
  const { data: requests, isLoading: isLoadingRequests } = useCollection<Request>(requestsCollection);

  const isLoading =
    isUserLoading || isLoadingUsersSWR || isLoadingDoctors || isLoadingPresentations || isLoadingCities || isLoadingRequests;

  const userMap = useMemo(() => new Map(allUsers?.map((u) => [u.uid, u])), [allUsers]);
  const doctorMap = useMemo(() => new Map(doctors?.map((d) => [d.id, d.name])), [doctors]);

  const recentActivity = useMemo(() => {
    if (!presentations && !requests && !allUsers) return [];

    const presentationActivities = (presentations || []).map((p) => {
      const actingUser = userMap.get(p.updatedBy);
      return {
        kind: p.error ? ('error' as const) : ('ppt' as const),
        action: p.error ? 'Presentation failed' : 'Presentation updated',
        subject: doctorMap.get(p.doctorId) || 'Unknown Doctor',
        by: actingUser ? actingUser.displayName : 'Admin',
        time: p.updatedAt.toDate(),
      };
    });

    const requestActivities = (requests || []).map((r) => ({
      kind: 'request' as const,
      action: r.doctorId ? 'Slide change requested' : 'New doctor proposed',
      subject: (r.doctorId && doctorMap.get(r.doctorId)) || r.doctorName || 'Unknown Doctor',
      by: userMap.get(r.repId)?.displayName || r.repName || 'Rep',
      time: r.createdAt?.toDate() || new Date(),
    }));

    // Managers can't manage accounts, so account creation isn't their activity feed.
    const userActivities = isManager
      ? []
      : (allUsers || []).map((u) => {
          const creator = u.createdBy ? userMap.get(u.createdBy) : null;
          return {
            kind: 'user' as const,
            action: 'New user added',
            subject: `${u.displayName} (${u.role})`,
            by: creator ? creator.displayName : 'System',
            time: new Date(u.creationTime),
          };
        });

    return [...presentationActivities, ...requestActivities, ...userActivities]
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 6);
  }, [presentations, requests, allUsers, userMap, doctorMap, isManager]);

  const pendingRequestsList = useMemo(
    () =>
      (requests || [])
        .filter((r) => r.status === 'pending')
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
        .map((r) => ({
          id: r.id,
          doctor: (r.doctorId && doctorMap.get(r.doctorId)) || r.doctorName || 'New doctor',
          isNewDoctor: !r.doctorId,
          rep: userMap.get(r.repId)?.displayName || r.repName || 'Unknown rep',
          time: r.createdAt?.toDate() ?? null,
        })),
    [requests, doctorMap, userMap]
  );

  const attentionPresentations = useMemo(
    () =>
      (presentations || [])
        .filter((p) => !!p.error || p.dirty)
        .sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
        .map((p) => ({
          id: p.id,
          doctor: doctorMap.get(p.doctorId) || 'Unknown Doctor',
          district: p.city,
          failed: !!p.error,
        })),
    [presentations, doctorMap]
  );

  const stats = useMemo((): Stat[] => {
    const now = new Date();
    const twentyFourHoursAgo = sub(now, { hours: 24 });
    const pendingCount = pendingRequestsList.length;
    const attentionCount = attentionPresentations.length;
    const errorsCount = (presentations || []).filter((p) => !!p.error && p.updatedAt.toDate() > twentyFourHoursAgo).length;
    const pdfsToday = (presentations || []).filter((p) => p.updatedAt.toDate() >= startOfDay(now)).length;
    const repCount = allUsers?.filter((u) => u.role === 'rep').length || 0;

    const pending: Stat = { title: 'Pending requests', value: pendingCount, icon: Mail, tone: 'amber', alert: pendingCount > 0, href: '/admin/requests?status=pending' };
    const doctorsStat: Stat = { title: 'Doctors', value: doctors?.length || 0, icon: HeartPulse, tone: 'rose', href: '/admin/doctors' };
    const reps: Stat = { title: 'Field reps', value: repCount, icon: Users, tone: 'indigo', href: adminRole === 'admin' ? '/admin/users' : '/admin/doctors?view=reps' };
    const pdfs: Stat = { title: 'PDFs today', value: pdfsToday, icon: FileText, tone: 'sky', href: '/admin/presentations' };
    const districts: Stat = { title: 'Districts', value: cities?.length || 0, icon: Building, tone: 'violet', href: '/admin/cities' };

    if (isManager) {
      // Action items first: what a Project Manager needs to deal with today.
      return [
        pending,
        { title: 'PPTs need attention', value: attentionCount, icon: AlertTriangle, tone: 'amber', alert: attentionCount > 0, href: '/admin/presentations' },
        pdfs,
        doctorsStat,
        reps,
        districts,
      ];
    }
    return [
      reps,
      doctorsStat,
      pdfs,
      pending,
      districts,
      { title: 'Errors in 24h', value: errorsCount, icon: AlertTriangle, tone: 'emerald', alert: errorsCount > 0, href: '/admin/presentations?status=failed' },
    ];
  }, [allUsers, doctors, presentations, cities, adminRole, isManager, pendingRequestsList, attentionPresentations]);

  const districtStatus = useMemo(() => {
    if (!cities || !presentations) return [];
    return cities
      .map((city) => {
        const cityPresentations = presentations.filter((p) => p.city === city.name);
        const ready = cityPresentations.filter((p) => !p.dirty && !p.error).length;
        const pending = cityPresentations.filter((p) => p.dirty && !p.error).length;
        const error = cityPresentations.filter((p) => !!p.error).length;
        return { city: city.name, ready, pending, error, total: ready + pending + error };
      })
      .sort((a, b) => b.total - a.total);
  }, [cities, presentations]);

  const handleRepAdded = () => {
    mutateUsers();
  };

  const handleDoctorAdded = async (_newDoctor: CreateDoctorInput) => {};

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading dashboard data...</p>
      </div>
    );
  }

  if (!hasPortalAccess) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <ShieldQuestion /> Permission Denied
          </CardTitle>
          <CardContent className="pt-4">
            <p>You do not have the necessary permissions to view this page. Please contact the system administrator.</p>
          </CardContent>
        </CardHeader>
      </Card>
    );
  }

  const now = new Date();
  const firstName = currentUser?.displayName?.split(' ')[0];
  const pendingCount = pendingRequestsList.length;
  const attentionCount = attentionPresentations.length;
  const needsAction = pendingCount + attentionCount;

  return (
    <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-5 text-white shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-white/20">
                {isManager ? 'Project Manager' : 'Administrator'}
              </span>
              <span className="text-xs text-indigo-100">{format(now, 'EEEE, d MMM')}</span>
            </div>
            <h1 className="mt-3 font-headline text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting(now)}
              {firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1 text-sm text-indigo-100">
              {needsAction > 0
                ? `${needsAction} item${needsAction === 1 ? '' : 's'} need${needsAction === 1 ? 's' : ''} your attention today.`
                : "Everything's up to date — nothing needs your attention."}
            </p>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <AddDoctorDialog
              onDoctorAdded={handleDoctorAdded}
              triggerButton={
                <Button className="h-11 justify-start gap-2 rounded-xl bg-white text-indigo-700 shadow-sm hover:bg-indigo-50">
                  <Plus className="h-4 w-4" /> Add Doctor
                </Button>
              }
            />
            {adminRole === 'admin' ? (
              <AddUserDialog
                cities={cities || []}
                isLoadingCities={isLoadingCities}
                onUserAdded={handleRepAdded}
                triggerButton={
                  <Button className="h-11 justify-start gap-2 rounded-xl bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25">
                    <UserPlus className="h-4 w-4" /> Add User
                  </Button>
                }
              />
            ) : (
              <Button asChild className="h-11 justify-start gap-2 rounded-xl bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25">
                <Link href="/admin/presentations">
                  <PresentationIcon className="h-4 w-4" /> Presentations
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Stats: 2-up on phones, 3-up on tablets, one row on wide screens */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
        {stats.map((stat) => (
          <StatTile key={stat.title} stat={stat} />
        ))}
      </section>

      {/* Action queues */}
      <section className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Pending change requests"
          subtitle={pendingCount > 0 ? `${pendingCount} waiting for review` : 'Rep proposals waiting for review'}
          action={{ label: 'Review', href: '/admin/requests?status=pending' }}
        >
          {pendingCount > 0 ? (
            <ul className="divide-y">
              {pendingRequestsList.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link
                    href="/admin/requests?status=pending"
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1',
                        r.isNewDoctor ? TONES.emerald : TONES.amber
                      )}
                    >
                      {r.isNewDoctor ? <Plus className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.doctor}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.isNewDoctor ? 'New doctor' : 'Slide change'} · {r.rep}
                      </p>
                    </div>
                    {r.time && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(r.time, { addSuffix: true })}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow icon={CheckCircle2} text="No pending requests — you're all caught up." />
          )}
        </SectionCard>

        <SectionCard
          title="Presentations needing attention"
          subtitle={attentionCount > 0 ? `${attentionCount} failed or waiting to regenerate` : 'Failed or waiting to regenerate'}
          action={{ label: 'View all', href: '/admin/presentations' }}
        >
          {attentionCount > 0 ? (
            <ul className="divide-y">
              {attentionPresentations.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link
                    href={p.failed ? '/admin/presentations?status=failed' : '/admin/presentations?status=pending'}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1',
                        p.failed ? TONES.rose : TONES.amber
                      )}
                    >
                      {p.failed ? <XCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.doctor}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.district}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 rounded-full border-0 px-2 py-0.5 text-[11px]',
                        p.failed ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                      )}
                    >
                      {p.failed ? 'Failed' : 'Pending'}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow icon={CheckCircle2} text="All presentations are ready." />
          )}
        </SectionCard>
      </section>

      {/* Coverage + activity */}
      <section className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionCard title="Presentation status by district" subtitle="Ready, pending and failed PDFs" action={{ label: 'Districts', href: '/admin/cities' }}>
            {districtStatus.length > 0 ? (
              <ul className="divide-y">
                {districtStatus.map((d) => (
                  <li key={d.city} className="px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">{d.city}</p>
                      <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        <span className="font-semibold text-emerald-600">{d.ready}</span>
                        {' / '}
                        {d.total} ready
                      </p>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                      {d.total > 0 && (
                        <>
                          <div className="bg-emerald-500" style={{ width: `${(d.ready / d.total) * 100}%` }} />
                          <div className="bg-amber-400" style={{ width: `${(d.pending / d.total) * 100}%` }} />
                          <div className="bg-rose-500" style={{ width: `${(d.error / d.total) * 100}%` }} />
                        </>
                      )}
                    </div>
                    {(d.pending > 0 || d.error > 0) && (
                      <div className="mt-1.5 flex gap-3 text-[11px]">
                        {d.pending > 0 && <span className="text-amber-700">{d.pending} pending</span>}
                        {d.error > 0 && <span className="text-rose-600">{d.error} failed</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow icon={Building} text="No districts yet." />
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <SectionCard title="Recent activity">
            {recentActivity.length > 0 ? (
              <ol className="relative px-4 py-4 sm:px-5">
                {recentActivity.map((a, i) => {
                  const dot =
                    a.kind === 'error' ? TONES.rose : a.kind === 'request' ? TONES.amber : a.kind === 'user' ? TONES.indigo : TONES.sky;
                  const Icon = a.kind === 'error' ? XCircle : a.kind === 'request' ? Mail : a.kind === 'user' ? UserPlus : FileText;
                  return (
                    <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < recentActivity.length - 1 && (
                        <span className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-border" aria-hidden />
                      )}
                      <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1', dot)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className={cn('text-sm font-medium leading-snug', a.kind === 'error' && 'text-rose-600')}>
                          {a.action}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.subject} · {a.by}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                          {formatDistanceToNow(a.time, { addSuffix: true })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyRow icon={Clock} text="No recent activity yet." />
            )}
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
