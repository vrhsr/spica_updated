
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
import { Stethoscope, ArrowLeft, Chrome, Loader } from 'lucide-react';
import { useAuth } from '@/firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';

export default function RepLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

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
      await signInWithPopup(auth, provider);
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
      await signInWithEmailAndPassword(auth, email, password);
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
              <h1 className="font-headline text-3xl font-bold">SPICASG Portal</h1>
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
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoadingPassword || isLoadingGoogle}
                />
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
              <Separator />
              <span className="mx-4 shrink-0 text-xs text-muted-foreground">OR</span>
              <Separator />
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
              <p className="mt-4 text-center text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
      <ForgotPasswordDialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen} />
    </>
  );
}
