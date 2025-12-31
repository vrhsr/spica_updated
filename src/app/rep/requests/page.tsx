
'use client';

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
};

function AddDoctorRequestDialog({ repId, repCity, onSubmitted }: { repId: string; repCity: string; onSubmitted: () => void }) {
  const [step, setStep] = useState<'details' | 'slides'>('details');
  const [doctorName, setDoctorName] = useState('');
  const [proposedDoctor, setProposedDoctor] = useState<Partial<Doctor> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleNext = () => {
    if (doctorName.trim()) {
      const finalName = doctorName.trim().startsWith('Dr.') ? doctorName.trim() : `Dr. ${doctorName.trim()}`;
      setProposedDoctor({ name: finalName, city: repCity });
      setStep('slides');
    }
  }

  const handleSlideSave = async (slides: number[]) => {
    if (!firestore || !proposedDoctor) return;
    
    setIsSubmitting(true);
    const requestsCollection = collection(firestore, 'requests');
    const newRequest = {
        repId,
        doctorName: proposedDoctor.name,
        doctorCity: proposedDoctor.city,
        selectedSlides: slides,
        status: 'pending' as const,
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
            description: "Your proposal to add a new doctor has been sent for admin review.",
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
  }

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
        setStep('details');
        setDoctorName('');
        setProposedDoctor(null);
        setIsSubmitting(false);
    }, 200);
  }
  
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
          <PlusCircle className="mr-2 h-4 w-4" /> Add Doctor & Propose PPT
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        {step === 'details' ? (
          <>
            <DialogHeader>
              <DialogTitle>Propose a New Doctor</DialogTitle>
              <DialogDescription>
                Enter the name of the new doctor you want to add. They will be assigned to your city, <span className="font-bold">{repCity}</span>. The "Dr." prefix will be added automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div>
                    <Label htmlFor="doctor-name">Doctor Name</Label>
                    <Input
                        id="doctor-name"
                        placeholder="e.g., Jane Smith"
                        value={doctorName}
                        onChange={(e) => setDoctorName(e.target.value)}
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleNext} disabled={!doctorName.trim()}>
                    Next: Propose Slides
                </Button>
            </DialogFooter>
          </>
        ) : proposedDoctor ? (
            <EditSlidesForm
                doctor={proposedDoctor}
                onSave={handleSlideSave}
                isSaving={isSubmitting}
            />
        ): null}
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

  const { data: requests, isLoading: isLoadingRequests, forceRefetch } = useCollection<Request>(requestsQuery);

  const isLoading = isAuthLoading || isProfileLoading || isLoadingRequests;
  
  const sortedRequests = useMemo(() => {
    return requests?.sort((a,b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()) || [];
  }, [requests]);

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


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          My Proposals
        </h1>
        {userProfile?.city && user && (
          <AddDoctorRequestDialog repId={user.uid} repCity={userProfile.city} onSubmitted={forceRefetch} />
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
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Doctor Name</TableHead>
                        <TableHead>Proposed Slides</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedRequests.length > 0 ? sortedRequests.map(req => (
                        <TableRow key={req.id}>
                            <TableCell className="font-medium">{req.doctorName || 'N/A'}</TableCell>
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
                            <TableCell colSpan={4} className="h-48 text-center text-muted-foreground">
                                <div className="flex flex-col items-center justify-center">
                                    <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                                    <h3 className="mt-4 text-lg font-semibold">No Proposals Found</h3>
                                    <p className="mt-1 text-sm">
                                        Click "Add Doctor & Propose PPT" to submit your first proposal.
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
