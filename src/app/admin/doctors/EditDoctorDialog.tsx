'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DoctorForm } from './AddDoctorDialog';
import type { Doctor } from './page';
import { WithId } from '@/firebase/firestore/use-collection';

interface EditDoctorDialogProps {
  doctor: WithId<Doctor> | null;
  onClose: () => void;
  onSave: (doctorId: string, details: { name: string; city: string; subCity: string }, selectedSlides: number[]) => void;
  isSaving: boolean;
}

export function EditDoctorDialog({
  doctor,
  onClose,
  onSave,
  isSaving
}: EditDoctorDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (doctor) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [doctor]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Delay telling parent to nullify user to allow Dialog close animation to complete
      setTimeout(() => {
        onClose();
        // Fallback safety to strip locks
        document.body.style.pointerEvents = '';
        document.body.removeAttribute('data-scroll-locked');
      }, 300);
    }
  };

  const handleFormSave = (details: { name: string; city: string; subCity: string }) => {
    if (!doctor) return;
    onSave(doctor.id, details, doctor.selectedSlides);
    // Don't close immediately here. The parent component will set isSaving=false
    // after the DB update, and then we'll close or the parent will nullify `doctor`
    // which triggers the effect to set isOpen=false.
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        {doctor && (
          <DoctorForm
            doctor={doctor}
            onSave={handleFormSave}
            isSaving={isSaving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
