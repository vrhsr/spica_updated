
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  HeartPulse,
  Presentation,
  LogOut,
  Stethoscope,
  Building,
  GalleryThumbnails,
  Loader,
  ShieldCheck,
  KeyRound,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useAuth } from '@/firebase';
import { PasswordResetDialog } from './PasswordResetDialog';
import { cn } from '@/lib/utils';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/users', icon: ShieldCheck, label: 'Users & Roles' },
  { href: '/admin/doctors', icon: HeartPulse, label: 'Doctors' },
  { href: '/admin/cities', icon: Building, label: 'Cities' },
  { href: '/admin/slides', icon: GalleryThumbnails, label: 'Slides Library' },
  { href: '/admin/presentations', icon: Presentation, label: 'Presentations' },
  { href: '/admin/requests?status=pending', icon: Mail, label: 'Change Requests' },
];

type Request = {
  status: 'pending' | 'approved' | 'rejected';
  repId: string;
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const adminAvatar = PlaceHolderImages.find((img) => img.id === 'admin-avatar');

  // Fetch pending requests count for badge
  const firestore = useFirestore();
  const requestsCollection = useMemoFirebase(
    () => (firestore && user?.uid ? collection(firestore, 'requests') : null),
    [firestore, user?.uid]
  );
  const { data: requests } = useCollection<Request>(requestsCollection);
  const pendingCount = requests?.filter((r) => r.status === 'pending').length || 0;

  const [isTimedOut, setIsTimedOut] = useState(false);

  // Check if user has admin role and redirect if not
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isUserLoading || !user) {
        setIsTimedOut(true);
      }
    }, 10000); // 10 second timeout

    if (!isUserLoading && user) {
      clearTimeout(timer);
      user.getIdTokenResult().then((idTokenResult) => {
        const userRole = idTokenResult.claims.role;
        if (userRole !== 'admin') {
          // User is not an admin, redirect to home page
          router.push('/');
        }
      }).catch((error) => {
        console.error('Error checking user role:', error);
        router.push('/');
      });
    }

    return () => clearTimeout(timer);
  }, [user, isUserLoading, router]);

  if (isTimedOut) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-6">It's taking longer than expected to load your profile. Please try logging in again.</p>
        <Button onClick={() => {
          auth?.signOut();
          window.location.href = '/admin-login';
        }}>
          Login Again
        </Button>
      </div>
    );
  }

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading secure portal...</p>
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
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border p-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <img
                src="/icon-192.png"
                alt="SG HEALTH PHARMA Logo"
                className="h-8 w-8 object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-headline text-base font-bold leading-none tracking-tight">
                SG HEALTH PHARMA
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                Admin Portal
              </span>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => {
              const isRequestsItem = item.href === '/admin/requests';
              const showBadge = isRequestsItem && pendingCount > 0;

              return (
                <SidebarMenuItem key={item.label}>
                  <Link href={item.href}>
                    <SidebarMenuButton isActive={pathname.startsWith(item.href)} className="text-base py-3">
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                      {showBadge && (
                        <Badge className="ml-auto bg-destructive text-destructive-foreground">
                          {pendingCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-auto w-full items-center justify-start gap-3 px-3 py-2"
              >
                <Avatar>
                  <AvatarImage
                    src={adminAvatar?.imageUrl}
                    data-ai-hint={adminAvatar?.imageHint}
                  />
                  <AvatarFallback>AD</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-semibold">
                    {user.displayName || 'Admin User'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setIsPasswordResetOpen(true)}>
                <KeyRound className="mr-2 h-4 w-4" />
                <span>Change Password</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-secondary/50">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm lg:px-6" style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(3.5rem + env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2">
            <SidebarTrigger className="lg:hidden" />
            <h2 className="font-headline text-base md:text-lg font-semibold">
              {navItems.find((item) => pathname.startsWith(item.href))?.label ||
                'Admin Portal'}
            </h2>
          </div>

          {/* Mobile Logout Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={adminAvatar?.imageUrl}
                      data-ai-hint={adminAvatar?.imageHint}
                    />
                    <AvatarFallback>AD</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">
                      {user.displayName || 'Admin User'}
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {user.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setIsPasswordResetOpen(true)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  <span>Change Password</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-3 md:p-6 lg:p-8 overflow-x-auto min-h-[calc(100vh-4rem)]">{children}</main>
      </SidebarInset>

      <PasswordResetDialog open={isPasswordResetOpen} onOpenChange={setIsPasswordResetOpen} userEmail={user.email || ''} />

    </SidebarProvider>
  );
}
