
'use client';

import React, { useState, useMemo, useTransition, Suspense } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, Search, Loader, FileQuestion, RefreshCcw, MoreHorizontal, Eye, ChevronsUpDown, X, ShieldQuestion, Edit, Trash2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useCollection, WithId } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, updateDoc, Timestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { generateAndUpsertPresentation } from '@/lib/actions/generatePresentation';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { EditSlidesForm } from '../doctors/AddDoctorDialog';


type Presentation = {
  doctorId: string;
  city: string;
  pdfUrl?: string;
  updatedAt: Timestamp;
  updatedBy: string;
  dirty: boolean;
  error?: string;
};

type Doctor = {
  id: string;
  name: string;
  city: string;
  selectedSlides: number[];
};

type EnrichedPresentation = WithId<Presentation> & {
  doctorName?: string;
  doctorSlides?: number[];
  status: 'ready' | 'pending' | 'failed' | 'generating' | 'unknown';
};

function PresentationsComponent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchTerm = searchParams.get('q') || '';
  const cityFilter = searchParams.get('city');
  const statusFilter = searchParams.get('status');

  const [isTransitioning, startTransition] = useTransition();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [editingPresentation, setEditingPresentation] = useState<EnrichedPresentation | null>(null);
  const [deletingPresentation, setDeletingPresentation] = useState<EnrichedPresentation | null>(null);

  const firestore = useFirestore();
  const { user: adminUser, role: adminRole, isUserLoading } = useUser();
  const { toast } = useToast();

  const isAdmin = adminRole === 'admin';

  const presentationsQuery = useMemoFirebase(() =>
    (firestore && isAdmin) ? collection(firestore, 'presentations') : null,
    [firestore, isAdmin]
  );
  const doctorsQuery = useMemoFirebase(() =>
    (firestore && isAdmin) ? collection(firestore, 'doctors') : null,
    [firestore, isAdmin]
  );

  const { data: presentations, isLoading: isLoadingPresentations, error: presentationsError, forceRefetch } = useCollection<Presentation>(presentationsQuery);
  const { data: doctors, isLoading: isLoadingDoctors, forceRefetch: refetchDoctors } = useCollection<Doctor>(doctorsQuery);

  const isLoading = isUserLoading || isLoadingPresentations || isLoadingDoctors;
  const isAnyFilterActive = !!searchTerm || !!cityFilter || !!statusFilter;

  const doctorsMap = useMemo(() => {
    if (!doctors) return new Map<string, Omit<Doctor, 'id'>>();
    return new Map(doctors.map(doc => [doc.id, { name: doc.name, city: doc.city, selectedSlides: doc.selectedSlides }]));
  }, [doctors]);

  const { availableCities, availableStatuses } = useMemo(() => {
    if (!presentations) return { availableCities: [], availableStatuses: [] };

    const citySet = new Set<string>();
    const statusSet = new Set<EnrichedPresentation['status']>();

    presentations.forEach(p => {
      citySet.add(p.city);
      if (p.error) statusSet.add('failed');
      else if (p.dirty) statusSet.add('pending');
      else if (p.pdfUrl) statusSet.add('ready');
    });

    return {
      availableCities: [...citySet].sort(),
      availableStatuses: [...statusSet].sort(),
    };
  }, [presentations]);


  const handleFilterChange = (key: 'q' | 'city' | 'status', value: string | null) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (!value) {
      current.delete(key);
    } else {
      current.set(key, value);
    }
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`${pathname}${query}`);
  };


  const enrichedPresentations = useMemo((): EnrichedPresentation[] => {
    if (!presentations) return [];

    let enriched = presentations.map(p => {
      const doctorInfo = doctorsMap.get(p.doctorId);
      let status: EnrichedPresentation['status'] = 'unknown';

      if (generatingId === p.id) {
        status = 'generating';
      } else if (p.error) {
        status = 'failed';
      } else if (p.dirty) {
        status = 'pending';
      } else if (p.pdfUrl) {
        status = 'ready';
      }

      return {
        ...p,
        doctorName: doctorInfo?.name || 'Unknown Doctor',
        doctorSlides: doctorInfo?.selectedSlides || [],
        status,
      }
    });

    if (statusFilter) {
      enriched = enriched.filter(p => p.status === statusFilter);
    }
    if (cityFilter) {
      enriched = enriched.filter(p => p.city === cityFilter);
    }
    if (searchTerm) {
      enriched = enriched.filter(p =>
        (p.doctorName && p.doctorName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return enriched.sort((a, b) => b.updatedAt.toDate().getTime() - a.updatedAt.toDate().getTime());

  }, [presentations, doctorsMap, searchTerm, statusFilter, cityFilter, generatingId]);

  const getStatusBadge = (presentation: EnrichedPresentation) => {
    switch (presentation.status) {
      case 'generating':
        return <Badge className="bg-blue-100 text-blue-800 animate-pulse">Generating...</Badge>;
      case 'failed':
        return <Badge variant="destructive" title={presentation.error}>Failed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'ready':
        return <Badge className="bg-green-100 text-green-800">Ready</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  }

  const handleGenerate = async (presentation: EnrichedPresentation) => {
    if (!adminUser || !presentation.doctorSlides || !presentation.doctorName) {
      toast({ title: 'Error', description: 'Missing required data to generate.', variant: 'destructive' });
      return;
    }

    setGeneratingId(presentation.id);
    startTransition(async () => {
      try {
        const result = await generateAndUpsertPresentation({
          doctorId: presentation.doctorId,
          doctorName: presentation.doctorName!,
          city: presentation.city,
          selectedSlides: presentation.doctorSlides || [],
          adminUid: adminUser.uid,
        });

        if ('error' in result) {
          throw new Error(result.error);
        }

        toast({
          title: 'Presentation Ready',
          description: `PDF for ${presentation.doctorName} has been regenerated.`
        });
        forceRefetch();

      } catch (err: any) {
        console.error("Error generating presentation:", err);
        toast({ title: 'Generation Failed', description: err.message || 'An unknown error occurred.', variant: 'destructive' });
      } finally {
        setGeneratingId(null);
      }
    });
  }

  const handleRegenerate = async (presentation: EnrichedPresentation) => {
    if (!firestore || !adminUser) return;

    const presentationRef = doc(firestore, 'presentations', presentation.id);
    const updateData = {
      dirty: true,
      updatedAt: Timestamp.now(),
      updatedBy: adminUser.uid,
      error: null, // Clear previous errors when marking for regeneration
    };
    try {
      await updateDoc(presentationRef, updateData).catch(err => {
        const contextualError = new FirestorePermissionError({ operation: 'update', path: presentationRef.path, requestResourceData: updateData });
        errorEmitter.emit('permission-error', contextualError);
        throw err;
      });
      toast({
        title: 'Marked for Regeneration',
        description: `Presentation for ${presentation.doctorName} is now pending generation.`
      });
      forceRefetch();
    } catch (err) {
      console.error("Error marking for regeneration:", err);
      toast({ title: 'Error', description: 'Could not mark for regeneration.', variant: 'destructive' });
    }
  }

  const handleEditSlidesSave = async (slides: number[]) => {
    if (!editingPresentation || !firestore || !adminUser) return;

    const originalPresentationId = editingPresentation.id;
    setGeneratingId(originalPresentationId);
    setEditingPresentation(null); // Close dialog immediately

    startTransition(async () => {
      try {
        // 1. Update the doctor document
        const doctorRef = doc(firestore, 'doctors', editingPresentation.doctorId);
        await updateDoc(doctorRef, { selectedSlides: slides });
        refetchDoctors(); // re-fetch doctors to update the map

        // 2. Mark presentation as dirty (not strictly needed as we regenerate right away, but good practice)
        const presentationRef = doc(firestore, 'presentations', originalPresentationId);
        await updateDoc(presentationRef, { dirty: true, updatedAt: Timestamp.now(), updatedBy: adminUser.uid });
        forceRefetch(); // re-fetch presentations to show pending state

        toast({
          title: "Slides Updated",
          description: `Slides for ${editingPresentation.doctorName} have been updated. Regenerating presentation...`,
        });

        // 3. Trigger regeneration
        await handleGenerate({ ...editingPresentation, doctorSlides: slides });

      } catch (err: any) {
        console.error("Error updating slides:", err);
        toast({
          variant: "destructive",
          title: "Failed to Update Slides",
          description: "Could not save slide changes. Please check the console for details."
        });
      } finally {
        setGeneratingId(null);
      }
    });
  }

  const handleDeletePresentation = async (presentation: EnrichedPresentation) => {
    if (!firestore || !adminUser) return;

    setGeneratingId(presentation.id); // Reuse existing loading state
    setDeletingPresentation(null); // Close confirmation dialog

    startTransition(async () => {
      try {
        const presentationRef = doc(firestore, 'presentations', presentation.id);
        await deleteDoc(presentationRef);

        toast({
          title: 'Presentation Deleted',
          description: `Presentation for ${presentation.doctorName} has been removed.`
        });
        forceRefetch();
      } catch (err: any) {
        console.error("Error deleting presentation:", err);
        toast({
          title: 'Delete Failed',
          description: err.message || 'Could not delete presentation.',
          variant: 'destructive'
        });
      } finally {
        setGeneratingId(null);
      }
    });
  }



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
          <CardDescription>
            You do not have the necessary permissions to view this page. This is because your account does not have the 'admin' role. Please contact the system administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Manage Presentations
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by doctor name..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => handleFilterChange('q', e.target.value)}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => handleFilterChange('q', null)}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
          {isAnyFilterActive && (
            <Button variant="ghost" onClick={() => router.push(pathname)}>
              Clear Filters
            </Button>
          )}
        </div>
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Presentations Library</CardTitle>
          <CardDescription>View, download, or regenerate presentations for doctors.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Loading presentations...</p>
            </div>
          ) : presentationsError ? (
            <div className="py-8 text-center text-destructive">
              Failed to load presentations. This may be a security rule issue. Check the console.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor Name</TableHead>
                      <TableHead>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="-ml-4">
                              City {cityFilter && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{cityFilter}</span>}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuLabel>Filter by City</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem checked={!cityFilter} onSelect={() => handleFilterChange('city', null)}>
                              All Cities
                            </DropdownMenuCheckboxItem>
                            {availableCities.map(city => (
                              <DropdownMenuCheckboxItem
                                key={city}
                                checked={cityFilter === city}
                                onSelect={() => handleFilterChange('city', city)}
                              >
                                {city}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="-ml-4">
                              Status {statusFilter && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-secondary-foreground">{statusFilter}</span>}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem checked={!statusFilter} onSelect={() => handleFilterChange('status', null)}>
                              All Statuses
                            </DropdownMenuCheckboxItem>
                            {availableStatuses.map(status => (
                              <DropdownMenuCheckboxItem
                                key={status}
                                checked={statusFilter === status}
                                onSelect={() => handleFilterChange('status', status)}
                                className="capitalize"
                              >
                                {status}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrichedPresentations.length > 0 ? (
                      enrichedPresentations.map((presentation) => (
                        <TableRow key={presentation.id} className={(isTransitioning || !!generatingId) ? 'opacity-50' : ''}>
                          <TableCell className="font-medium">
                            {presentation.doctorName}
                          </TableCell>
                          <TableCell>{presentation.city}</TableCell>
                          <TableCell>
                            {presentation.updatedAt ? (
                              <span title={format(presentation.updatedAt.toDate(), 'PPP p')}>
                                {formatDistanceToNow(presentation.updatedAt.toDate(), { addSuffix: true })}
                              </span>
                            ) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(presentation)}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {presentation.status === 'pending' || presentation.status === 'failed' ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleGenerate(presentation)}
                                disabled={isTransitioning || !!generatingId}
                              >
                                {generatingId === presentation.id ? (
                                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCcw className="mr-2 h-4 w-4" />
                                )}
                                Generate
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(presentation.pdfUrl, '_blank')}
                                disabled={!presentation.pdfUrl || isTransitioning || !!generatingId}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPresentation(presentation)}
                              disabled={isTransitioning || !!generatingId}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" disabled={isTransitioning || !!generatingId}>
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>More Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (presentation.pdfUrl) {
                                      const link = document.createElement('a');
                                      link.href = presentation.pdfUrl;
                                      link.setAttribute('download', `${presentation.doctorName?.replace(/ /g, '_')}_presentation.pdf`);
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }
                                  }}
                                  disabled={!presentation.pdfUrl}
                                >
                                  <Download className="mr-2 h-4 w-4" /> Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRegenerate(presentation)}
                                  disabled={presentation.dirty || isTransitioning || !!generatingId}
                                >
                                  <RefreshCcw className="mr-2 h-4 w-4" /> Mark for Regeneration
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeletingPresentation(presentation)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Presentation
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-48 text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold">No Presentations Found</h3>
                            <p className="mt-1 text-sm">
                              {isAnyFilterActive
                                ? `No presentations match your current filters.`
                                : "Assign slides to a doctor to create a presentation."
                              }
                            </p>
                            {(isAnyFilterActive) && (
                              <Button variant="link" onClick={() => router.push(pathname)}>Clear All Filters</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {enrichedPresentations.length > 0 ? (
                  enrichedPresentations.map((presentation) => (
                    <Card key={presentation.id} className={`p-4 ${(isTransitioning || !!generatingId) ? 'opacity-50' : ''}`}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold">{presentation.doctorName}</p>
                            <p className="text-sm text-muted-foreground">{presentation.city}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {presentation.updatedAt ? formatDistanceToNow(presentation.updatedAt.toDate(), { addSuffix: true }) : 'N/A'}
                            </p>
                          </div>
                          <div>{getStatusBadge(presentation)}</div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {presentation.status === 'pending' || presentation.status === 'failed' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleGenerate(presentation)}
                              disabled={isTransitioning || !!generatingId}
                              className="flex-1"
                            >
                              {generatingId === presentation.id ? (
                                <Loader className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCcw className="mr-2 h-4 w-4" />
                              )}
                              Generate
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(presentation.pdfUrl, '_blank')}
                              disabled={!presentation.pdfUrl || isTransitioning || !!generatingId}
                              className="flex-1"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPresentation(presentation)}
                            disabled={isTransitioning || !!generatingId}
                            className="flex-1"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={isTransitioning || !!generatingId}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>More Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (presentation.pdfUrl) {
                                    const link = document.createElement('a');
                                    link.href = presentation.pdfUrl;
                                    link.setAttribute('download', `${presentation.doctorName?.replace(/ /g, '_')}_presentation.pdf`);
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }
                                }}
                                disabled={!presentation.pdfUrl}
                              >
                                <Download className="mr-2 h-4 w-4" /> Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRegenerate(presentation)}
                                disabled={presentation.dirty || isTransitioning || !!generatingId}
                              >
                                <RefreshCcw className="mr-2 h-4 w-4" /> Mark for Regeneration
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeletingPresentation(presentation)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Presentation
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-semibold">No Presentations Found</h3>
                    <p className="mt-1 text-sm">
                      {isAnyFilterActive
                        ? `No presentations match your current filters.`
                        : "Assign slides to a doctor to create a presentation."}
                    </p>
                    {isAnyFilterActive && (
                      <Button variant="link" onClick={() => router.push(pathname)}>Clear All Filters</Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Slides Dialog */}
      <Dialog open={!!editingPresentation} onOpenChange={(open) => !open && setEditingPresentation(null)}>
        <DialogContent className="max-w-2xl">
          {editingPresentation && (
            <EditSlidesForm
              doctor={{
                id: editingPresentation.doctorId,
                name: editingPresentation.doctorName,
                city: editingPresentation.city,
                selectedSlides: editingPresentation.doctorSlides || [],
              }}
              onSave={handleEditSlidesSave}
              isSaving={isTransitioning || !!generatingId}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPresentation} onOpenChange={(open) => !open && setDeletingPresentation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Presentation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the presentation for{' '}
              <strong>{deletingPresentation?.doctorName}</strong>?{' '}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPresentation && handleDeletePresentation(deletingPresentation)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
}


export default function PresentationsPage() {
  return (
    <Suspense fallback={<div className="flex h-64 w-full items-center justify-center"><Loader className="h-8 w-8 animate-spin" /></div>}>
      <PresentationsComponent />
    </Suspense>
  )
}


