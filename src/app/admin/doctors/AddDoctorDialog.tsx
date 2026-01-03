
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

export function EditSlidesForm({
  doctor,
  onSave,
  isSaving,
}: {
  doctor: Partial<WithId<Doctor>>;
  onSave: (slides: number[]) => void;
  isSaving?: boolean;
}) {

  const firstSlideNumber = 1;
  const lastSlideNumber = 34;

  const getDefaultSlides = () => {
    // If we are editing a doctor that already has slides, use those.
    if (doctor.selectedSlides && doctor.selectedSlides.length > 0) {
      return doctor.selectedSlides;
    }
    // Otherwise, for a new doctor, default to the first and last slides.
    return [firstSlideNumber, lastSlideNumber];
  }

  const [selectedSlides, setSelectedSlides] = React.useState(getDefaultSlides());
  const [searchTerm, setSearchTerm] = React.useState('');

  const toggleSlide = (slideNumber: number) => {
    // Prevent unselecting the first and last slides
    if (slideNumber === firstSlideNumber || slideNumber === lastSlideNumber) {
      return;
    }

    setSelectedSlides((prev) =>
      prev.includes(slideNumber)
        ? prev.filter((s) => s !== slideNumber)
        : [...prev, slideNumber]
    );
  };

  // Filter slides based on search term
  const filteredSlides = allSlides.filter((slide) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      slide.medicineName.toLowerCase().includes(searchLower) ||
      slide.number.toString().includes(searchTerm)
    );
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Assign Slides for {doctor.name}</DialogTitle>
        <DialogDescription>
          Select the slides to include in the presentation. The first and last slides are mandatory and always included.
        </DialogDescription>
      </DialogHeader>

      {/* Search Bar */}
      <div className="px-1">
        <Input
          placeholder="Search by medicine name or slide number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-3"
        />
      </div>

      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[60vh] overflow-y-auto p-2 border rounded-md">
        {filteredSlides.length > 0 ? (
          filteredSlides.map((slide) => {
            const isMandatory = slide.number === firstSlideNumber || slide.number === lastSlideNumber;
            const isSelected = selectedSlides.includes(slide.number);

            return (
              <div
                key={slide.id}
                className={cn(
                  "relative aspect-[16/9]",
                  isSaving && "cursor-not-allowed opacity-75",
                  isMandatory ? "cursor-default" : "cursor-pointer",
                )}
                onClick={() => !isSaving && toggleSlide(slide.number)}
              >
                <img
                  src={slide.url}
                  alt={`Slide ${slide.number}`}
                  className={cn(
                    'w-full h-full object-cover rounded-md transition-all',
                    isSelected
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : 'opacity-60',
                    !isMandatory && 'hover:opacity-100'
                  )}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent rounded-md" />
                <div className="absolute bottom-1 left-1.5 right-1.5">
                  <p className="text-white text-xs font-bold truncate">{slide.medicineName}</p>
                </div>
                <div className="absolute top-1 right-1 bg-background/70 text-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {slide.number}
                </div>
              </div>
            )
          })
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No slides found matching "{searchTerm}"
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={isSaving}>Cancel</Button>
        </DialogClose>
        <Button
          onClick={() => onSave(selectedSlides)}
          disabled={selectedSlides.length === 0 || isSaving}
        >
          {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? 'Saving...' : 'Save and Create Presentation'}
        </Button>
      </DialogFooter>
    </>
  );
}

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

