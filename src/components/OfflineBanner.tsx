'use client';
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const setOffline = () => setIsOffline(true);
    const setOnline = () => setIsOffline(false);

    // Initial check
    if (typeof window.navigator.onLine !== 'undefined') {
        setIsOffline(!window.navigator.onLine);
    }

    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);

    return () => {
        window.removeEventListener("online", setOnline);
        window.removeEventListener("offline", setOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    // Not sticky/fixed on purpose: rep/layout.tsx's own header is ALSO
    // sticky top-0 with a lower z-index, so this — sitting right before it
    // in the DOM — would win that fight on scroll and cover the header. A
    // transient "you're offline" notice doesn't need to stay pinned while
    // scrolling; it just scrolls away with the rest of the content.
    //
    // This is also the very FIRST element in the page (renders before the
    // header), so on an edge-to-edge Android WebView it was rendering flush
    // under the status bar — the clock/battery icons overlapping the
    // banner text. Needs the same top-inset treatment as everything else
    // that sits at the top of the screen.
    <div
      className="w-full bg-yellow-500 py-2 text-center text-sm font-semibold text-black"
      style={{ paddingTop: 'calc(0.5rem + max(env(safe-area-inset-top), var(--android-inset-top, 0px)))' }}
    >
      You are currently offline. Some features may be unavailable.
    </div>
  );
}
