import { useEffect, useRef } from 'react';
import type { Tank, Notification, NotificationType } from '../types';
import { useStore } from '../store/useStore';

const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes with no update = stale

export type AlertKind =
  | 'low-water' | 'critical-water' | 'overflow-risk' | 'rapid-drop' | 'possible-leak'
  | 'pump-running-long' | 'device-offline' | 'sensor-offline' | 'low-battery'
  | 'weak-signal' | 'stale-data' | 'dry-run';

export interface AlertCandidate {
  key: string; // stable per (tank, kind) — used for dedup
  kind: AlertKind;
  severity: NotificationType; // 'info' | 'warning' | 'error' (mapped to severity below)
  title: string;
  message: string;
  tank: Tank;
}

const PUMP_RUNTIME_WARNING_MS = 60 * 60 * 1000; // 1 hour continuous run

/** Pure function: given current (and optionally previous) tank state plus the most recent pump-log transition for it, return active alert conditions. Real data only — no fabricated conditions. */
export function evaluateTankAlerts(tank: Tank, previous?: Tank, latestPumpTransitionAt?: number): AlertCandidate[] {
  const alerts: AlertCandidate[] = [];
  const now = Date.now();

  if (tank.waterLevel <= 10) {
    alerts.push({
      key: `${tank.id}:critical-water`, kind: 'critical-water', severity: 'error',
      title: 'Critical Water Level',
      message: `${tank.name} is at ${tank.waterLevel}% — critically low.`,
      tank,
    });
  } else if (tank.waterLevel <= 20) {
    alerts.push({
      key: `${tank.id}:low-water`, kind: 'low-water', severity: 'warning',
      title: 'Low Water Level',
      message: `${tank.name} is at ${tank.waterLevel}%.`,
      tank,
    });
  }

  if (tank.waterLevel >= 95 && !tank.overflow) {
    alerts.push({
      key: `${tank.id}:overflow-risk`, kind: 'overflow-risk', severity: 'warning',
      title: 'Overflow Risk',
      message: `${tank.name} is at ${tank.waterLevel}% and approaching capacity.`,
      tank,
    });
  }

  if (tank.overflow) {
    alerts.push({
      key: `${tank.id}:overflow-risk-active`, kind: 'overflow-risk', severity: 'error',
      title: 'Overflow Detected',
      message: `${tank.name} is currently overflowing.`,
      tank,
    });
  }

  if (tank.leak) {
    alerts.push({
      key: `${tank.id}:possible-leak`, kind: 'possible-leak', severity: 'error',
      title: 'Possible Leak Detected',
      message: `Leak flag is active on ${tank.name}.`,
      tank,
    });
  }

  if (tank.dryRun) {
    alerts.push({
      key: `${tank.id}:dry-run`, kind: 'dry-run', severity: 'error',
      title: 'Dry Run Warning',
      message: `Pump on ${tank.name} is running without sufficient water.`,
      tank,
    });
  }

  if (previous && tank.waterLevel < previous.waterLevel - 15) {
    alerts.push({
      key: `${tank.id}:rapid-drop`, kind: 'rapid-drop', severity: 'warning',
      title: 'Rapid Water Level Drop',
      message: `${tank.name} dropped from ${previous.waterLevel}% to ${tank.waterLevel}% since the last reading.`,
      tank,
    });
  }

  if (tank.pumpStatus === 'ON' && latestPumpTransitionAt && now - latestPumpTransitionAt > PUMP_RUNTIME_WARNING_MS) {
    const hours = Math.round(((now - latestPumpTransitionAt) / 3600_000) * 10) / 10;
    alerts.push({
      key: `${tank.id}:pump-running-long`, kind: 'pump-running-long', severity: 'warning',
      title: 'Pump Running Too Long',
      message: `Pump on ${tank.name} has been running continuously for approximately ${hours} hours.`,
      tank,
    });
  }

  if (tank.sensorHealth === 'Offline') {
    alerts.push({
      key: `${tank.id}:sensor-offline`, kind: 'sensor-offline', severity: 'warning',
      title: 'Sensor Offline',
      message: `Sensor for ${tank.name} is reporting as offline.`,
      tank,
    });
  }

  if (tank.battery > 0 && tank.battery < 15) {
    alerts.push({
      key: `${tank.id}:low-battery`, kind: 'low-battery', severity: 'warning',
      title: 'Low Battery',
      message: `Battery on ${tank.name} is at ${tank.battery}%.`,
      tank,
    });
  }

  if (tank.signal > 0 && tank.signal < 25) {
    alerts.push({
      key: `${tank.id}:weak-signal`, kind: 'weak-signal', severity: 'warning',
      title: 'Weak Signal',
      message: `Signal strength on ${tank.name} is at ${tank.signal}%.`,
      tank,
    });
  }

  if (tank.lastUpdated && now - tank.lastUpdated > STALE_THRESHOLD_MS) {
    const minutes = Math.round((now - tank.lastUpdated) / 60000);
    alerts.push({
      key: `${tank.id}:stale-data`, kind: 'stale-data', severity: 'warning',
      title: 'Stale Sensor Data',
      message: `${tank.name} has not reported a reading in ${minutes} minutes.`,
      tank,
    });
  }

  return alerts;
}

function toNotification(candidate: AlertCandidate): Notification {
  return {
    id: `alert-${candidate.key}-${Date.now()}`,
    name: candidate.tank.name,
    property: candidate.tank.property,
    title: candidate.title,
    message: candidate.message,
    previousValue: null,
    newValue: null,
    source: 'Firebase',
    updatedBy: 'TankSync Alert Engine',
    isRead: false,
    type: candidate.severity,
    timestamp: Date.now(),
  };
}

/**
 * Watches live tank state and raises client-side notifications for real
 * threshold crossings, deduplicated so a persisting condition (e.g. still
 * low battery) doesn't spam a new notification every update — it only
 * re-fires once the condition clears and re-occurs. Runs once at the app
 * root alongside the other realtime hooks.
 */
export function useAlertsEngine() {
  const tanks = useStore((s) => s.tanks);
  const pumpLogs = useStore((s) => s.pumpLogs);
  const addNotification = useStore((s) => s.addNotification);
  const activeKeys = useRef<Set<string>>(new Set());
  const previousTanks = useRef<Map<string, Tank>>(new Map());

  useEffect(() => {
    const stillActive = new Set<string>();

    // pumpLogs is already sorted newest-first; find each tank's most recent
    // transition timestamp where it was switched ON.
    const latestOnTransition = new Map<string, number>();
    for (const log of pumpLogs) {
      if (latestOnTransition.has(log.tankId)) continue;
      if (log.pumpStatus === 'ON') latestOnTransition.set(log.tankId, log.timestamp);
      else latestOnTransition.set(log.tankId, 0); // most recent transition was OFF — not currently running
    }

    tanks.forEach((tank) => {
      const previous = previousTanks.current.get(tank.id);
      const transitionAt = latestOnTransition.get(tank.id) || undefined;
      const candidates = evaluateTankAlerts(tank, previous, transitionAt);

      candidates.forEach((c) => {
        stillActive.add(c.key);
        if (!activeKeys.current.has(c.key)) {
          addNotification(toNotification(c));
        }
      });

      previousTanks.current.set(tank.id, tank);
    });

    activeKeys.current = stillActive;
  }, [tanks, pumpLogs, addNotification]);
}
