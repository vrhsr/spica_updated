'use client';

import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Inter } from 'next/font/google';
import { Lora } from 'next/font/google';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useBackButtonHandler } from '@/lib/capacitor-back-button';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-headline',
});

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UpdateNotification } from '@/components/UpdateNotification';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  // Initialize Android back button handler for Capacitor app
  useBackButtonHandler();

  // Offline detection and auto-redirect
  useEffect(() => {
    // Skip offline redirect if already in offline mode or special routes
    const isOfflineRoute = pathname === '/rep/offline' || pathname.startsWith('/rep/present/');
    const isPublicRoute = pathname === '/' || pathname === '/rep-login' || pathname === '/admin-login';

    if (!navigator.onLine && !isOfflineRoute && !isPublicRoute) {
      // Only redirect to offline if not already there
      router.replace('/rep/offline');
    }
  }, [router, pathname]);

  return (
    <html
      lang="en"
      className={cn(inter.variable, lora.variable)}
      style={{ colorScheme: 'light' }}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#0ea5e9" />
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
        <ErrorBoundary level="root">
          <FirebaseClientProvider>
            {children}
            <UpdateNotification />
            <Toaster />
          </FirebaseClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
