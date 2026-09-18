import { useEffect, useCallback } from 'react';
import { ref, onValue, off, update } from 'firebase/database';
import { getFirebaseDb, initializeFirebase } from '../lib/firebase';
import { useStore } from '../store/useStore';
import { useFirebaseConfig } from '../context/FirebaseContext';
import { normalizeSensorPayload } from '../lib/sensorAdapter';
import { FIREBASE_PATHS } from '../constants/firebasePaths';

const THROTTLE_MS = 2000;
let lastSyncTime = 0;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

export function useFirebaseTanks() {
  const {
    config, hasConfig, isDemoMode,
    setStatus, setLastSync, setLatency, incrementReconnect,
  } = useFirebaseConfig();

  const syncTelemetry = useCallback((tanksVal: Record<string, unknown> | null) => {
    if (!tanksVal) return;
    const { setTanks } = useStore.getState();
    const tanks = Object.entries(tanksVal).map(([id, t]) => normalizeSensorPayload(t as Record<string, unknown>, id));
    tanks.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    setTanks(tanks);
  }, []);

  useEffect(() => {
    if (isDemoMode || !hasConfig) return;

    let database = getFirebaseDb();
    if (!database) {
      try {
        database = initializeFirebase(config).db;
      } catch {
        setStatus('offline');
        return;
      }
    }
    if (!database) {
      setStatus('offline');
      return;
    }

    setStatus('connecting');
    const tanksPath = config.telemetryPath || FIREBASE_PATHS.tanks;
    const tanksNode = ref(database, tanksPath);

    const handleSnapshot = (snapshot: { val: () => unknown }) => {
      const now = Date.now();
      const payload = snapshot.val() as Record<string, unknown> | null;

      const doSync = () => {
        const start = Date.now();
        try {
          syncTelemetry(payload);
          setStatus('connected');
          setLastSync(new Date());
          setLatency(Date.now() - start);
        } catch {
          setStatus('reconnecting');
          incrementReconnect();
        }
      };

      if (now - lastSyncTime < THROTTLE_MS) {
        if (pendingTimer) clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => {
          lastSyncTime = Date.now();
          doSync();
        }, THROTTLE_MS);
      } else {
        lastSyncTime = now;
        doSync();
      }
    };

    const unsub = onValue(
      tanksNode,
      handleSnapshot,
      (error) => {
        console.error('Firebase listener error:', error);
        setStatus('reconnecting');
        incrementReconnect();
      }
    );

    return () => {
      off(tanksNode, 'value', unsub);
      if (pendingTimer) clearTimeout(pendingTimer);
    };
  }, [hasConfig, isDemoMode, config.apiKey, config.databaseURL, config.telemetryPath, setStatus, setLastSync, setLatency, incrementReconnect, syncTelemetry]);
}

export async function setFirebasePump(tankId: string, pumpStatus: 'ON' | 'OFF') {
  const database = getFirebaseDb();
  if (!database) return;
  await update(ref(database, `${FIREBASE_PATHS.tanks}/${tankId}`), {
    pumpStatus,
    lastUpdated: Date.now(),
  });
}
