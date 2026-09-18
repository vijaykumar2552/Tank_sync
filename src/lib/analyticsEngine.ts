/**
 * ANALYTICS ENGINE
 * ================
 * Pure, deterministic calculations over real TankHistory/PumpLog data.
 * Deliberately kept OUT of React components (per project requirement) so it
 * can be unit-tested in isolation and reused by both the AI Insights page
 * and Excel/Report exports.
 *
 * Every function here either returns a real result computed from the data
 * it was given, or an explicit "insufficient data" signal (null / a
 * `sufficient: false` flag, or the DataSufficiency tri-state below) — never
 * a fabricated number. Thresholds for "enough data" are named constants
 * below so they're easy to audit.
 *
 * ON MACHINE LEARNING: this file deliberately does NOT include an ML layer
 * (e.g. Isolation Forest, K-means). Explicit decision, not an oversight:
 *   1. There is currently no accumulated real production dataset (no
 *      hardware connected yet) — training on anything else would mean
 *      training on synthetic/demo data, which is exactly what's ruled out.
 *   2. Every use case in the spec this was built against (anomaly
 *      detection, forecasting, pattern discovery) is already covered by
 *      explainable statistical methods here (z-score/IQR, exponential
 *      smoothing, Pearson/Spearman, change-point detection).
 *   3. Adding an ML dependency now would be exactly the "add ML to claim
 *      AI" anti-pattern this project explicitly avoids.
 * Revisit this once real historical data has accumulated AND a concrete
 * gap emerges that these deterministic methods can't cover.
 */
import type { Tank, TankHistory, PumpLog } from '../types';

// ---- Data-sufficiency thresholds (named so they're auditable, not magic numbers) ----
export const MIN_POINTS_FOR_TREND = 4;
export const MIN_POINTS_FOR_ANOMALY = 10;
export const MIN_POINTS_FOR_FORECAST = 6;
export const MIN_POINTS_FOR_PEAK = 8;
export const MIN_POINTS_FOR_CORRELATION = 8;

export type DataSufficiency = 'READY' | 'LIMITED' | 'INSUFFICIENT';

/** Shared, centralized sufficiency classification so every analysis function judges "enough data" the same way. */
export function classifySufficiency(pointCount: number, minForLimited: number, minForReady: number): DataSufficiency {
  if (pointCount < minForLimited) return 'INSUFFICIENT';
  if (pointCount < minForReady) return 'LIMITED';
  return 'READY';
}

// ============================================================
// Basic stats helpers
// ============================================================
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Interquartile range — [Q1, Q3, IQR]. */
export function quartiles(xs: number[]): { q1: number; q3: number; iqr: number } {
  if (xs.length === 0) return { q1: 0, q3: 0, iqr: 0 };
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted.slice(0, mid);
  const upper = sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);
  const q1 = median(lower);
  const q3 = median(upper.length ? upper : sorted.slice(mid));
  return { q1, q3, iqr: q3 - q1 };
}

/** Pearson correlation coefficient, -1..1. Returns null if inputs are too short or constant (undefined correlation). */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < MIN_POINTS_FOR_CORRELATION) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return null; // one series is constant — correlation undefined
  return num / Math.sqrt(dx2 * dy2);
}

function rank(xs: number[]): number[] {
  const indexed = xs.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(xs.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j) / 2 + 1; // tie-aware average rank
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

/** Spearman rank correlation — captures monotonic (not necessarily linear) relationships, e.g. "consumption rises with temperature" even if the relationship isn't a straight line. Same sufficiency/undefined-correlation rules as Pearson. */
export function spearmanCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < MIN_POINTS_FOR_CORRELATION) return null;
  return pearsonCorrelation(rank(xs), rank(ys));
}

// ============================================================
// Timestamp / grouping helpers
// ============================================================
function sortByTime(entries: TankHistory[]): TankHistory[] {
  return [...entries].sort((a, b) => a.timestamp - b.timestamp);
}

export function groupByHour(entries: TankHistory[]): Map<number, TankHistory[]> {
  const map = new Map<number, TankHistory[]>();
  entries.forEach((e) => {
    const hour = new Date(e.timestamp).getHours();
    const arr = map.get(hour) ?? [];
    arr.push(e);
    map.set(hour, arr);
  });
  return map;
}

