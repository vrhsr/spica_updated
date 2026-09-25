'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';

type Role = 'admin' | 'manager' | 'rep';

interface UseRequireRoleOptions {
  /** Where to send a signed-in user whose role isn't in the allowed list. Default '/'. */
  redirectTo?: string;
  /** Where to send a visitor who isn't signed in at all. Default '/login'. */
  signedOutRedirectTo?: string;
  /** How long to wait for auth to resolve before showing a timeout state. Default 10000ms. */
  timeoutMs?: number;
  /** Set false to skip the check entirely (e.g. an offline-bypass route). Default true. */
  enabled?: boolean;
}

interface UseRequireRoleResult {
  /** True once `role` has resolved and is one of `allowedRoles`. */
  allowed: boolean;
  /** True while auth/role is still resolving, or access hasn't been confirmed yet — callers should render a loading state and NOT mount protected content or fire queries. */
  isChecking: boolean;
  /** True if auth never resolved within `timeoutMs` — callers should offer a "log in again" affordance. */
  isTimedOut: boolean;
  role: Role | null;
}

/**
 * Centralizes the "wait for role, then gate or redirect" pattern that used to
 * be hand-rolled per layout. The critical property this guarantees: `allowed`
 * only flips true after `role` is actually known — a caller that waits on
 * `isChecking` before rendering protected children never mounts a page (and
 * its Firestore queries) for a role that doesn't have access, which is what
 * caused the permission-denied crashes this was built to fix.
 */
export function useRequireRole(
  allowedRoles: Role[],
  { redirectTo = '/', signedOutRedirectTo = '/login', timeoutMs = 10000, enabled = true }: UseRequireRoleOptions = {}
): UseRequireRoleResult {
  const router = useRouter();
  const { user, role, isUserLoading } = useUser();
  const [isTimedOut, setIsTimedOut] = useState(false);
  // uid whose "no role" we've confirmed against a freshly minted token.
  const [confirmedRolelessUid, setConfirmedRolelessUid] = useState<string | null>(null);
  const [roleRetryTick, setRoleRetryTick] = useState(0);

  const allowed = !enabled || (!!user && !!role && allowedRoles.includes(role));

  // A signed-in user with no role yet may just have been granted one (Google
  // Sign-In's invite linking sets claims right after sign-in), with the
  // cached token not caught up. Force one refresh before treating them as
  // roleless; if it carries a role, the provider picks it up on its own.
  useEffect(() => {
    if (!enabled || isUserLoading || !user || role || confirmedRolelessUid === user.uid) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    user
      .getIdTokenResult(true)
      .then((r) => {
        if (!cancelled && !r.claims.role) setConfirmedRolelessUid(user.uid);
      })
      .catch(() => {
        // A failed refresh (flaky network) proves nothing about the role —
        // retry rather than bounce a real rep/admin out as "roleless".
        if (!cancelled) retryTimer = setTimeout(() => setRoleRetryTick((t) => t + 1), 4000);
      });
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [enabled, isUserLoading, user, role, confirmedRolelessUid, roleRetryTick]);

  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      if (isUserLoading || !user) {
        setIsTimedOut(true);
      }
    }, timeoutMs);

    // Signed out: send to the login page after a short grace period — not
    // instantly, because right after sign-in the page can mount a beat
    // before the provider has caught up with the new user. (The timeout
    // above stays as the fallback "Login Again" screen.)
    let signedOutTimer: ReturnType<typeof setTimeout> | undefined;
    if (!isUserLoading && !user) {
      signedOutTimer = setTimeout(() => router.replace(signedOutRedirectTo), 2500);
    }

    if (!isUserLoading && user) {
      clearTimeout(timer);
      setIsTimedOut(false);
      const hasWrongRole = !!role && !allowedRoles.includes(role);
      const isConfirmedRoleless = !role && !!user && confirmedRolelessUid === user.uid;
      if (user && (hasWrongRole || isConfirmedRoleless)) {
        router.push(redirectTo);
      }
    }

    return () => {
      clearTimeout(timer);
      clearTimeout(signedOutTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, user, role, isUserLoading, confirmedRolelessUid, router, redirectTo, signedOutRedirectTo, timeoutMs, allowedRoles.join(',')]);

  return {
    allowed,
    isChecking: enabled && (isUserLoading || !user || !allowed),
    isTimedOut: enabled && isTimedOut,
    role,
  };
}
