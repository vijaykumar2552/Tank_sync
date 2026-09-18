import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import type { FirebaseConfig } from '../types';
import { firebaseConfigSchema } from './validation';
import { loadSavedConfig } from './firebaseConfigStore';
import { DEFAULT_CONFIG } from '../constants/config';

let app: FirebaseApp | null = null;
let db: Database | null = null;
let currentConfigKey: string | null = null;

function configSignature(cfg: FirebaseConfig): string {
  return [
    cfg.apiKey, cfg.authDomain, cfg.databaseURL, cfg.projectId,
    cfg.storageBucket, cfg.messagingSenderId, cfg.appId, cfg.telemetryPath,
  ].join('|');
}

/**
 * Best-effort, optional Analytics init. Never awaited by callers, never
 * throws, and never blocks Auth/Database from being ready. If the
 * environment doesn't support Analytics (SSR, some browsers, ad blockers)
 * or measurementId is blank, this silently does nothing.
 */
function initAnalyticsIfConfigured(firebaseApp: FirebaseApp, measurementId: string): void {
  if (!measurementId) return;
  import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      try {
        const supported = await isSupported();
        if (supported) getAnalytics(firebaseApp);
      } catch {
        /* Analytics unavailable in this environment — ignore, non-fatal */
      }
    })
    .catch(() => { /* firebase/analytics failed to load — ignore, non-fatal */ });
}

export function initializeFirebase(cfg: FirebaseConfig): { app: FirebaseApp; db: Database } {
  const sig = configSignature(cfg);
  if (app && db && sig === currentConfigKey) {
    return { app, db };
  }

  if (app) {
    try { deleteApp(app); } catch { /* ignore */ }
  }

  app = initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    databaseURL: cfg.databaseURL,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  }, `tanksync-${Date.now()}`);
  db = getDatabase(app);
  currentConfigKey = sig;

  initAnalyticsIfConfigured(app, cfg.measurementId);

  return { app, db };
}

export async function testFirebaseConnection(cfg: FirebaseConfig): Promise<{ ok: boolean; error?: string }> {
  const testAppName = `tanksync-test-${Date.now()}`;
  let testApp: FirebaseApp | null = null;
  try {
    testApp = initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      databaseURL: cfg.databaseURL,
      projectId: cfg.projectId,
      storageBucket: cfg.storageBucket,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    }, testAppName);
    const testDb = getDatabase(testApp);
    const { ref, get } = await import('firebase/database');
    const snap = await get(ref(testDb, cfg.telemetryPath || '/tanks'));
    void snap;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
  } finally {
    if (testApp) {
      try { await deleteApp(testApp); } catch { /* ignore */ }
    }
  }
}

export function teardownFirebase(): void {
  if (app) {
    try { deleteApp(app); } catch { /* ignore */ }
    app = null;
    db = null;
    currentConfigKey = null;
  }
}

export function getFirebaseDb(): Database | null {
  return db;
}

const ENV_CONFIG: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
  telemetryPath: '/tanks',
};

/** The env vars required for TankSync to run against a real project. measurementId, authDomain, storageBucket, and messagingSenderId are not gating — Analytics is optional and some Auth methods still work without them. */
const REQUIRED_ENV_VARS: Array<[name: string, value: string]> = [
  ['VITE_FIREBASE_API_KEY', ENV_CONFIG.apiKey],
  ['VITE_FIREBASE_DATABASE_URL', ENV_CONFIG.databaseURL],
  ['VITE_FIREBASE_PROJECT_ID', ENV_CONFIG.projectId],
  ['VITE_FIREBASE_APP_ID', ENV_CONFIG.appId],
];

/** Names only — never values. Safe to log or show in the UI. */
export function getMissingRequiredEnvVars(): string[] {
  return REQUIRED_ENV_VARS.filter(([, value]) => !value).map(([name]) => name);
}

let warnedOnce = false;

export function isEnvConfigured(): boolean {
  const missing = getMissingRequiredEnvVars();
  if (missing.length > 0) {
    if (!warnedOnce) {
      // Dev-facing only: names which required var is unset, never its value.
      console.warn(
        `[TankSync] Firebase env config incomplete — missing: ${missing.join(', ')}. ` +
        'This env config will NOT be used until all required variables are set. ' +
        'Check .env at the project root and restart the dev server.'
      );
      warnedOnce = true;
    }
    return false;
  }
  return true;
}

export function getEnvConfig(): FirebaseConfig {
  return ENV_CONFIG;
}

export function validateConfig(cfg: FirebaseConfig): string[] {
  const result = firebaseConfigSchema.safeParse(cfg);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

export type FirebaseConfigSource = 'env' | 'saved' | 'none';

export interface FirebaseConfigResolution {
  /** Where the active config actually came from. */
  source: FirebaseConfigSource;
  config: FirebaseConfig;
  hasConfig: boolean;
  /** Names of required env vars that are unset — empty when source is 'env'. */
  missingEnvVars: string[];
  /** Whether a config exists in localStorage from an earlier explicit Settings save, regardless of whether it's currently active. */
  hasSavedConfig: boolean;
}

/**
 * THE single source of truth for which Firebase config is active, used by
 * both FirebaseContext (Realtime Database) and AuthContext (Authentication)
 * so they can never disagree or independently re-derive this.
 *
 * Precedence (per product requirement):
 *   1. A fully-populated .env always wins — unconditionally, even if a
 *      saved Settings config also exists.
 *   2. A saved Settings config is NEVER applied automatically. It only
 *      becomes active when the user explicitly requests it (see
 *      `useSavedConfig` in FirebaseContext), so a stale save from an
 *      earlier session can't silently override or masquerade as a fresh
 *      .env setup.
 *   3. Never fabricate a fallback: with no valid env and no explicit saved
 *      config in use, this returns hasConfig: false and the missing
 *      variable NAMES — never an empty-but-"looks configured" object.
 */
export function resolveFirebaseConfig(): FirebaseConfigResolution {
  const hasSavedConfig = loadSavedConfig() !== null;

  if (isEnvConfigured()) {
    return { source: 'env', config: ENV_CONFIG, hasConfig: true, missingEnvVars: [], hasSavedConfig };
  }

  return {
    source: 'none',
    config: DEFAULT_CONFIG,
    hasConfig: false,
    missingEnvVars: getMissingRequiredEnvVars(),
    hasSavedConfig,
  };
}
