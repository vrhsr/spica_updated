/**
 * Storage Quota Management Utilities
 * Helps monitor and manage device storage for offline PWA features
 */

export interface StorageQuotaInfo {
    usage: number;
    quota: number;
    percentUsed: number;
    available: number;
    usageFormatted: string;
    quotaFormatted: string;
    availableFormatted: string;
}

/**
 * Check current storage quota and usage
 * @returns Storage quota information or null if not supported
 */
export async function checkStorageQuota(): Promise<StorageQuotaInfo | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
            const { usage = 0, quota = 0 } = await navigator.storage.estimate();
            const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;
            const available = quota - usage;

            return {
                usage,
                quota,
                percentUsed,
                available,
                usageFormatted: formatBytes(usage),
                quotaFormatted: formatBytes(quota),
                availableFormatted: formatBytes(available),
            };
        } catch (error) {
            console.error('Error checking storage quota:', error);
            return null;
        }
    }
    return null;
}

/**
 * Check if there's enough storage available for a given size
 * @param requiredBytes Number of bytes needed
 * @param bufferPercent Safety buffer percentage (default 10%)
 * @returns True if sufficient storage available
 */
export async function hasEnoughStorage(
    requiredBytes: number,
    bufferPercent: number = 10
): Promise<boolean> {
    const quotaInfo = await checkStorageQuota();
    if (!quotaInfo) {
        // If we can't check, assume it's okay
        return true;
    }

    const requiredWithBuffer = requiredBytes * (1 + bufferPercent / 100);
    return quotaInfo.available >= requiredWithBuffer;
}

/**
 * Get storage status level based on usage percentage
 * @param percentUsed Percentage of storage used
 * @returns Status level: 'healthy' | 'warning' | 'critical'
 */
export function getStorageStatus(percentUsed: number): 'healthy' | 'warning' | 'critical' {
    if (percentUsed >= 90) return 'critical';
    if (percentUsed >= 75) return 'warning';
    return 'healthy';
}

/**
 * Request persistent storage (prevents automatic eviction)
 * @returns True if persistent storage is granted
 */
export async function requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
        try {
            const isPersisted = await navigator.storage.persisted();
            if (isPersisted) {
                return true;
            }

            const granted = await navigator.storage.persist();
            return granted;
        } catch (error) {
            console.error('Error requesting persistent storage:', error);
            return false;
        }
    }
    return false;
}

/**
 * Check if persistent storage is already granted
 */
export async function isPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persisted' in navigator.storage) {
        try {
            return await navigator.storage.persisted();
        } catch (error) {
            console.error('Error checking persistent storage:', error);
            return false;
        }
    }
    return false;
}

/**
 * Format bytes to human-readable size
 * @param bytes Number of bytes
 * @param decimals Number of decimal places (default 2)
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get storage recommendations based on current usage
 */
export async function getStorageRecommendations(): Promise<string[]> {
    const quotaInfo = await checkStorageQuota();
    if (!quotaInfo) {
        return [];
    }

    const recommendations: string[] = [];
    const status = getStorageStatus(quotaInfo.percentUsed);

    if (status === 'critical') {
        recommendations.push('Storage is critically low. Please delete old offline presentations.');
        recommendations.push(`Only ${quotaInfo.availableFormatted} remaining.`);
    } else if (status === 'warning') {
        recommendations.push('Storage is running low. Consider removing older presentations.');
        recommendations.push(`${quotaInfo.availableFormatted} available.`);
    }

    const isPersisted = await isPersistentStorage();
    if (!isPersisted) {
        recommendations.push('Enable persistent storage to prevent automatic data deletion.');
    }

    return recommendations;
}
