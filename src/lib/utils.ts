import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Tank, TankHistory, PumpStatus, PumpMode, SensorHealth } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** For percentages that must always be a valid displayable number (waterLevel is `number`, not `number | null`, so unlike pH there's no "unavailable" state to fall back to). Non-numeric input falls back to 0; a numeric but out-of-range value (negative, or over 100) is clamped to the nearest valid bound rather than passed through raw — a sensor should never report -10% or 150%, and displaying that raw would be worse than clamping it. */
export function safeBoundedPercent(value: unknown, fallback = 0): number {
  const n = safeNumber(value, fallback);
  return Math.max(0, Math.min(100, n));
}

/** For fields where "unavailable" must stay null rather than a fake 0 (e.g. pH — 0 is a valid reading, not "no sensor"). Rejects out-of-range values instead of clamping them. */
export function safeNullableNumber(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/**
 * Resolves the tank's actual water volume honestly:
 *  - if the sensor sent a real, finite currentWater/quantity value, use it and label it 'measured'
 *  - else, if capacity and waterLevel are both known, derive volume = capacity x level/100 and label it 'calculated'
 *  - else there's nothing to show — 0 with 'unavailable', which the UI must render as "unavailable", never a bare 0
 */
function resolveQuantity(raw: Record<string, unknown>, capacity: number, waterLevel: number): { currentWater: number; quantitySource: 'measured' | 'calculated' | 'unavailable' } {
  const rawVal = raw.currentWater;
  const measured = typeof rawVal === 'number' ? rawVal : typeof rawVal === 'string' && rawVal.trim() !== '' ? Number(rawVal) : NaN;
  if (Number.isFinite(measured) && measured >= 0) {
    return { currentWater: measured, quantitySource: 'measured' };
  }
  if (capacity > 0 && Number.isFinite(waterLevel)) {
    return { currentWater: Math.round((capacity * waterLevel) / 100), quantitySource: 'calculated' };
  }
  return { currentWater: 0, quantitySource: 'unavailable' };
}

export function formatNumber(value: unknown, fallback = '—'): string {
  const n = safeNumber(value, NaN);
  return Number.isFinite(n) ? n.toLocaleString() : fallback;
}

export function formatDate(date: string | Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : typeof date === 'string' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(date: string | Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : typeof date === 'string' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateTime(date: string | Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : typeof date === 'string' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return '—';
  return `${formatDate(d)} ${formatTime(d)}`;
}

/** "3m ago", "2h ago", etc. Returns null for 0/falsy timestamps so callers can show an honest "never reported" state instead of a nonsense relative time. */
export function formatRelativeTime(timestamp: number): string | null {
  if (!timestamp || timestamp <= 0) return null;
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getLevelColor(percentage: number): string {
  const p = safeNumber(percentage, 0);
  if (p >= 75) return 'text-success-600';
  if (p >= 40) return 'text-warning-500';
  if (p >= 20) return 'text-warning-600';
  return 'text-error-500';
}

export function getLevelBg(percentage: number): string {
  const p = safeNumber(percentage, 0);
  if (p >= 75) return 'bg-success-500';
  if (p >= 40) return 'bg-warning-400';
  if (p >= 20) return 'bg-warning-500';
  return 'bg-error-500';
}

export function getBatteryColor(percentage: number): string {
  const p = safeNumber(percentage, 0);
  if (p >= 60) return 'text-success-600';
  if (p >= 30) return 'text-warning-500';
  return 'text-error-500';
}

export function getSignalColor(strength: number): string {
  const s = safeNumber(strength, 0);
  if (s >= 80) return 'text-success-600';
  if (s >= 50) return 'text-warning-500';
  return 'text-error-500';
}

function safePumpStatus(v: unknown): PumpStatus {
  return v === 'ON' || v === 'OFF' ? v : 'OFF';
}

function safePumpMode(v: unknown): PumpMode {
  return v === 'Manual' || v === 'Auto' ? v : 'Auto';
}

function safeSensorHealth(v: unknown): SensorHealth {
  const allowed = ['Good', 'Fair', 'Poor', 'Offline'] as const;
  return (allowed as readonly string[]).includes(v as string) ? (v as SensorHealth) : 'Good';
}

export function sanitizeTank(raw: Record<string, unknown>, id: string): Tank {
  const capacity = safeNumber(raw.capacity);
  const waterLevel = safeBoundedPercent(raw.waterLevel);
  const quantity = resolveQuantity(raw, capacity, waterLevel);
  return {
    id,
    property: typeof raw.property === 'string' ? raw.property : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    shape: (typeof raw.shape === 'string' ? raw.shape : 'Vertical Cylinder') as Tank['shape'],
    capacity,
    currentWater: quantity.currentWater,
    quantitySource: quantity.quantitySource,
    waterLevel,
    pumpStatus: safePumpStatus(raw.pumpStatus),
    pumpMode: safePumpMode(raw.pumpMode),
    battery: safeNumber(raw.battery),
    batteryVoltage: safeNumber(raw.batteryVoltage),
    signal: safeNumber(raw.signal),
    temperature: safeNumber(raw.temperature),
    humidity: safeNumber(raw.humidity),
    flowRate: safeNumber(raw.flowRate),
    ph: safeNullableNumber(raw.ph, 0, 14),
    leak: raw.leak === true,
    overflow: raw.overflow === true,
    dryRun: raw.dryRun === true,
    sensorHealth: safeSensorHealth(raw.sensorHealth),
    remarks: typeof raw.remarks === 'string' ? raw.remarks : '',
    customImageUrl: typeof raw.customImageUrl === 'string' ? raw.customImageUrl : null,
    status: typeof raw.status === 'string' ? raw.status : 'normal',
    lastUpdated: safeNumber(raw.lastUpdated),
  };
}

export function sanitizeTankHistory(raw: Record<string, unknown>, id: string): TankHistory {
  const capacity = safeNumber(raw.capacity);
  const waterLevel = safeBoundedPercent(raw.waterLevel);
  const quantity = resolveQuantity(raw, capacity, waterLevel);
  return {
    id,
    tankId: typeof raw.tankId === 'string' ? raw.tankId : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    property: typeof raw.property === 'string' ? raw.property : '',
    capacity,
    currentWater: quantity.currentWater,
    quantitySource: quantity.quantitySource,
    waterLevel,
    pumpStatus: safePumpStatus(raw.pumpStatus),
    pumpMode: safePumpMode(raw.pumpMode),
    battery: safeNumber(raw.battery),
    batteryVoltage: safeNumber(raw.batteryVoltage),
    signal: safeNumber(raw.signal),
    temperature: safeNumber(raw.temperature),
    humidity: safeNumber(raw.humidity),
    flowRate: safeNumber(raw.flowRate),
    ph: safeNullableNumber(raw.ph, 0, 14),
    leak: raw.leak === true,
    overflow: raw.overflow === true,
    dryRun: raw.dryRun === true,
    sensorHealth: safeSensorHealth(raw.sensorHealth),
    remarks: typeof raw.remarks === 'string' ? raw.remarks : '',
    source: (typeof raw.source === 'string' ? raw.source : 'Admin') as TankHistory['source'],
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : '',
    timestamp: safeNumber(raw.timestamp),
  };
}

/**
 * Neutralizes CSV/Excel formula injection (CWE-1236): a text field like a
 * tank's remarks or name is user-editable, and if it starts with =, +, -, @,
 * or a tab/CR, spreadsheet software may interpret it as a formula when the
 * export is opened. Prefixing a single quote forces it to be read as plain
 * text in Excel/Sheets/LibreOffice without changing the visible value in
 * almost all viewers. Only applies to strings — never touches numbers.
 */
export function sanitizeForSpreadsheet(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return value;
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}
