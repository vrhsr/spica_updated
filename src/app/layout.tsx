import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Inter } from 'next/font/google';
import { Lora } from 'next/font/google';
import { FirebaseClientProvider } from '@/firebase/client-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-headline',
});

export const metadata: Metadata = {
  title: 'SG HEALTH PHARMA Portal',
  description: 'Professional presentation portal for SG HEALTH PHARMA representatives.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
