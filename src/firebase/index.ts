'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported } from "firebase/analytics";

export function initializeFirebase() {
  if (!getApps().length) {
    // Explicit config, not the Firebase App Hosting argument-less
    // initializeApp(): this site is served by Vercel and the Android app is a
    // local bundle, so the App Hosting auto-config never exists and that path
    // only ever failed and logged a warning in every visitor's console.
    return getSdks(initializeApp(firebaseConfig));
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  let analytics;
  if (typeof window !== 'undefined') {
    // Only initialize Analytics if it is supported by the browser.
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(firebaseApp);
      }
    });
  }
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    analytics,
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
