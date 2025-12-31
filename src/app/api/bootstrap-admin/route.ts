import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

// The UID of the user to be made an admin.
const ADMIN_UID = "i7RKC6FSN5VTnRQTgbkDKieEFcz1";

/**
 * A temporary, one-time-use API route to bootstrap the first admin user.
 * It sets a custom claim on the specified user's authentication token.
 * 
 * !!! WARNING: THIS ENDPOINT SHOULD BE DELETED AFTER ITS FIRST SUCCESSFUL USE !!!
 */
export async function GET() {
  try {
    // Set the custom claim `{ role: 'admin' }` on the user's account.
    await adminAuth.setCustomUserClaims(ADMIN_UID, { role: 'admin' });

    console.log(`Successfully set role 'admin' for user ${ADMIN_UID}.`);
    
    // Invalidate the user's existing tokens to force a refresh on the client.
    await adminAuth.revokeRefreshTokens(ADMIN_UID);
    
    return NextResponse.json({ 
      success: true, 
      message: `Admin role granted to UID ${ADMIN_UID}. Please log out and log back in to see the changes.` 
    });

  } catch (error: any) {
    console.error('Error bootstrapping first admin:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to set admin role.', 
      error: error.message 
    }, { status: 500 });
  }
}
