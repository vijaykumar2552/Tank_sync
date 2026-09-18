/**
 * SENSOR DATA ADAPTER
 * ====================
 * This is the single place in the codebase that maps *raw* incoming sensor
 * payload field names (from Firebase, or later a REST API) onto TankSync's
 * internal canonical field names before they reach `sanitizeTank` /
 * `sanitizeTankHistory` in `utils.ts` for type coercion and safety.
 *
 * If your ESP32 firmware sends different field names than the ones already
 * listed below, add the alias to the relevant array in FIELD_ALIASES.
 * Nothing else in the app needs to change.
 *
 * This layer does NOT invent units or values — it only renames keys it
 * recognizes. Actual numeric coercion, clamping, and defaulting for missing
 * fields still happens in `sanitizeTank` / `sanitizeTankHistory`, so a field
 * your hardware doesn't send simply falls back to that function's existing
 * safe default (never fabricated sensor data).
 */
import type { Tank, TankHistory } from '../types';
import { sanitizeTank, sanitizeTankHistory } from './utils';

/** Canonical internal field name -> accepted raw key spellings (checked case-insensitively). */
export const FIELD_ALIASES: Record<string, string[]> = {
  tankId: ['tankId', 'tank_id', 'tankID'],
  name: ['name', 'tankName', 'tank_name'],
  property: ['property', 'propertyName', 'property_name', 'location'],
  deviceId: ['deviceId', 'device_id', 'deviceID'],
  shape: ['shape', 'tankShape', 'tank_shape'],
  capacity: ['capacity', 'tankCapacity', 'capacityLiters', 'capacity_l'],
  currentWater: ['currentWater', 'currentVolume', 'current_volume', 'current_water', 'volume'],
  waterLevel: ['waterLevel', 'water_level', 'level', 'waterLevelPercent', 'water_level_percent', 'levelPercent'],
  pumpStatus: ['pumpStatus', 'pump_status', 'pump', 'pumpState'],
  pumpMode: ['pumpMode', 'pump_mode'],
  pumpRuntime: ['pumpRuntime', 'pump_runtime', 'runtime'],
  battery: ['battery', 'batteryPercent', 'battery_percent', 'batteryLevel'],
  batteryVoltage: ['batteryVoltage', 'battery_voltage', 'batteryV', 'battery_v'],
  signal: ['signal', 'signalStrength', 'signal_strength', 'rssi', 'signalPercent'],
  temperature: ['temperature', 'temp', 'temperatureC', 'temperature_c'],
  humidity: ['humidity', 'humidityPercent', 'humidity_percent', 'hum'],
  flowRate: ['flowRate', 'flow_rate', 'flow'],
  ph: ['ph', 'pH', 'ph_level', 'phLevel'],
  leak: ['leak', 'leakStatus', 'leak_status', 'leakDetected'],
  overflow: ['overflow', 'overflowStatus', 'overflow_status'],
  dryRun: ['dryRun', 'dry_run', 'dryRunning'],
  sensorHealth: ['sensorHealth', 'sensorStatus', 'sensor_status', 'sensor_health'],
  status: ['status', 'deviceStatus', 'device_status'],
  remarks: ['remarks', 'notes', 'comment'],
  customImageUrl: ['customImageUrl', 'imageUrl', 'image_url'],
  lastUpdated: ['lastUpdated', 'timestamp', 'time', 'ts', 'updatedAt', 'last_updated'],
  timestamp: ['timestamp', 'time', 'ts', 'updatedAt'],
  source: ['source', 'updateSource', 'update_source'],
  updatedBy: ['updatedBy', 'updated_by', 'author'],
};

function findRawKey(raw: Record<string, unknown>, aliases: string[]): string | null {
  const rawKeys = Object.keys(raw);
  for (const alias of aliases) {
    const exact = rawKeys.find((k) => k === alias);
    if (exact) return exact;
  }
  // Case-insensitive fallback pass
  const lowerAliases = aliases.map((a) => a.toLowerCase());
  const ciMatch = rawKeys.find((k) => lowerAliases.includes(k.toLowerCase()));
  return ciMatch ?? null;
}

/**
 * Remaps an arbitrary raw sensor object onto canonical internal field names.
 * Fields with no matching alias in the raw payload are simply left absent,
 * so downstream sanitize functions apply their normal safe defaults.
 */
export function remapSensorFields(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    if (canonical in out) continue; // already using the canonical name
    const rawKey = findRawKey(raw, aliases);
    if (rawKey !== null) {
      out[canonical] = raw[rawKey];
    }
  }
  return out;
}

/** Full pipeline: raw device/Firebase payload -> validated, normalized Tank. */
export function normalizeSensorPayload(raw: Record<string, unknown>, id: string): Tank {
  return sanitizeTank(remapSensorFields(raw), id);
}

/** Full pipeline: raw device/Firebase reading -> validated, normalized TankHistory entry. */
export function normalizeSensorHistoryPayload(raw: Record<string, unknown>, id: string): TankHistory {
  return sanitizeTankHistory(remapSensorFields(raw), id);
}
