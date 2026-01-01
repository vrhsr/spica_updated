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

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-headline',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();

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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0ea5e9" />
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
