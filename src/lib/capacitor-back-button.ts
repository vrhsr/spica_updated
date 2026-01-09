'use client';

import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { isCapacitorApp } from './capacitor-utils';
import { toast } from '@/hooks/use-toast';

let backButtonListenerHandle: any = null;

/**
 * Initialize Android back button handler for Capacitor app
 * Implements double-tap-to-exit pattern
 */
export function initializeBackButtonHandler() {
    if (!isCapacitorApp()) {
        console.log('[BackButton] Not a Capacitor app, skipping initialization');
        return;
    }

    let lastBackPress = 0;
    const BACK_PRESS_INTERVAL = 2000; // 2 seconds

    // Remove any existing listener
    if (backButtonListenerHandle) {
        backButtonListenerHandle.remove();
        backButtonListenerHandle = null;
    }

    // Add back button listener
    App.addListener('backButton', ({ canGoBack }) => {
        const currentTime = Date.now();
        const timeSinceLastPress = currentTime - lastBackPress;

        // If we can navigate back in the app, let the default behavior handle it
        if (canGoBack) {
            window.history.back();
            return;
        }

        // If at root and back pressed within interval, exit
        if (timeSinceLastPress < BACK_PRESS_INTERVAL) {
            App.exitApp();
        } else {
            // First press - show toast
            lastBackPress = currentTime;
            toast({
                title: 'Press back again to exit',
                duration: 2000,
            });
        }
    }).then((handle) => {
        backButtonListenerHandle = handle;
        console.log('[BackButton] Listener registered successfully');
    });
}

/**
 * Clean up back button handler
 */
export function cleanupBackButtonHandler() {
    if (backButtonListenerHandle) {
        backButtonListenerHandle.remove();
        backButtonListenerHandle = null;
        console.log('[BackButton] Listener removed');
    }
}

/**
 * React hook for back button handling
 * Use in your root layout component
 */
export function useBackButtonHandler() {
    const isInitialized = useRef(false);

    useEffect(() => {
        if (!isInitialized.current) {
            initializeBackButtonHandler();
            isInitialized.current = true;
        }

        return () => {
            cleanupBackButtonHandler();
            isInitialized.current = false;
        };
    }, []);
}
