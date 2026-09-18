/**
 * FIREBASE REALTIME DATABASE — PATH CONFIGURATION
 * ================================================
 * This is the ONE place to change if your Firebase Realtime Database uses
 * different top-level paths than TankSync's defaults. Every hook and page
 * that reads/writes tank data imports these constants instead of hardcoding
 * path strings.
 *
 * Default database structure (documented in full in README.md):
 *
 *   tanks/{tankId}          -> current live state of each tank
 *   history/{entryId}       -> append-only log of every tank update (for charts/reports)
 *   notifications/{id}      -> user-facing alerts/notifications
 *   auditLogs/{id}          -> who/what/when changed a tank (compliance trail)
 *   pumpLogs/{id}           -> pump ON/OFF transitions
 */
export const FIREBASE_PATHS = {
  tanks: 'tanks',
  history: 'history',
  notifications: 'notifications',
  auditLogs: 'auditLogs',
  pumpLogs: 'pumpLogs',
} as const;

export type FirebasePathKey = keyof typeof FIREBASE_PATHS;
