'use client';

import { useMemo } from 'react';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { mergeSlides, type Slide } from '@/lib/slides';

type StoredSlide = { number: number; url: string; medicineName: string };

/**
 * The full slide library: the built-in slides plus any added from Admin →
 * Slides Library, live. Falls back to just the built-in slides while loading
 * or if the library can't be read (e.g. offline), so a picker is never empty.
 * `isLoaded` is only true once the custom slides were actually read — use it
 * before treating a slide number as "doesn't exist".
 */
export function useAllSlides() {
  const firestore = useFirestore();
  const slidesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'slides') : null), [firestore]);
  const { data, isLoading, error } = useCollection<StoredSlide>(slidesQuery);

  const slides = useMemo(() => {
    const custom: Slide[] = (data ?? []).map((d) => ({
      id: d.id,
      number: Number(d.number),
      url: d.url,
      medicineName: d.medicineName,
    }));
    return mergeSlides(custom);
  }, [data]);

  return { slides, isLoaded: !!data && !isLoading && !error, isLoading };
}
