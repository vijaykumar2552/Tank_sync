import { useMemo, memo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Battery, Thermometer, Activity, Droplets, AlertCircle } from 'lucide-react';
import { cn, formatNumber, formatDateTime } from '../lib/utils';
import type { TankHistory } from '../types';

const PIE_COLORS = ['#0088ff', '#94a3b8', '#f59e0b', '#dc2626', '#64748b', '#cbd5e1'];

function ChartCard({ title, index, rangeKey, children }: { title: string; index: number; rangeKey: string; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: Math.min(index, 4) * 0.05 }}
      className="card"
    >
      <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4">{title}</h3>
      <AnimatePresence mode="wait">
        <motion.div
          key={rangeKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

type Range = 'daily' | 'weekly' | 'monthly';

function calcUsage(entries: TankHistory[]): number {
  let total = 0;
  entries.forEach((h, i) => {
    if (i === 0) return;
    const prev = entries[i - 1];
    const draw = prev.waterLevel - h.waterLevel;
    if (draw > 0) total += draw * (h.capacity / 100);
  });
  return Math.round(total);
}

function Analytics() {
  const tanks = useStore((s) => s.tanks);
  const history = useStore((s) => s.history);
  const pumpLogs = useStore((s) => s.pumpLogs);
  const [range, setRange] = useState<Range>('daily');

  const filteredHistory = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === 'daily' ? now - 24 * 3600_000 :
      range === 'weekly' ? now - 7 * 24 * 3600_000 :
      now - 30 * 24 * 3600_000;
    return history.filter((h) => h.timestamp >= cutoff).sort((a, b) => a.timestamp - b.timestamp);
  }, [history, range]);

  const chartData = useMemo(() => {
    return filteredHistory.map((h) => ({
      ...h,
      time: formatDateTime(h.timestamp),
    }));
  }, [filteredHistory]);

  const usageByTank = useMemo(() => {
    const map = new Map<string, TankHistory[]>();
    filteredHistory.forEach((h) => {
      const arr = map.get(h.name) ?? [];
      arr.push(h);
      map.set(h.name, arr);
    });
    return tanks.map((t) => {
      const entries = map.get(t.name) ?? [];
      const usage = entries.length >= 2 ? calcUsage(entries) : 0;
      return { name: t.name, usage, currentLevel: t.waterLevel, capacity: t.capacity };
    });
  }, [filteredHistory, tanks]);

  const totalUsage = useMemo(() => usageByTank.reduce((s, u) => s + u.usage, 0), [usageByTank]);

  const pumpRuntime = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === 'daily' ? now - 24 * 3600_000 :
      range === 'weekly' ? now - 7 * 24 * 3600_000 :
      now - 30 * 24 * 3600_000;
    const logs = pumpLogs.filter((l) => l.timestamp >= cutoff).sort((a, b) => a.timestamp - b.timestamp);
    let totalMs = 0;
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (log.pumpStatus !== 'ON') continue;
      const next = logs[i + 1];
      const endTs = next ? next.timestamp : Date.now();
      totalMs += endTs - log.timestamp;
    }
    return Math.round(totalMs / 60000);
  }, [pumpLogs, range]);

  const pumpActivations = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === 'daily' ? now - 24 * 3600_000 :
      range === 'weekly' ? now - 7 * 24 * 3600_000 :
      now - 30 * 24 * 3600_000;
    return pumpLogs.filter((l) => l.pumpStatus === 'ON' && l.timestamp >= cutoff).length;
  }, [pumpLogs, range]);

  const levelByTank = useMemo(() =>
    tanks.map((t) => ({ name: t.name, level: t.waterLevel, battery: t.battery })),
  [tanks]);

  const pumpDistribution = useMemo(() => {
    const on = tanks.filter((t) => t.pumpStatus === 'ON').length;
    const off = tanks.filter((t) => t.pumpStatus === 'OFF').length;
    return [{ name: 'ON', value: on }, { name: 'OFF', value: off }];
  }, [tanks]);

  const stats = useMemo(() => ({
    avgLevel: tanks.length ? Math.round(tanks.reduce((s, t) => s + t.waterLevel, 0) / tanks.length) : 0,
    avgBattery: tanks.length ? Math.round(tanks.reduce((s, t) => s + t.battery, 0) / tanks.length) : 0,
    avgTemp: tanks.length ? Math.round(tanks.reduce((s, t) => s + t.temperature, 0) / tanks.length) : 0,
    totalFlow: tanks.reduce((s, t) => s + t.flowRate, 0),
  }), [tanks]);

  const statCards = [
    { label: 'Avg Level', value: `${stats.avgLevel}%`, icon: Activity, color: 'text-primary-600 bg-primary-50 dark:bg-primary-500/10 dark:text-primary-400' },
    { label: 'Avg Battery', value: `${stats.avgBattery}%`, icon: Battery, color: 'text-success-600 bg-success-50 dark:bg-success-500/10 dark:text-success-400' },
    { label: 'Avg Temp', value: `${stats.avgTemp}\u00B0C`, icon: Thermometer, color: 'text-warning-600 bg-warning-50 dark:bg-warning-500/10 dark:text-warning-400' },
    { label: 'Total Flow', value: `${stats.totalFlow} L/min`, icon: TrendingUp, color: 'text-accent-600 bg-accent-50 dark:bg-accent-500/10 dark:text-accent-400' },
  ];

  const hasHistory = filteredHistory.length > 0;
  const hasEnoughData = filteredHistory.length >= 2;

  const rangeLabels: Record<Range, string> = { daily: '24 hours', weekly: '7 days', monthly: '30 days' };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{s.label}</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{s.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Consumption Summary</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{rangeLabels[range]} summary from real data</p>
          </div>
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize',
                  range === r
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {hasEnoughData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="w-5 h-5 text-primary-500" />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Water Used</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{formatNumber(totalUsage)} L</p>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-success-500" />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Pump Runtime</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{pumpRuntime} min</p>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-accent-500" />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Pump Activations</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{pumpActivations}</p>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="w-5 h-5 text-primary-500" />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Data Points</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{filteredHistory.length}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
            <AlertCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Not enough data for {range} summary</p>
            <p className="text-xs mt-1">At least 2 history entries in this period are needed</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Water Level History" index={0} rangeKey={range}>
          {hasHistory ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff' }} />
                <Legend />
                <Line type="monotone" dataKey="waterLevel" stroke="#0088ff" strokeWidth={2} name="Water Level %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No history data for this period" />
          )}
        </ChartCard>

        <ChartCard title="Tank Comparison" index={1} rangeKey={range}>
          {tanks.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={levelByTank}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff' }} />
                <Legend />
                <Bar dataKey="level" fill="#0088ff" name="Water Level %" radius={[8, 8, 0, 0]} />
                <Bar dataKey="battery" fill="#94a3b8" name="Battery %" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No tanks to compare" />
          )}
        </ChartCard>

        <ChartCard title="Water Usage by Tank" index={2} rangeKey={range}>
          {hasEnoughData && usageByTank.some((u) => u.usage > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={usageByTank} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} unit=" L" />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={100} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff' }} />
                <Bar dataKey="usage" fill="#0088ff" name="Water Used (L)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="Not enough usage data for this period" />
          )}
        </ChartCard>

        <ChartCard title="Pump Status Distribution" index={3} rangeKey={range}>
          {tanks.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pumpDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pumpDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No pump data available" />
          )}
        </ChartCard>

        <ChartCard title="Battery &amp; Temperature Trend" index={4} rangeKey={range}>
          {hasHistory ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="batt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff' }} />
                <Legend />
                <Area type="monotone" dataKey="battery" stroke="#94a3b8" strokeWidth={2} fill="url(#batt)" name="Battery %" />
                <Line type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2} name="Temperature \u00B0C" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No history data for this period" />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="h-[280px] flex flex-col items-center justify-center text-neutral-400">
      <Activity className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-sm font-medium">{message}</p>
      <p className="text-xs mt-1">Data will appear as history accumulates</p>
    </div>
  );
}

export default memo(Analytics);
