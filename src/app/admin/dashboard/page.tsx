'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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
import { Badge } from '@/components/ui/badge';
import {
  Users,
  HeartPulse,
  Mail,
  Building,
  FileText,
  AlertTriangle,
  UploadCloud,
  Loader,
  ShieldQuestion,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { AddRepDialog } from '@/app/admin/reps/AddRepDialog';
import React, { useMemo } from 'react';
import { AddDoctorDialog } from '../doctors/AddDoctorDialog';
import { useCollection, WithId } from '@/firebase/firestore/use-collection';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { sub, startOfDay, formatDistanceToNow } from 'date-fns';
import { listAllUsers } from '../users/actions';
import useSWR from 'swr';


type City = { id: string; name: string };
type Doctor = { id: string; name: string; city: string };
type User = WithId<{
  uid: string;
  role: 'admin' | 'rep',
  displayName: string,
  creationTime?: string; // This will come from the server action now
  createdBy?: string;
}>;
type Request = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  repId: string;
  doctorId: string;
  createdAt: Timestamp;
};
type Presentation = {
  id: string;
  city: string;
  doctorId: string;
  updatedAt: Timestamp;
  updatedBy: string;
  error?: string | null;
  dirty: boolean;
};

export default function AdminDashboardPage() {
  const firestore = useFirestore();
  const { role: adminRole, isUserLoading } = useUser();
  const isAdmin = adminRole === 'admin';

  // Using SWR to fetch users from the server action
  const { data: allUsers, error: usersError, isLoading: isLoadingUsersSWR, mutate: mutateUsers } = useSWR(isAdmin ? 'allUsers' : null, listAllUsers);

  const doctorsCollection = useMemoFirebase(
    () => (firestore && isAdmin ? collection(firestore, 'doctors') : null),
    [firestore, isAdmin]
  );
  const presentationsCollection = useMemoFirebase(
    () => (firestore && isAdmin ? collection(firestore, 'presentations') : null),
    [firestore, isAdmin]
  );
  const citiesCollection = useMemoFirebase(
    () => (firestore && isAdmin ? collection(firestore, 'cities') : null),
    [firestore, isAdmin]
  );
  const requestsCollection = useMemoFirebase(
    () => (firestore && isAdmin ? collection(firestore, 'requests') : null),
    [firestore, isAdmin]
  );

  // useCollection is still useful for realtime updates on other collections
  const { data: doctors, isLoading: isLoadingDoctors } =
    useCollection<Doctor>(doctorsCollection);
  const { data: presentations, isLoading: isLoadingPresentations } =
    useCollection<Presentation>(presentationsCollection);
  const { data: cities, isLoading: isLoadingCities } =
    useCollection<City>(citiesCollection);
  const { data: requests, isLoading: isLoadingRequests } =
    useCollection<Request>(requestsCollection);

  const isLoading =
    isUserLoading ||
    isLoadingUsersSWR ||
    isLoadingDoctors ||
    isLoadingPresentations ||
    isLoadingCities ||
    isLoadingRequests;

  const userMap = useMemo(() => new Map(allUsers?.map(u => [u.uid, u])), [allUsers]);
  const doctorMap = useMemo(() => new Map(doctors?.map(d => [d.id, d.name])), [doctors]);

  const recentActivity = useMemo(() => {
    if (!presentations && !requests && !allUsers) return [];

    const presentationActivities = (presentations || []).map(p => {
      const actingUser = userMap.get(p.updatedBy);
      const byText = actingUser
        ? `${actingUser.displayName} (${actingUser.role})`
        : 'Admin';

      return {
        type: 'presentation',
        action: p.error ? 'PPT Failed' : 'PPT',
        subject: `for ${doctorMap.get(p.doctorId) || 'Unknown Doctor'}`,
        by: byText,
        time: p.updatedAt.toDate(),
        isError: !!p.error,
      }
    });

    const requestActivities = (requests || []).map(r => ({
      type: 'request',
      action: `Requested Slide Change`,
      subject: `for ${doctorMap.get(r.doctorId) || 'Unknown Doctor'}`,
      by: `Rep: ${userMap.get(r.repId)?.displayName || 'Unknown'} `,
      time: r.createdAt?.toDate() || new Date(),
      isError: false,
    }));

    const userActivities = (allUsers || []).map(u => {
      const creator = u.createdBy ? userMap.get(u.createdBy) : null;
      const byText = creator ? `${creator.displayName} (${creator.role})` : 'System';

      return {
        type: 'user',
        action: `Created New User`,
        subject: `${u.displayName} (${u.role})`,
        by: byText,
        time: new Date(u.creationTime),
        isError: false,
      };
    });

    return [...presentationActivities, ...requestActivities, ...userActivities]
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 5); // Get the top 5 most recent activities

  }, [presentations, requests, allUsers, userMap, doctorMap]);


  const stats = useMemo(() => {
    const now = new Date();
    const twentyFourHoursAgo = sub(now, { hours: 24 });

    const recentPresentations =
      presentations?.filter(
        (p) => p.updatedAt.toDate() > twentyFourHoursAgo
      ) || [];

    return [
      {
        title: 'Total Reps',
        value: allUsers?.filter((u) => u.role === 'rep').length || 0,
        icon: Users,
        href: '/admin/users'
      },
      {
        title: 'Total Doctors',
        value: doctors?.length || 0,
        icon: HeartPulse,
        href: '/admin/doctors'
      },
      {
        title: 'PDFs Generated Today',
        value:
          presentations?.filter(
            (p) => p.updatedAt.toDate() >= startOfDay(now)
          ).length || 0,
        icon: FileText,
        href: '/admin/presentations'
      },
      {
        title: 'Pending Requests',
        value: requests?.filter((r) => r.status === 'pending').length || 0,
        icon: Mail,
        variant: 'destructive',
        href: '/admin/requests?status=pending'
      },
      {
        title: 'Active Cities',
        value: cities?.length || 0,
        icon: Building,
        href: '/admin/cities'
      },
      {
        title: 'Errors in 24h',
        value: recentPresentations.filter((p) => !!p.error).length || 0,
        icon: AlertTriangle,
        variant: 'destructive',
        href: '/admin/presentations?status=error'
      },
    ];
  }, [allUsers, doctors, presentations, cities, requests]);

  const doctorStatusByCity = useMemo(() => {
    if (!cities || !presentations) return [];

    return cities.map(city => {
      const cityPresentations = presentations.filter(p => p.city === city.name);
      const updated = cityPresentations.filter(p => !p.dirty && !p.error).length;
      const pending = cityPresentations.filter(p => p.dirty).length;
      const error = cityPresentations.filter(p => !!p.error).length;

      return { city: city.name, updated, pending, error };
    });

  }, [cities, presentations]);

  const handleRepAdded = () => {
    // Re-fetch user list after a new rep is added.
    mutateUsers();
  };

  const handleDoctorAdded = () => {
    // Here you would typically re-fetch data or update state
    console.log('A new doctor has been added from the dashboard.');
  };

  const getStatusBadge = (status: {
    updated: number;
    pending: number;
    error: number;
  }) => {
    if (status.error > 0) return <Badge variant="destructive">Error</Badge>;
    if (status.pending > 0) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    return <Badge className="bg-green-100 text-green-800">Ready</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading dashboard data...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline"><ShieldQuestion /> Permission Denied</CardTitle>
          <CardContent className="pt-4">
            <p>You do not have the necessary permissions to view this page. This is because your account does not have the 'admin' role. Please contact the system administrator.</p>
          </CardContent>
        </CardHeader>
      </Card>
    )
  }


  const renderCard = (stat: (typeof stats)[0]) => {
    const card = (
      <Card key={stat.title} className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {stat.title}
          </CardTitle>
          <stat.icon className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stat.value}</div>
        </CardContent>
      </Card>
    );

    if (stat.href) {
      return <Link href={stat.href} className="block">{card}</Link>
    }
    return card;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Dashboard
        </h1>
        <div className="flex flex-col gap-2 md:flex-row">
          <AddDoctorDialog
            onDoctorAdded={handleDoctorAdded}
            triggerButton={
              <Button variant="outline">
                <TrendingUp className="mr-2 h-4 w-4" /> Add Doctor
              </Button>
            }
          />
          <AddRepDialog
            cities={cities || []}
            isLoadingCities={isLoadingCities}
            onRepAdded={handleRepAdded}
            triggerButton={
              <Button>
                <Users className="mr-2 h-4 w-4" /> Add User
              </Button>
            }
          />
        </div>
      </div>

      {/* System Status Summary */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((item) => (
          <Card
            key={item.title}
            className={`group flex flex-col transition-all hover:border-primary/50 hover:shadow-lg ${item.variant === 'destructive'
              ? 'border-l-4 border-l-destructive shadow-md ring-1 ring-destructive/20 animate-pulse-subtle'
              : ''
              }`}
          >
            <Link href={item.href} className="flex h-full flex-col">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-5 px-5">
                <CardTitle className="font-headline text-base font-semibold text-muted-foreground">
                  {item.title}
                </CardTitle>
                <item.icon className={`h-7 w-7 ${item.variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground/60'}`} />
              </CardHeader>
              <CardContent className="flex flex-grow items-end justify-between px-5 pb-5 pt-2">
                <p className="text-4xl font-bold text-foreground">{item.value}</p>
                <div className="flex items-center text-sm text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary">
                  View <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Presentation Status by City - Compact Table */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Presentation Status by City</CardTitle>
            <CardDescription>Overview of PDF generation status</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {doctorStatusByCity.length > 0 ? (
              <div className="overflow-x-auto max-w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">City</TableHead>
                      <TableHead className="text-center">Ready</TableHead>
                      <TableHead className="text-center">Pending</TableHead>
                      <TableHead className="text-center">Errors</TableHead>
                      <TableHead className="pr-6 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctorStatusByCity.map((city) => (
                      <TableRow key={city.city}>
                        <TableCell className="font-medium pl-6 truncate max-w-[120px]">{city.city}</TableCell>
                        <TableCell className="text-center text-green-600">{city.updated}</TableCell>
                        <TableCell className="text-center text-yellow-600">{city.pending}</TableCell>
                        <TableCell className="text-center text-red-600">{city.error}</TableCell>
                        <TableCell className="pr-6 text-right">{getStatusBadge(city)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-10">
                No cities found.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Log */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="overflow-x-auto max-w-full">
                <Table>
                  <TableBody>
                    {recentActivity.map((activity, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className={`font-medium ${activity.isError ? 'text-destructive' : ''} `}>{activity.action} {activity.subject}</div>
                          <div className="text-sm text-muted-foreground">
                            {activity.by}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(activity.time, { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-10">
                No recent activity to display.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
