import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import { readFileSync } from 'node:fs';
import type { NormalizedTankTelemetry } from './ttsDecoder.js';

let app: App | null = null;
let db: Database | null = null;

export interface FirebaseAdminInitResult {
  ok: boolean;
  error?: string;
}

export function initFirebaseAdmin(serviceAccountPath: string, databaseURL: string): FirebaseAdminInitResult {
  if (!serviceAccountPath || !databaseURL) {
    return { ok: false, error: 'FIREBASE_SERVICE_ACCOUNT_PATH and FIREBASE_DATABASE_URL must both be set.' };
  }
  try {
    const raw = readFileSync(serviceAccountPath, 'utf-8');
    const serviceAccount = JSON.parse(raw);
    app = initializeApp({ credential: cert(serviceAccount), databaseURL });
    db = getDatabase(app);
    return { ok: true };
  } catch (err) {
    // Never log the file contents — only the fact that it failed.
    return { ok: false, error: `Failed to load service account from ${serviceAccountPath}: ${err instanceof Error ? err.message : 'unknown error'}` };
  }
}

export function isFirebaseAdminReady(): boolean {
  return db !== null;
}

/**
 * Writes one telemetry reading using the EXISTING flat TankSync schema:
 *  - partial update() to tanks/{tankId} — only telemetry fields, so tank
 *    config (name, property, shape, capacity, customImageUrl) set up via
 *    the TankSync UI is never overwritten
 *  - a full snapshot pushed to history/ for Reports/Analytics, matching
 *    the existing TankHistory shape the frontend already reads
 *
 * The tank at tanks/{tankId} must already exist (created via the TankSync
 * UI or Firebase console) — this only updates telemetry fields, it does
 * not create a fully-configured tank from nothing.
 */
export async function writeTelemetry(tankId: string, telemetry: NormalizedTankTelemetry): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: 'Firebase Admin is not initialized.' };

  try {
    const tankRef = db.ref(`tanks/${tankId}`);
    const snap = await tankRef.get();
    const existing = (snap.val() as Record<string, unknown> | null) ?? {};

    const lastUpdated = telemetry.timestamp ?? Date.now();

    const telemetryUpdate: Record<string, unknown> = { lastUpdated, source: 'TTS' };
    if (telemetry.waterLevelPercent !== null) telemetryUpdate.waterLevel = telemetry.waterLevelPercent;
    if (telemetry.quantityLiters !== null) telemetryUpdate.currentWater = telemetry.quantityLiters;
    if (telemetry.temperatureC !== null) telemetryUpdate.temperature = telemetry.temperatureC;
    if (telemetry.ph !== null) telemetryUpdate.ph = telemetry.ph;
    if (telemetry.pumpStatus !== null) telemetryUpdate.pumpStatus = telemetry.pumpStatus;
    if (telemetry.deviceStatus !== null) telemetryUpdate.sensorHealth = telemetry.deviceStatus;

    await tankRef.update(telemetryUpdate);

    const historyEntry = {
      tankId,
      name: existing.name ?? tankId,
      property: existing.property ?? '',
      capacity: existing.capacity ?? 0,
      currentWater: telemetryUpdate.currentWater ?? existing.currentWater ?? 0,
      waterLevel: telemetryUpdate.waterLevel ?? existing.waterLevel ?? 0,
      pumpStatus: telemetryUpdate.pumpStatus ?? existing.pumpStatus ?? 'OFF',
      pumpMode: existing.pumpMode ?? 'Auto',
      battery: existing.battery ?? 0,
      batteryVoltage: existing.batteryVoltage ?? 0,
      signal: existing.signal ?? 0,
      temperature: telemetryUpdate.temperature ?? existing.temperature ?? 0,
      humidity: existing.humidity ?? 0,
      flowRate: existing.flowRate ?? 0,
      ph: telemetryUpdate.ph ?? existing.ph ?? null,
      leak: existing.leak ?? false,
      overflow: existing.overflow ?? false,
      dryRun: existing.dryRun ?? false,
      sensorHealth: telemetryUpdate.sensorHealth ?? existing.sensorHealth ?? 'Good',
      remarks: existing.remarks ?? '',
      source: 'TTS',
      updatedBy: telemetry.deviceId ?? 'tts-bridge',
      timestamp: lastUpdated,
    };

    await db.ref('history').push(historyEntry);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown Firebase write error' };
  }
}
