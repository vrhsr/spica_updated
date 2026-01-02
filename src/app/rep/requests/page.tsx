
'use client';

// Force dynamic rendering (required for auth + PWA features)
export const dynamic = 'force-dynamic';

import React, { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader, PlusCircle, FileQuestion } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, addDoc, doc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { EditSlidesForm } from '@/app/admin/doctors/AddDoctorDialog';

type Doctor = { id: string; name: string; city: string; selectedSlides: number[] };
type UserProfile = { city: string };
type Request = {
  doctorId?: string;
  doctorName?: string;
  doctorCity?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  selectedSlides: number[];
  requestType?: 'new_doctor' | 'slide_change'; // NEW field
};

function ProposeChangesDialog({ repId, repCity, doctors, onSubmitted }: {
  repId: string;
  repCity: string;
  doctors: Doctor[];
  onSubmitted: () => void;
}) {
  const [step, setStep] = useState<'type' | 'details' | 'slides'>('type');
  const [requestType, setRequestType] = useState<'new_doctor' | 'slide_change'>('new_doctor');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [proposedDoctor, setProposedDoctor] = useState<Partial<Doctor> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleTypeSelect = (type: 'new_doctor' | 'slide_change') => {
    setRequestType(type);
    setStep('details');
  };

  const handleNext = () => {
    if (requestType === 'new_doctor' && doctorName.trim()) {
      const finalName = doctorName.trim().startsWith('Dr.') ? doctorName.trim() : `Dr. ${doctorName.trim()}`;
      setProposedDoctor({ name: finalName, city: repCity });
      setStep('slides');
    } else if (requestType === 'slide_change' && selectedDoctorId) {
      const doctor = doctors.find(d => d.id === selectedDoctorId);
      if (doctor) {
        setProposedDoctor(doctor);
        setStep('slides');
      }
    }
  };

  const handleSlideSave = async (slides: number[]) => {
    if (!firestore || !proposedDoctor) return;

    setIsSubmitting(true);
    const requestsCollection = collection(firestore, 'requests');

    const newRequest = requestType === 'new_doctor'
      ? {
        repId,
        doctorName: proposedDoctor.name,
        doctorCity: proposedDoctor.city,
        selectedSlides: slides,
        status: 'pending' as const,
        requestType: 'new_doctor' as const,
        createdAt: Timestamp.now()
      }
      : {
        repId,
        doctorId: selectedDoctorId,
        selectedSlides: slides,
        status: 'pending' as const,
        requestType: 'slide_change' as const,
        createdAt: Timestamp.now()
      };

    try {
      await addDoc(requestsCollection, newRequest).catch(err => {
        const contextualError = new FirestorePermissionError({
          operation: 'create',
          path: requestsCollection.path,
          requestResourceData: newRequest
        });
        errorEmitter.emit('permission-error', contextualError);
        throw err;
      });

      toast({
        title: "Request Submitted",
        description: requestType === 'new_doctor'
          ? "Your proposal to add a new doctor has been sent for admin review."
          : "Your slide change request has been sent for admin review.",
      });
      onSubmitted();
      handleClose();

    } catch (err) {
      console.error("Error submitting request:", err);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Could not submit your request. Check console for details.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setStep('type');
      setRequestType('new_doctor');
      setSelectedDoctorId('');
      setDoctorName('');
      setProposedDoctor(null);
      setIsSubmitting(false);
    }, 200);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    } else {
      setIsOpen(true);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Propose Changes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        {step === 'type' ? (
          <>
            <DialogHeader>
              <DialogTitle>What would you like to do?</DialogTitle>
              <DialogDescription>
                Choose the type of change you want to propose
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Button
                variant="outline"
                className="h-auto py-6 flex-col items-start gap-2"
                onClick={() => handleTypeSelect('new_doctor')}
              >
                <div className="font-semibold">Add New Doctor</div>
                <div className="text-sm text-muted-foreground">Propose a new doctor for your city</div>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-6 flex-col items-start gap-2"
                onClick={() => handleTypeSelect('slide_change')}
              >
                <div className="font-semibold">Update Slides for Existing Doctor</div>
                <div className="text-sm text-muted-foreground">Request slide changes for a current doctor</div>
              </Button>
            </div>
          </>
        ) : step === 'details' ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {requestType === 'new_doctor' ? 'Propose a New Doctor' : 'Select Doctor'}
              </DialogTitle>
              <DialogDescription>
                {requestType === 'new_doctor'
                  ? `Enter the name of the new doctor you want to add. They will be assigned to your city, ${repCity}.`
                  : 'Choose the doctor whose slides you want to update'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {requestType === 'new_doctor' ? (
                <div>
                  <Label htmlFor="doctor-name">Doctor Name</Label>
                  <Input
                    id="doctor-name"
                    placeholder="e.g., Jane Smith"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="doctor-select">Select Doctor</Label>
                  <select
                    id="doctor-select"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                  >
                    <option value="">Select a doctor...</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('type')}>Back</Button>
              <Button
                onClick={handleNext}
                disabled={requestType === 'new_doctor' ? !doctorName.trim() : !selectedDoctorId}
              >
                Next: Select Slides
              </Button>
            </DialogFooter>
          </>
        ) : proposedDoctor ? (
          <EditSlidesForm
            doctor={proposedDoctor}
            onSave={handleSlideSave}
            isSaving={isSubmitting}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function RepRequestsPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(
    () => (user?.uid ? doc(firestore!, 'users', user.uid) : null),
    [firestore, user?.uid]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'requests'), where('repId', '==', user.uid));
  }, [firestore, user?.uid]);

  const doctorsQuery = useMemoFirebase(() => {
    if (!firestore || !userProfile?.city) return null;
    return query(collection(firestore, 'doctors'), where('city', '==', userProfile.city));
  }, [firestore, userProfile?.city]);

  const { data: requests, isLoading: isLoadingRequests, forceRefetch } = useCollection<Request>(requestsQuery);
  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsQuery);

  const isLoading = isAuthLoading || isProfileLoading || isLoadingRequests || isLoadingDoctors;

  const sortedRequests = useMemo(() => {
    return requests?.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()) || [];
  }, [requests]);

  // Create a map of doctorId to doctor name for slide change requests
  const doctorMap = useMemo(() => {
    return new Map(doctors?.map(d => [d.id, d.name]) || []);
  }, [doctors]);

  const getStatusBadge = (status: Request['status']) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  // Get display name for request
  const getRequestDoctorName = (req: Request) => {
    if (req.doctorName) {
      // New doctor proposal
      return req.doctorName;
    } else if (req.doctorId) {
      // Slide change request - lookup doctor name
      return doctorMap.get(req.doctorId) || 'Unknown Doctor';
    }
    return 'N/A';
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          My Proposals
        </h1>
        {userProfile?.city && user && doctors && (
          <ProposeChangesDialog
            repId={user.uid}
            repCity={userProfile.city}
            doctors={doctors}
            onSubmitted={forceRefetch}
          />
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Proposal History</CardTitle>
          <CardDescription>Track the status of all the new doctor proposals you have submitted.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Loading proposals...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Proposed Slides</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRequests.length > 0 ? sortedRequests.map(req => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{getRequestDoctorName(req)}</TableCell>
                      <TableCell>
                        {req.requestType === 'slide_change' ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            Slide Update
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                            New Doctor
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-md truncate">
                        <p className="truncate text-xs" title={req.selectedSlides.join(', ')}>
                          {req.selectedSlides.join(', ')}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span title={format(req.createdAt.toDate(), 'PPP p')}>
                          {formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true })}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center">
                          <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                          <h3 className="mt-4 text-lg font-semibold">No Proposals Found</h3>
                          <p className="mt-1 text-sm">
                            Click "Propose Changes" to submit your first proposal.
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
