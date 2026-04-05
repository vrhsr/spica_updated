
'use client';

import React, { useMemo, useState, useTransition, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { Loader, Check, X, FileQuestion, MessageSquareQuote, Eye, Edit } from 'lucide-react';
import { useCollection, WithId } from '@/firebase/firestore/use-collection';
import { collection, doc, updateDoc, Timestamp, writeBatch, addDoc, getDocs, query as fsQuery, where } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { listAllUsers } from '../users/actions';
import useSWR from 'swr';
import { generateAndUpsertPresentation } from '@/lib/actions/generatePresentation';
import { SlidePreviewDialog } from '@/components/SlidePreviewDialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EditSlidesForm } from '@/components/EditSlidesForm';

type Request = {
  repId: string;
  // For slide change requests on existing doctors
  doctorId?: string;
  // For new doctor proposals
  doctorName?: string;
  doctorCity?: string;
  doctorDistrict?: string;
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
  repDistrict?: string;
  requestType: 'New Doctor' | 'Slide Change';
};

export default function AdminRequestsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user: adminUser } = useUser();
  const [isSubmitting, startTransition] = useTransition();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [previewRequest, setPreviewRequest] = useState<EnrichedRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<EnrichedRequest | null>(null);

  // Get search params for filtering
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Set initial filter from URL params
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
      setStatusFilter(status);
    }
  }, [searchParams]);

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
          repDistrict: userMap.get(req.repId)?.city || 'Unknown District',
          requestType: (isNewDoctorRequest ? 'New Doctor' : 'Slide Change') as 'New Doctor' | 'Slide Change'
        };
      })
      .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
  }, [requests, userMap, doctorMap]);

  // Apply status filtering
  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return enrichedRequests;
    return enrichedRequests.filter(req => req.status === statusFilter);
  }, [enrichedRequests, statusFilter]);

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

          // 1. Extract correct District and City
          const districtName = (request as any).doctorDistrict || request.repDistrict || '';
          const cityName = request.doctorCity.trim().toUpperCase();

          // 2. Create the new doctor doc
          const newDoctorData = {
            name: request.doctorName,
            city: districtName, // District
            subCity: cityName,  // Actual City
            selectedSlides: request.selectedSlides,
          };
          const newDoctorRef = await addDoc(doctorsCollection, newDoctorData);

          // 3. Auto-create the city in districts_cities if it doesn't already exist
          const citiesRef = collection(firestore, 'districts_cities');
          const existingCitySnap = await getDocs(
            fsQuery(citiesRef, where('name', '==', cityName), where('districtName', '==', districtName))
          );
          if (existingCitySnap.empty && cityName !== districtName.toUpperCase()) {
            await addDoc(citiesRef, { name: cityName, districtName });
            console.log(`Auto-created city "${cityName}" under district "${districtName}"`);
          }

          // 4. Mark the request as 'approved' and persist final slide selection
          await updateDoc(requestRef, { status: 'approved', selectedSlides: request.selectedSlides });

          // 5. Trigger presentation generation
          const result = await generateAndUpsertPresentation({
            doctorId: newDoctorRef.id,
            doctorName: request.doctorName,
            city: districtName, // ALWAYS use District for filtering compatibility
            selectedSlides: request.selectedSlides,
            adminUid: adminUser.uid,
          });

          if ('error' in result) {
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

          // 2. Mark the request as 'approved' and persist final slide selection
          batch.update(requestRef, { status: 'approved', selectedSlides: request.selectedSlides });

          // Commit the batch write
          await batch.commit();

          // 3. Trigger the presentation generation as a separate step after commit
          const doctor = doctorMap.get(request.doctorId!);
          const result = await generateAndUpsertPresentation({
            doctorId: request.doctorId!,
            doctorName: request.doctorNameDisplay,
            city: doctor?.city || request.repDistrict || request.doctorCityDisplay, // District name is required for Rep portal visibility
            selectedSlides: request.selectedSlides,
            adminUid: adminUser.uid,
          });

          if ('error' in result) {
            throw new Error(`Presentation generation failed: ${result.error}`);
          }

          toast({
            title: "Request Approved & PPT Regenerated",
            description: `The slide changes for ${request.doctorNameDisplay} have been applied.`,
          });
        }

        refetchRequests(); // Refresh requests list
        refetchDoctors(); // Refresh doctors list 

      } catch (err: any) {
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
      } catch (err) {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Representative Requests
          </h1>
          <p className="text-muted-foreground">
            Review and approve doctor proposals or slide changes submitted from the field.
          </p>
        </div>
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Review Requests</CardTitle>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className="w-full sm:w-auto"
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('pending')}
                className="w-full sm:w-auto"
              >
                Pending
              </Button>
              <Button
                variant={statusFilter === 'approved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('approved')}
                className="w-full sm:w-auto"
              >
                Approved
              </Button>
              <Button
                variant={statusFilter === 'rejected' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('rejected')}
                className="w-full sm:w-auto"
              >
                Rejected
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Loading requests...</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto bg-card rounded-xl border shadow-sm max-w-[calc(100vw-3rem)] md:max-w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request Type</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Proposed City</TableHead>
                        <TableHead>Representative</TableHead>
                        <TableHead>District</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-14">View</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.length > 0 ? (
                        filteredRequests.map(req => (
                          <TableRow key={req.id}>
                            <TableCell className="font-medium">
                              {req.requestType === 'New Doctor' ? (
                                <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                                  {req.requestType}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                                  {req.requestType}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{req.doctorNameDisplay}</TableCell>
                            <TableCell className="text-muted-foreground">{req.doctorCityDisplay}</TableCell>
                            <TableCell className="text-muted-foreground">{req.repName}</TableCell>
                            <TableCell className="text-muted-foreground font-medium">{req.repDistrict}</TableCell>
                            <TableCell className="text-muted-foreground">
                              <span title={format(req.createdAt.toDate(), 'PPP p')}>
                                {formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true })}
                              </span>
                            </TableCell>
                            <TableCell>{getStatusBadge(req.status)}</TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setPreviewRequest(req)}
                                disabled={isSubmitting}
                                title="View Slides"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              {req.status === 'pending' ? (
                                <div className="flex justify-end items-center gap-2">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => setEditingRequest(req)}
                                    disabled={isSubmitting}
                                    title="Edit slides before approving"
                                    className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRejectRequest(req.id)}
                                    disabled={isSubmitting}
                                  >
                                    {submittingId === req.id && isSubmitting ? <Loader className="h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                                    Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveRequest(req)}
                                    disabled={isSubmitting}
                                  >
                                    {submittingId === req.id && isSubmitting ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
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
                          <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
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
                </div>

              {/* Mobile Card View */}
              <div className="lg:hidden grid gap-3 grid-cols-1 sm:grid-cols-2">
                {filteredRequests.length > 0 ? (
                  filteredRequests.map(req => (
                    <Card key={req.id} className="overflow-hidden border rounded-xl shadow-sm">
                      <CardContent className="p-0 flex flex-col h-full">
                        <div className="bg-muted/10 p-3 border-b flex items-start justify-between gap-3 border-primary/5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {req.requestType === 'New Doctor' ? (
                                <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-[10px] py-0 px-1.5 h-4 font-semibold uppercase tracking-widest leading-tight">
                                  {req.requestType}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-[10px] py-0 px-1.5 h-4 font-semibold uppercase tracking-widest leading-tight">
                                  {req.requestType}
                                </Badge>
                              )}
                            </div>
                            <p className="font-headline text-[1.05rem] font-bold text-primary truncate leading-tight">{req.doctorNameDisplay}</p>
                            <div className="flex items-center text-xs text-muted-foreground mt-1 gap-1 flex-wrap">
                              <span className="font-medium bg-primary/5 text-primary/80 px-1.5 py-0.5 rounded">{req.doctorCityDisplay}</span>
                              <span className="text-muted-foreground/30">•</span>
                              <span className="text-xs text-muted-foreground mt-0.5">Rep: <span className="font-medium text-foreground">{req.repName}</span> ({req.repDistrict})</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-1.5">
                              {formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="shrink-0">{getStatusBadge(req.status)}</div>
                        </div>

                        <div className="p-3 grid gap-2 mt-auto">
                          {req.status === 'pending' ? (
                            <div className="grid grid-cols-3 gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewRequest(req)}
                                disabled={isSubmitting}
                                className="w-full text-xs h-8 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                              >
                                <Eye className="mr-1.5 h-3 w-3" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectRequest(req.id)}
                                disabled={isSubmitting}
                                className="w-full text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                              >
                                {submittingId === req.id && isSubmitting ? <Loader className="h-3 w-3 animate-spin mx-auto" /> : <><X className="mr-1.5 h-3 w-3" />Reject</>}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApproveRequest(req)}
                                disabled={isSubmitting}
                                className="w-full text-xs h-8 bg-green-600 hover:bg-green-700 text-white"
                              >
                                {submittingId === req.id && isSubmitting ? <Loader className="h-3 w-3 animate-spin mx-auto" /> : <><Check className="mr-1.5 h-3 w-3" />Approve</>}
                              </Button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewRequest(req)}
                                disabled={isSubmitting}
                                className="w-full text-xs h-8"
                              >
                                <Eye className="mr-1.5 h-3 w-3" />
                                View Details
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full py-12 px-4 text-center border-2 border-dashed rounded-xl border-muted bg-muted/5 text-muted-foreground">
                    <FileQuestion className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <h3 className="text-sm font-semibold">No Requests Found</h3>
                    <p className="text-xs mt-1">There are no pending or past requests to review.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <SlidePreviewDialog
        open={!!previewRequest}
        onOpenChange={(open) => !open && setPreviewRequest(null)}
        slideNumbers={previewRequest?.selectedSlides || []}
        doctorName={previewRequest?.doctorNameDisplay}
      />

      {/* Edit Slides Dialog - admin can modify proposed slides before approving */}
      <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
        <DialogContent className="max-w-2xl">
          {editingRequest && (
            <EditSlidesForm
              doctor={{
                name: editingRequest.doctorNameDisplay,
                city: editingRequest.doctorCity,
                selectedSlides: editingRequest.selectedSlides,
              }}
              showCityEdit={editingRequest.requestType === 'New Doctor'}
              onSave={async (newSlides, updatedCity) => {
                if (!editingRequest) return;
                
                // Close the dialog immediately
                setEditingRequest(null);
                
                // Notify user
                toast({
                  title: 'Saving changes...',
                  description: 'Applying your edits and generating the final presentation.',
                });

                // Directly pass to the approve handler to save edits, approve, and generate!
                handleApproveRequest({
                  ...editingRequest,
                  selectedSlides: newSlides,
                  doctorCity: updatedCity || editingRequest.doctorCity
                });
              }}
              isSaving={isSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
