import { useEffect } from 'react';

/**
 * Hook to ensure body pointer-events are always reset to auto
 * This fixes issues with modal dialogs leaving pointer-events:none on the body
 */
export function useBodyPointerEventsCleanup() {
    useEffect(() => {
        // Cleanup function that runs when component unmounts or before re-render
        return () => {
            // Small delay to ensure dialog cleanup has completed
            setTimeout(() => {
                if (document.body.style.pointerEvents === 'none') {
                    document.body.style.pointerEvents = '';
                }
            }, 100);
        };
    }, []);

    // Also add a global listener for when dialogs close
    useEffect(() => {
        const checkPointerEvents = () => {
            // Only reset if there are no open dialogs
            const openDialogs = document.querySelectorAll('[role="alertdialog"][data-state="open"], [role="dialog"][data-state="open"]');
            if (openDialogs.length === 0 && document.body.style.pointerEvents === 'none') {
                document.body.style.pointerEvents = '';
            }
        };

        // Check periodically (every 500ms) if pointer events need to be reset
        const interval = setInterval(checkPointerEvents, 500);

        return () => clearInterval(interval);
    }, []);
}
