'use client';

import { type MutableRefObject, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { usePathname } from 'next/navigation';
import { isCapacitorApp } from './capacitor-utils';

type BackButtonListenerHandle = {
    remove: () => Promise<void>;
};

let isInitialized = false;
let lastHandledAt = 0;
// Some Android devices/OS versions (gesture nav in particular) dispatch the
// 'backButton' event more than once for what the rep experiences as a
// single press/swipe. Each firing independently called window.history.back(),
// so one physical back gesture could silently consume several history
// entries at once — a rep several screens deep would suddenly land many
// screens further back than expected. Collapsing any event that arrives
// within this window of the last one we actually acted on turns that back
// into a no-op instead of another navigation.
const BACK_BUTTON_DEBOUNCE_MS = 400;

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
        const now = Date.now();
        if (now - lastHandledAt < BACK_BUTTON_DEBOUNCE_MS) {
            return;
        }
        lastHandledAt = now;

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
            window.location.replace('/rep/');
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
