
'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { Doctor } from './page';
import { collection, query, where, addDoc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { Loader } from 'lucide-react';
import { useCollection, WithId } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';


interface AddDoctorDialogProps {
  defaultCity?: string; // district name pre-selected (comes from ?city= param)
  onDoctorAdded: (doctor: Omit<Doctor, 'status'>) => void | Promise<void>;
  triggerButton: React.ReactNode;
}

export function DoctorForm({
  doctor,
  onSave,
  defaultCity,
  isSaving,
}: {
  doctor?: Partial<WithId<Doctor>>;
  onSave: (details: { name: string; city: string; subCity: string }) => void;
  defaultCity?: string;
  isSaving?: boolean;
}) {
  const [name, setName] = React.useState(doctor?.name?.replace(/^Dr\.\s*/, '') || '');
  // `city` here = district name (for backwards compat with Firestore queries)
  const [district, setDistrict] = React.useState(doctor?.city || defaultCity || '');
  const [subCity, setSubCity] = React.useState(doctor?.subCity || '');

  // Inline city adding state
  const [showInlineCityAdd, setShowInlineCityAdd] = React.useState(false);
  const [inlineCityName, setInlineCityName] = React.useState('');
  const [isAddingCity, setIsAddingCity] = React.useState(false);

  const firestore = useFirestore();
  const { toast } = useToast();

  // Load districts (from existing 'cities' collection)
  const districtsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'cities') : null),
    [firestore]
  );
  const { data: districts, isLoading: isLoadingDistricts } = useCollection<{ id: string; name: string }>(districtsCollection);

  // Load cities for selected district (from new 'districts_cities' collection)
  const citiesQuery = useMemoFirebase(
    () => {
      if (!firestore || !district) return null;
      return query(collection(firestore, 'districts_cities'), where('districtName', '==', district));
    },
    [firestore, district]
  );
  const { data: cities, isLoading: isLoadingCities } = useCollection<{ id: string; name: string; districtName: string }>(citiesQuery);

  // When district changes, clear sub-city selection
  const handleDistrictChange = (val: string) => {
    setDistrict(val);
    setSubCity('');
    setShowInlineCityAdd(false);
  };

  const handleInlineAddCity = async () => {
    if (!inlineCityName.trim() || !firestore || !district) return;
    const finalCityName = inlineCityName.trim().toUpperCase();

    // Prevent duplicate cities
    const isDuplicate = cities?.some((c) => c.name.toUpperCase() === finalCityName);
    if (isDuplicate) {
      toast({ variant: 'destructive', title: 'Duplicate City', description: `"${finalCityName}" already exists in ${district}.` });
      return;
    }

    setIsAddingCity(true);
    try {
      await addDoc(collection(firestore, 'districts_cities'), {
        name: finalCityName,
        districtName: district,
      });
      toast({ title: 'City Added', description: `"${finalCityName}" has been created and selected.` });
      setSubCity(finalCityName);
      setInlineCityName('');
      setShowInlineCityAdd(false);
    } catch (err: any) {
      console.error('Error inline adding city:', err);
      toast({ variant: 'destructive', title: 'Error Adding City', description: err.message || 'Could not add city. Check console.' });
    } finally {
      setIsAddingCity(false);
    }
  };

  const handleSave = () => {
    if (name && district) {
      const finalName = name.trim().startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`;
      onSave({ name: finalName, city: district, subCity });
    }
  };

  const canProceed = !!name && !!district;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add New Doctor</DialogTitle>
        <DialogDescription>
          Enter the doctor's details below. The &quot;Dr.&quot; prefix will be added automatically.
          {' '}{defaultCity && `They will be added to ${defaultCity}.`}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {/* Doctor Name */}
        <div>
          <Label htmlFor="doctor-name">Doctor Name</Label>
          <Input
            id="doctor-name"
            placeholder="e.g., John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSaving}
          />
        </div>

        {/* District */}
        <div>
          <Label htmlFor="district">District</Label>
          <Select
            value={district}
            onValueChange={handleDistrictChange}
            disabled={!!defaultCity || isLoadingDistricts || isSaving}
          >
            <SelectTrigger id="district">
              <SelectValue placeholder="Select a district" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingDistricts ? (
                <div className="flex items-center justify-center p-2"><Loader className="h-4 w-4 animate-spin" /></div>
              ) : (
                districts?.map((d) => (
                  <SelectItem key={d.id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* City (within district) */}
        <div>
          <Label htmlFor="sub-city">
            City <span className="text-xs text-muted-foreground ml-1">(within district)</span>
          </Label>
          <Select
            value={subCity}
            onValueChange={setSubCity}
            disabled={!district || isLoadingCities || isSaving}
          >
            <SelectTrigger id="sub-city">
              <SelectValue placeholder={
                !district
                  ? 'Select a district first'
                  : isLoadingCities
                    ? 'Loading cities...'
                    : cities && cities.length === 0
                      ? 'No cities added to this district yet'
                      : 'Select a city'
              } />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCities ? (
                <div className="flex items-center justify-center p-2"><Loader className="h-4 w-4 animate-spin" /></div>
              ) : cities && cities.length > 0 ? (
                cities.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))
              ) : null}
            </SelectContent>
          </Select>

          {/* Inline Add City UI */}
          {district && !isLoadingCities && (
            <div className="mt-2">
              {!showInlineCityAdd ? (
                <div className="flex items-center justify-between">
                  {cities && cities.length === 0 ? (
                    <p className="text-xs text-amber-600">No cities in {district} yet.</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground hidden sm:block">Need to assign a doctor to a city that isn't listed?</p>
                  )}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs font-semibold text-primary"
                    onClick={() => setShowInlineCityAdd(true)}
                  >
                    + Add New City
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 shadow-sm animate-in fade-in slide-in-from-top-1">
                  <Input
                    placeholder="Enter new city name..."
                    value={inlineCityName}
                    onChange={(e) => setInlineCityName(e.target.value)}
                    className="h-8 text-xs bg-background"
                    disabled={isAddingCity}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInlineAddCity();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleInlineAddCity}
                    disabled={!inlineCityName.trim() || isAddingCity}
                  >
                    {isAddingCity ? <Loader className="h-3 w-3 animate-spin" /> : 'Add'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground"
                    onClick={() => setShowInlineCityAdd(false)}
                    disabled={isAddingCity}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={isSaving}>Cancel</Button>
        </DialogClose>
        <Button onClick={handleSave} disabled={!canProceed || isLoadingDistricts || isSaving}>
          {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? 'Saving...' : 'Next: Assign Slides'}
        </Button>
      </DialogFooter>
    </>
  );
}

import { EditSlidesForm } from '@/components/EditSlidesForm';
export { EditSlidesForm };

export function AddDoctorDialog({
  defaultCity,
  onDoctorAdded,
  triggerButton,
}: AddDoctorDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [step, setStep] = React.useState<'form' | 'slides'>('form');
  const [newDoctorDetails, setNewDoctorDetails] = React.useState<Partial<Doctor> | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep('form');
      setNewDoctorDetails(null);
      setIsSaving(false);
    }
    setIsOpen(open);
  };

  const handleDoctorFormSave = (details: { name: string; city: string; subCity: string }) => {
    setNewDoctorDetails(details);
    setStep('slides');
  };

  const handleNewDoctorSlidesSave = async (slides: number[]) => {
    if (newDoctorDetails) {
      setIsSaving(true);
      try {
        await onDoctorAdded({
          name: newDoctorDetails.name!,
          city: newDoctorDetails.city!,
          subCity: newDoctorDetails.subCity,
          selectedSlides: slides,
        });
      } finally {
        setIsSaving(false);
        handleOpenChange(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        {step === 'form' ? (
          <DoctorForm
            onSave={handleDoctorFormSave}
            defaultCity={defaultCity}
            isSaving={isSaving}
          />
        ) : (
          <EditSlidesForm
            doctor={newDoctorDetails!}
            onSave={handleNewDoctorSlidesSave}
            isSaving={isSaving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

