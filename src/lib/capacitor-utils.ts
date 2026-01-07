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
    return !!(window as any).Capacitor;
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

    return capacitor.getPlatform() || 'web';
}
