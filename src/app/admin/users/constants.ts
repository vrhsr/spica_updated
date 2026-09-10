/**
 * There is exactly one true admin account, identified by email rather than a
 * mutable role field, so it can never be reassigned or lost via the app UI.
 * Everyone else with elevated access is a 'manager' (Project Manager), who
 * can add representatives but cannot delete/suspend anyone or touch roles.
 *
 * Lives in its own plain module (not actions.ts) because a 'use server' file
 * may only export async functions — a const export there breaks the build.
 */
export const KING_ADMIN_EMAIL = 'mvrhsr@gmail.com';
