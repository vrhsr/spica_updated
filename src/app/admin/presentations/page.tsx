
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
import { Download, Search, Loader, FileQuestion, RefreshCcw, MoreHorizontal, Eye, ChevronsUpDown, X, ShieldQuestion, Edit, PlusCircle, Trash2, Clock, Check, Copy } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useCollection, WithId } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, updateDoc, Timestamp, getDocs, where, addDoc, deleteDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { generateAndUpsertPresentation } from '@/lib/actions/generatePresentation';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AddDoctorDialog, EditSlidesForm } from '../doctors/AddDoctorDialog';
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
  city: string; // This is the District
  subCity?: string; // This is the Actual City
  selectedSlides: number[];
};

type EnrichedPresentation = WithId<Presentation> & {
  doctorName?: string;
  doctorCity?: string;
  doctorDistrict?: string;
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
  const [presentationToDelete, setPresentationToDelete] = useState<EnrichedPresentation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewPresentation, setViewPresentation] = useState<EnrichedPresentation | null>(null);

  const handleCopyLink = async (url: string | undefined) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(url);
      toast({
        title: "Link Copied",
        description: "Presentation link copied to clipboard.",
        duration: 2000,
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Could not copy link to clipboard.",
        variant: "destructive"
      });
    }
  };

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
    return new Map(doctors.map(doc => [doc.id, { name: doc.name, city: doc.city, subCity: doc.subCity, selectedSlides: doc.selectedSlides }]));
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
        doctorCity: doctorInfo?.subCity || 'Unknown City',
        doctorDistrict: doctorInfo?.city || p.city || 'Unknown District',
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
      const lowerSearch = searchTerm.toLowerCase();
      enriched = enriched.filter(p =>
        (p.doctorName && p.doctorName.toLowerCase().includes(lowerSearch)) ||
        (p.doctorCity && p.doctorCity.toLowerCase().includes(lowerSearch)) ||
        (p.doctorDistrict && p.doctorDistrict.toLowerCase().includes(lowerSearch))
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

  const handleDoctorAdded = async (newDoctor: Omit<Doctor, 'status'>) => {
    if (!firestore || !adminUser) return;

    try {
      setGeneratingId(`add-${Date.now()}`); // Use a temporary generating ID or just lock UI

      // Global duplicate check
      const duplicateQuery = query(collection(firestore, 'doctors'), where('name', '==', newDoctor.name));
      const duplicateSnapshot = await getDocs(duplicateQuery);
      if (!duplicateSnapshot.empty) {
        toast({
          variant: "destructive",
          title: "Duplicate Doctor",
          description: `A doctor named "${newDoctor.name}" already exists in the system.`,
        });
        return;
      }

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
      
      toast({
        title: "Doctor Added & Generating...",
        description: `${newDoctor.name} successfully added! The presentation is now generating in the background.`,
      });
      refetchDoctors();

      // Trigger presentation generation asynchronously
      generateAndUpsertPresentation({
        doctorId: docRef.id,
        doctorName: newDoctor.name,
        city: newDoctor.city,
        selectedSlides: newDoctor.selectedSlides || [],
        adminUid: adminUser.uid,
      }).then((result) => {
        if ('error' in result) {
          toast({ variant: 'destructive', title: 'Generation Failed', description: result.error });
        } else {
          toast({ title: 'Presentation Ready', description: `PDF for ${newDoctor.name} is available for download.` });
        }
        forceRefetch();
      });

    } catch (err: any) {
      console.error("Error adding doctor:", err);
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to add new doctor. Check console." });
    } finally {
      setGeneratingId(null);
    }
  };

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

  const handleDeletePresentation = async () => {
    if (!firestore || !presentationToDelete) return;

    try {
      setGeneratingId(`delete-${presentationToDelete.id}`);
      const presentationRef = doc(firestore, 'presentations', presentationToDelete.id);
      
      await deleteDoc(presentationRef).catch(err => {
        const contextualError = new FirestorePermissionError({
          operation: 'delete',
          path: presentationRef.path,
        });
        errorEmitter.emit('permission-error', contextualError);
        throw err;
      });

      toast({
        title: 'Presentation Deleted',
        description: `The presentation for ${presentationToDelete.doctorName} has been deleted.`,
      });
      forceRefetch();
    } catch (err: any) {
      console.error("Error deleting presentation:", err);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: err.message || "Could not delete presentation.",
      });
    } finally {
      setGeneratingId(null);
      setPresentationToDelete(null);
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
          <CardDescription>
            You do not have the necessary permissions to view this page. This is because your account does not have the 'admin' role. Please contact the system administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Manage Presentations
        </h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <AddDoctorDialog 
            onDoctorAdded={handleDoctorAdded} 
            triggerButton={
              <Button className="w-full sm:w-auto shadow-md">
                <PlusCircle className="mr-2 h-4 w-4" /> Create Presentation
              </Button>
            } 
          />
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by doctor name..."
              className="pl-9 w-full"
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
            <Button variant="ghost" onClick={() => router.push(pathname)} className="shrink-0">
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
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto bg-card rounded-xl border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="-ml-4">
                              District {cityFilter && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{cityFilter}</span>}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuLabel>Filter by District</DropdownMenuLabel>
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
                          <TableCell className="text-muted-foreground">{presentation.doctorCity}</TableCell>
                          <TableCell>{presentation.doctorDistrict}</TableCell>
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
                                onClick={() => setViewPresentation(presentation)}
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
                                  onClick={() => setPresentationToDelete(presentation)}
                                  disabled={isTransitioning || !!generatingId}
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
                          colSpan={6}
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
              <div className="lg:hidden grid gap-3 grid-cols-1 sm:grid-cols-2">
                {enrichedPresentations.length > 0 ? (
                  enrichedPresentations.map((presentation) => (
                    <Card key={presentation.id} className={`overflow-hidden border rounded-xl shadow-sm transition-all duration-200 ${(isTransitioning || !!generatingId) ? 'opacity-50' : ''}`}>
                      <CardContent className="p-0 flex flex-col h-full">
                        <div className="bg-muted/10 p-3 border-b flex items-start justify-between gap-2 border-primary/5">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-headline text-[1.05rem] font-bold text-primary truncate leading-tight">{presentation.doctorName}</h3>
                            <div className="flex items-center text-xs text-muted-foreground mt-1 gap-1 flex-wrap">
                              <span className="font-medium bg-primary/5 text-primary/80 px-1.5 py-0.5 rounded">{presentation.doctorCity}</span>
                              <span className="text-muted-foreground/30">•</span>
                              <span>{presentation.doctorDistrict}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1 opacity-70">
                              <Clock className="w-3 h-3" />
                              {presentation.updatedAt ? formatDistanceToNow(presentation.updatedAt.toDate(), { addSuffix: true }) : 'N/A'}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {getStatusBadge(presentation)}
                          </div>
                        </div>

                        <div className="p-3 grid gap-2 mt-auto">
                          <div className="grid grid-cols-2 gap-2">
                            {presentation.status === 'pending' || presentation.status === 'failed' ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleGenerate(presentation)}
                                disabled={isTransitioning || !!generatingId}
                                className="w-full text-xs h-8"
                              >
                                {generatingId === presentation.id ? (
                                  <Loader className="mr-1.5 h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCcw className="mr-1.5 h-3 w-3" />
                                )}
                                Generate
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs h-8"
                                onClick={() => setViewPresentation(presentation)}
                                disabled={!presentation.pdfUrl || isTransitioning || !!generatingId}
                              >
                                <Eye className="mr-1.5 h-3 w-3" />
                                View PDF
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPresentation(presentation)}
                              disabled={isTransitioning || !!generatingId}
                              className="w-full text-xs h-8"
                            >
                              <Edit className="mr-1.5 h-3 w-3" />
                              Edit Info
                            </Button>
                          </div>

                          <div className="flex gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full text-xs h-8 text-muted-foreground hover:bg-muted/50 border"
                                  disabled={isTransitioning || !!generatingId}
                                >
                                  <MoreHorizontal className="mr-1.5 h-3 w-3" />
                                  More Actions
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {presentation.status === 'ready' && (
                                  <DropdownMenuItem onClick={() => handleRegenerate(presentation)}>
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Force Regenerate
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => window.open(presentation.pdfUrl, '_blank')} disabled={!presentation.pdfUrl}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Open in New Tab
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleCopyLink(presentation.pdfUrl)}
                                  disabled={!presentation.pdfUrl}
                                >
                                  {copiedId === presentation.pdfUrl ? (
                                    <Check className="mr-2 h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="mr-2 h-4 w-4" />
                                  )}
                                  Copy Public Link
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setPresentationToDelete(presentation)} className="text-red-500 focus:text-red-600 focus:bg-red-50">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Presentation
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full py-12 px-4 text-center border-2 border-dashed rounded-xl border-muted bg-muted/5 text-muted-foreground">
                    <FileQuestion className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <h3 className="text-sm font-semibold">No Presentations</h3>
                    <p className="text-xs mt-1">
                      {isAnyFilterActive ? 'Clear filters to see results.' : 'No presentations found.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View PDF Dialog */}
      <Dialog open={!!viewPresentation} onOpenChange={(open) => !open && setViewPresentation(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-4 w-full sm:w-[90vw]">
          {viewPresentation?.pdfUrl ? (
            <iframe src={`${viewPresentation.pdfUrl}#toolbar=0`} className="w-full h-full rounded-md border" title="Presentation PDF" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground flex-col bg-muted/20 rounded-md border">
              <FileQuestion className="h-10 w-10 opacity-50 mb-2" />
              <p>No PDF available to display</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Slides Dialog */}
      <Dialog open={!!editingPresentation} onOpenChange={(open) => !open && setEditingPresentation(null)}>
        <DialogContent className="max-w-2xl">
          {editingPresentation && (
            <EditSlidesForm
              doctor={{
                id: editingPresentation.doctorId,
                name: editingPresentation.doctorName,
                selectedSlides: editingPresentation.doctorSlides || [],
              }}
              onSave={handleEditSlidesSave}
              isSaving={isTransitioning || !!generatingId}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!presentationToDelete} onOpenChange={(open) => !open && setPresentationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Presentation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the presentation for <strong>{presentationToDelete?.doctorName}</strong>?
              This action cannot be undone, and the Doctor's record will show "Not Generated" until a new presentation is made.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!generatingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault(); // Prevent closing until done
                handleDeletePresentation();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!generatingId}
            >
              {generatingId === `delete-${presentationToDelete?.id}` ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
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


