import type { NormalizedTankTelemetry } from './ttsDecoder.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /** The telemetry with any individually-invalid fields nulled out (not silently replaced with a guess). */
  sanitized: NormalizedTankTelemetry;
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // reject telemetry older than 24h as likely a clock/formatting bug

/**
 * Validates one decoded telemetry reading. A field that's out of range or
 * the wrong type is nulled (never replaced with a plausible-looking guess)
 * and recorded as an error. The whole reading is rejected (valid: false)
 * only when there's no usable data at all or the device/timestamp is
 * unusable.
 */
export function validateTelemetry(input: NormalizedTankTelemetry): ValidationResult {
  const errors: string[] = [];
  const sanitized: NormalizedTankTelemetry = { ...input };

  if (!input.deviceId) {
    errors.push('Missing end_device_ids.device_id — cannot map to a tank.');
  }

  if (sanitized.waterLevelPercent !== null) {
    if (sanitized.waterLevelPercent < 0 || sanitized.waterLevelPercent > 100) {
      errors.push(`waterLevelPercent ${sanitized.waterLevelPercent} is outside 0-100 — rejected, not clamped.`);
      sanitized.waterLevelPercent = null;
    }
  }

  if (sanitized.quantityLiters !== null && sanitized.quantityLiters < 0) {
    errors.push(`quantityLiters ${sanitized.quantityLiters} is negative — rejected.`);
    sanitized.quantityLiters = null;
  }

  if (sanitized.temperatureC !== null && (sanitized.temperatureC < -50 || sanitized.temperatureC > 150)) {
    errors.push(`temperatureC ${sanitized.temperatureC} is outside a plausible sensor range (-50 to 150) — rejected.`);
    sanitized.temperatureC = null;
  }

  if (sanitized.ph !== null && (sanitized.ph < 0 || sanitized.ph > 14)) {
    errors.push(`ph ${sanitized.ph} is outside 0-14 — rejected.`);
    sanitized.ph = null;
  }

  if (sanitized.timestamp === null) {
    errors.push('No usable timestamp on this uplink (checked uplink_message.received_at and top-level received_at).');
  } else if (sanitized.timestamp > Date.now() + 5 * 60_000) {
    errors.push(`Timestamp ${new Date(sanitized.timestamp).toISOString()} is more than 5 minutes in the future — rejected.`);
    sanitized.timestamp = null;
  } else if (Date.now() - sanitized.timestamp > STALE_THRESHOLD_MS) {
    errors.push(`Timestamp ${new Date(sanitized.timestamp).toISOString()} is over 24h old — flagged as stale, still written.`);
    // Stale is a warning, not a rejection — the device may have queued uplinks.
  }

  const hasAnyReading =
    sanitized.waterLevelPercent !== null || sanitized.quantityLiters !== null ||
    sanitized.temperatureC !== null || sanitized.ph !== null ||
    sanitized.pumpStatus !== null || sanitized.deviceStatus !== null;

  if (!hasAnyReading) {
    errors.push('No recognized telemetry field found in decoded_payload — check PAYLOAD_FIELD_ALIASES in ttsDecoder.ts against your real payload.');
  }

  const valid = Boolean(input.deviceId) && hasAnyReading && sanitized.timestamp !== null;

  return { valid, errors, sanitized };
}
