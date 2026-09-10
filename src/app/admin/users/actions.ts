
'use server';

import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { KING_ADMIN_EMAIL } from './constants';

// The site users are invited back to, to set their password. Override via
// NEXT_PUBLIC_SITE_URL if the production domain ever changes.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://spicasg.in';
const INVITE_APP_NAME = 'invite-mailer';

type Role = 'admin' | 'manager' | 'rep';

interface Caller {
  uid: string;
  email: string;
  role?: Role;
}

/**
 * Verifies the caller's identity from a fresh Firebase ID token instead of
 * trusting a client-supplied uid/role string — server actions are callable
 * directly (bypassing any UI), so this is the actual authorization boundary.
 */
async function verifyCaller(idToken: string): Promise<Caller> {
  if (!idToken) {
    throw new Error('Not authenticated.');
  }
  const decoded = await adminAuth.verifyIdToken(idToken);
  return { uid: decoded.uid, email: decoded.email || '', role: decoded.role as Role | undefined };
}

function assertRole(caller: Caller, allowed: Role[]) {
  if (!caller.role || !allowed.includes(caller.role)) {
    throw new Error('You do not have permission to perform this action.');
  }
}

function assertNotKingAdmin(email: string | undefined, action: string) {
  if (email === KING_ADMIN_EMAIL) {
    throw new Error(`The primary administrator account cannot be ${action}.`);
  }
}

/**
 * A throwaway password for the Auth account. It is never stored, logged, or
 * shown to anyone — the user sets their real password via the emailed invite link.
 */
function generateThrowawayPassword(): string {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Sends a "set your password" email to a newly-created (or re-invited) user,
 * via Firebase Auth's own hosted email delivery — no separate email service
 * needed. The link lands on our own /accept-invite page (handleCodeInApp),
 * where the user sets their password directly instead of an admin ever
 * seeing or relaying it.
 */
async function sendInviteEmail(email: string): Promise<boolean> {
  try {
    const app = getApps().find((a) => a.name === INVITE_APP_NAME) ?? initializeApp(firebaseConfig, INVITE_APP_NAME);
    const auth = getAuth(app);
    await sendPasswordResetEmail(auth, email, {
      url: `${SITE_URL}/accept-invite`,
      handleCodeInApp: true,
    });
    return true;
  } catch (error) {
    console.error(`Failed to send invite email to ${email}:`, error);
    return false;
  }
}

// Define Zod schemas for input validation
const CreateUserInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  role: z.enum(['manager', 'rep']), // 'admin' is never assignable — see KING_ADMIN_EMAIL.
  city: z.string(),
  idToken: z.string().min(1, 'Not authenticated'),
});

export const createUser = async (input: z.infer<typeof CreateUserInputSchema>) => {
  const validation = CreateUserInputSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(`Invalid input: ${JSON.stringify(validation.error.flatten().fieldErrors)}`);
  }
  const { name, email, phone, role, city, idToken } = validation.data;

  const caller = await verifyCaller(idToken);
  assertRole(caller, ['admin']);

  // Check for duplicate name
  const existingUserSnapshot = await adminFirestore
    .collection('users')
    .where('name', '==', name)
    .limit(1)
    .get();

  if (!existingUserSnapshot.empty) {
    throw new Error(`A user with the name "${name}" already exists.`);
  }

  // 1. Create the user in Firebase Auth with a throwaway password nobody ever sees.
  const userRecord = await adminAuth.createUser({
    email,
    emailVerified: true,
    password: generateThrowawayPassword(),
    displayName: name,
    phoneNumber: phone,
    disabled: false,
  });

  // 2. Set custom claims for the user (role and city)
  const claims = {
    role,
    city: role === 'rep' ? city.trim().toUpperCase() : null,
  };
  await adminAuth.setCustomUserClaims(userRecord.uid, claims);

  // 3. Create a corresponding user document in Firestore
  const userDocRef = adminFirestore.collection('users').doc(userRecord.uid);
  await userDocRef.set({
    name,
    email,
    phone,
    role,
    city: role === 'rep' ? city.trim().toUpperCase() : null,
    active: true,
    createdBy: caller.uid, // From the verified token, not a client-supplied value
    inviteAccepted: false,
    invitedAt: Timestamp.now(),
  });

  // 4. Email them an invite link to set their own password.
  const inviteEmailSent = await sendInviteEmail(email);

  console.log(`Successfully created new user: ${userRecord.uid} (invite email sent: ${inviteEmailSent})`);
  return { uid: userRecord.uid, inviteEmailSent };
}

