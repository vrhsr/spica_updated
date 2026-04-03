
'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HeartPulse, Users, Loader, PlusCircle, Building, Trash2, MapPin, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useCollection } from '@/firebase/firestore/use-collection';
import {
  collection,
  query,
  where,
  addDoc,
  deleteDoc,
  doc,
  CollectionReference,
} from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import React, { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type District = { id: string; name: string };
type DistrictCity = { id: string; name: string; districtName: string };
type Doctor = { id: string; city: string };
type Rep = { id: string; city: string; role: string };

// ─── Add District Dialog ──────────────────────────────────────────────────────
function AddDistrictDialog({
  existingDistricts,
  districtsCollection,
  onDistrictAdded,
}: {
  existingDistricts: { name: string }[];
  districtsCollection: CollectionReference | null;
  onDistrictAdded: () => void;
}) {
  const [districtName, setDistrictName] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!districtName.trim() || !districtsCollection) return;
    const final = districtName.trim().toUpperCase();
    
    // Duplicate check
    const isDuplicate = existingDistricts.some(d => d.name.toUpperCase() === final);
    if (isDuplicate) {
      toast({ variant: 'destructive', title: 'Duplicate District', description: `A district named "${final}" already exists.` });
      return;
    }

    try {
      await addDoc(districtsCollection, { name: final });
      toast({ title: 'District Added', description: `"${final}" has been added.` });
      setDistrictName('');
      setIsOpen(false);
      onDistrictAdded();
    } catch (error: any) {
      console.error('Error adding district:', error);
      toast({ variant: 'destructive', title: 'Error Adding District', description: 'Check console.' });
      if (error.message?.includes('permission-denied') || error.message?.includes('insufficient permissions')) {
        const contextualError = new FirestorePermissionError({
          operation: 'create',
          path: districtsCollection.path,
          requestResourceData: { name: final },
        });
        errorEmitter.emit('permission-error', contextualError);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add District
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New District</DialogTitle>
          <DialogDescription>
            Enter the district name. It will be saved in uppercase. After adding a district, you can add cities within it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="district-name">District Name</Label>
          <Input
            id="district-name"
            value={districtName}
            onChange={(e) => setDistrictName(e.target.value)}
            placeholder="e.g., NORTH ZONE"
            onKeyDown={(e) => e.key === 'Enter' && districtName.trim() && handleAdd()}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleAdd} disabled={!districtName.trim()}>
            Add District
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add City to District Dialog ──────────────────────────────────────────────
function AddCityToDistrictDialog({
  districtName,
  existingCitiesInDistrict,
  onCityAdded,
}: {
  districtName: string;
  existingCitiesInDistrict: { name: string }[];
  onCityAdded: () => void;
}) {
  const [cityName, setCityName] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleAdd = async () => {
    if (!cityName.trim() || !firestore) return;
    const final = cityName.trim().toUpperCase();
    
    // Duplicate check
    const isDuplicate = existingCitiesInDistrict.some(c => c.name.toUpperCase() === final);
    if (isDuplicate) {
      toast({ variant: 'destructive', title: 'Duplicate City', description: `A city named "${final}" already exists in ${districtName}.` });
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'districts_cities'), {
        name: final,
        districtName,
      });
      toast({ title: 'City Added', description: `"${final}" added to ${districtName}.` });
      setCityName('');
      setIsOpen(false);
      onCityAdded();
    } catch (error: any) {
      console.error('Error adding city:', error);
      toast({ variant: 'destructive', title: 'Error Adding City', description: 'Check console.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs h-8 rounded-full border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-colors">
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Sub-City
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-headline">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </span>
            Add City
          </DialogTitle>
          <DialogDescription className="pt-2">
            Expand the <strong className="text-foreground">{districtName}</strong> district by registering a new city or geographical sub-region.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
            <Label htmlFor="city-name-in-district" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City / Region Name</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                id="city-name-in-district"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                placeholder="e.g. VELLORE CITY"
                className="pl-9 h-11 border-muted-foreground/20 shadow-sm bg-background transition-all focus-visible:ring-primary focus-visible:border-primary"
                onKeyDown={(e) => e.key === 'Enter' && cityName.trim() && handleAdd()}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">The city name will be standardized and saved in UPPERCASE automatically.</p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" className="rounded-xl">Cancel</Button>
          </DialogClose>
          <Button onClick={handleAdd} disabled={!cityName.trim() || isSaving} className="rounded-xl shadow-md transition-all hover:shadow-lg">
            {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Register City
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── District Card ────────────────────────────────────────────────────────────
function DistrictCard({
  district,
  doctorCount,
  repCount,
  cities,
  onDeleteDistrict,
  onCityDeleted,
  onCityAdded,
}: {
  district: District;
  doctorCount: number;
  repCount: number;
  cities: DistrictCity[];
  onDeleteDistrict: (d: District) => void;
  onCityDeleted: () => void;
  onCityAdded: () => void;
}) {
  const [showCities, setShowCities] = useState(true);
  const [cityToDelete, setCityToDelete] = useState<DistrictCity | null>(null);
  const [isDeletingCity, setIsDeletingCity] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const isDeletable = doctorCount === 0 && repCount === 0;

  const handleDeleteCity = async () => {
    if (!cityToDelete || !firestore) return;
    setIsDeletingCity(true);
    try {
      await deleteDoc(doc(firestore, 'districts_cities', cityToDelete.id));
      toast({ title: 'City Removed', description: `"${cityToDelete.name}" removed from ${district.name}.` });
      onCityDeleted();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not remove city.' });
    } finally {
      setIsDeletingCity(false);
      setCityToDelete(null);
    }
  };

  return (
    <>
      <Card className="group relative overflow-hidden backdrop-blur-sm bg-card/50 border-2 rounded-2xl transition-all duration-200 hover:shadow-lg hover:border-accent hover:bg-accent/5">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="font-headline text-2xl">{district.name}</CardTitle>
              <CardDescription className="text-xs">District management hub</CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border-red-200"
                    onClick={() => onDeleteDistrict(district)}
                    disabled={!isDeletable}
                    aria-label={`Delete district ${district.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TooltipTrigger>
              {!isDeletable && (
                <TooltipContent>
                  <p>Cannot delete district with active doctors or reps.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-2.5">
              <div className="p-1.5 rounded-md bg-primary/10">
                <HeartPulse className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Doctors</span>
                <span className="font-bold text-lg">{doctorCount}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-2.5">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Reps</span>
                <span className="font-bold text-lg">{repCount}</span>
              </div>
            </div>
          </div>

          {/* Cities Section */}
          <div className="rounded-xl border bg-muted/30 p-3">
            <button
              className="flex w-full items-center justify-between text-sm font-semibold text-foreground mb-2"
              onClick={() => setShowCities(!showCities)}
            >
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Cities ({cities.length})
              </span>
              {showCities ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {showCities && (
              <div className="space-y-2">
                {cities.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No cities added yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {cities.map((city) => (
                      <Badge
                        key={city.id}
                        variant="secondary"
                        className="text-xs flex items-center gap-1 pl-2 pr-1 py-1"
                      >
                        {city.name}
                        <button
                          onClick={() => setCityToDelete(city)}
                          className="ml-0.5 rounded-full hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
                          aria-label={`Remove city ${city.name}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="pt-1">
                  <AddCityToDistrictDialog
                    districtName={district.name}
                    existingCitiesInDistrict={cities}
                    onCityAdded={onCityAdded}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="border-t bg-muted/20 p-4">
          <Button asChild className="w-full">
            <Link href={`/admin/doctors?city=${district.name}`}>
              Manage Doctors
            </Link>
          </Button>
        </CardFooter>
      </Card>

      {/* Delete City Confirmation */}
      <AlertDialog open={!!cityToDelete} onOpenChange={(open) => !open && setCityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove city &quot;{cityToDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the city from <strong>{district.name}</strong>. Doctors already assigned to this city will still have it recorded on their profile. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCity}
              disabled={isDeletingCity}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeletingCity && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DistrictsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [districtToDelete, setDistrictToDelete] = useState<District | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

  const districtsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'cities') : null),
    [firestore]
  );

  const doctorsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'doctors') : null),
    [firestore]
  );

  const repsCollection = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'users'), where('role', '==', 'rep'))
        : null,
    [firestore]
  );

  const districtsCitiesCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'districts_cities') : null),
    [firestore]
  );

  const { data: districts, isLoading: isLoadingDistricts, error: districtsError, forceRefetch } = useCollection<Omit<District, 'id'>>(districtsCollection);
  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsCollection);
  const { data: reps, isLoading: isLoadingReps } = useCollection<Rep>(repsCollection);
  const { data: allCities, isLoading: isLoadingCities, forceRefetch: refetchCities } = useCollection<DistrictCity>(districtsCitiesCollection);

  const isLoading = isLoadingDistricts || isLoadingDoctors || isLoadingReps || isLoadingCities;

  const districtData = useMemo(() => {
    if (!districts || !doctors || !reps || !allCities) return [];

    return districts.map((district) => {
      const districtDoctors = doctors.filter((d) => d.city === district.name).length;
      const districtReps = reps.filter((r) => r.city === district.name).length;
      const districtCities = allCities.filter((c) => c.districtName === district.name);
      return {
        id: district.id,
        name: district.name,
        doctors: districtDoctors,
        reps: districtReps,
        cities: districtCities,
      };
    });
  }, [districts, doctors, reps, allCities]);

  const handleDeleteDistrict = async () => {
    if (!districtToDelete || !firestore) return;
    try {
      const districtRef = doc(firestore, 'cities', districtToDelete.id);
      deleteDoc(districtRef).catch((error) => {
        const contextualError = new FirestorePermissionError({
          operation: 'delete',
          path: districtRef.path,
        });
        errorEmitter.emit('permission-error', contextualError);
      });
      toast({
        title: 'District Deleted',
        description: `"${districtToDelete.name}" has been successfully deleted.`,
      });
      forceRefetch();
    } catch (error) {
      console.error('Error deleting district:', error);
      toast({ variant: 'destructive', title: 'Error Deleting District', description: 'Check console.' });
    } finally {
      setDistrictToDelete(null);
      setDeleteConfirmationInput('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading districts...</p>
      </div>
    );
  }

  if (districtsError) {
    return (
      <div className="flex h-64 items-center justify-center text-center text-destructive">
        There was an error fetching the districts. <br />
        This is likely a Firestore security rule issue. Check the console.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">Manage Districts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Districts contain cities. Doctors are assigned to a district + city.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <AddDistrictDialog 
              existingDistricts={districts || []} 
              districtsCollection={districtsCollection} 
              onDistrictAdded={forceRefetch} 
            />
          </div>
        </div>

        {districtData.length === 0 ? (
          <Card className="text-center border-2 border-dashed py-12">
            <CardHeader>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50">
                <Building className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="text-xl font-semibold">No Districts Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">Add your first district to get started.</p>
              <p className="text-sm text-muted-foreground">
                After adding a district, you can add cities within it.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {districtData.map((district) => (
              <DistrictCard
                key={district.id}
                district={district}
                doctorCount={district.doctors}
                repCount={district.reps}
                cities={district.cities}
                onDeleteDistrict={setDistrictToDelete}
                onCityDeleted={refetchCities}
                onCityAdded={refetchCities}
              />
            ))}
          </div>
        )}

        {/* Delete District Confirmation */}
        <AlertDialog 
          open={!!districtToDelete} 
          onOpenChange={(open) => {
            if (!open) {
              setDistrictToDelete(null);
              setDeleteConfirmationInput('');
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the district <strong>{districtToDelete?.name}</strong> and all its city entries. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4 space-y-3 rounded-xl border bg-destructive/10 p-4">
              <Label htmlFor="delete-confirm" className="text-sm font-semibold text-destructive">
                Please type <strong className="font-mono bg-background px-1.5 py-0.5 rounded border">DELETE {districtToDelete?.name}</strong> to confirm.
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                autoComplete="off"
                placeholder={`DELETE ${districtToDelete?.name}`}
                className="font-mono"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteDistrict} 
                disabled={deleteConfirmationInput !== `DELETE ${districtToDelete?.name}`}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete District
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
