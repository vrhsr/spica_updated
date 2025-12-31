
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
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
  { href: '/admin/requests', icon: Mail, label: 'Change Requests' },
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

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
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
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Stethoscope className="h-6 w-6" />
            </div>
            <h1 className="font-headline text-xl font-bold">SPICASG</h1>
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
                    <SidebarMenuButton isActive={pathname.startsWith(item.href)}>
                      <item.icon />
                      <span>{item.label}</span>
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
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm lg:px-6">
          <SidebarTrigger className="md:hidden" />
          <h2 className="font-headline text-lg font-semibold">
            {navItems.find((item) => pathname.startsWith(item.href))?.label ||
              'Admin Portal'}
          </h2>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>

      <PasswordResetDialog open={isPasswordResetOpen} onOpenChange={setIsPasswordResetOpen} userEmail={user.email || ''} />

    </SidebarProvider>
  );
}