const ResendInviteInputSchema = z.object({
  uid: z.string().min(1, 'UID is required'),
  idToken: z.string().min(1, 'Not authenticated'),
});

/**
 * Re-sends the "set your password" invite email — e.g. if it never
 * arrived, or the link expired before the user got to it.
 */
export const resendInvite = async (uid: string, idToken: string) => {
  const validation = ResendInviteInputSchema.safeParse({ uid, idToken });
  if (!validation.success) {
    throw new Error(`Invalid input: ${JSON.stringify(validation.error.flatten().fieldErrors)}`);
  }

  const caller = await verifyCaller(idToken);
  assertRole(caller, ['admin']);

  const userRecord = await adminAuth.getUser(uid);
  if (!userRecord.email) {
    throw new Error('This user has no email address on file.');
  }

  const sent = await sendInviteEmail(userRecord.email);
  if (!sent) {
    throw new Error('Failed to send the invitation email. Please try again in a moment.');
  }

  await adminFirestore.collection('users').doc(uid).update({ invitedAt: Timestamp.now() });
  return { success: true };
}

/**
 * Called by the /accept-invite page once a user has successfully set their
 * password, so the admin's user list stops showing them as pending.
 */
export const markInviteAccepted = async (email: string) => {
  const validation = z.string().email().safeParse(email);
  if (!validation.success) {
    throw new Error('A valid email is required.');
  }

  const userRecord = await adminAuth.getUserByEmail(email);
  await adminFirestore.collection('users').doc(userRecord.uid).update({ inviteAccepted: true });
  return { success: true };
}


const SetUserRoleInputSchema = z.object({
  uid: z.string().min(1, 'UID is required'),
  role: z.enum(['manager', 'rep']), // 'admin' is never assignable — see KING_ADMIN_EMAIL.
  idToken: z.string().min(1, 'Not authenticated'),
});

/** Only the admin can promote/demote — Project Managers can never change roles. */
export const setUserRole = async (uid: string, role: 'manager' | 'rep', idToken: string) => {
  const validation = SetUserRoleInputSchema.safeParse({ uid, role, idToken });
  if (!validation.success) {
    throw new Error(`Invalid input: ${JSON.stringify(validation.error.flatten().fieldErrors)}`);
  }

  const caller = await verifyCaller(idToken);
  assertRole(caller, ['admin']);

  const userRecord = await adminAuth.getUser(uid);
  assertNotKingAdmin(userRecord.email, 'reassigned');

  const newClaims = {
    ...userRecord.customClaims,
    role: role,
    city: role === 'manager' ? null : userRecord.customClaims?.city,
  };

  await adminAuth.setCustomUserClaims(uid, newClaims);
  const normalizedCity = newClaims.city ? newClaims.city.trim().toUpperCase() : null;
  await adminFirestore.collection('users').doc(uid).update({ role: role, city: normalizedCity });
  await adminAuth.revokeRefreshTokens(uid);
  console.log(`Set role '${role}' for user ${uid}`);
  return { success: true };
}


const SetUserCityInputSchema = z.object({
  uid: z.string().min(1, 'UID is required'),
  city: z.string().min(1, 'City is required'),
  idToken: z.string().min(1, 'Not authenticated'),
});

export const setUserCity = async (uid: string, city: string, idToken: string) => {
  const validation = SetUserCityInputSchema.safeParse({ uid, city, idToken });
  if (!validation.success) {
    throw new Error(`Invalid input: ${JSON.stringify(validation.error.flatten().fieldErrors)}`);
  }

  const caller = await verifyCaller(idToken);
  assertRole(caller, ['admin']);

  const userRecord = await adminAuth.getUser(uid);

  if (userRecord.customClaims?.role !== 'rep') {
    throw new Error('Can only set city for users with the "rep" role.');
  }

  const normalizedCity = city.trim().toUpperCase();
  const newClaims = { ...userRecord.customClaims, city: normalizedCity };
  await adminAuth.setCustomUserClaims(uid, newClaims);
  await adminFirestore.collection('users').doc(uid).update({ city: normalizedCity });
  await adminAuth.revokeRefreshTokens(uid);
  console.log(`Set city '${city}' for user ${uid}`);
  return { success: true };
}


const DeleteUserInputSchema = z.object({
  uid: z.string().min(1, 'UID is required'),
  idToken: z.string().min(1, 'Not authenticated'),
});

