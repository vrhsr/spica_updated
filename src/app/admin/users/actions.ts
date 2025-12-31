
'use server';

import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import { UserRecord } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Generates a random, temporary password.
 */
function generateTemporaryPassword(): string {
  return Math.random().toString(36).slice(-8);
}


// Define Zod schemas for input validation
const CreateUserInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  role: z.enum(['admin', 'rep']),
  city: z.string(),
  adminUid: z.string().min(1, 'Admin UID is required'),
});

export const createUser = async (input: z.infer<typeof CreateUserInputSchema>) => {
  const validation = CreateUserInputSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(`Invalid input: ${validation.error.flatten().fieldErrors}`);
  }
  const { name, email, phone, role, city, adminUid } = validation.data;
  
  const temporaryPassword = generateTemporaryPassword();

  // 1. Create the user in Firebase Auth
  const userRecord = await adminAuth.createUser({
    email,
    emailVerified: true,
    password: temporaryPassword,
    displayName: name,
    phoneNumber: phone,
    disabled: false,
  });

  // 2. Set custom claims for the user (role and city)
  const claims = {
    role,
    city: role === 'rep' ? city : null,
  };
  await adminAuth.setCustomUserClaims(userRecord.uid, claims);

  // 3. Create a corresponding user document in Firestore
  const userDocRef = adminFirestore.collection('users').doc(userRecord.uid);
  await userDocRef.set({
    name,
    email,
    phone,
    role,
    city: role === 'rep' ? city : null,
    active: true,
    createdBy: adminUid, // Save the UID of the admin who created the user
  });
  
  console.log(`Successfully created new user: ${userRecord.uid}`);
  return { uid: userRecord.uid, temporaryPassword };
}


const SetUserRoleInputSchema = z.object({
  uid: z.string().min(1, 'UID is required'),
  role: z.enum(['admin', 'rep']),
});

export const setUserRole = async (uid: string, role: 'admin' | 'rep') => {
   const validation = SetUserRoleInputSchema.safeParse({uid, role});
   if (!validation.success) {
    throw new Error(`Invalid input: ${validation.error.flatten().fieldErrors}`);
  }

  const { claims } = await adminAuth.getUser(uid);
  const newClaims = {
      ...claims,
      role: role,
      city: role === 'admin' ? null : claims?.city,
  };

  await adminAuth.setCustomUserClaims(uid, newClaims);
  await adminFirestore.collection('users').doc(uid).update({ role: role, city: newClaims.city || null });
  await adminAuth.revokeRefreshTokens(uid);
  console.log(`Set role '${role}' for user ${uid}`);
  return { success: true };
}


const SetUserCityInputSchema = z.object({
  uid: z.string().min(1, 'UID is required'),
  city: z.string().min(1, 'City is required'),
});

export const setUserCity = async (uid: string, city: string) => {
  const validation = SetUserCityInputSchema.safeParse({uid, city});
   if (!validation.success) {
    throw new Error(`Invalid input: ${validation.error.flatten().fieldErrors}`);
  }

  const { claims } = await adminAuth.getUser(uid);
  
  if (claims?.role !== 'rep') {
      throw new Error('Can only set city for users with the "rep" role.');
  }

  const newClaims = { ...claims, city };
  await adminAuth.setCustomUserClaims(uid, newClaims);
  await adminFirestore.collection('users').doc(uid).update({ city });
  await adminAuth.revokeRefreshTokens(uid);
  console.log(`Set city '${city}' for user ${uid}`);
  return { success: true };
}


const DeleteUserInputSchema = z.object({
  uid: z.string().min(1, 'UID is required'),
});

export const deleteUser = async (uid: string) => {
  const validation = DeleteUserInputSchema.safeParse({uid});
   if (!validation.success) {
    throw new Error(`Invalid input: ${validation.error.flatten().fieldErrors}`);
  }

  // 1. Delete from Firebase Auth
  await adminAuth.deleteUser(uid);
  // 2. Delete from Firestore
  await adminFirestore.collection('users').doc(uid).delete();
  
  console.log(`Successfully deleted user ${uid}`);
  return { success: true };
}

/**
 * A server action that lists all users and their custom claims.
 */
export const listAllUsers = async (): Promise<any[]> => {
  const users: any[] = [];
  let nextPageToken: string | undefined;

  do {
    const listUsersResult = await adminAuth.listUsers(1000, nextPageToken);
    
    // Create an array of promises to fetch user data from Firestore
    const firestorePromises = listUsersResult.users.map(userRecord => 
      adminFirestore.collection('users').doc(userRecord.uid).get()
    );
    
    // Resolve all promises
    const firestoreSnapshots = await Promise.all(firestorePromises);
    
    // Map results
    listUsersResult.users.forEach((userRecord, index) => {
        const firestoreDoc = firestoreSnapshots[index];
        const firestoreData = firestoreDoc.exists ? firestoreDoc.data() : {};
        
        users.push({
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          phone: userRecord.phoneNumber,
          // Custom claims are the source of truth for role/city if available
          role: userRecord.customClaims?.role || firestoreData?.role, 
          city: userRecord.customClaims?.city || firestoreData?.city,
          creationTime: userRecord.metadata.creationTime,
          createdBy: firestoreData?.createdBy, // Include createdBy from Firestore
        });
    });

    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);
  
  return users;
};
