import { config } from 'dotenv';
config();

import admin from 'firebase-admin';

// This is the critical diagnostic step.
console.log("ENV CHECK - Service Account Length:", process.env.FIREBASE_SERVICE_ACCOUNT?.length);

if (!admin.apps.length) {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (!serviceAccountString) {
    throw new Error(`
      ================================================================================
      FIREBASE ADMIN SDK AUTHENTICATION ERROR
      ================================================================================
      The 'FIREBASE_SERVICE_ACCOUNT' environment variable is not set.
      This is required for backend user and data management flows.
      ================================================================================
    `);
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

  } catch (e: any) {
    throw new Error(`
      ================================================================================
      FIREBASE ADMIN SDK PARSING ERROR
      ================================================================================
      The 'FIREBASE_SERVICE_ACCOUNT' environment variable is malformed.
      Parsing Error: ${e.message}
      ================================================================================
    `);
  }
}

export const adminAuth = admin.auth();
export const adminFirestore = admin.firestore();
// adminStorage is no longer used for PPTs, but might be used elsewhere.
// Keep it exported but be aware that new uploads go to Supabase.
export const adminStorage = admin.storage();
export const adminApp = admin.app();
