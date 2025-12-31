'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SaveOfflineButtonProps {
  pdfUrl?: string;
  disabled?: boolean;
}

const CACHE_NAME = 'pdf-cache-v1';

export function SaveOfflineButton({ pdfUrl, disabled }: SaveOfflineButtonProps) {
  const [isCached, setIsCached] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function checkCache() {
      if (!pdfUrl || !window.caches) {
        setIsChecking(false);
        return;
      };
      
      try {
        const cache = await caches.open(CACHE_NAME);
        const match = await cache.match(pdfUrl);
        setIsCached(!!match);
      } catch (error) {
        console.error("Error checking cache:", error);
      } finally {
        setIsChecking(false);
      }
    }
    checkCache();
  }, [pdfUrl]);
  
  const handleSaveOffline = async () => {
    if (!pdfUrl || !window.caches) {
        toast({ title: 'Error', description: 'Offline storage is not supported in this browser.', variant: 'destructive' });
        return;
    }
    setIsSaving(true);
    try {
        const cache = await caches.open(CACHE_NAME);
        // Important: fetch with no-cors might be needed if Supabase has strict CORS rules
        const response = await fetch(pdfUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        await cache.put(pdfUrl, response);
        setIsCached(true);
        toast({ title: 'Saved for Offline', description: 'This presentation is now available without an internet connection.' });
    } catch(error: any) {
        console.error('Failed to cache PDF:', error);
        toast({ title: 'Save Failed', description: error.message || 'Could not save the file for offline use.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }

  if (isChecking) {
    return (
        <Button variant="secondary" size="sm" disabled>
            <Loader className="mr-2 h-4 w-4 animate-spin"/>
            Checking...
        </Button>
    )
  }

  if (isCached) {
     return (
        <Button variant="secondary" size="sm" disabled>
            <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
            Saved
        </Button>
     )
  }

  return (
    <Button 
        variant="default" 
        size="sm" 
        onClick={handleSaveOffline}
        disabled={disabled || isSaving}
    >
        {isSaving ? (
            <Loader className="mr-2 h-4 w-4 animate-spin"/>
        ) : (
            <Download className="mr-2 h-4 w-4" />
        )}
      {isSaving ? 'Saving...' : 'Save Offline'}
    </Button>
  );
}
