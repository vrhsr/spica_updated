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
    <div className="sticky top-0 z-50 w-full bg-yellow-500 py-2 text-center text-sm font-semibold text-black">
      You are currently offline. Some features may be unavailable.
    </div>
  );
}
