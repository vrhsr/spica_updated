'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toast } from '@/hooks/use-toast';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 *
 * In development it throws the error so Next.js's dev overlay surfaces the
 * full structured rule-denial context (path, method, decoded auth token) —
 * that's deliberately rich/verbose, meant to make Firestore rule bugs
 * obvious immediately during development.
 *
 * In production, throwing here would unmount the *entire* app (this
 * component lives at the root, inside FirebaseProvider) over what's often a
 * single denied query on one widget. Instead it logs the same context to
 * the console and shows a toast, so the rest of the page keeps working.
 */
export function FirebaseErrorListener() {
  // Use the specific error type for the state for type safety.
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    // The callback now expects a strongly-typed error, matching the event payload.
    const handleError = (error: FirestorePermissionError) => {
      if (process.env.NODE_ENV === 'development') {
        // Set error in state to trigger a re-render and throw below.
        setError(error);
        return;
      }

      console.error('[Firestore] Permission denied:', error);
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: "You don't have access to part of this page. Some data may be missing.",
      });
    };

    // The typed emitter will enforce that the callback for 'permission-error'
    // matches the expected payload type (FirestorePermissionError).
    errorEmitter.on('permission-error', handleError);

    // Unsubscribe on unmount to prevent memory leaks.
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // On re-render, if an error exists in state, throw it (dev-only path).
  if (error) {
    throw error;
  }

  // This component renders nothing.
  return null;
}
