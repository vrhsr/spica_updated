'use client';

import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Inter } from 'next/font/google';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useBackButtonHandler } from '@/lib/capacitor-back-button';
import { AppExitDialog } from '@/components/AppExitDialog';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UpdateNotification } from '@/components/UpdateNotification';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { isExitDialogOpen, setIsExitDialogOpen, confirmExit } = useBackButtonHandler();

  // Offline detection and auto-redirect
  useEffect(() => {
    // Skip offline redirect if already in offline mode or special routes
    const isOfflineRoute = pathname.includes('/rep/offline') || pathname.includes('/rep/present/');
    const isPublicRoute = pathname === '/' || pathname.includes('/login') || pathname.includes('/rep-login') || pathname.includes('/admin-login') || pathname.includes('/accept-invite');

    if (!navigator.onLine && !isOfflineRoute && !isPublicRoute) {
      // Only redirect to offline if not already there
      router.replace('/rep/offline');
    }
  }, [router, pathname]);

  return (
    <html
      lang="en"
      className={cn(inter.variable)}
      style={{ colorScheme: 'light' }}
    >
      <head>
        <link rel="icon" href="/spicasg-logo.png" type="image/png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className={cn('min-h-screen bg-slate-50 font-body antialiased')}>
        <ErrorBoundary level="root">
          <FirebaseClientProvider>
            {children}
            <AppExitDialog
              open={isExitDialogOpen}
              onOpenChange={setIsExitDialogOpen}
              onConfirm={confirmExit}
            />
            <UpdateNotification />
            <Toaster />
          </FirebaseClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

