'use client';

import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { allSlides } from '@/lib/slides';

export default function SlidesPage() {
  const sortedSlides = useMemo(() => {
    // Sort all slides by their number
    return [...allSlides].sort((a, b) => a.number - b.number);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Slides Library
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Master Slide Templates</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {sortedSlides.map((slide) => (
              <div
                key={slide.id}
                className="group relative aspect-[16/9] w-full overflow-hidden rounded-lg border bg-card text-center transition-all"
              >
                <img
                  src={slide.url}
                  alt={`Slide ${slide.number}`}
                  className="h-full w-full object-cover"
                  data-ai-hint="presentation slide"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <div className="absolute bottom-2 left-2 text-left text-white">
                  <p className="text-sm font-bold">{slide.medicineName}</p>
                </div>

                <div className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/70 text-xs font-bold text-foreground">
                  {slide.number}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
