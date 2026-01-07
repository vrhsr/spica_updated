'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogOut, Stethoscope, Loader, PlusCircle, AlertTriangle, WifiOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { doc } from 'firebase/firestore';

type UserProfile = {
    city: string;
}

// Wrapper component required for useSearchParams during static generation
export default function RepLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={
            <div className="flex h-screen items-center justify-center">
                <Loader className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <RepLayoutInner>{children}</RepLayoutInner>
        </Suspense>
    );
}

function RepLayoutInner({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const auth = useAuth();
    const { user, role, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const [isTimedOut, setIsTimedOut] = useState(false);
    const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [hasCheckedOffline, setHasCheckedOffline] = useState(false);
    const repAvatar = PlaceHolderImages.find((img) => img.id === 'rep-avatar');

    const userProfileRef = useMemoFirebase(
        () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
        [firestore, user?.uid]
    );

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    const isUserLoading = isAuthLoading || isProfileLoading;

    // Offline mode should bypass auth for:
    // 1. /rep/offline page (always)
    // 2. /rep/present/* routes when actually offline OR when ?mode=bypass is set
    const isBypassMode = searchParams.get('mode') === 'bypass';
    const isOfflineMode = pathname === '/rep/offline' ||
        (pathname.startsWith('/rep/present/') && (!isOnline || isBypassMode));

    // Check online/offline status
    useEffect(() => {
        const updateOnlineStatus = () => {
            setIsOnline(navigator.onLine);
        };

        updateOnlineStatus();
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);

    // Automatically redirect to offline mode if offline and not already there
    useEffect(() => {
        if (!isOnline && !isOfflineMode && !hasCheckedOffline) {
            setHasCheckedOffline(true);
            // Check if there are offline presentations available
            import('@/lib/offline-storage').then(({ listOfflinePresentations }) => {
                listOfflinePresentations().then(presentations => {
                    if (presentations.length > 0) {
                        // Redirect to offline mode if presentations are available
                        router.push('/rep/offline');
                    }
                });
            });
        }
    }, [isOnline, isOfflineMode, hasCheckedOffline, router]);

    useEffect(() => {
        if (isOfflineMode) return; // Skip auth check in offline mode

        const timer = setTimeout(() => {
            if (isUserLoading || !user || role !== 'rep') {
                setIsTimedOut(true);
            }
        }, 10000); // 10 second timeout

        if (!isUserLoading && user && role === 'rep') {
            clearTimeout(timer);
        } else if (!isUserLoading && (!user || role !== 'rep')) {
            clearTimeout(timer);
            // Don't redirect if offline - let the offline redirect handle it
            if (isOnline) {
                router.push('/rep-login');
            }
        }

        return () => clearTimeout(timer);
    }, [user, role, isUserLoading, router, isOfflineMode, isOnline]);

    if (isTimedOut && !isOfflineMode) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-background p-4 text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                <p className="text-muted-foreground mb-6">It's taking longer than expected to load your profile. Please try logging in again.</p>
                <Button onClick={() => {
                    auth?.signOut();
                    window.location.href = '/rep-login';
                }}>
                    Login Again
                </Button>
            </div>
        );
    }

    // CRITICAL FIX: When offline and not on allowed offline routes, redirect immediately
    // Don't wait for Firebase auth - it will never resolve offline
    if (!isOnline && !isOfflineMode) {
        // Redirect to offline mode immediately
        router.replace('/rep/offline');
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <WifiOff className="h-12 w-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">You're offline. Redirecting...</p>
                </div>
            </div>
        );
    }

    if ((isUserLoading || !user || role !== 'rep') && !isOfflineMode) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground animate-pulse">Loading field portal...</p>
                </div>
            </div>
        );
    }

    const handleLogout = () => {
        if (auth) {
            auth.signOut();
        }
        router.push('/');
    };

    return (
        <div className="flex min-h-screen flex-col">
            <OfflineBanner />
            <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm lg:px-6" style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(4rem + env(safe-area-inset-top))' }}>
                <div className="flex items-center gap-4">
                    <Link href={isOfflineMode ? "/rep/offline" : "/rep"} className="flex items-center gap-2">
                        <img
                            src="/icon-192.png"
                            alt="SG HEALTH PHARMA Logo"
                            className="h-8 w-8 object-contain"
                        />
                        <span className="font-headline text-sm md:text-lg font-bold">
                            SPICA SG {isOfflineMode && <span className="text-xs font-normal text-muted-foreground">(Offline)</span>}
                        </span>
                    </Link>
                </div>
                {user && !isOfflineMode ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="flex h-auto items-center justify-start gap-3 px-3 py-2"
                            >
                                <div className="text-right">
                                    <p className="text-sm font-semibold">{user.displayName || 'Rep User'}</p>
                                    <p className="text-xs text-muted-foreground">City: {userProfile?.city || 'N/A'}</p>
                                </div>
                                <Avatar>
                                    <AvatarImage
                                        src={repAvatar?.imageUrl}
                                        data-ai-hint={repAvatar?.imageHint}
                                    />
                                    <AvatarFallback>{user.displayName?.substring(0, 2) || 'RP'}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" align="end" className="w-48">
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={handleLogout}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : isOfflineMode ? (
                    <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5 px-3 py-1">
                        <WifiOff className="mr-2 h-3 w-3" /> Offline Access
                    </Badge>
                ) : null}
            </header>
            <main className="flex-1 px-4 md:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}
