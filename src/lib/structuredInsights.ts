/**
 * STRUCTURED INSIGHTS
 * ===================
 * Converts the analytics engine's raw statistical output into the
 * structured insight objects the AI Insights UI renders. This is the
 * "deterministic calculation -> structured metric -> insight" stage of the
 * pipeline — there is no LLM here. See AIProvider below for where a real
 * language model would plug in, if one is ever added.
 */
import type { Tank, TankHistory, PumpLog } from '../types';
import { analyzeAllTanks, type TankAnalytics } from './analyticsEngine';

export type InsightSeverity = 'info' | 'low' | 'moderate' | 'high' | 'critical';
export type InsightCategory = 'summary' | 'consumption' | 'anomaly' | 'quality' | 'pump' | 'forecast' | 'recommendation';

export interface StructuredInsight {
  id: string;
  type: InsightCategory;
  title: string;
  summary: string;
  metric: string;
  value: number | string | null;
  baseline: number | string | null;
  changePercent: number | null;
  severity: InsightSeverity;
  /** How much of this insight rests on real, sufficient data vs. a partial/borderline sample. Not a probability — a plain-language confidence tier. */
  confidence: 'high' | 'medium' | 'low';
  timestamp: number;
  evidence: string;
  recommendation: string | null;
  tankName: string;
}

/**
 * Optional AI explanation layer. No LLM provider is currently configured —
 * this returns the deterministic summary/evidence unchanged. If a real
 * provider is added later, implement this interface and pass real
 * insights through it for a natural-language rewrite; NEVER let it
 * invent numbers that didn't come from the analytics engine above, and
 * keep any API key server-side (never in frontend code).
 */
export interface AIProvider {
  explain(insight: StructuredInsight): Promise<string>;
}

export const NO_AI_PROVIDER: AIProvider = {
  async explain(insight) {
    return insight.summary; // pass-through — no LLM configured
  },
};

function makeId(tankId: string, category: string): string {
  return `${tankId}-${category}-${Date.now()}`;
}

