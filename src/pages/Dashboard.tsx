import { useMemo, memo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Droplets, Battery, Signal, Thermometer, AlertTriangle, Power, Activity, FlaskConical,
  TrendingDown, TrendingUp, Clock, Zap, Brain,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { TankVisualization } from '../components/TankVisualization';
import { StatCard } from '../components/StatCard';
import { Skeleton, CardSkeleton } from '../components/Skeleton';
import { getBatteryColor, getSignalColor, getLevelColor, cn, formatNumber, formatDateTime } from '../lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar,
} from 'recharts';
import type { Tank } from '../types';

function Dashboard() {
  const tanks = useStore((s) => s.tanks);
  const history = useStore((s) => s.history);
  const pumpLogs = useStore((s) => s.pumpLogs);
  const loading = useStore((s) => s.loading);

  const stats = useMemo(() => {
    const total = tanks.length;
    const avgLevel = total > 0 ? Math.round(tanks.reduce((s, t) => s + t.waterLevel, 0) / total) : 0;
    const activePumps = tanks.filter((t) => t.pumpStatus === 'ON').length;
    const alerts = tanks.filter((t) => t.leak || t.overflow || t.dryRun).length;
    const totalCapacity = tanks.reduce((s, t) => s + t.capacity, 0);
    const totalWater = tanks.reduce((s, t) => s + t.currentWater, 0);
    return { total, avgLevel, activePumps, alerts, totalCapacity, totalWater };
  }, [tanks]);

  const todayUsage = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEntries = history.filter((h) => h.timestamp >= todayStart.getTime());
    if (todayEntries.length < 2) return null;
    const maxLevel = Math.max(...todayEntries.map((h) => h.waterLevel));
    const minLevel = Math.min(...todayEntries.map((h) => h.waterLevel));
    const totalDrawn = todayEntries.reduce((sum, h, i) => {
      if (i === 0) return 0;
      const prev = todayEntries[i - 1];
      const draw = prev.waterLevel - h.waterLevel;
      return sum + (draw > 0 ? draw * (h.capacity / 100) : 0);
    }, 0);
    return { litres: Math.round(totalDrawn), maxLevel, minLevel };
  }, [history]);

  const yesterdayUsage = useMemo(() => {
    const yesterdayStart = new Date();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);
    const entries = history.filter((h) => h.timestamp >= yesterdayStart.getTime() && h.timestamp < yesterdayEnd.getTime());
    if (entries.length < 2) return null;
    const totalDrawn = entries.reduce((sum, h, i) => {
      if (i === 0) return 0;
      const prev = entries[i - 1];
      const draw = prev.waterLevel - h.waterLevel;
      return sum + (draw > 0 ? draw * (h.capacity / 100) : 0);
    }, 0);
    return Math.round(totalDrawn);
  }, [history]);

  const usageTrend = useMemo(() => {
    if (todayUsage && yesterdayUsage && yesterdayUsage > 0) {
      const diff = ((todayUsage.litres - yesterdayUsage) / yesterdayUsage) * 100;
      return Math.round(diff);
    }
    return null;
  }, [todayUsage, yesterdayUsage]);

  const lastPumpActivation = useMemo(() => {
    const onLog = pumpLogs.find((l) => l.pumpStatus === 'ON');
    return onLog ? onLog.timestamp : null;
  }, [pumpLogs]);

  const chartData = useMemo(() => {
    if (history.length === 0) {
      const hours = ['00', '04', '08', '12', '16', '20', 'Now'];
      return hours.map((h) => ({ time: h, level: 0 }));
    }
    const now = Date.now();
    const buckets: Array<{ time: string; level: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const bucketEnd = now - i * 4 * 3600_000;
      const bucketStart = bucketEnd - 4 * 3600_000;
      const entries = history.filter((h) => h.timestamp >= bucketStart && h.timestamp < bucketEnd);
      const avgLevel = entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.waterLevel, 0) / entries.length) : 0;
      const hour = new Date(bucketEnd).getHours();
      buckets.push({ time: i === 0 ? 'Now' : `${String(hour).padStart(2, '0')}:00`, level: avgLevel });
    }
    return buckets;
  }, [history]);

  const radialData = useMemo(() => tanks.slice(0, 4).map((t) => ({
    name: t.name,
    value: t.waterLevel,
    fill: t.waterLevel >= 75 ? '#22c55e' : t.waterLevel >= 40 ? '#f59e0b' : '#ef4444',
  })), [tanks]);

  return (
    <div className="space-y-6">
      {loading && tanks.length === 0 ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading live telemetry...">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
          </div>
          <div className="card">
            <Skeleton className="w-40 h-5 mb-4" />
            <Skeleton className="w-full h-[220px] rounded-xl" />
          </div>
          <div className="card">
            <Skeleton className="w-32 h-5 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-neutral-200/60 dark:border-neutral-800 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <Skeleton className="w-24 h-4" />
                    <Skeleton className="w-12 h-4 rounded-full" />
                  </div>
                  <Skeleton className="w-full h-32 rounded-xl mb-3" />
                  <Skeleton lines={2} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          index={0}
          label="Tank Level"
          value={stats.avgLevel}
          icon={Droplets}
          color={stats.avgLevel >= 50 ? 'success' : stats.avgLevel >= 25 ? 'warning' : 'error'}
          trend={stats.totalWater > 0 ? `${formatNumber(stats.totalWater)} L remaining` : 'No tanks'}
          suffix="%"
        />
        <StatCard
          index={1}
          label="Pump Status"
          value={stats.activePumps}
          icon={Power}
          color={stats.activePumps > 0 ? 'success' : 'neutral'}
          trend={stats.activePumps > 0 ? 'Running' : 'OFF'}
          suffix={stats.activePumps === 1 ? ' ON' : stats.activePumps > 1 ? ' ON' : ''}
        />
        <StatCard
          index={2}
          label="Today's Usage"
          value={todayUsage?.litres ?? 0}
          icon={Activity}
          color="primary"
          trend={
            usageTrend !== null
              ? `${usageTrend > 0 ? '↑' : '↓'} ${Math.abs(usageTrend)}% vs yesterday`
              : 'More data needed'
          }
          suffix=" L"
        />
        <StatCard
          index={3}
          label="Active Alerts"
          value={stats.alerts}
          icon={AlertTriangle}
          color={stats.alerts > 0 ? 'error' : 'success'}
          trend={stats.alerts > 0 ? 'Needs attention' : 'All clear'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">Water Level Trend</h3>
              <p className="section-subtitle">Last 24 hours</p>
            </div>
          </div>
          {chartData.some((d) => d.level > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff' }} />
                <Area type="monotone" dataKey="level" stroke="#3b82f6" strokeWidth={2} fill="url(#colorLevel)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState />
          )}
        </div>

        <div className="card">
          <h3 className="section-title mb-4">Tank Levels</h3>
          {radialData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart innerRadius="25%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                  <RadialBar background dataKey="value" cornerRadius={8} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {radialData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400 truncate">{d.name}</span>
                    <span className="font-semibold flex-shrink-0 ml-2" style={{ color: d.fill }}>{d.value}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center text-neutral-400">
              <Droplets className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No tanks configured yet</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title">Tank Overview</h3>
            <p className="section-subtitle">{tanks.length} tank{tanks.length !== 1 ? 's' : ''} monitored</p>
          </div>
        </div>
        {tanks.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <Droplets className="w-14 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No tanks configured</p>
            <p className="text-xs mt-1">Add tanks from the Tanks page to start monitoring</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tanks.map((tank, idx) => (
              <TankCard key={tank.id} tank={tank} index={idx} />
            ))}
          </div>
        )}
      </div>

      {lastPumpActivation && (
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-success-50 dark:bg-success-500/10 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-success-600 dark:text-success-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Last pump activation</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {formatDateTime(lastPumpActivation)}
            </p>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="h-[260px] flex flex-col items-center justify-center text-neutral-400">
      <Activity className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-sm font-medium">No usage history yet</p>
      <p className="text-xs mt-1">TankSync needs more data to generate charts</p>
    </div>
  );
}

const TankCard = memo(function TankCard({ tank, index }: { tank: Tank; index: number }) {
  const status = getTankStatus(tank);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      whileHover={{ y: -3 }}
      className="border border-neutral-200/60 dark:border-neutral-800 rounded-2xl p-4 hover:shadow-card-hover transition-shadow duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm truncate">{tank.name}</h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{tank.property}</p>
        </div>
        <span className={cn('badge', status.badgeClass)}>
          {status.label}
        </span>
      </div>

      <div className="flex justify-center mb-3">
        <TankVisualization tank={tank} size="sm" />
      </div>

      <div className={cn('grid gap-2 text-center', tank.ph !== null ? 'grid-cols-4' : 'grid-cols-3')}>
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2">
          <Battery className={cn('w-4 h-4 mx-auto mb-1', getBatteryColor(tank.battery))} />
          <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{tank.battery}%</p>
        </div>
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2">
          <Signal className={cn('w-4 h-4 mx-auto mb-1', getSignalColor(tank.signal))} />
          <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{tank.signal}%</p>
        </div>
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2">
          <Thermometer className="w-4 h-4 mx-auto mb-1 text-warning-500" />
          <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{tank.temperature}&deg;C</p>
        </div>
        {tank.ph !== null && (
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2">
            <FlaskConical className="w-4 h-4 mx-auto mb-1 text-accent-500" />
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{tank.ph.toFixed(1)}</p>
          </div>
        )}
      </div>

      {(tank.leak || tank.overflow || tank.dryRun) && (
        <div className="mt-3 flex gap-1 flex-wrap">
          {tank.leak && <span className="badge-error"><AlertTriangle className="w-3 h-3" /> Leak</span>}
          {tank.overflow && <span className="badge-warning">Overflow</span>}
          {tank.dryRun && <span className="badge-error">Dry Run</span>}
        </div>
      )}
    </motion.div>
  );
});

function getTankStatus(tank: Tank): { label: string; badgeClass: string } {
  if (tank.sensorHealth === 'Offline') return { label: 'Offline', badgeClass: 'badge-neutral' };
  if (tank.leak || tank.dryRun) return { label: 'Critical', badgeClass: 'badge-error' };
  if (tank.overflow || tank.waterLevel >= 90) return { label: 'Overflow Risk', badgeClass: 'badge-warning' };
  if (tank.waterLevel <= 10) return { label: 'Critical', badgeClass: 'badge-error' };
  if (tank.waterLevel <= 20) return { label: 'Low', badgeClass: 'badge-warning' };
  return { label: 'Healthy', badgeClass: 'badge-success' };
}

export default memo(Dashboard);
