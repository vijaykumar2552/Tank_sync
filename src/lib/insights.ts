import type { Tank, TankHistory } from '../types';

export type Priority = 'info' | 'recommendation' | 'attention' | 'warning' | 'critical';

export type InsightIconKey =
  | 'leak' | 'dry-run' | 'sensor-offline' | 'sensor-poor' | 'water-critical'
  | 'water-low' | 'near-overflow' | 'overflow' | 'battery' | 'temperature'
  | 'anomaly-drift' | 'anomaly-overnight' | 'sensor-inconsistent' | 'prediction'
  | 'healthy';

export interface Insight {
  id: string;
  priority: Priority;
  iconKey: InsightIconKey;
  title: string;
  what: string;
  why: string;
  action: string;
  tankName?: string;
}

export interface InsightsSummary {
  efficiency: number;
  weeklyUsage: number | null;
  usageChange: number | null;
  anomalyCount: number;
  tankCount: number;
}

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0, warning: 1, attention: 2, recommendation: 3, info: 4,
};

export function groupHistoryByTank(history: TankHistory[]): Map<string, TankHistory[]> {
  const map = new Map<string, TankHistory[]>();
  history.forEach((h) => {
    const arr = map.get(h.tankId) ?? [];
    arr.push(h);
    map.set(h.tankId, arr);
  });
  return map;
}

export function detectAnomalies(entries: TankHistory[], tankName: string): Insight[] {
  const result: Insight[] = [];
  if (entries.length < 10) return result;

  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const recent = sorted.slice(-24);
  const older = sorted.slice(0, -24);

  if (older.length >= 10) {
    const recentAvg = recent.reduce((s, e) => s + e.waterLevel, 0) / recent.length;
    const olderAvg = older.reduce((s, e) => s + e.waterLevel, 0) / older.length;
    const variance = Math.abs(recentAvg - olderAvg);

    if (variance > 20) {
      result.push({
        id: `${tankName}-anomaly-drift`, priority: 'attention', iconKey: 'anomaly-drift',
        title: 'Unusual Consumption Pattern',
        what: `Water level on ${tankName} shifted by ${Math.round(variance)}% compared to its normal pattern.`,
        why: 'A significant shift in consumption may indicate a leak, a change in usage habits, or a sensor calibration issue.',
        action: 'Check taps, pipes, and connected devices for possible leakage. Verify sensor readings are consistent.',
        tankName,
      });
    }
  }

  const overnightEntries = recent.filter((e) => {
    const hour = new Date(e.timestamp).getHours();
    return hour >= 0 && hour < 6;
  });
  if (overnightEntries.length >= 3) {
    const overnightDraw = overnightEntries.reduce((sum, e, i) => {
      if (i === 0) return 0;
      const prev = overnightEntries[i - 1];
      const draw = prev.waterLevel - e.waterLevel;
      return sum + (draw > 0 ? draw : 0);
    }, 0);
    if (overnightDraw > 15) {
      result.push({
        id: `${tankName}-anomaly-overnight`, priority: 'warning', iconKey: 'anomaly-overnight',
        title: 'Possible Unusual Overnight Consumption',
        what: `Water usage on ${tankName} remained unusually high during overnight hours (${Math.round(overnightDraw)}% drop).`,
        why: 'Overnight usage is normally very low. This may indicate a leak or a device left running.',
        action: 'Check taps, pipes, and connected devices for possible leakage. Verify no appliances are running unintentionally.',
        tankName,
      });
    }
  }

  const readings = recent.map((e) => e.waterLevel);
  const inconsistencies = readings.filter((v, i) => i > 0 && Math.abs(v - readings[i - 1]) > 30);
  if (inconsistencies.length >= 2) {
    result.push({
      id: `${tankName}-sensor-inconsistent`, priority: 'attention', iconKey: 'sensor-inconsistent',
      title: 'Sensor Readings Inconsistent',
      what: `Sensor readings on ${tankName} have shown sudden jumps of over 30% in the last 24 hours.`,
      why: 'Large, sudden changes in readings often indicate sensor calibration issues or interference rather than actual water level changes.',
      action: 'Inspect the sensor for physical damage or debris. Consider recalibrating or replacing the sensor.',
      tankName,
    });
  }

  return result;
}

