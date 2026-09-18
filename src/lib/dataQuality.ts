/**
 * DATA QUALITY ENGINE
 * ===================
 * Runs BEFORE any pattern/statistical analysis. Classifies each reading
 * rather than silently deleting anything — a reading flagged SUSPECT or
 * INVALID is still visible for diagnostics, just excluded from specific
 * calculations with a stated reason.
 */
import type { TankHistory } from '../types';

export type ReadingQuality = 'VALID' | 'INVALID' | 'SUSPECT' | 'MISSING';

export interface QualityFlag {
  entryId: string;
  timestamp: number;
  quality: ReadingQuality;
  reasons: string[];
}

export interface DataQualityReport {
  total: number;
  valid: number;
  invalid: number;
  suspect: number;
  missing: number;
  flags: QualityFlag[];
  /** Only VALID + SUSPECT entries are safe to feed into most analytics (SUSPECT with the caller's own judgment); INVALID/MISSING are excluded. */
  usableEntries: TankHistory[];
  duplicateTimestamps: number;
  timestampGaps: { fromTimestamp: number; toTimestamp: number; gapHours: number }[];
  identicalRunLength: number; // longest run of consecutive identical waterLevel readings (possible stuck sensor)
}

const FUTURE_TOLERANCE_MS = 5 * 60_000;
export const STUCK_SENSOR_RUN_THRESHOLD = 6; // 6+ identical consecutive readings is worth flagging as SUSPECT (surfaced via report.identicalRunLength)
const ABNORMAL_GAP_HOURS = 12; // a gap this large between readings is notable, not necessarily wrong

function classifyEntry(entry: TankHistory, previous: TankHistory | undefined, now: number): QualityFlag {
  const reasons: string[] = [];
  let quality: ReadingQuality = 'VALID';

  if (entry.timestamp <= 0 || Number.isNaN(entry.timestamp)) {
    reasons.push('Missing or unparseable timestamp.');
    quality = 'MISSING';
  } else if (entry.timestamp > now + FUTURE_TOLERANCE_MS) {
    reasons.push('Timestamp is in the future.');
    quality = 'INVALID';
  }

  if (entry.waterLevel < 0 || entry.waterLevel > 100) {
    reasons.push(`waterLevel ${entry.waterLevel} outside 0-100.`);
    quality = 'INVALID';
  }

  if (entry.ph !== null && (entry.ph < 0 || entry.ph > 14)) {
    reasons.push(`ph ${entry.ph} outside 0-14.`);
    quality = quality === 'INVALID' ? quality : 'INVALID';
  }

  if (entry.currentWater < 0) {
    reasons.push('currentWater is negative.');
    quality = 'INVALID';
  }

  if (previous && quality === 'VALID') {
    const dtHours = (entry.timestamp - previous.timestamp) / 3_600_000;
    if (dtHours > 0 && dtHours < 1) {
      const levelJump = Math.abs(entry.waterLevel - previous.waterLevel);
      if (levelJump > 50) {
        reasons.push(`Water level changed ${Math.round(levelJump)}% in under an hour — a sudden jump worth reviewing.`);
        quality = 'SUSPECT';
      }
    }
    if (entry.timestamp === previous.timestamp) {
      reasons.push('Duplicate timestamp with the previous reading.');
      quality = 'SUSPECT';
    }
  }

  return { entryId: entry.id, timestamp: entry.timestamp, quality, reasons };
}

/** Analyzes ONE tank's history (already isolated by tankId by the caller). */
export function assessDataQuality(entriesForOneTank: TankHistory[]): DataQualityReport {
  const sorted = [...entriesForOneTank].sort((a, b) => a.timestamp - b.timestamp);
  const now = Date.now();
  const flags: QualityFlag[] = [];
  const usableEntries: TankHistory[] = [];

  let duplicateTimestamps = 0;
  const timestampGaps: DataQualityReport['timestampGaps'] = [];
  let longestIdenticalRun = 0;
  let currentIdenticalRun = 1;

  sorted.forEach((entry, i) => {
    const previous = i > 0 ? sorted[i - 1] : undefined;
    const flag = classifyEntry(entry, previous, now);
    flags.push(flag);

    if (flag.quality === 'VALID' || flag.quality === 'SUSPECT') {
      usableEntries.push(entry);
    }

    if (previous) {
      if (entry.timestamp === previous.timestamp) duplicateTimestamps += 1;

      const gapHours = (entry.timestamp - previous.timestamp) / 3_600_000;
      if (gapHours >= ABNORMAL_GAP_HOURS) {
        timestampGaps.push({ fromTimestamp: previous.timestamp, toTimestamp: entry.timestamp, gapHours: Math.round(gapHours * 10) / 10 });
      }

      if (entry.waterLevel === previous.waterLevel) {
        currentIdenticalRun += 1;
      } else {
        longestIdenticalRun = Math.max(longestIdenticalRun, currentIdenticalRun);
        currentIdenticalRun = 1;
      }
    }
  });
  longestIdenticalRun = Math.max(longestIdenticalRun, currentIdenticalRun);

  return {
    total: sorted.length,
    valid: flags.filter((f) => f.quality === 'VALID').length,
    invalid: flags.filter((f) => f.quality === 'INVALID').length,
    suspect: flags.filter((f) => f.quality === 'SUSPECT').length,
    missing: flags.filter((f) => f.quality === 'MISSING').length,
    flags,
    usableEntries,
    duplicateTimestamps,
    timestampGaps,
    identicalRunLength: longestIdenticalRun,
  };
}
