'use client';

import { type MutableRefObject, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { usePathname } from 'next/navigation';
import { isCapacitorApp } from './capacitor-utils';

type BackButtonListenerHandle = {
    remove: () => Promise<void>;
};

let isInitialized = false;

/**
 * Initialize Android back button handler for Capacitor app
 */
export function initializeBackButtonHandler(
    pathnameRef: MutableRefObject<string>,
    onRequestExit: () => void,
    isExitDialogOpenRef: MutableRefObject<boolean>
) {
    if (!isCapacitorApp() || isInitialized) {
        return;
    }

    isInitialized = true;

    App.addListener('backButton', ({ canGoBack }) => {
        const pathname = pathnameRef.current;
        // Normalize pathname for robust matching
        const normalizedPath = pathname.split('?')[0].split('#')[0];
        
        const isPresentationRoute = normalizedPath.startsWith('/rep/present/view');
        // Include both /rep and /rep/ as root
        const isRootRoute = normalizedPath === '/rep' || normalizedPath === '/rep/' || normalizedPath === '/admin/dashboard';

        if (isPresentationRoute) {
            return;
        }

        if (isRootRoute) {
            if (!isExitDialogOpenRef.current) {
                onRequestExit();
            }
            return;
        }

        if (canGoBack) {
            window.history.back();
            return;
        }

        if (!isExitDialogOpenRef.current) {
            // Failsafe for non-root routes when history cannot go back
            window.location.replace('/rep');
        }
    }).then(() => {
        console.log('[BackButton] Listener registered permanently');
    });
}

/**
 * React hook for back button handling
 * Use in your root layout component
 */
export function useBackButtonHandler() {
    const pathname = usePathname();
    const pathnameRef = useRef(pathname);
    const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
    const isExitDialogOpenRef = useRef(false);

    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    useEffect(() => {
        isExitDialogOpenRef.current = isExitDialogOpen;
    }, [isExitDialogOpen]);

    useEffect(() => {
        initializeBackButtonHandler(
            pathnameRef,
            () => setIsExitDialogOpen(true),
            isExitDialogOpenRef
        );
    }, []);

    return {
        isExitDialogOpen,
        setIsExitDialogOpen,
        confirmExit: async () => {
            setIsExitDialogOpen(false);
            await App.exitApp();
        },
    };
}