export function groupByDayOfWeek(entries: TankHistory[]): Map<number, TankHistory[]> {
  const map = new Map<number, TankHistory[]>();
  entries.forEach((e) => {
    const day = new Date(e.timestamp).getDay(); // 0=Sunday
    const arr = map.get(day) ?? [];
    arr.push(e);
    map.set(day, arr);
  });
  return map;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ============================================================
// Consumption (refill-aware: only level DROPS count as consumption;
// a rise is treated as a refill event and excluded from the sum)
// ============================================================
export interface ConsumptionResult {
  sufficient: boolean;
  totalLiters: number;
  refillEvents: number;
  reason?: string;
}

/** Consumption between consecutive readings of ONE tank's history, in liters (measured currentWater delta). Sudden resets (e.g. sensor reset to a much higher reading with no plausible refill volume) are not specially distinguished from a real refill — this is a documented limitation, not a silent guess. */
export function calculateConsumption(entriesForOneTank: TankHistory[]): ConsumptionResult {
  const sorted = sortByTime(entriesForOneTank);
  if (sorted.length < 2) {
    return { sufficient: false, totalLiters: 0, refillEvents: 0, reason: 'Need at least 2 readings to calculate consumption.' };
  }
  let total = 0;
  let refills = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const delta = prev.currentWater - cur.currentWater; // positive = water went down = consumption
    if (delta > 0) {
      total += delta;
    } else if (delta < 0) {
      refills += 1; // level rose — a refill, not consumption; excluded from total
    }
  }
  return { sufficient: true, totalLiters: Math.round(total), refillEvents: refills };
}

// ============================================================
// Peak usage (which hour/day sees the most consumption)
// ============================================================
export interface PeakUsageResult {
  sufficient: boolean;
  peakHour: number | null;
  peakHourLabel: string | null;
  peakDay: string | null;
  minHour: number | null;
  avgHourlyConsumption: number | null;
  reason?: string;
}

export function calculatePeakUsage(entriesForOneTank: TankHistory[]): PeakUsageResult {
  const sorted = sortByTime(entriesForOneTank);
  if (sorted.length < MIN_POINTS_FOR_PEAK) {
    return { sufficient: false, peakHour: null, peakHourLabel: null, peakDay: null, minHour: null, avgHourlyConsumption: null, reason: `Need at least ${MIN_POINTS_FOR_PEAK} readings to identify peak usage.` };
  }

  // Consumption per hour-of-day, aggregated across all days present.
  const byHourConsumption = new Map<number, number>();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const delta = prev.currentWater - cur.currentWater;
    if (delta > 0) {
      const hour = new Date(cur.timestamp).getHours();
      byHourConsumption.set(hour, (byHourConsumption.get(hour) ?? 0) + delta);
    }
  }
  if (byHourConsumption.size === 0) {
    return { sufficient: false, peakHour: null, peakHourLabel: null, peakDay: null, minHour: null, avgHourlyConsumption: null, reason: 'No consumption (only refills or flat readings) observed yet.' };
  }

  let peakHour = 0, peakVal = -Infinity, minHour = 0, minVal = Infinity;
  byHourConsumption.forEach((v, h) => {
    if (v > peakVal) { peakVal = v; peakHour = h; }
    if (v < minVal) { minVal = v; minHour = h; }
  });

  const byDay = groupByDayOfWeek(sorted);
  const dayConsumption = new Map<number, number>();
  byDay.forEach((entries, day) => {
    const c = calculateConsumption(entries);
    dayConsumption.set(day, c.totalLiters);
  });
  let peakDayIdx = 0, peakDayVal = -Infinity;
  dayConsumption.forEach((v, d) => { if (v > peakDayVal) { peakDayVal = v; peakDayIdx = d; } });

  const avg = mean(Array.from(byHourConsumption.values()));

  return {
    sufficient: true,
    peakHour,
    peakHourLabel: `${peakHour}:00–${(peakHour + 1) % 24}:00`,
    peakDay: DAY_NAMES[peakDayIdx],
    minHour,
    avgHourlyConsumption: Math.round(avg),
  };
}

// ============================================================
// Trend analysis (increasing / decreasing / stable)
// ============================================================
export interface TrendResult {
  sufficient: boolean;
  direction: 'increasing' | 'decreasing' | 'stable' | null;
  changePercent: number | null;
  reason?: string;
}

