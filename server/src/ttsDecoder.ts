/**
 * THE THINGS STACK UPLINK DECODER
 * ================================
 * The Things Stack (TTS) v3 Application webhook always sends this outer
 * envelope shape — this part is genuinely documented and stable, not
 * guessed: https://www.thethingsindustries.com/docs/integrations/webhooks/
 *
 *   {
 *     "end_device_ids": { "device_id": "...", ... },
 *     "received_at": "2024-01-01T12:00:00.000Z",
 *     "uplink_message": {
 *       "decoded_payload": { ...device/formatter-specific fields... },
 *       "received_at": "2024-01-01T12:00:00.000Z",
 *       "f_port": 1,
 *       ...
 *     }
 *   }
 *
 * What is NOT knowable in advance is the shape of `decoded_payload` — that
 * depends entirely on YOUR device's payload formatter (decoder script) in
 * the TTS console. Nothing here guesses that shape. Instead, PAYLOAD_FIELD_ALIASES
 * below is the ONE place to add your real field names once you have a real
 * uplink to inspect — exactly the same pattern as the frontend's
 * src/lib/sensorAdapter.ts.
 *
 * Until a real payload is supplied, this decoder still works correctly for
 * any formatter that already happens to emit the canonical names directly
 * (waterLevelPercent, quantityLiters, temperatureC, ph, pumpStatus,
 * deviceStatus) — it just won't recognize OTHER spellings until you add
 * them below.
 */

export interface TTSUplinkEnvelope {
  end_device_ids?: { device_id?: string };
  received_at?: string;
  uplink_message?: {
    decoded_payload?: Record<string, unknown>;
    received_at?: string;
    f_port?: number;
  };
}

export interface NormalizedTankTelemetry {
  deviceId: string | null;
  waterLevelPercent: number | null;
  quantityLiters: number | null;
  temperatureC: number | null;
  ph: number | null;
  pumpStatus: string | null;
  deviceStatus: string | null;
  timestamp: number | null; // normalized to unix milliseconds
  /** The raw decoded_payload as TTS sent it, kept for diagnostics — never written to Firebase as-is. */
  raw: Record<string, unknown>;
}

/** Canonical field -> accepted decoded_payload key spellings. ADD YOUR REAL FIELD NAMES HERE once you have a real uplink. */
const PAYLOAD_FIELD_ALIASES: Record<string, string[]> = {
  waterLevelPercent: ['waterLevelPercent', 'water_level_percent', 'waterLevel', 'water_level', 'level'],
  quantityLiters: ['quantityLiters', 'quantity_liters', 'volumeLiters', 'volume_liters', 'quantity'],
  temperatureC: ['temperatureC', 'temperature_c', 'temperature', 'temp'],
  ph: ['ph', 'pH', 'ph_level', 'phLevel'],
  pumpStatus: ['pumpStatus', 'pump_status', 'pump'],
  deviceStatus: ['deviceStatus', 'device_status', 'status'],
};

function findAliasValue(payload: Record<string, unknown>, aliases: string[]): unknown {
  const keys = Object.keys(payload);
  for (const alias of aliases) {
    const exact = keys.find((k) => k === alias);
    if (exact) return payload[exact];
  }
  const lower = aliases.map((a) => a.toLowerCase());
  const ci = keys.find((k) => lower.includes(k.toLowerCase()));
  return ci ? payload[ci] : undefined;
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return n;
}

function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

/** Normalizes unix seconds, unix milliseconds, or an ISO string into unix milliseconds. Never fabricates a timestamp — returns null if genuinely absent/unparseable. */
export function normalizeTimestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const n = Number(value);
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;

  // Heuristic: 10-digit numbers are unix seconds, 13-digit are milliseconds.
  if (n < 1e11) return Math.round(n * 1000); // seconds -> ms
  return Math.round(n); // already ms
}

/**
 * Decodes one TTS webhook envelope into normalized telemetry. Does NOT
 * validate ranges or write anything — see validate.ts for that. Returns
 * null fields for anything genuinely absent rather than inventing values.
 */
export function decodeTTSUplink(envelope: TTSUplinkEnvelope): NormalizedTankTelemetry {
  const payload = envelope.uplink_message?.decoded_payload ?? {};
  const deviceId = envelope.end_device_ids?.device_id ?? null;

  const timestampSource =
    envelope.uplink_message?.received_at ??
    envelope.received_at ??
    null;

  return {
    deviceId,
    waterLevelPercent: toNumberOrNull(findAliasValue(payload, PAYLOAD_FIELD_ALIASES.waterLevelPercent)),
    quantityLiters: toNumberOrNull(findAliasValue(payload, PAYLOAD_FIELD_ALIASES.quantityLiters)),
    temperatureC: toNumberOrNull(findAliasValue(payload, PAYLOAD_FIELD_ALIASES.temperatureC)),
    ph: toNumberOrNull(findAliasValue(payload, PAYLOAD_FIELD_ALIASES.ph)),
    pumpStatus: toStringOrNull(findAliasValue(payload, PAYLOAD_FIELD_ALIASES.pumpStatus)),
    deviceStatus: toStringOrNull(findAliasValue(payload, PAYLOAD_FIELD_ALIASES.deviceStatus)),
    timestamp: normalizeTimestamp(timestampSource),
    raw: payload,
  };
}
