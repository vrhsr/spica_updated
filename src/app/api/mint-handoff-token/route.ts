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

// Called cross-origin from the Capacitor app's locally-bundled shell (a
// different origin than this live site). It's a POST with a JSON body, so
// the browser sends a CORS preflight (OPTIONS) first — without an
// OPTIONS handler and these headers on the actual response, that preflight
// fails and the real POST never goes out at all. That's exactly what was
// silently breaking the admin/manager handoff: the fetch failed, the
// login page's catch block fell back to just opening the live /login
// page, which is the "asks me to log in again" symptom. Wide open ('*')
// is fine: this route only mints a token for whatever account the
// caller's OWN valid ID token already proves they're signed in as.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400, headers: CORS_HEADERS });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const role = decoded.role;
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json({ error: 'Not authorized for this handoff' }, { status: 403, headers: CORS_HEADERS });
    }

    const customToken = await adminAuth.createCustomToken(decoded.uid);
    return NextResponse.json({ customToken }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[mint-handoff-token] Failed:', error);
    return NextResponse.json({ error: 'Failed to create handoff token' }, { status: 500, headers: CORS_HEADERS });
  }
}