/** Only the admin can delete accounts — Project Managers never can. */
export const deleteUser = async (uid: string, idToken: string) => {
  const validation = DeleteUserInputSchema.safeParse({ uid, idToken });
  if (!validation.success) {
    throw new Error(`Invalid input: ${JSON.stringify(validation.error.flatten().fieldErrors)}`);
  }

  const caller = await verifyCaller(idToken);
  assertRole(caller, ['admin']);

  const target = await adminAuth.getUser(uid);
  assertNotKingAdmin(target.email, 'deleted');

  // 1. Delete from Firebase Auth
  await adminAuth.deleteUser(uid);
  // 2. Delete from Firestore
  await adminFirestore.collection('users').doc(uid).delete();

  console.log(`Successfully deleted user ${uid}`);
  return { success: true };
}

// ─── Edit User Details ───────────────────────────────────────────────────
const UpdateUserDetailsSchema = z.object({
  uid: z.string().min(1, 'UID is required'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  idToken: z.string().min(1, 'Not authenticated'),
});

export const updateUserDetails = async (input: z.infer<typeof UpdateUserDetailsSchema>) => {
  const validation = UpdateUserDetailsSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(`Invalid input: ${JSON.stringify(validation.error.flatten().fieldErrors)}`);
  }
  const { uid, name, email, phone, idToken } = validation.data;

  const caller = await verifyCaller(idToken);
  assertRole(caller, ['admin']);

  // Check for duplicate name (excluding the current user)
  const existingUserSnapshot = await adminFirestore
    .collection('users')
    .where('name', '==', name)
    .get();

  const isDuplicate = existingUserSnapshot.docs.some((doc) => doc.id !== uid);
  if (isDuplicate) {
    throw new Error(`Another user with the name "${name}" already exists.`);
  }

  // Update Firebase Auth
  await adminAuth.updateUser(uid, {
    displayName: name,
    email: email,
    phoneNumber: phone || null,
  });

  // Update Firestore
  await adminFirestore.collection('users').doc(uid).update({
    name,
    email,
    phone: phone || null,
  });

  return { success: true };
}

// ─── Toggle User Status (Suspend/Activate) ───────────────────────────────
/** Only the admin can suspend/activate accounts — Project Managers never can. */
export const toggleUserStatus = async (uid: string, disabled: boolean, idToken: string) => {
  if (!uid) throw new Error('UID is required');

  const caller = await verifyCaller(idToken);
  assertRole(caller, ['admin']);

  const target = await adminAuth.getUser(uid);
  if (disabled) assertNotKingAdmin(target.email, 'suspended');

  // Disable or Enable the login at the Firebase Auth level
  await adminAuth.updateUser(uid, { disabled });
  
  if (disabled) {
    // Revoke their current session instantly if suspended
    await adminAuth.revokeRefreshTokens(uid);
  }

  // Reflect status in Firestore document for completeness
  await adminFirestore.collection('users').doc(uid).update({
    active: !disabled,
  });

  return { success: true };
}

export interface AdminUserSummary {
  uid: string;
  email?: string;
  displayName?: string;
  phone?: string;
  role?: Role;
  city?: string;
  creationTime: string;
  createdBy?: string;
  disabled: boolean;
  /** False only while an invited user hasn't set their password yet; true for legacy accounts predating invites. */
  inviteAccepted: boolean;
}

/**
 * A server action that lists users and their custom claims — scoped to what
 * the caller is allowed to see: a Project Manager only sees Representatives
 * (never other managers or the admin); everyone sees only accounts that were
 * actually onboarded (an unset role claim means someone hit "Sign in with
 * Google" without ever being invited — that's not a real managed user, so it
 * never shows up here even for the admin).
 */
export const listAllUsers = async (idToken: string): Promise<AdminUserSummary[]> => {
  const caller = await verifyCaller(idToken);
  assertRole(caller, ['admin', 'manager']);

  const users: AdminUserSummary[] = [];
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
      const role = userRecord.customClaims?.role as Role | undefined;
      // No role claim = never invited/assigned by an admin (e.g. an
      // unauthorized "Sign in with Google" attempt) — not a real managed user.
      if (!role) return;
      // Project Managers only ever see Representatives.
      if (caller.role === 'manager' && role !== 'rep') return;

      const firestoreDoc = firestoreSnapshots[index];
      const firestoreData = firestoreDoc.exists ? firestoreDoc.data() : {};

      users.push({
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        phone: userRecord.phoneNumber,
        role,
        city: userRecord.customClaims?.city || firestoreData?.city,
        creationTime: userRecord.metadata.creationTime,
        createdBy: firestoreData?.createdBy, // Include createdBy from Firestore
        disabled: userRecord.disabled, // Returns true if the user is suspended
        // Undefined means this account predates invite tracking — treat as accepted.
        inviteAccepted: firestoreData?.inviteAccepted !== false,
      });
    });

    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);

  return users;
};
