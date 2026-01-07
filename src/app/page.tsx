'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Users, ArrowRight, Menu, X, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

export default function LandingPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Detect online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle Representative card click - redirect to offline mode if offline
  const handleRepClick = (e: React.MouseEvent) => {
    if (!isOnline) {
      e.preventDefault();
      router.push('/rep/offline');
    }
    // If online, let the default Link behavior work
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200" style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(4rem + env(safe-area-inset-top))' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-gray-900 uppercase">
                SG HEALTH PHARMA
              </span>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-gray-400 hover:text-gray-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100 bg-white">
              <div className="flex flex-col gap-2 px-4">
                <Link href="/admin-login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start font-normal">
                    <Shield className="mr-3 h-5 w-5" />
                    Admin Portal
                  </Button>
                </Link>
                <Link href={isOnline ? "/rep-login" : "/rep/offline"} onClick={(e) => { setMobileMenuOpen(false); handleRepClick(e); }}>
                  <Button variant="ghost" className="w-full justify-start font-normal">
                    {!isOnline && <WifiOff className="mr-2 h-4 w-4 text-orange-500" />}
                    <Users className="mr-3 h-5 w-5" />
                    {isOnline ? 'Representative Portal' : 'Offline Presentations'}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content - Cards like Admin Dashboard */}
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 sm:p-8">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight uppercase">
              SG HEALTH PHARMA
            </h1>
            <p className="mt-2 text-gray-500 font-medium">Select your portal to continue</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Admin Portal Card */}
            <Card className="group flex flex-col transition-all hover:border-primary/50 hover:shadow-lg bg-white">
              <Link href="/admin-login" className="flex h-full flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
                    <CardDescription>Management and content control</CardDescription>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <Shield className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-grow items-end justify-between pt-6">
                  <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    Access dashboard
                  </p>
                  <div className="flex items-center text-sm text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary">
                    Login <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </Link>
            </Card>

            {/* Rep Portal Card */}
            <Card className={`group flex flex-col transition-all hover:border-primary/50 hover:shadow-lg bg-white ${!isOnline ? 'ring-2 ring-orange-400' : ''}`}>
              <Link href={isOnline ? "/rep-login" : "/rep/offline"} onClick={handleRepClick} className="flex h-full flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      Representative
                      {!isOnline && (
                        <span className="text-xs font-normal bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <WifiOff className="h-3 w-3" /> Offline
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {isOnline ? 'Presentations and doctor proposals' : 'Access downloaded presentations offline'}
                    </CardDescription>
                  </div>
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center transition-colors ${!isOnline ? 'bg-orange-100 group-hover:bg-orange-500' : 'bg-primary/10 group-hover:bg-primary'}`}>
                    {!isOnline ? (
                      <WifiOff className="h-6 w-6 text-orange-500 group-hover:text-white transition-colors" />
                    ) : (
                      <Users className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-grow items-end justify-between pt-6">
                  <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    {isOnline ? 'Access field portal' : 'View offline presentations'}
                  </p>
                  <div className={`flex items-center text-sm transition-transform group-hover:translate-x-1 ${!isOnline ? 'text-orange-600 group-hover:text-orange-700' : 'text-muted-foreground group-hover:text-primary'}`}>
                    {isOnline ? 'Login' : 'Open'} <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              SG HEALTH PHARMA
            </span>
            <p className="text-xs">
              © 2026 SG Health Pharma. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
