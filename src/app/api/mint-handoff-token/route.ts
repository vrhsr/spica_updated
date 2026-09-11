import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * Mints a short-lived Firebase custom token for the SAME uid presented via
 * a fresh ID token — used only to hand an admin/manager off from the
 * Capacitor app (a different origin than this live site, so Firebase
 * Auth's session can't carry over on its own) into the live admin
 * dashboard without making them type their password a second time. See
 * src/app/login/page.tsx (mints it before navigating) and
 * src/app/admin/layout.tsx (consumes it via signInWithCustomToken).
 *
 * Grants nothing the caller doesn't already have — same uid, same
 * custom-claim role, single-use in practice (consumed once on load, then
 * stripped from the URL), short Firebase-enforced expiry. This is a
 * session bridge, not a new privilege grant.
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const role = decoded.role;
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json({ error: 'Not authorized for this handoff' }, { status: 403 });
    }

    const customToken = await adminAuth.createCustomToken(decoded.uid);
    return NextResponse.json({ customToken });
  } catch (error: any) {
    console.error('[mint-handoff-token] Failed:', error);
    return NextResponse.json({ error: 'Failed to create handoff token' }, { status: 500 });
  }
}
