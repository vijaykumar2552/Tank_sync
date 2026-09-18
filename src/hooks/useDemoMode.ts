import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useFirebaseConfig } from '../context/FirebaseContext';

export function useDemoMode() {
  const { isDemoMode, status, setDemoMode } = useFirebaseConfig();
  const { tanks } = useStore();
  const tanksRef = useRef(tanks);
  tanksRef.current = tanks;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isDemoMode) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const { upsertTank } = useStore.getState();

    intervalRef.current = setInterval(() => {
      const currentTanks = tanksRef.current;
      if (currentTanks.length === 0) return;

      currentTanks.forEach((tank) => {
        const drift = (Math.random() - 0.45) * 8;
        const newPct = Math.max(0, Math.min(100, Math.round(tank.waterLevel + drift)));
        const newLitres = Math.round((newPct / 100) * tank.capacity);
        const newTemp = Math.round((tank.temperature + (Math.random() - 0.5) * 2) * 10) / 10;
        const newBattery = Math.max(0, Math.min(100, Math.round(tank.battery + (Math.random() - 0.5) * 2)));
        const newSignal = Math.max(0, Math.min(100, Math.round(tank.signal + (Math.random() - 0.5) * 5)));

        upsertTank({
          ...tank,
          waterLevel: newPct,
          currentWater: newLitres,
          temperature: newTemp,
          battery: newBattery,
          signal: newSignal,
          lastUpdated: Date.now(),
        });
      });
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isDemoMode]);

  useEffect(() => {
    if (status === 'offline' && !isDemoMode) {
      const timer = setTimeout(() => {
        setDemoMode(true);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [status, isDemoMode, setDemoMode]);

  return { isDemoMode };
}