/** Compares the mean of the first half of the series to the second half. */
export function calculateTrend(values: number[]): TrendResult {
  if (values.length < MIN_POINTS_FOR_TREND) {
    return { sufficient: false, direction: null, changePercent: null, reason: `Need at least ${MIN_POINTS_FOR_TREND} data points for a trend.` };
  }
  const mid = Math.floor(values.length / 2);
  const firstHalf = mean(values.slice(0, mid));
  const secondHalf = mean(values.slice(mid));
  if (firstHalf === 0) {
    return { sufficient: false, direction: null, changePercent: null, reason: 'Baseline value is zero — cannot compute a percentage change.' };
  }
  const changePercent = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
  const direction = Math.abs(changePercent) < 5 ? 'stable' : changePercent > 0 ? 'increasing' : 'decreasing';
  return { sufficient: true, direction, changePercent };
}

// ============================================================
// Statistical anomaly detection (z-score + IQR — explainable, not ML)
// ============================================================
export interface AnomalyResult {
  index: number;
  value: number;
  baseline: number;
  method: 'z-score' | 'iqr';
  zScore?: number;
  evidence: string;
}

/** Flags points that are statistical outliers vs. the rest of the series. Returns [] (not an error) when there isn't enough data or nothing is anomalous. */
export function detectStatisticalAnomalies(values: number[], zThreshold = 2.5): AnomalyResult[] {
  if (values.length < MIN_POINTS_FOR_ANOMALY) return [];
  const m = mean(values);
  const sd = stddev(values);
  const { q1, q3, iqr } = quartiles(values);
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const anomalies: AnomalyResult[] = [];
  values.forEach((v, i) => {
    if (sd > 0) {
      const z = (v - m) / sd;
      if (Math.abs(z) >= zThreshold) {
        anomalies.push({
          index: i, value: v, baseline: Math.round(m), method: 'z-score', zScore: Math.round(z * 100) / 100,
          evidence: `Value ${v} is ${Math.abs(Math.round(z * 10) / 10)} standard deviations from the recent average of ${Math.round(m)}.`,
        });
        return;
      }
    }
    if (iqr > 0 && (v < lowerFence || v > upperFence)) {
      anomalies.push({
        index: i, value: v, baseline: Math.round(median(values)), method: 'iqr',
        evidence: `Value ${v} falls outside the normal range (${Math.round(lowerFence)}–${Math.round(upperFence)}) seen in recent readings.`,
      });
    }
  });
  return anomalies;
}

// ============================================================
// Forecasting (exponential smoothing — simple, explainable)
// ============================================================
export interface ForecastResult {
  sufficient: boolean;
  nextPeriodEstimate: number | null;
  hoursToLowLevel: number | null;
  reason?: string;
}

/** Simple exponential smoothing for the next-period value, plus a time-to-low-level estimate when capacity/current level are known. alpha weights recent readings more heavily than old ones. */
export function forecastConsumption(recentValues: number[], currentLevel?: number, dropRatePerHour?: number, lowThreshold = 20): ForecastResult {
  if (recentValues.length < MIN_POINTS_FOR_FORECAST) {
    return { sufficient: false, nextPeriodEstimate: null, hoursToLowLevel: null, reason: `Need at least ${MIN_POINTS_FOR_FORECAST} data points for a forecast.` };
  }
  const alpha = 0.3;
  let smoothed = recentValues[0];
  for (let i = 1; i < recentValues.length; i++) {
    smoothed = alpha * recentValues[i] + (1 - alpha) * smoothed;
  }

  let hoursToLowLevel: number | null = null;
  if (currentLevel !== undefined && dropRatePerHour !== undefined && dropRatePerHour > 0 && currentLevel > lowThreshold) {
    hoursToLowLevel = Math.round(((currentLevel - lowThreshold) / dropRatePerHour) * 10) / 10;
  }

  return { sufficient: true, nextPeriodEstimate: Math.round(smoothed), hoursToLowLevel };
}

// ============================================================
// Water quality (pH / temperature) analytics
// ============================================================
export interface QualityStats {
  sufficient: boolean;
  current: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
  trend: TrendResult;
  reason?: string;
}

