/**
 * DEVICE -> TANK MAPPING
 * A webhook payload's device_id is never trusted as a tank ID directly.
 * Only devices explicitly listed in DEVICE_TANK_MAP (server-side env
 * config) can write telemetry, and only to the tank they're mapped to.
 */
let map: Record<string, string> = {};

export function loadDeviceTankMap(json: string): void {
  try {
    const parsed = JSON.parse(json || '{}') as Record<string, unknown>;
    map = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => typeof v === 'string')
    ) as Record<string, string>;
  } catch {
    console.error('[bridge] DEVICE_TANK_MAP is not valid JSON — no devices will be mapped until this is fixed.');
    map = {};
  }
}

export function resolveTankId(deviceId: string | null): string | null {
  if (!deviceId) return null;
  return map[deviceId] ?? null;
}

export function getConfiguredDeviceCount(): number {
  return Object.keys(map).length;
}
