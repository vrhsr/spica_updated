
'use client';

import React, { useMemo, useState, useTransition } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Loader, Check, X, FileQuestion, MessageSquareQuote } from 'lucide-react';
import { useCollection, WithId } from '@/firebase/firestore/use-collection';
import { collection, doc, updateDoc, Timestamp, writeBatch, addDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { listAllUsers } from '../users/actions';
import useSWR from 'swr';
import { generateAndUpsertPresentation } from '../doctors/actions';

type Request = {
  repId: string;
  // For slide change requests on existing doctors
  doctorId?: string;
  // For new doctor proposals
  doctorName?: string;
  doctorCity?: string;
  selectedSlides: number[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
};

type Doctor = { name: string; city: string; selectedSlides: number[] };
type User = { displayName: string };

type EnrichedRequest = WithId<Request> & {
  doctorNameDisplay: string;
  doctorCityDisplay: string;
  repName?: string;
  requestType: 'New Doctor' | 'Slide Change';
};

export default function AdminRequestsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user: adminUser } = useUser();
  const [isSubmitting, startTransition] = useTransition();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Data fetching
  const { data: allUsers, isLoading: isLoadingUsersSWR } = useSWR('allUsers', listAllUsers);
  const requestsCollection = useMemo(() => firestore ? collection(firestore, 'requests') : null, [firestore]);
  const doctorsCollection = useMemo(() => firestore ? collection(firestore, 'doctors') : null, [firestore]);
  
  const { data: requests, isLoading: isLoadingRequests, forceRefetch: refetchRequests } = useCollection<Request>(requestsCollection);
  const { data: doctors, isLoading: isLoadingDoctors, forceRefetch: refetchDoctors } = useCollection<Doctor>(doctorsCollection);

  const isLoading = isLoadingRequests || isLoadingUsersSWR || isLoadingDoctors;

  // Memoized maps for efficient lookups
  const userMap = useMemo(() => new Map(allUsers?.map(u => [u.uid, u])), [allUsers]);
  const doctorMap = useMemo(() => new Map(doctors?.map(d => [d.id, d])), [doctors]);

  const enrichedRequests = useMemo((): EnrichedRequest[] => {
    if (!requests) return [];
    return requests
      .map(req => {
        const isNewDoctorRequest = !!req.doctorName;
        const doctor = req.doctorId ? doctorMap.get(req.doctorId) : null;
        
        return {
            ...req,
            doctorNameDisplay: req.doctorName || doctor?.name || 'Unknown Doctor',
            doctorCityDisplay: req.doctorCity || doctor?.city || 'Unknown City',
            repName: userMap.get(req.repId)?.displayName || 'Unknown Rep',
            requestType: isNewDoctorRequest ? 'New Doctor' : 'Slide Change'
        };
      })
      .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
  }, [requests, userMap, doctorMap]);
  
  const handleApproveRequest = (request: EnrichedRequest) => {
    if (!firestore || !adminUser || !request.doctorNameDisplay) return;

    setSubmittingId(request.id);
    startTransition(async () => {
      try {
        const requestRef = doc(firestore, 'requests', request.id);

        if (request.requestType === 'New Doctor') {
            // Logic for approving a NEW doctor
            if (!request.doctorName || !request.doctorCity) {
                throw new Error("New doctor request is missing name or city.");
            }
            const doctorsCollection = collection(firestore, 'doctors');

            // 1. Create the new doctor doc
            const newDoctorData = {
                name: request.doctorName,
                city: request.doctorCity,
                selectedSlides: request.selectedSlides,
            };
            const newDoctorRef = await addDoc(doctorsCollection, newDoctorData);

            // 2. Mark the request as 'approved'
            await updateDoc(requestRef, { status: 'approved' });

            // 3. Trigger presentation generation
            const result = await generateAndUpsertPresentation({
                doctorId: newDoctorRef.id,
                doctorName: request.doctorName,
                city: request.doctorCity,
                selectedSlides: request.selectedSlides,
                adminUid: adminUser.uid,
            });

             if (result.error) {
                throw new Error(`Doctor created, but presentation generation failed: ${result.error}`);
            }

            toast({
                title: "New Doctor Approved",
                description: `${request.doctorName} has been added and their presentation is ready.`
            });

        } else {
            // Logic for approving a SLIDE CHANGE
            const batch = writeBatch(firestore);
            
            // 1. Update the doctor's document with the new slides
            const doctorRef = doc(firestore, 'doctors', request.doctorId!);
            batch.update(doctorRef, { selectedSlides: request.selectedSlides });
            
            // 2. Mark the request as 'approved'
            batch.update(requestRef, { status: 'approved' });

            // Commit the batch write
            await batch.commit();

            // 3. Trigger the presentation generation as a separate step after commit
            const result = await generateAndUpsertPresentation({
            doctorId: request.doctorId!,
            doctorName: request.doctorNameDisplay,
            city: request.doctorCityDisplay,
            selectedSlides: request.selectedSlides,
            adminUid: adminUser.uid,
            });

            if (result.error) {
            throw new Error(`Presentation generation failed: ${result.error}`);
            }

            toast({
            title: "Request Approved & PPT Regenerated",
            description: `The slide changes for ${request.doctorNameDisplay} have been applied.`,
            });
        }
        
        refetchRequests(); // Refresh requests list
        refetchDoctors(); // Refresh doctors list 

      } catch(err: any) {
        console.error("Error approving request:", err);
        toast({
          variant: "destructive",
          title: "Approval Failed",
          description: err.message || "Could not approve the request. Check console for details.",
        });
      } finally {
        setSubmittingId(null);
      }
    });
  }

  const handleRejectRequest = (requestId: string) => {
    if (!firestore) return;
    setSubmittingId(requestId);
    startTransition(async () => {
      try {
          const requestRef = doc(firestore, 'requests', requestId);
          await updateDoc(requestRef, { status: 'rejected' });
          
          toast({
              title: "Request Rejected",
              description: "The change request has been marked as rejected.",
          });
          refetchRequests();
      } catch(err) {
          console.error("Error rejecting request:", err);
          toast({
              variant: "destructive",
              title: "Update Failed",
              description: "Could not reject the request. Check console for details.",
          });
      } finally {
          setSubmittingId(null);
      }
    });
  }
  
  const getStatusBadge = (status: Request['status']) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Change Requests
        </h1>
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Review Requests</CardTitle>
          <CardDescription>
            Approve or reject requests from representatives. Approving a request will automatically update slides and regenerate the presentation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Loading requests...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request Type</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Proposed Slides</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedRequests.length > 0 ? (
                  enrichedRequests.map(req => (
                    <TableRow key={req.id}>
                       <TableCell className="font-medium">
                            <Badge variant={req.requestType === 'New Doctor' ? 'secondary' : 'outline'}>
                                {req.requestType}
                            </Badge>
                       </TableCell>
                      <TableCell className="font-medium">{req.doctorNameDisplay}</TableCell>
                       <TableCell className="text-muted-foreground">{req.doctorCityDisplay}</TableCell>
                      <TableCell className="text-muted-foreground">{req.repName}</TableCell>
                      <TableCell className="max-w-xs text-muted-foreground">
                        <p className="truncate text-xs" title={req.selectedSlides.join(', ')}>
                            {req.selectedSlides.join(', ')}
                        </p>
                      </TableCell>
                       <TableCell className="text-muted-foreground">
                        <span title={format(req.createdAt.toDate(), 'PPP p')}>
                            {formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true })}
                        </span>
                       </TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="text-right">
                        {req.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleRejectRequest(req.id)}
                                disabled={isSubmitting}
                            >
                                {submittingId === req.id && isSubmitting ? <Loader className="h-4 w-4 animate-spin"/> : <X className="mr-2 h-4 w-4" />}
                                Reject
                            </Button>
                            <Button 
                                size="sm"
                                onClick={() => handleApproveRequest(req)}
                                disabled={isSubmitting}
                            >
                                {submittingId === req.id && isSubmitting ? <Loader className="h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                                Approve
                            </Button>
                          </div>
                        ) : (
                            <span className="text-xs text-muted-foreground italic">No actions</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 text-lg font-semibold">No Requests Found</h3>
                        <p className="mt-1 text-sm">There are no pending or past requests to review.</p>
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
