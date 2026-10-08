import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Alphabetical comparator for presentation/doctor names. Ignores a leading
 * "Dr." and case, and orders embedded numbers naturally (2 before 10), so
 * "Dr. Kannan" sorts under K alongside a free-named "Cardiology Overview".
 */
export function compareByName(a?: string, b?: string): number {
  const key = (n?: string) => (n ?? '').replace(/^\s*dr\.?\s+/i, '').trim();
  return key(a).localeCompare(key(b), undefined, { sensitivity: 'base', numeric: true });
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