export function predictEmptyTime(entries: TankHistory[], tank?: Tank): Insight | null {
  if (!tank || entries.length < 10) return null;

  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const recent = sorted.slice(-20);
  if (recent.length < 5) return null;

  const totalDrop = recent[0].waterLevel - recent[recent.length - 1].waterLevel;
  if (totalDrop <= 0) return null;

  const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
  if (timeSpan <= 0) return null;

  const dropPerMs = totalDrop / timeSpan;
  if (dropPerMs <= 0) return null;

  const currentLevel = tank.waterLevel;
  const lowThreshold = 20;
  const msToLow = (currentLevel - lowThreshold) / dropPerMs;
  const hoursToLow = msToLow / 3600_000;

  if (hoursToLow > 0 && hoursToLow < 72) {
    const timeDesc = hoursToLow < 1 ? `${Math.round(hoursToLow * 60)} minutes` : `${Math.round(hoursToLow)} hours`;
    return {
      id: `${tank.id}-prediction`, priority: 'info', iconKey: 'prediction',
      title: 'Predicted Time to Low Level',
      what: `Based on the last ${recent.length} readings, ${tank.name} may reach the low-level threshold in approximately ${timeDesc}.`,
      why: 'This prediction uses recent consumption rate and assumes usage patterns continue at the same pace.',
      action: 'Plan refilling ahead of time to avoid running out of water.',
      tankName: tank.name,
    };
  }

  return null;
}

export function calculateEfficiency(tanks: Tank[], history: TankHistory[]): number {
  if (tanks.length === 0) return 0;
  let score = 100;
  tanks.forEach((t) => {
    if (t.leak || t.dryRun) score -= 20;
    if (t.overflow) score -= 10;
    if (t.waterLevel <= 10) score -= 10;
    if (t.sensorHealth === 'Offline') score -= 10;
    if (t.sensorHealth === 'Poor') score -= 5;
    if (t.battery < 20) score -= 5;
  });
  if (history.length > 100) score += 5;
  return Math.max(0, Math.min(100, score));
}

export function calculateWeeklyUsage(history: TankHistory[]): number | null {
  const weekAgo = Date.now() - 7 * 24 * 3600_000;
  const weekEntries = history.filter((h) => h.timestamp >= weekAgo);
  if (weekEntries.length < 2) return null;
  let total = 0;
  weekEntries.forEach((h, i) => {
    if (i === 0) return;
    const prev = weekEntries[i - 1];
    const draw = prev.waterLevel - h.waterLevel;
    if (draw > 0) total += draw * (h.capacity / 100);
  });
  return Math.round(total);
}

export function calculatePrevWeeklyUsage(history: TankHistory[]): number | null {
  const now = Date.now();
  const twoWeeksAgo = now - 14 * 24 * 3600_000;
  const weekAgo = now - 7 * 24 * 3600_000;
  const entries = history.filter((h) => h.timestamp >= twoWeeksAgo && h.timestamp < weekAgo);
  if (entries.length < 2) return null;
  let total = 0;
  entries.forEach((h, i) => {
    if (i === 0) return;
    const prev = entries[i - 1];
    const draw = prev.waterLevel - h.waterLevel;
    if (draw > 0) total += draw * (h.capacity / 100);
  });
  return Math.round(total);
}