/** Builds the full structured insight set for one tank's analytics. Always returns at least a "data unavailable" entry per category rather than skipping it silently, so the UI can show why a section is empty. */
function insightsForTank(tank: Tank, a: TankAnalytics): StructuredInsight[] {
  const out: StructuredInsight[] = [];
  const now = Date.now();

  // --- Consumption ---
  if (a.consumption.sufficient) {
    out.push({
      id: makeId(tank.id, 'consumption'), type: 'consumption', tankName: tank.name,
      title: 'Water Consumption', summary: `${tank.name} used approximately ${a.consumption.totalLiters} L over the observed period.`,
      metric: 'consumption_liters', value: a.consumption.totalLiters, baseline: null, changePercent: null,
      severity: 'info', confidence: a.consumption.refillEvents > 0 ? 'medium' : 'high', timestamp: now,
      evidence: `Calculated from ${a.consumption.refillEvents} refill event(s) excluded and consecutive measured-volume drops.`,
      recommendation: null,
    });
  } else {
    out.push(insufficientInsight(tank, 'consumption', 'Water Consumption', a.consumption.reason));
  }

  // --- Peak usage ---
  if (a.peakUsage.sufficient) {
    out.push({
      id: makeId(tank.id, 'peak'), type: 'consumption', tankName: tank.name,
      title: 'Peak Usage Period', summary: `${tank.name}'s highest usage is typically around ${a.peakUsage.peakHourLabel}, and ${a.peakUsage.peakDay} sees the most consumption overall.`,
      metric: 'peak_hour', value: a.peakUsage.peakHourLabel, baseline: `avg ${a.peakUsage.avgHourlyConsumption} L/hr`, changePercent: null,
      severity: 'info', confidence: 'medium', timestamp: now,
      evidence: `Based on hourly consumption aggregated across all recorded days for this tank.`,
      recommendation: null,
    });
  } else {
    out.push(insufficientInsight(tank, 'consumption', 'Peak Usage Period', a.peakUsage.reason));
  }

  // --- Level trend ---
  if (a.levelTrend.sufficient) {
    const severity: InsightSeverity = a.levelTrend.direction === 'decreasing' && (a.levelTrend.changePercent ?? 0) < -30 ? 'high' : 'info';
    out.push({
      id: makeId(tank.id, 'trend'), type: 'consumption', tankName: tank.name,
      title: 'Water Level Trend', summary: `${tank.name}'s water level is ${a.levelTrend.direction} (${a.levelTrend.changePercent}% change across the observed period).`,
      metric: 'level_trend_percent', value: a.levelTrend.changePercent, baseline: null, changePercent: a.levelTrend.changePercent,
      severity, confidence: 'medium', timestamp: now,
      evidence: 'Comparing the average level in the first half vs. the second half of the recorded history.',
      recommendation: severity === 'high' ? 'Consider checking for unusually high demand or a possible leak if this drop is unexpected.' : null,
    });
  } else {
    out.push(insufficientInsight(tank, 'consumption', 'Water Level Trend', a.levelTrend.reason));
  }

  // --- Anomalies ---
  if (a.anomalies.length > 0) {
    a.anomalies.forEach((an) => {
      out.push({
        id: makeId(tank.id, `anomaly-${an.index}`), type: 'anomaly', tankName: tank.name,
        title: 'Unusual Reading Detected', summary: `${tank.name} recorded a water level of ${an.value}%, which is a statistical outlier vs. its recent readings.`,
        metric: 'water_level_percent', value: an.value, baseline: an.baseline, changePercent: null,
        severity: 'moderate', confidence: an.method === 'z-score' ? 'high' : 'medium', timestamp: now,
        evidence: an.evidence, recommendation: 'Possible abnormal water-loss or sensor pattern — worth a manual check.',
      });
    });
  } else {
    out.push({
      id: makeId(tank.id, 'anomaly-none'), type: 'anomaly', tankName: tank.name,
      title: 'No Anomalies Detected', summary: `No statistically unusual readings found for ${tank.name} in the available history.`,
      metric: 'anomaly_count', value: 0, baseline: null, changePercent: null,
      severity: 'info', confidence: 'medium', timestamp: now,
      evidence: 'Z-score and IQR checks found nothing outside the normal range (or there is not yet enough history to check).',
      recommendation: null,
    });
  }

  // --- Water quality: pH ---
  if (a.ph.sufficient) {
    out.push({
      id: makeId(tank.id, 'ph'), type: 'quality', tankName: tank.name,
      title: 'pH Level', summary: `Current pH for ${tank.name} is ${a.ph.current} (recent average ${a.ph.average}, range ${a.ph.min}–${a.ph.max}).`,
      metric: 'ph', value: a.ph.current, baseline: a.ph.average, changePercent: a.ph.trend.changePercent,
      severity: 'info', confidence: 'high', timestamp: now,
      evidence: `Computed from ${'sufficient' in a.ph ? 'recorded' : ''} pH readings in history; no health/safety threshold is configured for this deployment.`,
      recommendation: null,
    });
  } else {
    out.push(insufficientInsight(tank, 'quality', 'pH Level', a.ph.reason));
  }

  // --- Water quality: temperature ---
  if (a.temperature.sufficient) {
    out.push({
      id: makeId(tank.id, 'temperature'), type: 'quality', tankName: tank.name,
      title: 'Temperature', summary: `Current temperature for ${tank.name} is ${a.temperature.current}\u00B0C (recent average ${a.temperature.average}\u00B0C).`,
      metric: 'temperature_c', value: a.temperature.current, baseline: a.temperature.average, changePercent: a.temperature.trend.changePercent,
      severity: 'info', confidence: 'high', timestamp: now,
      evidence: `Range observed: ${a.temperature.min}\u00B0C to ${a.temperature.max}\u00B0C.`,
      recommendation: null,
    });
  } else {
    out.push(insufficientInsight(tank, 'quality', 'Temperature', a.temperature.reason));
  }

  // --- Pump intelligence ---
  if (a.pump.sufficient) {
    out.push({
      id: makeId(tank.id, 'pump'), type: 'pump', tankName: tank.name,
      title: 'Pump Activity', summary: `${tank.name}'s pump activated ${a.pump.activationCount} time(s), totaling ${a.pump.totalRuntimeMinutes} minutes of runtime.`,
      metric: 'pump_runtime_minutes', value: a.pump.totalRuntimeMinutes, baseline: a.pump.averageRuntimeMinutes, changePercent: null,
      severity: a.pump.abnormalRuns > 0 ? 'moderate' : 'info', confidence: 'high', timestamp: now,
      evidence: `Longest single run: ${a.pump.longestRuntimeMinutes} minute(s). ${a.pump.abnormalRuns} run(s) exceeded the 60-minute abnormal-runtime threshold.`,
      recommendation: a.pump.abnormalRuns > 0 ? 'Review the flagged long pump run(s) for a possible stuck relay or unexpected demand.' : null,
    });
  } else {
    out.push(insufficientInsight(tank, 'pump', 'Pump Activity', a.pump.reason));
  }

  // --- Forecast ---
  if (a.forecast.sufficient) {
    out.push({
      id: makeId(tank.id, 'forecast'), type: 'forecast', tankName: tank.name,
      title: 'Remaining Water Estimate', summary: a.forecast.hoursToLowLevel
        ? `Estimated ${a.forecast.hoursToLowLevel} hours until ${tank.name} reaches a low level, based on the recent consumption rate.`
        : `Next-period level for ${tank.name} is estimated around ${a.forecast.nextPeriodEstimate}%, based on recent trend.`,
      metric: 'hours_to_low_level', value: a.forecast.hoursToLowLevel ?? a.forecast.nextPeriodEstimate, baseline: null, changePercent: null,
      severity: (a.forecast.hoursToLowLevel ?? 999) < 12 ? 'high' : 'info', confidence: 'low', timestamp: now,
      evidence: 'Estimated using exponential smoothing over the most recent readings — an approximation, not a guarantee.',
      recommendation: (a.forecast.hoursToLowLevel ?? 999) < 12 ? 'Consider scheduling a refill soon.' : null,
    });
  } else {
    out.push(insufficientInsight(tank, 'forecast', 'Remaining Water Estimate', a.forecast.reason));
  }

  // --- Tank utilization (days remaining, time-in-band) ---
  if (a.utilization.sufficiency !== 'INSUFFICIENT') {
    const days = a.utilization.estimatedDaysRemaining;
    out.push({
      id: makeId(tank.id, 'utilization'), type: 'consumption', tankName: tank.name,
      title: 'Tank Utilization', summary: days !== null
        ? `At the observed depletion rate, ${tank.name} has approximately ${days} day(s) of water remaining.`
        : `${tank.name} has averaged ${a.utilization.averageLevel}% over the observed period (range ${a.utilization.minLevel}–${a.utilization.maxLevel}%).`,
      metric: 'days_remaining', value: days, baseline: a.utilization.averageLevel, changePercent: null,
      severity: days !== null && days < 2 ? 'high' : 'info',
      confidence: a.utilization.sufficiency === 'READY' ? 'medium' : 'low', timestamp: now,
      evidence: a.utilization.timeShareLow !== null
        ? `Spent ${Math.round(a.utilization.timeShareLow * 100)}% of the observed time below 20%, ${Math.round((a.utilization.timeShareHigh ?? 0) * 100)}% above 80%.`
        : 'Derived from the observed level history.',
      recommendation: days !== null && days < 2 ? 'Plan a refill soon based on the current depletion rate.' : null,
    });
  } else {
    out.push(insufficientInsight(tank, 'consumption', 'Tank Utilization', a.utilization.reason));
  }

  // --- Refill pattern ---
  if (a.refillPattern.sufficiency !== 'INSUFFICIENT') {
    const largeRefills = a.refillPattern.events.filter((e) => e.classification === 'large');
    out.push({
      id: makeId(tank.id, 'refill-pattern'), type: 'consumption', tankName: tank.name,
      title: 'Refill Pattern', summary: a.refillPattern.averageIntervalHours !== null
        ? `${tank.name} is refilled roughly every ${Math.round(a.refillPattern.averageIntervalHours / 24 * 10) / 10} day(s), averaging ${a.refillPattern.averageAmountLiters} L per refill.`
        : `${a.refillPattern.events.length} refill event(s) observed for ${tank.name} so far — not yet enough to establish a regular interval.`,
      metric: 'avg_refill_liters', value: a.refillPattern.averageAmountLiters, baseline: null, changePercent: null,
      severity: largeRefills.length > 0 ? 'moderate' : 'info',
      confidence: a.refillPattern.sufficiency === 'READY' ? 'medium' : 'low', timestamp: now,
      evidence: `${a.refillPattern.events.length} refill(s) recorded; ${largeRefills.length} classified as unusually large relative to this tank's own typical refill size.`,
      recommendation: largeRefills.length > 0 ? 'Review the unusually large refill(s) — could indicate a bigger-than-normal draw before refilling, or a top-up from a different source.' : null,
    });
  } else {
    out.push(insufficientInsight(tank, 'consumption', 'Refill Pattern', a.refillPattern.reason));
  }

  // --- Behavior change-point ---
  if (a.consumptionChangePoint.sufficiency !== 'INSUFFICIENT' && a.consumptionChangePoint.meaningful) {
    out.push({
      id: makeId(tank.id, 'change-point'), type: 'anomaly', tankName: tank.name,
      title: 'Behavior Shift Detected', summary: `${tank.name}'s recent water-level pattern differs from its historical baseline by ${a.consumptionChangePoint.changePercent}%.`,
      metric: 'level_change_percent', value: a.consumptionChangePoint.changePercent,
      baseline: a.consumptionChangePoint.historicalAverage, changePercent: a.consumptionChangePoint.changePercent,
      severity: Math.abs(a.consumptionChangePoint.changePercent ?? 0) > 50 ? 'high' : 'moderate',
      confidence: a.consumptionChangePoint.sufficiency === 'READY' ? 'medium' : 'low', timestamp: now,
      evidence: `Historical average level ${a.consumptionChangePoint.historicalAverage}% vs. recent average ${a.consumptionChangePoint.recentAverage}%.`,
      recommendation: 'Worth checking whether this reflects a real usage change, a leak, or a sensor issue.',
    });
  }

  return out;
}

function insufficientInsight(tank: Tank, type: InsightCategory, title: string, reason?: string): StructuredInsight {
  return {
    id: makeId(tank.id, `${type}-insufficient-${title}`), type, tankName: tank.name,
    title, summary: reason || 'Not enough historical data for a reliable result yet.',
    metric: '', value: null, baseline: null, changePercent: null,
    severity: 'info', confidence: 'low', timestamp: Date.now(),
    evidence: 'Insufficient data — no calculation was attempted rather than guessing.',
    recommendation: null,
  };
}

export function generateStructuredInsights(tanks: Tank[], history: TankHistory[], pumpLogs: PumpLog[]): StructuredInsight[] {
  if (tanks.length === 0) return [];
  const analytics = analyzeAllTanks(tanks, history, pumpLogs);
  return tanks.flatMap((tank) => {
    const a = analytics.find((x) => x.tankId === tank.id);
    return a ? insightsForTank(tank, a) : [];
  });
}
