'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogOut, Stethoscope, Loader, PlusCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { doc } from 'firebase/firestore';

type UserProfile = {
    city: string;
}

export default function RepLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const { user, role, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const repAvatar = PlaceHolderImages.find((img) => img.id === 'rep-avatar');

  const userProfileRef = useMemoFirebase(
      () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
      [firestore, user?.uid]
  );
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isUserLoading = isAuthLoading || isProfileLoading;

  useEffect(() => {
    if (!isUserLoading && (!user || role !== 'rep')) {
      router.push('/rep-login');
    }
  }, [user, role, isUserLoading, router]);

  if (isUserLoading || !user || role !== 'rep') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader className="h-12 w-12 animate-spin text-primary" />
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
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm lg:px-6">
            <div className="flex items-center gap-4">
                 <Link href="/rep" className="flex items-center gap-2">
                    <Stethoscope className="h-6 w-6 text-primary" />
                    <span className="font-headline text-lg font-bold">
                        SPICASG Portal
                    </span>
                </Link>
            </div>
            {user && (
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
                        <AvatarFallback>{user.displayName?.substring(0,2) || 'RP'}</AvatarFallback>
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
            )}
        </header>
        <main className="flex-1">
            <div className="container mx-auto p-4 md:p-6 lg:p-8">{children}</div>
        </main>
    </div>
  );
}