export function calculateQualityStats(entriesForOneTank: TankHistory[], field: 'ph' | 'temperature'): QualityStats {
  const sorted = sortByTime(entriesForOneTank);
  const values = sorted
    .map((e) => field === 'ph' ? e.ph : e.temperature)
    .filter((v): v is number => v !== null && v !== undefined);

  if (values.length === 0) {
    return { sufficient: false, current: null, average: null, min: null, max: null, trend: { sufficient: false, direction: null, changePercent: null }, reason: `${field === 'ph' ? 'pH' : 'Temperature'} data unavailable.` };
  }

  return {
    sufficient: true,
    current: values[values.length - 1],
    average: Math.round(mean(values) * 10) / 10,
    min: Math.min(...values),
    max: Math.max(...values),
    trend: calculateTrend(values),
  };
}

// ============================================================
// Pump analytics
// ============================================================
export interface PumpAnalyticsResult {
  sufficient: boolean;
  activationCount: number;
  totalRuntimeMinutes: number;
  averageRuntimeMinutes: number | null;
  longestRuntimeMinutes: number | null;
  abnormalRuns: number;
  reason?: string;
}

const ABNORMAL_RUNTIME_MINUTES = 60;

export function calculatePumpAnalytics(logsForOneTank: PumpLog[]): PumpAnalyticsResult {
  const sorted = [...logsForOneTank].sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length === 0) {
    return { sufficient: false, activationCount: 0, totalRuntimeMinutes: 0, averageRuntimeMinutes: null, longestRuntimeMinutes: null, abnormalRuns: 0, reason: 'No pump activity recorded yet.' };
  }

  const runtimes: number[] = [];
  let activations = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].pumpStatus === 'ON') {
      activations += 1;
      const next = sorted[i + 1];
      if (next && next.pumpStatus === 'OFF') {
        runtimes.push((next.timestamp - sorted[i].timestamp) / 60_000);
      }
    }
  }

  const abnormalRuns = runtimes.filter((r) => r > ABNORMAL_RUNTIME_MINUTES).length;

  return {
    sufficient: true,
    activationCount: activations,
    totalRuntimeMinutes: Math.round(runtimes.reduce((a, b) => a + b, 0)),
    averageRuntimeMinutes: runtimes.length ? Math.round(mean(runtimes)) : null,
    longestRuntimeMinutes: runtimes.length ? Math.round(Math.max(...runtimes)) : null,
    abnormalRuns,
  };
}

// ============================================================
// Multi-tank isolation helper — groups history strictly by tankId,
// never by name alone, so two tanks that happen to share a display
// name can never have their histories mixed.
// ============================================================
export function groupHistoryByTankId(history: TankHistory[]): Map<string, TankHistory[]> {
  const map = new Map<string, TankHistory[]>();
  history.forEach((h) => {
    const arr = map.get(h.tankId) ?? [];
    arr.push(h);
    map.set(h.tankId, arr);
  });
  return map;
}

// ============================================================
// Tank utilization — time spent in each band, refill cadence,
// estimated days remaining at the current depletion rate.
// ============================================================
const LOW_THRESHOLD = 20;
const HIGH_THRESHOLD = 80;
export const MIN_POINTS_FOR_UTILIZATION = 6;

export interface UtilizationResult {
  sufficiency: DataSufficiency;
  averageLevel: number | null;
  medianLevel: number | null;
  minLevel: number | null;
  maxLevel: number | null;
  /** Fraction (0-1) of the OBSERVED time span spent in each band — a rough estimate from discrete readings, not continuous monitoring. */
  timeShareLow: number | null;
  timeShareNormal: number | null;
  timeShareHigh: number | null;
  averageRefillIntervalHours: number | null;
  estimatedDaysRemaining: number | null;
  reason?: string;
}

