import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Battery,
  Droplets, Thermometer, Activity, Clock, Zap, Info, CheckCircle2,
  Gauge, Wrench, Eye,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { generateInsights, type Priority, type InsightIconKey } from '../lib/insights';
import { generateStructuredInsights, type InsightSeverity } from '../lib/structuredInsights';

const ICON_MAP: Record<InsightIconKey, typeof Brain> = {
  leak: AlertTriangle,
  'dry-run': AlertTriangle,
  'sensor-offline': Activity,
  'sensor-poor': Wrench,
  'water-critical': Droplets,
  'water-low': Droplets,
  'near-overflow': Droplets,
  overflow: AlertTriangle,
  battery: Battery,
  temperature: Thermometer,
  'anomaly-drift': Activity,
  'anomaly-overnight': AlertTriangle,
  'sensor-inconsistent': Eye,
  prediction: Clock,
  healthy: CheckCircle2,
};

const PRIORITY_CONFIG: Record<Priority, {
  label: string;
  border: string;
  bg: string;
  iconBg: string;
  iconText: string;
  titleText: string;
  badge: string;
}> = {
  info: {
    label: 'INFO', border: 'border-primary-200 dark:border-primary-500/20',
    bg: 'bg-primary-50/50 dark:bg-primary-500/5',
    iconBg: 'bg-primary-100 dark:bg-primary-500/20', iconText: 'text-primary-600 dark:text-primary-400',
    titleText: 'text-primary-900 dark:text-primary-200', badge: 'badge-info',
  },
  recommendation: {
    label: 'RECOMMENDATION', border: 'border-accent-200 dark:border-accent-500/20',
    bg: 'bg-accent-50/50 dark:bg-accent-500/5',
    iconBg: 'bg-accent-100 dark:bg-accent-500/20', iconText: 'text-accent-600 dark:text-accent-400',
    titleText: 'text-accent-900 dark:text-accent-200', badge: 'badge bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-400',
  },
  attention: {
    label: 'ATTENTION', border: 'border-warning-200 dark:border-warning-500/20',
    bg: 'bg-warning-50/50 dark:bg-warning-500/5',
    iconBg: 'bg-warning-100 dark:bg-warning-500/20', iconText: 'text-warning-600 dark:text-warning-400',
    titleText: 'text-warning-900 dark:text-warning-200', badge: 'badge-warning',
  },
  warning: {
    label: 'WARNING', border: 'border-error-200 dark:border-error-500/20',
    bg: 'bg-error-50/50 dark:bg-error-500/5',
    iconBg: 'bg-error-100 dark:bg-error-500/20', iconText: 'text-error-600 dark:text-error-400',
    titleText: 'text-error-900 dark:text-error-200', badge: 'badge-error',
  },
  critical: {
    label: 'CRITICAL', border: 'border-error-400 dark:border-error-500/40',
    bg: 'bg-error-50 dark:bg-error-500/10',
    iconBg: 'bg-error-500', iconText: 'text-white',
    titleText: 'text-error-900 dark:text-error-100', badge: 'badge-error',
  },
};

