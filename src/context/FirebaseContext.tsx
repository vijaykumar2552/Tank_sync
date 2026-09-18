import {
  createContext, useContext, useState, useCallback, useEffect, type ReactNode,
} from 'react';
import type { FirebaseConfig, ConnectionStatus } from '../types';
import {
  isEnvConfigured, initializeFirebase, teardownFirebase,
  validateConfig, testFirebaseConnection, resolveFirebaseConfig,
} from '../lib/firebase';
import { loadSavedConfig, saveConfig, clearSavedConfig } from '../lib/firebaseConfigStore';
import { DEFAULT_CONFIG } from '../constants/config';

interface FirebaseContextValue {
  config: FirebaseConfig;
  hasConfig: boolean;
  /** Where the active config came from: 'env', 'saved' (explicitly activated), or 'none'. */
  configSource: 'env' | 'saved' | 'none';
  /** Names of required env vars that are unset. Empty once .env is complete. Never contains values. */
  missingEnvVars: string[];
  /** Whether a config exists in localStorage from an earlier explicit Settings save (whether or not it's active right now). */
  hasSavedConfig: boolean;
  status: ConnectionStatus;
  lastSync: Date | null;
  latency: number | null;
  reconnectAttempts: number;
  projectName: string;
  isDemoMode: boolean;
  saveAndConnect: (cfg: FirebaseConfig) => void;
  /** Explicitly activates a previously saved Settings config for this session. Never called automatically. */
  useSavedConfig: () => void;
  disconnect: () => void;
  testConnection: (cfg: FirebaseConfig) => Promise<{ ok: boolean; message: string }>;
  resetConfig: () => void;
  restoreDefaults: () => void;
  setDemoMode: (on: boolean) => void;
  setStatus: (s: ConnectionStatus) => void;
  setLastSync: (d: Date | null) => void;
  setLatency: (ms: number | null) => void;
  incrementReconnect: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const initial = resolveFirebaseConfig();
  const [config, setConfig] = useState<FirebaseConfig>(initial.config);
  const [hasConfig, setHasConfig] = useState(initial.hasConfig);
  const [configSource, setConfigSource] = useState<'env' | 'saved' | 'none'>(initial.source);
  const [missingEnvVars, setMissingEnvVars] = useState<string[]>(initial.missingEnvVars);
  const [hasSavedConfig, setHasSavedConfig] = useState(initial.hasSavedConfig);
  const [status, setStatus] = useState<ConnectionStatus>('offline');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isDemoMode, setDemoModeState] = useState(false);

  const projectName = config.projectId || 'Unknown Project';

  const saveAndConnect = useCallback((cfg: FirebaseConfig) => {
    const errors = validateConfig(cfg);
    if (errors.length > 0) return;

    saveConfig(cfg);
    setHasSavedConfig(true);

    // A fully-configured .env always wins, even over a config the user just
    // saved in Settings — this is intentional so switching back to .env
    // later doesn't require clearing the saved copy.
    if (isEnvConfigured()) return;

    setConfig(cfg);
    setHasConfig(true);
    setConfigSource('saved');
    setStatus('connecting');

    try {
      initializeFirebase(cfg);
      setStatus('connected');
      setLastSync(new Date());
      setReconnectAttempts(0);
    } catch {
      setStatus('offline');
    }
  }, []);

  /** The ONLY path by which a saved Settings config becomes active — always an explicit user action, never automatic. */
  const useSavedConfig = useCallback(() => {
    const saved = loadSavedConfig();
    if (!saved) return;
    setConfig(saved);
    setHasConfig(true);
    setConfigSource('saved');
    setMissingEnvVars([]);
    setStatus('connecting');
    try {
      initializeFirebase(saved);
      setStatus('connected');
      setLastSync(new Date());
    } catch {
      setStatus('offline');
    }
  }, []);

  const disconnect = useCallback(() => {
    teardownFirebase();
    clearSavedConfig();
    setConfig(DEFAULT_CONFIG);
    setHasConfig(false);
    setConfigSource('none');
    setHasSavedConfig(false);
    setStatus('offline');
    setLastSync(null);
    setLatency(null);
    setReconnectAttempts(0);
  }, []);

  const testConnection = useCallback(async (cfg: FirebaseConfig): Promise<{ ok: boolean; message: string }> => {
    const errors = validateConfig(cfg);
    if (errors.length > 0) return { ok: false, message: errors[0] };

    const start = Date.now();
    const result = await testFirebaseConnection(cfg);
    const elapsed = Date.now() - start;
    setLatency(elapsed);

    if (result.ok) {
      return { ok: true, message: `Connected successfully in ${elapsed}ms` };
    }
    return { ok: false, message: result.error || 'Connection failed' };
  }, []);

  const resetConfig = useCallback(() => {
    clearSavedConfig();
    teardownFirebase();
    const resolved = resolveFirebaseConfig();
    setConfig(resolved.config);
    setHasConfig(resolved.hasConfig);
    setConfigSource(resolved.source);
    setMissingEnvVars(resolved.missingEnvVars);
    setHasSavedConfig(false);
    setStatus('offline');
  }, []);

  const restoreDefaults = useCallback(() => {
    const resolved = resolveFirebaseConfig();
    setConfig(resolved.config);
    setHasConfig(resolved.hasConfig);
    setConfigSource(resolved.source);
    setMissingEnvVars(resolved.missingEnvVars);
    setHasSavedConfig(resolved.hasSavedConfig);
  }, []);

  const setDemoMode = useCallback((on: boolean) => {
    setDemoModeState(on);
    if (on) {
      setStatus('demo');
      teardownFirebase();
    } else {
      setStatus(hasConfig ? 'connecting' : 'offline');
    }
  }, [hasConfig]);

  const incrementReconnect = useCallback(() => {
    setReconnectAttempts((n) => n + 1);
  }, []);

  useEffect(() => {
    if (hasConfig && !isDemoMode) {
      const errors = validateConfig(config);
      if (errors.length === 0) {
        setStatus('connecting');
        try {
          initializeFirebase(config);
          setStatus('connected');
          setLastSync(new Date());
        } catch {
          setStatus('offline');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasConfig, isDemoMode, config]);

  return (
    <FirebaseContext.Provider
      value={{
        config, hasConfig, configSource, missingEnvVars, hasSavedConfig,
        status, lastSync, latency, reconnectAttempts,
        projectName, isDemoMode, saveAndConnect, useSavedConfig, disconnect, testConnection,
        resetConfig, restoreDefaults, setDemoMode, setStatus, setLastSync,
        setLatency, incrementReconnect,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebaseConfig(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) throw new Error('useFirebaseConfig must be used within FirebaseProvider');
  return ctx;
}
