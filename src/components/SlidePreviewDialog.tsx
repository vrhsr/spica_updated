'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { sortSlides } from '@/lib/slides';
import { useAllSlides } from '@/hooks/useAllSlides';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface SlidePreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    slideNumbers: number[];
    doctorName?: string;
}

export function SlidePreviewDialog({
    open,
    onOpenChange,
    slideNumbers,
    doctorName
}: SlidePreviewDialogProps) {
    const { slides: librarySlides } = useAllSlides();
    // Thank You slide always appears last, even though library additions have bigger numbers.
    const selectedSlides = sortSlides(librarySlides.filter(slide => slideNumbers.includes(slide.number)));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>Preview Slides{doctorName ? ` - ${doctorName}` : ''}</DialogTitle>
                    <DialogDescription>
                        Reviewing {selectedSlides.length} slide{selectedSlides.length !== 1 ? 's' : ''} proposed for this presentation
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedSlides.map((slide) => (
                            <div
                                key={slide.id}
                                className="border rounded-lg overflow-hidden bg-card hover:shadow-lg transition-shadow"
                            >
                                <div className="relative aspect-video bg-muted">
                                    <Image
                                        src={slide.url}
                                        alt={`Slide ${slide.number}: ${slide.medicineName}`}
                                        fill
                                        className="object-contain"
                                        sizes="(max-width: 768px) 100vw, 50vw"
                                        // Slides added from the library live on R2, not a host next/image is configured for.
                                        unoptimized={!slide.url.includes('res.cloudinary.com')}
                                    />
                                </div>
                                <div className="p-3 flex items-center justify-between">
                                    <div>
                                        <Badge variant="outline" className="mb-1">
                                            Slide #{slide.number}
                                        </Badge>
                                        <p className="text-sm font-medium">{slide.medicineName}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {selectedSlides.length === 0 && (
                        <div className="flex items-center justify-center h-32 text-muted-foreground">
                            <p>No slides selected</p>
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
