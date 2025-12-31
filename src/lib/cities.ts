// This file is no longer the source of truth for cities.
// Cities are now managed dynamically in the Firestore 'cities' collection.
// This file is kept to avoid breaking imports, but the array is now empty.
export const CITIES: readonly string[] = [] as const;

export type City = (typeof CITIES)[number];
