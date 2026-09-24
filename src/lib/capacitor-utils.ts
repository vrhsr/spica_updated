/**
 * Utility to detect if the app is running in Capacitor (native mobile app)
 * vs web browser
 */

/**
 * Check if the app is running in a Capacitor environment
 * @returns true if running in Capacitor native app, false if in web browser
 */
export function isCapacitorApp(): boolean {
    if (typeof window === 'undefined') return false;

    // Check if Capacitor global object exists
    const capacitor = (window as any).Capacitor;
    if (capacitor) {
        // Check if running on native platform
        if (typeof capacitor.isNativePlatform === 'function') {
            return capacitor.isNativePlatform();
        }
        // Fallback to platform check
        const platform = capacitor.getPlatform?.();
        return platform === 'android' || platform === 'ios';
    }

    // Fallback: Check user agent for Android WebView
    const ua = navigator.userAgent || '';
    // Android WebView detection
    if (ua.includes('wv') || (ua.includes('Android') && !ua.includes('Chrome/'))) {
        return true;
    }

    return false;
}

/**
 * The Android app's own locally-bundled login screen. Capacitor serves the
 * root index.html for any extensionless path, so a deep link to /login/
 * wouldn't reliably render the login page — land on the root and let the
 * landing page forward to /login client-side (see src/app/page.tsx).
 */
export const APP_SHELL_LOGIN_URL = 'https://localhost/?next=login';

/**
 * True when the LIVE site (spicasg.in) is loaded inside our Android app's
 * WebView — i.e. after the admin/manager handoff, not the local bundle.
 * Native plugins don't work there (Capacitor sees its bridge, so it treats
 * the page as native, but has no plugin list for it — every plugin call
 * rejects with UNIMPLEMENTED), so anything that needs the app, like native
 * Google Sign-In, has to happen back on APP_SHELL_LOGIN_URL. Checks for the bridge
 * object itself, not the user agent: other apps' in-app browsers (Gmail,
 * WhatsApp) also look like a WebView and must not match.
 */
export function isLiveSiteInsideApp(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window as any).androidBridge && window.location.hostname !== 'localhost';
}

/**
 * Check if the app is running in a web browser
 * @returns true if running in web browser, false if in Capacitor
 */
export function isWebBrowser(): boolean {
    return !isCapacitorApp();
}

/**
 * Get the platform name (ios, android, web)
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
    if (typeof window === 'undefined') return 'web';

    const capacitor = (window as any).Capacitor;
    if (!capacitor) return 'web';

    return capacitor.getPlatform?.() || 'web';
}
