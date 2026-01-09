'use client';

import React from 'react';
import {
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { allSlides } from '@/lib/slides';
import { Loader } from 'lucide-react';

// Common Doctor type for slide editing
export type SlideDoctor = {
    id?: string;
    name?: string;
    selectedSlides?: number[];
};

export function EditSlidesForm({
    doctor,
    onSave,
    isSaving,
}: {
    doctor: SlideDoctor;
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
                                            ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-background'
                                            : 'opacity-70',
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
