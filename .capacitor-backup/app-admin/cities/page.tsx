
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
import { HeartPulse, Users, Loader, PlusCircle, Building, Trash2 } from 'lucide-react';
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
import React, { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useBodyPointerEventsCleanup } from '@/hooks/use-body-pointer-events-cleanup';

type City = { id: string; name: string };
type Doctor = { id: string; city: string };
type Rep = { id: string; city: string; role: string };

function AddCityDialog({
  citiesCollection,
  onCityAdded,
}: {
  citiesCollection: CollectionReference | null;
  onCityAdded: () => void;
}) {
  const [cityName, setCityName] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const { toast } = useToast();

  const handleAddCity = async () => {
    if (!cityName.trim() || !citiesCollection) return;
    const finalCityName = cityName.trim().toUpperCase();
    try {
      const cityDocRef = await addDoc(citiesCollection, { name: finalCityName });
      toast({
        title: 'City Added',
        description: `Successfully added "${finalCityName}" to the list of cities.`,
      });
      setCityName('');
      setIsOpen(false);
      onCityAdded(); // Trigger refetch
    } catch (error: any) {
      console.error('Error adding city: ', error);
      toast({
        variant: 'destructive',
        title: 'Error Adding City',
        description: 'Could not add the city. Check console for details.',
      });
      if (error.message?.includes('permission-denied') || error.message?.includes('insufficient permissions')) {
        const contextualError = new FirestorePermissionError({
          operation: 'create',
          path: citiesCollection.path,
          requestResourceData: { name: finalCityName },
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
          Add City
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New City</DialogTitle>
          <DialogDescription>
            Enter the name of the new city to make it available for doctors and
            representatives. It will be saved in uppercase.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="city-name">City Name</Label>
          <Input
            id="city-name"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            placeholder="e.g., CHENNAI"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleAddCity} disabled={!cityName.trim()}>
            Add City
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CitiesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [cityToDelete, setCityToDelete] = useState<City | null>(null);

  // Fix pointer-events issue with dialogs
  useBodyPointerEventsCleanup();

  // Memoize collections to prevent re-renders
  const citiesCollection = useMemoFirebase(
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

  // Fetch data from collections
  const { data: cities, isLoading: isLoadingCities, error: citiesError, forceRefetch } = useCollection<
    Omit<City, 'id'>
  >(citiesCollection);
  const { data: doctors, isLoading: isLoadingDoctors } =
    useCollection<Doctor>(doctorsCollection);
  const { data: reps, isLoading: isLoadingReps } =
    useCollection<Rep>(repsCollection);

  const isLoading = isLoadingCities || isLoadingDoctors || isLoadingReps;

  const cityData = useMemo(() => {
    if (!cities || !doctors || !reps) return [];

    return cities.map((city) => {
      const cityDoctors = doctors.filter((d) => d.city === city.name).length;
      const cityReps = reps.filter((r) => r.city === city.name).length;
      return {
        id: city.id,
        name: city.name,
        doctors: cityDoctors,
        reps: cityReps,
      };
    });
  }, [cities, doctors, reps]);

  const handleDeleteCity = async () => {
    if (!cityToDelete || !firestore) return;
    try {
      const cityRef = doc(firestore, 'cities', cityToDelete.id);
      deleteDoc(cityRef).catch(error => {
        const contextualError = new FirestorePermissionError({
          operation: 'delete',
          path: cityRef.path,
        });
        errorEmitter.emit('permission-error', contextualError);
      });
      toast({
        title: 'City Deleted',
        description: `"${cityToDelete.name}" has been successfully deleted.`,
      });
      forceRefetch(); // Refetch the cities list
    } catch (error) {
      console.error('Error deleting city:', error);
      toast({
        variant: 'destructive',
        title: 'Error Deleting City',
        description: 'An unexpected error occurred. Please check the console.',
      });
    } finally {
      setCityToDelete(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading cities...</p>
      </div>
    );
  }

  if (citiesError) {
    // Error is already thrown by the useCollection hook, but we can show a UI message too.
    return (
      <div className="flex h-64 items-center justify-center text-center text-destructive">
        There was an error fetching the cities. <br />
        This is likely a Firestore security rule issue. Please check the console for details.
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Manage Cities
          </h1>
          <AddCityDialog citiesCollection={citiesCollection} onCityAdded={forceRefetch} />
        </div>

        {cityData.length === 0 ? (
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <Building className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="text-xl font-semibold">No Cities Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Your `/cities` collection in Firestore appears to be empty.
              </p>
              <p className="text-sm text-muted-foreground">
                Click the "Add City" button to add your first city.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {cityData.map((city) => {
              const isDeletable = city.doctors === 0 && city.reps === 0;
              return (
                <Card key={city.id}>
                  <CardHeader>
                    <CardTitle className="font-headline text-2xl">
                      {city.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 rounded-lg border p-4">
                      <HeartPulse className="h-8 w-8 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Doctors</p>
                        <p className="text-2xl font-bold">{city.doctors}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-4">
                      <Users className="h-8 w-8 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Reps</p>
                        <p className="text-2xl font-bold">{city.reps}</p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button asChild>
                      <Link href={`/admin/doctors?city=${city.name}`}>
                        Manage Doctors
                      </Link>
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-block">
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => setCityToDelete(city)}
                            disabled={!isDeletable}
                            aria-label={`Delete city ${city.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {!isDeletable && (
                        <TooltipContent>
                          <p>Cannot delete city with active doctors or reps.</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}

        <AlertDialog open={!!cityToDelete} onOpenChange={(open) => { if (!open) setCityToDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the city "{cityToDelete?.name}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCityToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCity} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </TooltipProvider>
  );
}