export function calculateUtilization(entriesForOneTank: TankHistory[]): UtilizationResult {
  const sorted = sortByTime(entriesForOneTank);
  const sufficiency = classifySufficiency(sorted.length, MIN_POINTS_FOR_UTILIZATION, MIN_POINTS_FOR_UTILIZATION * 2);
  if (sufficiency === 'INSUFFICIENT') {
    return {
      sufficiency, averageLevel: null, medianLevel: null, minLevel: null, maxLevel: null,
      timeShareLow: null, timeShareNormal: null, timeShareHigh: null,
      averageRefillIntervalHours: null, estimatedDaysRemaining: null,
      reason: `Need at least ${MIN_POINTS_FOR_UTILIZATION} readings to characterize tank utilization.`,
    };
  }

  const levels = sorted.map((e) => e.waterLevel);

  // Time-weighted band share: each reading "owns" the time until the next reading.
  let lowMs = 0, normalMs = 0, highMs = 0, totalMs = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const dur = sorted[i + 1].timestamp - sorted[i].timestamp;
    if (dur <= 0) continue;
    totalMs += dur;
    if (sorted[i].waterLevel < LOW_THRESHOLD) lowMs += dur;
    else if (sorted[i].waterLevel > HIGH_THRESHOLD) highMs += dur;
    else normalMs += dur;
  }

  // Refill cadence: timestamps where level rose vs. the previous reading.
  const refillTimestamps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].waterLevel > sorted[i - 1].waterLevel + 5) refillTimestamps.push(sorted[i].timestamp);
  }
  let avgRefillIntervalHours: number | null = null;
  if (refillTimestamps.length >= 2) {
    const gaps = refillTimestamps.slice(1).map((t, i) => (t - refillTimestamps[i]) / 3_600_000);
    avgRefillIntervalHours = Math.round(mean(gaps) * 10) / 10;
  }

  // Days remaining: derived from the observed drop rate across the full window (0 or negative rate -> no estimate, never a fabricated number).
  let estimatedDaysRemaining: number | null = null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanHours = (last.timestamp - first.timestamp) / 3_600_000;
  if (spanHours > 0) {
    const netDrop = first.waterLevel - last.waterLevel;
    if (netDrop > 0) {
      const ratePerHour = netDrop / spanHours;
      estimatedDaysRemaining = Math.round((last.waterLevel / ratePerHour / 24) * 10) / 10;
    }
  }

  return {
    sufficiency,
    averageLevel: Math.round(mean(levels) * 10) / 10,
    medianLevel: Math.round(median(levels) * 10) / 10,
    minLevel: Math.min(...levels),
    maxLevel: Math.max(...levels),
    timeShareLow: totalMs > 0 ? Math.round((lowMs / totalMs) * 100) / 100 : null,
    timeShareNormal: totalMs > 0 ? Math.round((normalMs / totalMs) * 100) / 100 : null,
    timeShareHigh: totalMs > 0 ? Math.round((highMs / totalMs) * 100) / 100 : null,
    averageRefillIntervalHours: avgRefillIntervalHours,
    estimatedDaysRemaining,
  };
}

// ============================================================
// Refill pattern analysis — classifies each detected refill by size
// relative to the tank's own historical refill sizes.
// ============================================================
export interface RefillEvent {
  timestamp: number;
  previousLevel: number;
  newLevel: number;
  estimatedLiters: number;
  classification: 'partial' | 'normal' | 'large';
}

export interface RefillPatternResult {
  sufficiency: DataSufficiency;
  events: RefillEvent[];
  averageIntervalHours: number | null;
  averageAmountLiters: number | null;
  reason?: string;
}

/** Classifies refills relative to THIS tank's own median refill size — "large" is tank-relative, never an arbitrary global constant. */
export function analyzeRefillPattern(entriesForOneTank: TankHistory[]): RefillPatternResult {
  const sorted = sortByTime(entriesForOneTank);
  const events: RefillEvent[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const litersDelta = cur.currentWater - prev.currentWater;
    if (litersDelta > 0) {
      events.push({
        timestamp: cur.timestamp, previousLevel: prev.waterLevel, newLevel: cur.waterLevel,
        estimatedLiters: Math.round(litersDelta), classification: 'normal', // reclassified below once we know the median
      });
    }
  }

  if (events.length < 2) {
    return {
      sufficiency: events.length === 0 ? 'INSUFFICIENT' : 'LIMITED',
      events, averageIntervalHours: null, averageAmountLiters: null,
      reason: events.length === 0 ? 'No refill events observed yet.' : 'Only one refill observed — not enough to characterize a pattern.',
    };
  }

  const amounts = events.map((e) => e.estimatedLiters);
  const med = median(amounts);
  events.forEach((e) => {
    if (e.estimatedLiters < med * 0.5) e.classification = 'partial';
    else if (e.estimatedLiters > med * 1.5) e.classification = 'large';
    else e.classification = 'normal';
  });

  const intervals = events.slice(1).map((e, i) => (e.timestamp - events[i].timestamp) / 3_600_000);

  return {
    sufficiency: classifySufficiency(events.length, 2, 5),
    events,
    averageIntervalHours: Math.round(mean(intervals) * 10) / 10,
    averageAmountLiters: Math.round(mean(amounts)),
  };
}