function AIInsights() {
  const tanks = useStore((s) => s.tanks);
  const history = useStore((s) => s.history);
  const pumpLogs = useStore((s) => s.pumpLogs);

  const { insights, summary } = useMemo(() => {
    const { insights: all, summary: s } = generateInsights(tanks, history);
    return { insights: all.slice(0, 12), summary: s };
  }, [tanks, history]);

  const structured = useMemo(
    () => generateStructuredInsights(tanks, history, pumpLogs),
    [tanks, history, pumpLogs]
  );
  const grouped = useMemo(() => {
    const groups: Record<string, typeof structured> = {};
    structured.forEach((i) => {
      if (!groups[i.type]) groups[i.type] = [];
      groups[i.type].push(i);
    });
    return groups;
  }, [structured]);

  if (tanks.length === 0) {
    return (
      <div className="card text-center py-20">
        <Brain className="w-16 h-16 mx-auto mb-4 text-neutral-300 dark:text-neutral-700" />
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">No insights available yet</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
          TankSync needs tank data to generate AI-powered insights. Add tanks from the Tanks page to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ExecutiveSummary summary={summary} />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Active Insights</h3>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {insights.length} insight{insights.length !== 1 ? 's' : ''}
          </span>
        </div>

        {insights.length === 0 ? (
          <div className="card text-center py-16">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success-400" />
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">No active insights</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              All tanks are operating within normal parameters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {insights.map((insight, idx) => {
              const cfg = PRIORITY_CONFIG[insight.priority];
              const Icon = ICON_MAP[insight.iconKey];
              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                  whileHover={{ y: -2 }}
                  className={cn('card border-2 transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]', cfg.border, cfg.bg)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', cfg.iconBg, cfg.iconText)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={cn('font-bold text-sm', cfg.titleText)}>{insight.title}</h4>
                        <span className={cfg.badge}>{cfg.label}</span>
                      </div>
                      {insight.tankName && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{insight.tankName}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm ml-13">
                    <div>
                      <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">What happened</p>
                      <p className="text-neutral-700 dark:text-neutral-300">{insight.what}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Why it matters</p>
                      <p className="text-neutral-700 dark:text-neutral-300">{insight.why}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Recommended action</p>
                      <p className="text-neutral-700 dark:text-neutral-300">{insight.action}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnalyticsIntelligenceSection grouped={grouped} />
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  consumption: 'Consumption Patterns',
  anomaly: 'Anomalies',
  quality: 'Water Quality',
  pump: 'Pump Intelligence',
  forecast: 'Forecast',
};

const SEVERITY_STYLES: Record<InsightSeverity, { border: string; badge: string }> = {
  info: { border: 'border-neutral-200 dark:border-neutral-800', badge: 'badge-info' },
  low: { border: 'border-neutral-200 dark:border-neutral-800', badge: 'badge-info' },
  moderate: { border: 'border-warning-200 dark:border-warning-500/30', badge: 'badge-warning' },
  high: { border: 'border-error-200 dark:border-error-500/30', badge: 'badge-error' },
  critical: { border: 'border-error-300 dark:border-error-500/40', badge: 'badge-error' },
};

function AnalyticsIntelligenceSection({ grouped }: { grouped: Record<string, ReturnType<typeof generateStructuredInsights>> }) {
  const categories = ['consumption', 'anomaly', 'quality', 'pump', 'forecast'];
  const hasAny = categories.some((c) => (grouped[c]?.length ?? 0) > 0);
  if (!hasAny) return null;

  return (
    <div>
      <h3 className="section-title mb-4">Analytics Intelligence</h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 -mt-3 mb-4">
        Statistical analysis (consumption, trends, anomaly detection, forecasting) computed directly from real Firebase history — not a language model. Every figure below traces back to actual readings.
      </p>
      <div className="space-y-6">
        {categories.map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat}>
              <h4 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 mb-2">{CATEGORY_LABELS[cat]}</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {items.map((insight, idx) => {
                  const style = SEVERITY_STYLES[insight.severity];
                  return (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                      whileHover={{ y: -2 }}
                      className={cn('card border transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]', style.border)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <h5 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">{insight.title}</h5>
                        <span className={style.badge}>{insight.confidence} confidence</span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">{insight.tankName}</p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">{insight.summary}</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">{insight.evidence}</p>
                      {insight.recommendation && (
                        <p className="text-xs text-primary-600 dark:text-primary-400 mt-2 font-medium">→ {insight.recommendation}</p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExecutiveSummary({ summary }: {
  summary: {
    efficiency: number;
    weeklyUsage: number | null;
    usageChange: number | null;
    anomalyCount: number;
    tankCount: number;
  };
}) {
  const efficiencyColor = summary.efficiency >= 80 ? 'text-success-500' : summary.efficiency >= 60 ? 'text-warning-500' : 'text-error-500';
  const efficiencyBg = summary.efficiency >= 80 ? 'from-success-500 to-success-600' : summary.efficiency >= 60 ? 'from-warning-500 to-warning-600' : 'from-error-500 to-error-600';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn('card lg:col-span-1 text-white border-0 bg-gradient-to-br', efficiencyBg)}
      >
        <div className="flex items-center gap-2 mb-2">
          <Gauge className="w-5 h-5" />
          <span className="text-sm font-medium text-white/90">Efficiency Score</span>
        </div>
        <p className="text-4xl font-bold">{summary.efficiency}<span className="text-xl text-white/70">/100</span></p>
        <p className="text-xs text-white/80 mt-2">
          {summary.efficiency >= 80 ? 'Excellent water management' : summary.efficiency >= 60 ? 'Good, with room to improve' : 'Needs attention'}
        </p>
      </motion.div>

      <div className="card lg:col-span-1">
        <div className="flex items-center gap-2 mb-2">
          {summary.usageChange !== null && summary.usageChange < 0 ? (
            <TrendingDown className="w-5 h-5 text-success-500" />
          ) : (
            <TrendingUp className="w-5 h-5 text-neutral-400" />
          )}
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Weekly Usage</span>
        </div>
        <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          {summary.weeklyUsage !== null ? `${summary.weeklyUsage}L` : '—'}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
          {summary.usageChange !== null
            ? `${summary.usageChange > 0 ? '↑' : '↓'} ${Math.abs(summary.usageChange)}% vs last week`
            : 'More data needed for comparison'}
        </p>
      </div>

      <div className="card lg:col-span-1">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-error-500" />
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Anomalies</span>
        </div>
        <p className={cn('text-3xl font-bold', summary.anomalyCount > 0 ? 'text-error-500' : 'text-success-500')}>
          {summary.anomalyCount}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
          {summary.anomalyCount > 0 ? 'Issues requiring attention' : 'No anomalies detected'}
        </p>
      </div>

      <div className="card lg:col-span-1">
        <div className="flex items-center gap-2 mb-2">
          <Droplets className="w-5 h-5 text-primary-500" />
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Tanks Monitored</span>
        </div>
        <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{summary.tankCount}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">Active monitoring</p>
      </div>
    </div>
  );
}

export default memo(AIInsights);
