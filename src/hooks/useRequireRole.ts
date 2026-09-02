'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';

type Role = 'admin' | 'manager' | 'rep';

interface UseRequireRoleOptions {
  /** Where to send a signed-in user whose role isn't in the allowed list. Default '/'. */
  redirectTo?: string;
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
  { redirectTo = '/', timeoutMs = 10000, enabled = true }: UseRequireRoleOptions = {}
): UseRequireRoleResult {
  const router = useRouter();
  const { user, role, isUserLoading } = useUser();
  const [isTimedOut, setIsTimedOut] = useState(false);

  const allowed = !enabled || (!!user && !!role && allowedRoles.includes(role));

  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      if (isUserLoading || !user) {
        setIsTimedOut(true);
      }
    }, timeoutMs);

    if (!isUserLoading) {
      clearTimeout(timer);
      setIsTimedOut(false);
      if (user && !(role && allowedRoles.includes(role))) {
        router.push(redirectTo);
      }
    }

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, user, role, isUserLoading, router, redirectTo, timeoutMs, allowedRoles.join(',')]);

  return {
    allowed,
    isChecking: enabled && (isUserLoading || !user || !allowed),
    isTimedOut: enabled && isTimedOut,
    role,
  };
}
