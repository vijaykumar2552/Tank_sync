import type { FirebaseConfig } from '../types';

const STORAGE_KEY = 'tanksync_firebase_config';

export function loadSavedConfig(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FirebaseConfig>;
    if (!parsed.apiKey || !parsed.databaseURL) return null;
    return {
      apiKey: parsed.apiKey || '',
      authDomain: parsed.authDomain || '',
      databaseURL: parsed.databaseURL || '',
      projectId: parsed.projectId || '',
      storageBucket: parsed.storageBucket || '',
      messagingSenderId: parsed.messagingSenderId || '',
      appId: parsed.appId || '',
      measurementId: parsed.measurementId || '',
      telemetryPath: parsed.telemetryPath || '/tanks',
    };
  } catch {
    return null;
  }
}

export function saveConfig(cfg: FirebaseConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore quota errors */
  }
}

export function clearSavedConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
