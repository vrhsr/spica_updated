
'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlusCircle, Edit, MoreHorizontal, Trash2, ArrowLeft, Loader, FileQuestion, RefreshCcw, ShieldQuestion, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTransition } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AddDoctorDialog, EditSlidesForm } from './AddDoctorDialog';
import { useCollection, WithId } from '@/firebase/firestore/use-collection';
import { collection, query, where, addDoc, doc, updateDoc, deleteDoc, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { generateAndUpsertPresentation } from '@/lib/actions/generatePresentation';


export type Doctor = {
  name: string;
  city: string;
  selectedSlides: number[];
};

type Presentation = {
  doctorId: string;
  city: string;
  pdfUrl?: string;
  updatedAt: Timestamp;
  updatedBy: string;
  dirty: boolean;
  error?: string;
};

type EnrichedDoctor = WithId<Doctor> & {
  presentationStatus?: 'ready' | 'pending' | 'error' | 'generating' | 'not-generated';
  presentationError?: string;
};

export default function DoctorsPage() {
  const searchParams = useSearchParams();
  const cityFilter = searchParams.get('city');
  const firestore = useFirestore();
  const { user: adminUser, role: adminRole, isUserLoading } = useUser();
  const { toast } = useToast();
  const isAdmin = adminRole === 'admin';

  const [editDoctor, setEditDoctor] = React.useState<WithId<Doctor> | null>(null);
  const [doctorToDelete, setDoctorToDelete] = React.useState<WithId<Doctor> | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState<string | null>(null);

  const doctorsQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    const doctorsCollection = collection(firestore, 'doctors');
    if (cityFilter) {
      return query(doctorsCollection, where('city', '==', cityFilter));
    }
    return doctorsCollection;
  }, [firestore, cityFilter, isAdmin]);

  const presentationsQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    const presentationsCollection = collection(firestore, 'presentations');
    if (cityFilter) {
      return query(presentationsCollection, where('city', '==', cityFilter));
    }
    return presentationsCollection;
  }, [firestore, cityFilter, isAdmin]);

  const { data: doctors, isLoading: isLoadingDoctors, error: doctorsError, forceRefetch: refetchDoctors } = useCollection<Doctor>(doctorsQuery);
  const { data: presentations, isLoading: isLoadingPresentations, forceRefetch: refetchPresentations } = useCollection<Presentation>(presentationsQuery);

  const isLoading = isUserLoading || isLoadingDoctors || isLoadingPresentations;

  const handleGeneration = async (doctorId: string, doctorName: string, city: string, selectedSlides: number[]) => {
    if (!adminUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to generate presentations.' });
      return;
    }
    if (selectedSlides.length === 0) {
      toast({ variant: 'destructive', title: 'No Slides Selected', description: 'Cannot generate a presentation with no slides.' });
      return;
    }

    setIsSubmitting(`generate-${doctorId}`);
    try {
      const result = await generateAndUpsertPresentation({
        doctorId,
        doctorName,
        city,
        selectedSlides,
        adminUid: adminUser.uid,
      });

      if ('error' in result) {
        throw new Error(result.error);
      }

      toast({
        title: 'Presentation Ready',
        description: `PDF for ${doctorName} has been generated and is available for download.`
      });
      refetchPresentations();

    } catch (err: any) {
      console.error("Error during presentation generation/upsert:", err);
      toast({ variant: 'destructive', title: 'Generation Failed', description: err.message || 'An unknown error occurred.' });
      // Force a refetch even on failure to get the error state from the DB
      refetchPresentations();
    } finally {
      setIsSubmitting(null);
    }
  }

  const enrichedDoctors: EnrichedDoctor[] = React.useMemo(() => {
    if (!doctors) return [];
    const presentationMap = new Map(presentations?.map(p => [p.doctorId, p]) || []);

    return doctors.map(doctor => {
      const presentation = presentationMap.get(doctor.id);
      let status: EnrichedDoctor['presentationStatus'] = 'not-generated';
      if (presentation) {
        if (presentation.error) status = 'error';
        else if (presentation.dirty) status = 'pending';
        else status = 'ready';
      }

      // Override status if currently submitting for this doctor
      if (isSubmitting === `generate-${doctor.id}` || isSubmitting === `edit-slides-${doctor.id}` || isSubmitting === `add-${doctor.id}`) {
        status = 'generating';
      }

      return {
        ...doctor,
        presentationStatus: status,
        presentationError: presentation?.error,
      };
    });
  }, [doctors, presentations, isSubmitting]);


  const getStatusBadge = (doctor: EnrichedDoctor) => {
    const status = doctor.presentationStatus;
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-100 text-green-800">Ready</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'error':
        return <Badge variant="destructive" title={doctor.presentationError}>Error</Badge>;
      case 'generating':
        return <Badge className="bg-blue-100 text-blue-800 animate-pulse">Generating...</Badge>;
      default:
        return <Badge variant="outline">Not Generated</Badge>;
    }
  };


  const handleDoctorAdded = async (newDoctor: Omit<Doctor, 'status'>) => {
    if (!firestore || !adminUser) return;

    let tempId: string | null = null;
    try {
      setIsSubmitting('add-doctor');
      const doctorsCollection = collection(firestore, 'doctors');
      const docRef = await addDoc(doctorsCollection, newDoctor).catch(err => {
        const contextualError = new FirestorePermissionError({
          operation: 'create',
          path: doctorsCollection.path,
          requestResourceData: newDoctor
        });
        errorEmitter.emit('permission-error', contextualError);
        throw err;
      });
      tempId = docRef.id;
      setIsSubmitting(`add-${tempId}`);
      toast({
        title: "Doctor Added",
        description: `${newDoctor.name} has been successfully added.Generating presentation...`,
      });
      refetchDoctors();
      // Now generate the presentation immediately
      await handleGeneration(docRef.id, newDoctor.name, newDoctor.city, newDoctor.selectedSlides);

    } catch (err) {
      console.error("Error adding doctor:", err);
      toast({
        variant: "destructive",
        title: "Failed to Add Doctor",
        description: "Could not save the new doctor. Please check the console for details."
      });
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleEditSlidesSave = async (slides: number[]) => {
    if (!editDoctor || !firestore) return;

    const originalDoctorId = editDoctor.id;
    try {
      setIsSubmitting(`edit-slides-${originalDoctorId}`);
      const doctorRef = doc(firestore, 'doctors', editDoctor.id);

      // We set `dirty: true` here so the UI can show a pending state immediately
      const updatedData = { selectedSlides: slides };
      await updateDoc(doctorRef, updatedData);

      const presentationsRef = collection(firestore, 'presentations');
      const q = query(presentationsRef, where('doctorId', '==', editDoctor.id));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        await updateDoc(snapshot.docs[0].ref, { dirty: true });
      }

      toast({
        title: "Slides Updated",
        description: `Slides for ${editDoctor.name} have been updated.Regenerating presentation...`,
      });
      setEditDoctor(null); // Close dialog on success before generation
      refetchDoctors();
      refetchPresentations(); // refetch to show dirty state
      await handleGeneration(
        editDoctor.id,
        editDoctor.name,
        editDoctor.city,
        [...slides] // ensure clean copy
      );

    } catch (err) {
      console.error("Error updating slides:", err);
      toast({
        variant: "destructive",
        title: "Failed to Update Slides",
        description: "Could not save slide changes. Please check the console for details."
      });
    } finally {
      setIsSubmitting(null);
      if (editDoctor && originalDoctorId === editDoctor.id) {
        setEditDoctor(null);
      }
    }
  }

  const handleDeleteDoctor = async () => {
    if (!doctorToDelete || !firestore) return;

    try {
      setIsSubmitting(`delete-${doctorToDelete.id}`);
      const batch = writeBatch(firestore);
      const doctorRef = doc(firestore, 'doctors', doctorToDelete.id);
      const presentationsRef = collection(firestore, 'presentations');
      const q = query(presentationsRef, where('doctorId', '==', doctorToDelete.id));

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const presentationDocRef = snapshot.docs[0].ref;
        batch.delete(presentationDocRef);
      }

      batch.delete(doctorRef);

      await batch.commit().catch(err => {
        const contextualError = new FirestorePermissionError({
          operation: 'delete',
          path: doctorRef.path,
        });
        errorEmitter.emit('permission-error', contextualError);
        throw err;
      });

      toast({
        title: 'Doctor Deleted',
        description: `${doctorToDelete.name} and their associated presentation have been successfully deleted.`,
      });
      refetchDoctors();
      refetchPresentations();

    } catch (err) {
      console.error("Error deleting doctor and presentation:", err);
      toast({
        variant: "destructive",
        title: "Failed to Delete Doctor",
        description: "Could not delete the doctor. Please check the console."
      });
    } finally {
      setDoctorToDelete(null);
      setIsSubmitting(null);
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {cityFilter && (
            <Button variant="outline" size="icon" asChild>
              <Link href="/admin/cities">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <h1 className="font-headline text-2xl md:text-3xl font-bold tracking-tight">
            Manage Doctors {cityFilter && <span className="text-primary">({cityFilter})</span>}
          </h1>
        </div>
        <AddDoctorDialog
          onDoctorAdded={handleDoctorAdded}
          defaultCity={cityFilter || undefined}
          triggerButton={
            <Button disabled={!!isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Doctor
            </Button>
          }
        />
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Doctors</CardTitle>
              <CardDescription>
                {cityFilter
                  ? `Doctors in ${cityFilter}. Click the back arrow to view all cities.`
                  : 'Manage all doctors and their presentations.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Loading doctors...</p>
            </div>
          ) : doctorsError ? (
            <div className="py-8 text-center text-destructive">
              Failed to load doctors. This may be a security rule issue. Check the console.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Assigned Slides</TableHead>
                      <TableHead>Presentation Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrichedDoctors && enrichedDoctors.length > 0 ? enrichedDoctors.map((doctor) => (
                      <TableRow key={doctor.id} className={!!isSubmitting ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{doctor.name}</TableCell>
                        <TableCell>{doctor.city}</TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-xs truncate">{doctor.selectedSlides.join(', ')}</TableCell>
                        <TableCell>{getStatusBadge(doctor)}</TableCell>
                        <TableCell className="text-right">
                          {doctor.presentationStatus === 'error' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="mr-2"
                              onClick={() => handleGeneration(
                                doctor.id,
                                doctor.name,
                                doctor.city,
                                [...doctor.selectedSlides]
                              )
                              }
                              disabled={!!isSubmitting}
                            >
                              <RefreshCcw className="mr-2 h-4 w-4" />
                              Retry
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" disabled={!!isSubmitting}>
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setEditDoctor(doctor)} disabled={!!isSubmitting}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Slides
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-500 focus:bg-red-500/10 focus:text-red-600"
                                onClick={() => setDoctorToDelete(doctor)}
                                disabled={!!isSubmitting}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Doctor
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center">
                            <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold">No Doctors Found</h3>
                            <p className="mt-1 text-sm">
                              {cityFilter ? `No doctors have been added to ${cityFilter} yet.` : "No doctors have been added yet."}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {enrichedDoctors && enrichedDoctors.length > 0 ? enrichedDoctors.map((doctor) => (
                  <Card key={doctor.id} className={`p - 4 ${!!isSubmitting ? 'opacity-50' : ''} `}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold">{doctor.name}</p>
                          <p className="text-sm text-muted-foreground">{doctor.city}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Slides: {doctor.selectedSlides.join(', ')}
                          </p>
                        </div>
                        <div>{getStatusBadge(doctor)}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {doctor.presentationStatus === 'error' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleGeneration(
                              doctor.id,
                              doctor.name,
                              doctor.city,
                              [...doctor.selectedSlides]
                            )}
                            disabled={!!isSubmitting}
                            className="flex-1"
                          >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Retry
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditDoctor(doctor)}
                          disabled={!!isSubmitting}
                          className="flex-1"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Slides
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!!isSubmitting}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              className="text-red-500"
                              onClick={() => setDoctorToDelete(doctor)}
                              disabled={!!isSubmitting}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Doctor
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </Card>
                )) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-semibold">No Doctors Found</h3>
                    <p className="mt-1 text-sm">
                      Add a doctor to get started with creating presentations.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Slides Dialog */}
      <Dialog open={!!editDoctor} onOpenChange={(open) => !open && setEditDoctor(null)}>
        <DialogContent className="max-w-2xl">
          {editDoctor && (
            <EditSlidesForm doctor={editDoctor} onSave={handleEditSlidesSave} isSaving={isSubmitting === `edit - slides - ${editDoctor.id} `} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!doctorToDelete} onOpenChange={(open) => !open && setDoctorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the record for <span className="font-bold">{doctorToDelete?.name}</span> and their associated presentation. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDoctor} disabled={!!isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


