
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Separator } from '@/components/ui/separator';
import { Stethoscope, ArrowLeft, Chrome, Loader, Monitor } from 'lucide-react';
import { useAuth } from '@/firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';
import { listOfflinePresentations } from '@/lib/offline-storage';
import { useEffect } from 'react';

function OfflineBypassButton() {
  const [offlineCount, setOfflineCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const router = useRouter();

  // Detect offline status
  useEffect(() => {
    const updateStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  // Count offline presentations
  useEffect(() => {
    const check = async () => {
      const data = await listOfflinePresentations();
      setOfflineCount(data.length);
    };
    check();
  }, []);

  // Auto-redirect when offline and presentations available
  useEffect(() => {
    if (isOffline && offlineCount > 0) {
      // Small delay to let user see what's happening
      const timer = setTimeout(() => {
        router.push('/rep/offline');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOffline, offlineCount, router]);

  // Only show when offline
  if (!isOffline) return null;

  return (
    <div className="mt-6 p-4 border-2 border-dashed border-amber-500/50 rounded-xl bg-amber-50/80">
      <p className="text-xs text-center font-semibold text-amber-800 uppercase tracking-wider mb-3">
        {offlineCount > 0 ? '✈️ You are offline - Redirecting...' : '⚠️ No offline presentations available'}
      </p>
      {offlineCount > 0 ? (
        <Button asChild variant="default" className="w-full bg-amber-600 hover:bg-amber-700 h-12 shadow-md">
          <Link href="/rep/offline">
            <Monitor className="mr-2 h-5 w-5" />
            Access {offlineCount} Downloaded Presentations
          </Link>
        </Button>
      ) : (
        <p className="text-xs text-center text-amber-700">
          You need an internet connection to login. Please connect and save presentations for offline use.
        </p>
      )}
    </div>
  );
}

export default function RepLoginPage() {
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
        setError('Sign-in process was cancelled.');
        break;
      default:
        setError('An unexpected error occurred. Please try again.');
        break;
    }
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
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      const idTokenResult = await user.getIdTokenResult();
      const role = idTokenResult.claims.role;

      if (role !== 'rep') {
        await auth.signOut();
        setError(
          'Access denied. This portal is for Representatives only. Please use the Admin portal.'
        );
        return;
      }

      router.push('/rep');
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
      const user = userCredential.user;
      const idTokenResult = await user.getIdTokenResult();
      const role = idTokenResult.claims.role;

      if (role !== 'rep') {
        await auth.signOut();
        setError(
          'Access denied. This portal is for Representatives only. Please use the Admin portal.'
        );
        return;
      }

      router.push('/rep');
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
              Welcome back, Representative. Access your sales tools and personalized presentations.
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
            <div className="text-center">
              <h2 className="font-headline text-2xl font-bold tracking-tight">Representative Login</h2>
              <p className="text-sm text-muted-foreground">Sign in to your portal</p>
            </div>

            {/* Offline Bypass Option */}
            <OfflineBypassButton />

            <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="rep@example.com"
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
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoadingPassword || isLoadingGoogle}
            >
              {isLoadingGoogle && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              {!isLoadingGoogle && <Chrome className="mr-2 h-5 w-5" />}
              Sign in with Google
            </Button>

            {error && (
              <div className="mt-4 text-center space-y-2">
                <p className="text-sm text-destructive">{error}</p>
                {error.includes('Admin portal') && (
                  <Button variant="link" asChild className="text-primary h-auto p-0 font-medium">
                    <Link href="/admin-login">Go to Admin Login</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <ForgotPasswordDialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen} />
    </>
  );
}
