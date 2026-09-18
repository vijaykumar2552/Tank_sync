import { useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { getFirebaseDb } from '../lib/firebase';
import { useStore } from '../store/useStore';
import { useFirebaseConfig } from '../context/FirebaseContext';
import { FIREBASE_PATHS } from '../constants/firebasePaths';
import type { Notification } from '../types';

/**
 * Owns the `notifications` realtime listener plus the one-off initial fetches
 * for history/pumpLogs/auditLogs. Live tank data itself is owned exclusively
 * by `useFirebaseTanks` (which also respects the user-configurable Telemetry
 * Path from Settings) — this hook intentionally does NOT also subscribe to
 * the tanks node, to avoid running two listeners against the same data.
 */
export function useRealtime() {
  const { hasConfig, isDemoMode } = useFirebaseConfig();
  const { fetchTanks, fetchHistory, fetchPumpLogs, fetchAuditLogs, pushSourceToast } = useStore();

  useEffect(() => {
    if (isDemoMode) return;

    const database = getFirebaseDb();
    if (!database || !hasConfig) {
      fetchTanks();
      return;
    }

    const notifNode = ref(database, FIREBASE_PATHS.notifications);
    const unsubNotifs = onValue(
      notifNode,
      (snap) => {
        const val = snap.val() as Record<string, Notification> | null;
        if (val) {
          const notifs = Object.entries(val).map(([id, n]) => ({ ...n, id }));
          notifs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          const latest = notifs[0];
          if (latest && !latest.isRead && latest.source === 'Firebase') {
            pushSourceToast({
              id: latest.id,
              source: latest.source,
              message: latest.message,
              tankName: latest.name,
            });
          }
          const { setNotifications } = useStore.getState();
          setNotifications(notifs.slice(0, 100));
        }
      },
      (err) => {
        console.error('notifications listener error:', err);
      }
    );

    fetchTanks();
    fetchHistory();
    fetchPumpLogs();
    fetchAuditLogs();

    return () => {
      unsubNotifs();
    };
  }, [hasConfig, isDemoMode, fetchTanks, fetchHistory, fetchPumpLogs, fetchAuditLogs, pushSourceToast]);
}