export function generateInsights(tanks: Tank[], history: TankHistory[]): { insights: Insight[]; summary: InsightsSummary } {
  const result: Insight[] = [];

  tanks.forEach((tank) => {
    if (tank.leak) {
      result.push({
        id: `${tank.id}-leak`, priority: 'critical', iconKey: 'leak',
        title: 'Possible Leak Detected',
        what: `Leak flag is active on ${tank.name}.`,
        why: 'Active leaks can cause significant water loss and property damage if left unaddressed.',
        action: 'Inspect pipes, fittings, and the tank structure immediately. Turn off the pump if necessary.',
        tankName: tank.name,
      });
    }
    if (tank.dryRun) {
      result.push({
        id: `${tank.id}-dryrun`, priority: 'critical', iconKey: 'dry-run',
        title: 'Dry Run Warning',
        what: `Pump on ${tank.name} is running without sufficient water.`,
        why: 'Dry running can permanently damage the pump motor within minutes.',
        action: 'Stop the pump immediately from Pump Controls and inspect the water source.',
        tankName: tank.name,
      });
    }
    if (tank.sensorHealth === 'Offline') {
      result.push({
        id: `${tank.id}-sensor-offline`, priority: 'warning', iconKey: 'sensor-offline',
        title: 'Sensor Offline',
        what: `Sensor for ${tank.name} is reporting as offline.`,
        why: 'Without sensor data, tank levels cannot be monitored. This may indicate a hardware failure or connectivity issue.',
        action: 'Check the ESP32 device, verify WiFi connectivity, and inspect sensor wiring.',
        tankName: tank.name,
      });
    }
    if (tank.sensorHealth === 'Poor') {
      result.push({
        id: `${tank.id}-sensor-poor`, priority: 'attention', iconKey: 'sensor-poor',
        title: 'Sensor Health Degrading',
        what: `Sensor for ${tank.name} is in poor health.`,
        why: 'Degrading sensors may provide inaccurate readings, leading to incorrect decisions.',
        action: 'Schedule sensor maintenance or replacement before it fails completely.',
        tankName: tank.name,
      });
    }
    if (tank.waterLevel <= 10) {
      result.push({
        id: `${tank.id}-critical-low`, priority: 'critical', iconKey: 'water-critical',
        title: 'Critical Water Level',
        what: `${tank.name} is at ${tank.waterLevel}% — critically low.`,
        why: 'The tank may run empty soon, disrupting water supply.',
        action: 'Refill the tank immediately or activate the pump to draw from an alternative source.',
        tankName: tank.name,
      });
    } else if (tank.waterLevel <= 20) {
      result.push({
        id: `${tank.id}-low`, priority: 'warning', iconKey: 'water-low',
        title: 'Low Water Level',
        what: `${tank.name} is at ${tank.waterLevel}%.`,
        why: 'Water level is approaching the critical threshold.',
        action: 'Consider refilling soon or monitoring consumption more closely.',
        tankName: tank.name,
      });
    }
    if (tank.waterLevel >= 90 && !tank.overflow) {
      result.push({
        id: `${tank.id}-near-overflow`, priority: 'attention', iconKey: 'near-overflow',
        title: 'Near Overflow',
        what: `${tank.name} is at ${tank.waterLevel}%.`,
        why: 'The tank is close to overflow capacity. Continuing to fill may cause water spillage.',
        action: 'Stop the pump if running, or reduce inflow to prevent overflow.',
        tankName: tank.name,
      });
    }
    if (tank.overflow) {
      result.push({
        id: `${tank.id}-overflow`, priority: 'warning', iconKey: 'overflow',
        title: 'Overflow Detected',
        what: `${tank.name} is currently overflowing.`,
        why: 'Overflow wastes water and may cause structural or property damage.',
        action: 'Stop the pump immediately and verify the overflow sensor is functioning.',
        tankName: tank.name,
      });
    }
    if (tank.battery < 20) {
      result.push({
        id: `${tank.id}-battery`, priority: 'attention', iconKey: 'battery',
        title: 'Low Battery',
        what: `Battery on ${tank.name} is at ${tank.battery}%.`,
        why: 'Low battery may cause the sensor to go offline, resulting in missing data.',
        action: 'Replace or recharge the battery within the next few days.',
        tankName: tank.name,
      });
    }
    if (tank.temperature > 40) {
      result.push({
        id: `${tank.id}-temp`, priority: 'attention', iconKey: 'temperature',
        title: 'High Temperature',
        what: `Temperature at ${tank.name} is ${tank.temperature}°C.`,
        why: 'High temperatures can affect sensor accuracy and accelerate battery drain.',
        action: 'Ensure the sensor enclosure is shaded and ventilated.',
        tankName: tank.name,
      });
    }
  });

  const tankHistoryMap = groupHistoryByTank(history);
  tankHistoryMap.forEach((entries, tankId) => {
    const matchingTank = tanks.find((t) => t.id === tankId);
    const tankName = matchingTank?.name ?? entries[0]?.name ?? 'Unknown tank';
    const anomalies = detectAnomalies(entries, tankName);
    result.push(...anomalies);
    const prediction = predictEmptyTime(entries, matchingTank);
    if (prediction) result.push(prediction);
  });

  if (tanks.length > 0) {
    const avgLevel = Math.round(tanks.reduce((s, t) => s + t.waterLevel, 0) / tanks.length);
    if (avgLevel >= 60) {
      result.push({
        id: 'overall-healthy', priority: 'info', iconKey: 'healthy',
        title: 'All Systems Healthy',
        what: `Average water level across all tanks is ${avgLevel}%.`,
        why: 'Tank levels are within a healthy range with no immediate concerns.',
        action: 'No action needed. Continue monitoring as usual.',
      });
    }
  }

  result.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const efficiency = calculateEfficiency(tanks, history);
  const weeklyUsage = calculateWeeklyUsage(history);
  const prevWeeklyUsage = calculatePrevWeeklyUsage(history);
  const usageChange = weeklyUsage !== null && prevWeeklyUsage !== null && prevWeeklyUsage > 0
    ? Math.round(((weeklyUsage - prevWeeklyUsage) / prevWeeklyUsage) * 100)
    : null;
  const anomalyCount = result.filter((r) => r.priority === 'critical' || r.priority === 'warning').length;

  return {
    insights: result,
    summary: { efficiency, weeklyUsage, usageChange, anomalyCount, tankCount: tanks.length },
  };
}
