'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { isAvailableOffline } from '@/lib/offline-storage';

interface OfflineBadgeProps {
    doctorId: string;
}

export function OfflineBadge({ doctorId }: OfflineBadgeProps) {
    const [available, setAvailable] = useState(false);

    useEffect(() => {
        setAvailable(isAvailableOffline(doctorId));

        // Listen for storage changes
        const handleStorage = () => {
            setAvailable(isAvailableOffline(doctorId));
        };

        window.addEventListener('storage', handleStorage);
        // Custom event for same-page updates
        window.addEventListener('offline-updated', handleStorage);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('offline-updated', handleStorage);
        };
    }, [doctorId]);

    if (!available) return null;

    return (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
            <Download className="mr-1 h-3 w-3" />
            Offline Ready
        </Badge>
    );
}