// ============================================================
// Change-point detection — compares a recent window against the
// longer-term historical baseline for a metric (e.g. consumption rate).
// ============================================================
export interface ChangePointResult {
  sufficiency: DataSufficiency;
  historicalAverage: number | null;
  recentAverage: number | null;
  changePercent: number | null;
  meaningful: boolean;
  reason?: string;
}

const CHANGE_POINT_MIN_PERCENT = 25; // below this, a shift isn't reported as "meaningful" — avoids overreacting to normal noise

/** Splits a series into an early "historical" segment and a late "recent" segment (recentFraction of the series) and compares their means. */
export function detectChangePoint(values: number[], recentFraction = 0.25): ChangePointResult {
  const minPoints = 8;
  if (values.length < minPoints) {
    return { sufficiency: 'INSUFFICIENT', historicalAverage: null, recentAverage: null, changePercent: null, meaningful: false, reason: `Need at least ${minPoints} data points to detect a behavior shift.` };
  }
  const recentCount = Math.max(2, Math.round(values.length * recentFraction));
  const recent = values.slice(-recentCount);
  const historical = values.slice(0, values.length - recentCount);
  if (historical.length < 2) {
    return { sufficiency: 'LIMITED', historicalAverage: null, recentAverage: mean(recent), changePercent: null, meaningful: false, reason: 'Not enough historical baseline to compare against.' };
  }
  const histAvg = mean(historical);
  const recentAvg = mean(recent);
  if (histAvg === 0) {
    return { sufficiency: 'LIMITED', historicalAverage: 0, recentAverage: recentAvg, changePercent: null, meaningful: false, reason: 'Historical baseline is zero — cannot compute a percentage change.' };
  }
  const changePercent = Math.round(((recentAvg - histAvg) / histAvg) * 100);
  return {
    sufficiency: classifySufficiency(values.length, minPoints, minPoints * 2),
    historicalAverage: Math.round(histAvg * 10) / 10,
    recentAverage: Math.round(recentAvg * 10) / 10,
    changePercent,
    meaningful: Math.abs(changePercent) >= CHANGE_POINT_MIN_PERCENT,
  };
}

export interface TankAnalytics {
  tankId: string;
  tankName: string;
  consumption: ConsumptionResult;
  peakUsage: PeakUsageResult;
  levelTrend: TrendResult;
  anomalies: AnomalyResult[];
  forecast: ForecastResult;
  ph: QualityStats;
  temperature: QualityStats;
  pump: PumpAnalyticsResult;
  utilization: UtilizationResult;
  refillPattern: RefillPatternResult;
  consumptionChangePoint: ChangePointResult;
}

/** Top-level entry point: full analytics for every tank, strictly isolated by tankId. */
export function analyzeAllTanks(tanks: Tank[], history: TankHistory[], pumpLogs: PumpLog[]): TankAnalytics[] {
  const byTank = groupHistoryByTankId(history);
  const pumpByTank = new Map<string, PumpLog[]>();
  pumpLogs.forEach((p) => {
    const arr = pumpByTank.get(p.tankId) ?? [];
    arr.push(p);
    pumpByTank.set(p.tankId, arr);
  });

  return tanks.map((tank) => {
    const entries = byTank.get(tank.id) ?? [];
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    const levels = sorted.map((e) => e.waterLevel);
    const dropRatePerHour = (() => {
      if (sorted.length < 2) return undefined;
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const hours = (last.timestamp - first.timestamp) / 3_600_000;
      if (hours <= 0) return undefined;
      const drop = first.waterLevel - last.waterLevel;
      return drop > 0 ? drop / hours : undefined;
    })();

    return {
      tankId: tank.id,
      tankName: tank.name,
      consumption: calculateConsumption(entries),
      peakUsage: calculatePeakUsage(entries),
      levelTrend: calculateTrend(levels),
      anomalies: detectStatisticalAnomalies(levels),
      forecast: forecastConsumption(levels.slice(-10), tank.waterLevel, dropRatePerHour),
      ph: calculateQualityStats(entries, 'ph'),
      temperature: calculateQualityStats(entries, 'temperature'),
      pump: calculatePumpAnalytics(pumpByTank.get(tank.id) ?? []),
      utilization: calculateUtilization(entries),
      refillPattern: analyzeRefillPattern(entries),
      consumptionChangePoint: detectChangePoint(levels),
    };
  });
}
