
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmPasswordReset, verifyPasswordResetCode, signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { markInviteAccepted } from '@/app/admin/users/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, KeyRound, Loader, ShieldAlert } from 'lucide-react';

type Status = 'verifying' | 'ready' | 'submitting' | 'success' | 'invalid' | 'unsupported';

/**
 * Firebase's own %LINK% merge tag in the Auth email templates always points
 * at either this project's default `.firebaseapp.com/__/auth/action` page,
 * or — once "Customize action URL" is set for a template in the Firebase
 * Console (Authentication > Templates > pencil icon) — at this route
 * instead. `handleCodeInApp` on the `sendPasswordResetEmail` call does NOT
 * bypass that for a plain web browser (it's a mobile-app deep-link
 * mechanism); it only decides what `continueUrl` gets attached to the link
 * as a query param. This page is that landing spot: one premium, on-brand
 * replacement for Firebase's bare default UI, for every `mode=resetPassword`
 * link the app sends (invite, self-service change, admin-triggered reset,
 * forgot-password) — see CLAUDE.md's "User management" section.
 *
 * The `continueUrl` param (set per call site in `sendInviteEmail` /
 * `PasswordResetDialog` / `ForgotPasswordDialog`) is what tells this page
 * which copy to show and whether to run invite-acceptance bookkeeping —
 * Firebase passes it through untouched even when the Console's custom
 * action URL setting is what actually routed the click here.
 */
function EyeToggleButton({ shown, onToggle, disabled }: { shown: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
      onClick={onToggle}
      disabled={disabled}
    >
      {shown ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
      )}
      <span className="sr-only">{shown ? 'Hide password' : 'Show password'}</span>
    </Button>
  );
}

function AuthActionContent() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');
  // Firebase re-attaches this exactly as the sending call site set it in
  // actionCodeSettings.url — used here purely to pick copy/behavior, never
  // trusted for anything security-sensitive (the oobCode itself is what's
  // verified against Firebase).
  const continueUrl = searchParams.get('continueUrl') || '';
  const isInvite = continueUrl.includes('/accept-invite') || continueUrl.includes('flow=invite');

  const [status, setStatus] = useState<Status>('verifying');
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!auth) return;
    if (mode !== 'resetPassword') {
      setStatus('unsupported');
      return;
    }
    if (!oobCode) {
      setError('This link is missing its verification code.');
      setStatus('invalid');
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        setEmail(verifiedEmail);
        setStatus('ready');
      })
      .catch(() => {
        setError(
          isInvite
            ? 'This invitation link is invalid or has expired. Please ask your administrator to resend it.'
            : 'This link is invalid or has expired. Please request a new one.'
        );
        setStatus('invalid');
      });
  }, [auth, mode, oobCode, isInvite]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !oobCode) return;

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setStatus('submitting');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      if (isInvite && email) {
        // Best-effort bookkeeping — the password is already set either way.
        // Signs in just long enough to prove who this is to the server.
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          await markInviteAccepted(await cred.user.getIdToken());
        } catch {
          /* non-fatal */
        } finally {
          await auth.signOut().catch(() => {});
        }
      }
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setError(
        err.code === 'auth/expired-action-code'
          ? 'This link has expired. Please request a new one.'
          : err.code === 'auth/weak-password'
          ? 'Please choose a stronger password.'
          : 'Something went wrong setting your password. Please try again.'
      );
      setStatus('ready');
    }
  };

  const headline =
    status === 'success'
      ? isInvite
        ? "You're all set"
        : 'Password updated'
      : isInvite
      ? 'Welcome to SPICA SG'
      : 'Reset your password';

  const description =
    status === 'invalid'
      ? isInvite
        ? "We couldn't verify this invitation."
        : "We couldn't verify this link."
      : status === 'unsupported'
      ? 'This link uses an action this page does not support.'
      : status === 'success'
      ? 'Your password has been updated. You can now log in.'
      : email
      ? isInvite
        ? `Set a password for ${email}.`
        : `Choose a new password for ${email}.`
      : 'Verifying your link…';

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-brand-gradient">
      <Card className="relative w-full max-w-md shadow-2xl">
        <CardHeader className="pt-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            {status === 'success' ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : status === 'invalid' || status === 'unsupported' ? (
              <ShieldAlert className="h-8 w-8" />
            ) : (
              <KeyRound className="h-8 w-8" />
            )}
          </div>
          <CardTitle className="font-headline text-3xl">{headline}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'verifying' && (
            <div className="flex justify-center py-6">
              <Loader className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {(status === 'invalid' || status === 'unsupported') && (
            <div className="space-y-4 text-center">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button asChild className="w-full">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          )}

          {(status === 'ready' || status === 'submitting') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={status === 'submitting'}
                    className="pr-10"
                    autoFocus
                  />
                  <EyeToggleButton shown={showPassword} onToggle={() => setShowPassword((v) => !v)} disabled={status === 'submitting'} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={status === 'submitting'}
                    className="pr-10"
                  />
                  <EyeToggleButton shown={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} disabled={status === 'submitting'} />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                className="w-full bg-primary py-6 text-base font-bold text-primary-foreground hover:bg-primary/90"
                disabled={status === 'submitting' || !password || !confirmPassword}
              >
                {status === 'submitting' && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                {status === 'submitting' ? 'Saving…' : isInvite ? 'Set Password & Continue' : 'Update Password'}
              </Button>
            </form>
          )}

          {status === 'success' && (
            <div className="space-y-3">
              <Button
                className="w-full bg-primary py-6 text-base font-bold text-primary-foreground hover:bg-primary/90"
                onClick={() => router.replace('/login')}
              >
                Continue to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-brand-gradient">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthActionContent />
    </Suspense>
  );
}
