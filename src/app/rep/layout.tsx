'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogOut, Stethoscope, Loader, PlusCircle, AlertTriangle, WifiOff, LayoutDashboard, ClipboardList } from 'lucide-react';
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
import { PasswordResetDialog } from '@/components/PasswordResetDialog';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useRequireRole } from '@/hooks/useRequireRole';

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
    const { user, role } = useUser();
    const firestore = useFirestore();
    const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [hasCheckedOffline, setHasCheckedOffline] = useState(false);
    const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
    const repAvatar = PlaceHolderImages.find((img) => img.id === 'rep-avatar');

    const userProfileRef = useMemoFirebase(
        () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
        [firestore, user?.uid]
    );

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    // Offline mode should bypass auth for:
    // 1. /rep/offline page (always)
    // 2. /rep/present/* routes (always - user already authenticated to reach this point)
    const isBypassMode = searchParams.get('mode') === 'bypass';
    const isOfflineMode = pathname.includes('/rep/offline') ||
        pathname.includes('/rep/present/');

    // Check online/offline status
    useEffect(() => {
        const updateOnlineStatus = () => {
            const online = navigator.onLine;
            setIsOnline(online);

            // CRITICAL: If we detect offline and we're not already on an offline route,
            // redirect IMMEDIATELY to prevent loading screen hang
            if (!online && !pathname.includes('/offline') && !pathname.includes('/present/')) {
                console.log('[Rep Layout] Offline detected - immediate redirect to /rep/offline');
                window.location.replace('/rep/offline');
            }
        };

        updateOnlineStatus();
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, [pathname]);

    // Automatically redirect to offline mode if offline and not already there
    useEffect(() => {
        if (!isOnline && !isOfflineMode && !hasCheckedOffline) {
            setHasCheckedOffline(true);
            // Check if there are offline presentations available
            import('@/lib/offline-storage').then(({ listOfflinePresentations }) => {
                listOfflinePresentations().then(presentations => {
                    if (presentations.length > 0) {
                        console.log('[Rep Layout] Offline detected with presentations - replacing to /rep/offline');
                        router.replace('/rep/offline');
                    }
                });
            });
        }
    }, [isOnline, isOfflineMode, hasCheckedOffline, router]);

    // SECONDARY FAILSAFE: If offline and NOT in an offline-ready route, redirect.
    // Moved to useEffect to avoid hard-refresh loops and render-cycle issues.
    useEffect(() => {
        if (!isOnline && !isOfflineMode) {
            const timer = setTimeout(() => {
                // Double check before redirect
                if (!navigator.onLine && !pathname.includes('/offline') && !pathname.includes('/present/')) {
                    console.log('[Rep Layout] Failsafe redirect to /rep/offline');
                    router.replace('/rep/offline');
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isOnline, isOfflineMode, pathname, router]);

    // Gate on the 'rep' role. Redirects any account without it (including
    // one that resolves to admin/manager) straight to /login instead of
    // leaving it stuck on "Loading field portal..." forever, which is what
    // happened before this used the shared hook.
    const { isChecking: isRoleChecking, isTimedOut } = useRequireRole(['rep'], {
        redirectTo: '/login',
        timeoutMs: 15000,
        enabled: !isOfflineMode,
    });

    if (isTimedOut && !isOfflineMode) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-background p-4 text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                <p className="text-muted-foreground mb-6">It's taking longer than expected to load your profile. Please try logging in again.</p>
                <Button onClick={() => {
                    auth?.signOut();
                    window.location.href = '/login';
                }}>
                    Login Again
                </Button>
            </div>
        );
    }


    if ((isRoleChecking || isProfileLoading) && !isOfflineMode && isOnline) {
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
                                    <p className="text-xs text-muted-foreground">District: {userProfile?.city || 'N/A'}</p>
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
                            <DropdownMenuItem onSelect={() => setIsPasswordResetOpen(true)}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                <span>Change Password</span>
                            </DropdownMenuItem>
                            {(role === 'admin' || role === 'manager') && (
                                <DropdownMenuItem onSelect={() => router.push('/admin/dashboard')}>
                                    <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
                                    <span className="font-semibold text-primary">Admin Portal</span>
                                </DropdownMenuItem>
                            )}
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

        <main className="flex-1 px-4 md:px-6 lg:px-8 pt-4 pb-2 max-w-screen-xl mx-auto w-full">
            {children}
        </main>

        {/* Bottom Tab Bar — shown only when online and authenticated */}
        {user && !isOfflineMode && (
            <nav
                className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm shadow-lg"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div className="flex items-center justify-around h-16 md:h-20 max-w-screen-xl mx-auto px-2">
                    <Link
                        href="/rep"
                        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200 ${
                            pathname === '/rep'
                                ? 'text-blue-700'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <div className={`flex flex-col items-center justify-center gap-1 px-5 py-2 rounded-2xl transition-all duration-200 ${
                            pathname === '/rep' ? 'bg-blue-100 shadow-sm ring-1 ring-blue-200 scale-105' : ''
                        }`}>
                            <LayoutDashboard className={`h-5 w-5 md:h-6 md:w-6 ${pathname === '/rep' ? 'text-blue-600' : ''}`} />
                            <span className={`text-[10px] md:text-xs ${pathname === '/rep' ? 'font-bold text-blue-800' : 'font-medium'}`}>Dashboard</span>
                        </div>
                    </Link>
                    <Link
                        href="/rep/doctors"
                        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200 ${
                            pathname === '/rep/doctors'
                                ? 'text-blue-700'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <div className={`flex flex-col items-center justify-center gap-1 px-5 py-2 rounded-2xl transition-all duration-200 ${
                            pathname === '/rep/doctors' ? 'bg-blue-100 shadow-sm ring-1 ring-blue-200 scale-105' : ''
                        }`}>
                            <Stethoscope className={`h-5 w-5 md:h-6 md:w-6 ${pathname === '/rep/doctors' ? 'text-blue-600' : ''}`} />
                            <span className={`text-[10px] md:text-xs ${pathname === '/rep/doctors' ? 'font-bold text-blue-800' : 'font-medium'}`}>Doctors</span>
                        </div>
                    </Link>
                    <Link
                        href="/rep/requests"
                        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200 ${
                            pathname === '/rep/requests'
                                ? 'text-blue-700'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <div className={`flex flex-col items-center justify-center gap-1 px-5 py-2 rounded-2xl transition-all duration-200 ${
                            pathname === '/rep/requests' ? 'bg-blue-100 shadow-sm ring-1 ring-blue-200 scale-105' : ''
                        }`}>
                            <ClipboardList className={`h-5 w-5 md:h-6 md:w-6 ${pathname === '/rep/requests' ? 'text-blue-600' : ''}`} />
                            <span className={`text-[10px] md:text-xs ${pathname === '/rep/requests' ? 'font-bold text-blue-800' : 'font-medium'}`}>Requests</span>
                        </div>
                    </Link>
                </div>
            </nav>
        )}
            {user?.email && (
                <PasswordResetDialog
                    open={isPasswordResetOpen}
                    onOpenChange={setIsPasswordResetOpen}
                    userEmail={user.email}
                />
            )}
        </div>
    );
}
