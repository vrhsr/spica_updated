'use client';

import { Loader } from 'lucide-react';

/**
 * This is a loading component that will be automatically displayed by Next.js
 * when navigating between pages within the /admin route group.
 */
export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
      <Loader className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
