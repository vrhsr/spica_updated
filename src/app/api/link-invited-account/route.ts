import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';

/**
 * Makes "Sign in with Google" work ONLY for someone an admin already invited
 * (via src/app/admin/users/AddUserDialog.tsx -> actions.ts's createUser),
 * using that exact Google-account email — nothing else.
 *
 * Google Sign-In authenticates by *identity provider*, not by email: Firebase
 * gives every Google-authenticated identity its own Auth uid, entirely
 * separate from the uid an admin's invite created for that same email
 * address. Left alone, that new uid has no custom-claim role and no
 * Firestore /users doc, so it's a real but useless "ghost" account — the
 * behavior this project's own notes call out as something `listAllUsers`
 * has to filter back out.
 *
 * This route is the fix: called right after a fresh Google sign-in, BEFORE
 * routing anywhere, with that sign-in's own ID token. It verifies the token
 * server-side (never trusts a client-supplied email), looks up whether an
 * admin already invited that *exact* email, and if so migrates the invite's
 * role/city/profile onto the new Google-authenticated uid so it becomes a
 * real, working account. If no invite matches, it deliberately grants
 * nothing — the caller is expected to sign the user back out.
 *
 * Called cross-origin from the Capacitor app's locally-bundled shell (a
 * different origin than this live site), same reasoning as
 * mint-handoff-token: needs its own CORS headers + OPTIONS handler or the
 * preflight silently fails and this never runs at all.
 */
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
    const newUid = decoded.uid;
    const email = decoded.email;

    // Google always verifies the email address itself before issuing an ID
    // token for it, but check anyway rather than trust it implicitly.
    if (!email || !decoded.email_verified) {
      return NextResponse.json({ linked: false, reason: 'unverified_email' }, { headers: CORS_HEADERS });
    }

    // Already has a role — either this uid was already linked in a previous
    // call, or it's not actually a Google-only ghost account. Nothing to do.
    if (decoded.role) {
      return NextResponse.json({ linked: true, alreadyLinked: true }, { headers: CORS_HEADERS });
    }

    let matches = (
      await adminFirestore.collection('users').where('email', '==', email).limit(2).get()
    ).docs;

    // Admins type the invite email by hand and it's stored exactly as typed;
    // Google's own email claim is case-normalized. A same-address-different-
    // case mismatch on an exact-match query would otherwise wrongly report
    // "not invited" for a real invite. The users collection is small by this
    // project's own scale (a handful of admins/managers/reps), so a full
    // fallback scan here is cheap — only runs at all when the fast path
    // above already found nothing.
    if (matches.length === 0) {
      const all = await adminFirestore.collection('users').get();
      matches = all.docs.filter((d) => (d.data().email ?? '').toLowerCase() === email.toLowerCase());
    }

    if (matches.length === 0) {
      return NextResponse.json({ linked: false, reason: 'not_invited' }, { headers: CORS_HEADERS });
    }
    if (matches.length > 1) {
      // Shouldn't happen (createUser only ever writes one doc per email),
      // but if it ever does, refuse rather than guess which one is real.
      console.error(`[link-invited-account] Multiple invited users share email ${email}; refusing to link.`);
      return NextResponse.json({ linked: false, reason: 'ambiguous' }, { headers: CORS_HEADERS });
    }

    const inviteDoc = matches[0];
    const invite = inviteDoc.data();
    const oldUid = inviteDoc.id;

    if (invite.active === false) {
      return NextResponse.json({ linked: false, reason: 'inactive' }, { headers: CORS_HEADERS });
    }

    const claims = { role: invite.role, city: invite.city ?? null };
    await adminAuth.setCustomUserClaims(newUid, claims);

    await adminFirestore.collection('users').doc(newUid).set({
      name: invite.name,
      email: invite.email,
      phone: invite.phone ?? null,
      role: invite.role,
      city: invite.city ?? null,
      active: true,
      createdBy: invite.createdBy,
      inviteAccepted: true,
      invitedAt: invite.invitedAt,
      linkedFromUid: oldUid,
    });

    // The invite was created with a throwaway password nobody was ever given
    // and never had a real session — if it was never actually used, retire
    // it now that its identity lives on under the Google-authenticated uid,
    // so Users & Roles doesn't show two rows for the same person. If it
    // WAS already used (this person already has a real password and real
    // history — requests, visit logs — under the old uid), leave both
    // accounts standing rather than risk deleting anything with real data
    // attached; they simply also gain Google Sign-In as a second option.
    if (!invite.inviteAccepted) {
      await adminFirestore.collection('users').doc(oldUid).delete();
      await adminAuth.deleteUser(oldUid).catch((e) => {
        // Non-fatal: the Firestore doc is already gone, which is what keeps
        // it out of Users & Roles; a stray unused Auth record left behind
        // is harmless.
        console.warn(`[link-invited-account] Could not delete superseded auth user ${oldUid}:`, e);
      });
    }

    return NextResponse.json({ linked: true }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[link-invited-account] Failed:', error);
    return NextResponse.json({ linked: false, reason: 'error' }, { status: 500, headers: CORS_HEADERS });
  }
}
