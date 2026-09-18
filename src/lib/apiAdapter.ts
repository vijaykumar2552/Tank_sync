/**
 * REST API ADAPTER
 * ================
 * TankSync's primary data source is Firebase Realtime Database (see
 * `sensorAdapter.ts` and `constants/firebasePaths.ts`). This module is a
 * secondary, OPTIONAL adapter for a future scenario where sensor data is
 * instead served by a REST backend: ESP32 -> REST API -> TankSync.
 *
 * IMPORTANT: no such backend exists yet. This client is NOT wired into any
 * page or the Zustand store. Calling any method here will throw a clear
 * error unless VITE_API_BASE_URL is set AND that backend actually implements
 * the endpoints below. This file exists purely as a documented, ready-to-use
 * interface — it does not simulate or fabricate API responses.
 *
 * A backend that wants to support this adapter must implement:
 *
 *   GET /api/tanks              -> Tank[]              (raw fields; passed through the sensor adapter)
 *   GET /api/tanks/:tankId      -> Tank
 *   GET /api/devices            -> raw device records   (same shape as Firebase `devices/` would use)
 *   GET /api/readings?tankId=   -> TankHistory[]
 *   GET /api/alerts             -> Notification[]
 *
 * All responses are expected to be JSON arrays/objects using ANY reasonable
 * field naming — they are passed through `normalizeSensorPayload` /
 * `normalizeSensorHistoryPayload` from `sensorAdapter.ts`, so the same field
 * aliasing that covers ESP32-via-Firebase also covers ESP32-via-REST.
 */
import type { Tank, TankHistory, Notification } from '../types';
import { normalizeSensorPayload, normalizeSensorHistoryPayload } from './sensorAdapter';

export class ApiNotConfiguredError extends Error {
  constructor() {
    super('REST API data source is not configured. Set VITE_API_BASE_URL to enable it.');
    this.name = 'ApiNotConfiguredError';
  }
}

function getBaseUrl(): string | null {
  const url = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return url && url.trim().length > 0 ? url.replace(/\/$/, '') : null;
}

export function isApiConfigured(): boolean {
  return getBaseUrl() !== null;
}

async function apiGet<T>(path: string): Promise<T> {
  const base = getBaseUrl();
  if (!base) throw new ApiNotConfiguredError();
  const res = await fetch(`${base}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText} (${path})`);
  }
  return res.json() as Promise<T>;
}

export const apiAdapter = {
  async getTanks(): Promise<Tank[]> {
    const raw = await apiGet<Array<Record<string, unknown>>>('/api/tanks');
    return raw.map((t, i) => normalizeSensorPayload(t, String(t.id ?? t.tankId ?? i)));
  },

  async getTank(tankId: string): Promise<Tank> {
    const raw = await apiGet<Record<string, unknown>>(`/api/tanks/${encodeURIComponent(tankId)}`);
    return normalizeSensorPayload(raw, tankId);
  },

  async getDevices(): Promise<Record<string, unknown>[]> {
    // Device records are backend/hardware-specific; returned as-is (not part
    // of the internal Tank model) for the caller to interpret.
    return apiGet<Array<Record<string, unknown>>>('/api/devices');
  },

  async getReadings(tankId?: string): Promise<TankHistory[]> {
    const qs = tankId ? `?tankId=${encodeURIComponent(tankId)}` : '';
    const raw = await apiGet<Array<Record<string, unknown>>>(`/api/readings${qs}`);
    return raw.map((r, i) => normalizeSensorHistoryPayload(r, String(r.id ?? i)));
  },

  async getAlerts(): Promise<Notification[]> {
    const raw = await apiGet<Array<Record<string, unknown>>>('/api/alerts');
    return raw.map((n, i) => ({
      id: String(n.id ?? i),
      name: String(n.name ?? ''),
      property: String(n.property ?? ''),
      title: String(n.title ?? ''),
      message: String(n.message ?? ''),
      previousValue: (n.previousValue as string | null) ?? null,
      newValue: (n.newValue as string | null) ?? null,
      source: 'API',
      updatedBy: String(n.updatedBy ?? 'API'),
      isRead: Boolean(n.isRead),
      type: (n.type as Notification['type']) ?? 'info',
      timestamp: Number(n.timestamp) || Date.now(),
    }));
  },
};
