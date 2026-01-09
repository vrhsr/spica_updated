
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
import { cn } from '@/lib/utils';
import type { Doctor } from './page';
import { allSlides } from '@/lib/slides';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { Loader } from 'lucide-react';
import { WithId } from '@/firebase/firestore/use-collection';


interface AddDoctorDialogProps {
  defaultCity?: string;
  onDoctorAdded: (doctor: Omit<Doctor, 'status'>) => void;
  triggerButton: React.ReactNode;
}

function DoctorForm({
  doctor,
  onSave,
  defaultCity,
  isSaving,
}: {
  doctor?: Partial<WithId<Doctor>>;
  onSave: (details: { name: string; city: string }) => void;
  defaultCity?: string;
  isSaving?: boolean;
}) {
  const [name, setName] = React.useState(doctor?.name?.replace(/^Dr\.\s*/, '') || '');
  const [city, setCity] = React.useState(doctor?.city || defaultCity || '');
  const firestore = useFirestore();
  const citiesCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'cities') : null),
    [firestore]
  );
  const { data: cities, isLoading: isLoadingCities } = useCollection<{ id: string, name: string }>(citiesCollection);

  const handleSave = () => {
    if (name && city) {
      const finalName = name.trim().startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`;
      onSave({ name: finalName, city });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add New Doctor</DialogTitle>
        <DialogDescription>
          Enter the doctor's details below. The "Dr." prefix will be added automatically.
          {' '}{defaultCity && `They will be added to ${defaultCity}.`}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
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
        <div>
          <Label htmlFor="city">City</Label>
          <Select
            value={city}
            onValueChange={setCity}
            disabled={!!defaultCity || isLoadingCities || isSaving}
          >
            <SelectTrigger id="city">
              <SelectValue placeholder="Select a city" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCities ? (
                <div className="flex items-center justify-center p-2"><Loader className="h-4 w-4 animate-spin" /></div>
              ) : (
                cities?.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={isSaving}>Cancel</Button>
        </DialogClose>
        <Button onClick={handleSave} disabled={!name || !city || isLoadingCities || isSaving}>
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

  const handleDoctorFormSave = (details: { name: string; city: string }) => {
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

