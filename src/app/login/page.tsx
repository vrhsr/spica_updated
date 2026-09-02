
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Stethoscope, ArrowLeft, Chrome, Loader, Monitor } from 'lucide-react';
import { useAuth } from '@/firebase';
import {
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';
import { listOfflinePresentations } from '@/lib/offline-storage';
import { isCapacitorApp } from '@/lib/capacitor-utils';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

/** Where a signed-in user lands, based on their custom-claim role. */
function destinationForRole(role: unknown): string | null {
  if (role === 'admin' || role === 'manager') return '/admin/dashboard';
  if (role === 'rep') return '/rep';
  return null;
}

function OfflineBypassButton() {
  const [offlineCount, setOfflineCount] = useState(0);

  useEffect(() => {
    const check = async () => {
      const data = await listOfflinePresentations();
      setOfflineCount(data.length);
    };
    check();
  }, []);

  return (
    <div className="mt-6 p-4 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5">
      <p className="text-xs text-center font-semibold text-primary uppercase tracking-wider mb-3">
        {offlineCount > 0 ? 'Ready for Offline Presentation' : 'Offline Mode Available'}
      </p>
      <Button asChild variant="default" className="w-full bg-primary hover:bg-primary/90 h-12 shadow-md">
        <Link href="/rep/offline">
          <Monitor className="mr-2 h-5 w-5" />
          {offlineCount > 0 ? `Access ${offlineCount} Downloaded Presentation${offlineCount > 1 ? 's' : ''}` : 'Access Offline Mode'}
        </Link>
      </Button>
      <p className="text-[10px] text-center text-muted-foreground mt-2">
        {offlineCount > 0
          ? 'No internet connection required to present these.'
          : 'View and present downloaded presentations without internet.'}
      </p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuthError = (err: any) => {
    console.error(err);
    switch (err.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        setError('Invalid email or password. Please try again.');
        break;
      case 'auth/invalid-email':
        setError('Please enter a valid email address.');
        break;
      case 'auth/too-many-requests':
        setError(
          'Access to this account has been temporarily disabled due to many failed login attempts. You can try again later.'
        );
        break;
      case 'auth/configuration-not-found':
      case 'auth/operation-not-allowed':
        setError(
          'This sign-in method is not enabled. Please enable it in your Firebase project console.'
        );
        break;
      case 'auth/popup-closed-by-user':
        setError('Sign-in process was cancelled or blocked. Please ensure popups are allowed and you are not in Incognito mode with third-party cookies blocked.');
        break;
      case 'auth/network-request-failed':
        setError('Network Connection Error. Please check your internet or firewall settings.');
        break;
      default:
        setError(`An unexpected error occurred: ${err.message || 'Unknown error'}. Please try again.`);
        break;
    }
  };

  const routeToDestination = async (user: import('firebase/auth').User) => {
    const idTokenResult = await user.getIdTokenResult();
    const destination = destinationForRole(idTokenResult.claims.role);
    if (!destination) {
      await auth?.signOut();
      setError('This account is not set up yet. Please contact your administrator.');
      return;
    }
    router.replace(destination);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoadingGoogle(true);
    if (!auth) {
      setError('Authentication service is not available.');
      setIsLoadingGoogle(false);
      return;
    }
    try {
      if (isCapacitorApp()) {
        await GoogleAuth.initialize({
          clientId: '731200978852-8mvn08dar40n0pr1u276hbgmlt9nsqjm.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });
        // Force account picker by signing out first
        await GoogleAuth.signOut();
        const googleUser = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        const userCredential = await signInWithCredential(auth, credential);
        await routeToDestination(userCredential.user);
      } else {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        await routeToDestination(userCredential.user);
      }
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoadingPassword(true);
    if (!auth) {
      setError('Authentication service is not available.');
      setIsLoadingPassword(false);
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await routeToDestination(userCredential.user);
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsLoadingPassword(false);
    }
  };

  return (
    <>
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-blue-200 p-4">
        <div className="w-full max-w-4xl rounded-xl bg-card/50 shadow-2xl backdrop-blur-lg md:grid md:grid-cols-2">

          {/* Left Side: Branding */}
          <div className="hidden flex-col justify-center p-12 text-foreground md:flex">
            <Link href="/" className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Stethoscope className="h-7 w-7" />
              </div>
              <h1 className="font-headline text-3xl font-bold">SG HEALTH PHARMA Portal</h1>
            </Link>
            <p className="text-lg text-muted-foreground">
              Sign in to access your dashboard, presentations, and field tools.
            </p>
          </div>

          {/* Right Side: Login Form */}
          <div className="relative flex flex-col justify-center rounded-xl bg-card p-6 sm:p-8">
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-4 text-muted-foreground"
              asChild
            >
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
            <div className="text-center pt-6 md:pt-0">
              <h2 className="font-headline text-2xl font-bold tracking-tight">Login</h2>
              <p className="text-sm text-muted-foreground">Sign in to your account</p>
            </div>

            {/* Offline Bypass Option */}
            <OfflineBypassButton />

            <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoadingPassword || isLoadingGoogle}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-xs text-muted-foreground"
                    onClick={() => setIsForgotPasswordOpen(true)}
                  >
                    Forgot Password?
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoadingPassword || isLoadingGoogle}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoadingPassword || isLoadingGoogle}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </Button>
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full text-base font-bold"
                disabled={isLoadingPassword || isLoadingGoogle}
              >
                {isLoadingPassword && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                Sign In with Email
              </Button>
            </form>

            <div className="my-4 flex items-center">
              <Separator className="flex-1" />
              <span className="mx-4 shrink-0 text-xs text-muted-foreground">OR</span>
              <Separator className="flex-1" />
            </div>

            <Button
              variant="outline"
              className="w-full relative overflow-hidden group bg-white hover:bg-gray-50 border-2 h-12 rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
              onClick={handleGoogleLogin}
              disabled={isLoadingPassword || isLoadingGoogle}
            >
              {isLoadingGoogle ? (
                <div className="flex items-center">
                  <div className="relative mr-3">
                    <div className="h-5 w-5 rounded-full border-3 border-primary/20"></div>
                    <div className="absolute top-0 h-5 w-5 animate-spin rounded-full border-3 border-transparent border-t-primary"></div>
                  </div>
                  <span className="font-medium">Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center">
                  <Chrome className="mr-2 h-5 w-5 text-blue-600" />
                  <span className="font-semibold">Sign in with Google</span>
                </div>
              )}
            </Button>

            {error && (
              <div className="mt-4 text-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <ForgotPasswordDialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen} />
    </>
  );
}
