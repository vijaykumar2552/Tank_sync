import { useEffect, memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, History, AlertTriangle, Clock, Zap, X, Activity, Info, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { setFirebasePump } from '../hooks/useFirebaseTanks';
import { cn, formatDateTime } from '../lib/utils';

function PumpControls() {
  const tanks = useStore((s) => s.tanks);
  const updateTank = useStore((s) => s.updateTank);
  const pumpLogs = useStore((s) => s.pumpLogs);
  const fetchPumpLogs = useStore((s) => s.fetchPumpLogs);

  const [confirmTank, setConfirmTank] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchPumpLogs();
  }, [fetchPumpLogs]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const confirmTarget = useMemo(
    () => tanks.find((t) => t.id === confirmTank) ?? null,
    [confirmTank, tanks]
  );

  const todayActivations = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return pumpLogs.filter(
      (l) => l.pumpStatus === 'ON' && l.timestamp >= todayStart.getTime()
    ).length;
  }, [pumpLogs]);

  const totalRuntimeToday = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let total = 0;
    for (let i = 0; i < pumpLogs.length - 1; i++) {
      const log = pumpLogs[i];
      const next = pumpLogs[i + 1];
      if (log.pumpStatus === 'ON' && log.timestamp >= todayStart.getTime()) {
        const endTs = next.timestamp > log.timestamp ? next.timestamp : Date.now();
        total += endTs - log.timestamp;
      }
    }
    return Math.round(total / 60000);
  }, [pumpLogs]);

  const handleConfirmToggle = async () => {
    if (!confirmTarget) return;
    const tank = confirmTarget;
    const newStatus = tank.pumpStatus === 'ON' ? 'OFF' : 'ON';
    setToggling(tank.id);
    setConfirmTank(null);

    try {
      const result = await updateTank(tank.id, {
        property: tank.property,
        name: tank.name,
        shape: tank.shape,
        capacity: tank.capacity,
        currentWater: tank.currentWater,
        waterLevel: tank.waterLevel,
        pump: newStatus,
        pumpMode: 'Manual',
        battery: tank.battery,
        batteryVoltage: tank.batteryVoltage,
        signal: tank.signal,
        temperature: tank.temperature,
        humidity: tank.humidity,
        flowRate: tank.flowRate,
        leak: tank.leak,
        overflow: tank.overflow,
        dryRun: tank.dryRun,
        sensorHealth: tank.sensorHealth,
        remarks: `Pump manually toggled to ${newStatus}`,
      }, 'Admin', 'Admin');

      if (!result.success) {
        setToast({ type: 'error', message: result.message || 'Failed to update pump status.' });
        return;
      }

      await setFirebasePump(tank.id, newStatus);
      await fetchPumpLogs();
      setToast({ type: 'success', message: `${tank.name} pump turned ${newStatus}` });
    } catch {
      setToast({ type: 'error', message: 'Failed to toggle pump. Please try again.' });
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card bg-accent-50/60 dark:bg-accent-500/5 border border-accent-200 dark:border-accent-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-accent-600 dark:text-accent-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-accent-900 dark:text-accent-200">Monitoring &amp; command interface — hardware acknowledgement not connected</p>
            <p className="text-xs text-accent-700 dark:text-accent-300 mt-1">
              START/STOP writes a command to Firebase (<code className="font-mono">pumpStatus</code>). The physical pump only
              responds once your ESP32 firmware is listening on that path and actually switches the relay — TankSync has no way
              to confirm the pump physically changed state until your firmware reports back. Treat this as request-only until
              your hardware acknowledges commands.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Active Pumps</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {tanks.filter((t) => t.pumpStatus === 'ON').length}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success-50 dark:bg-success-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Today's Activations</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{todayActivations}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-accent-600 dark:text-accent-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Runtime Today</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{totalRuntimeToday}m</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <Power className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Pumps</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{tanks.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="section-title mb-4">Pump Control Panel</h3>
          <div className="space-y-3">
            {tanks.map((tank) => {
              const isToggling = toggling === tank.id;
              const isOn = tank.pumpStatus === 'ON';
              return (
                <div
                  key={tank.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:shadow-card transition-shadow"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{tank.name}</p>
                      <span className={cn('badge', isOn ? 'badge-success' : 'badge-neutral')}>
                        {isOn ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                      {tank.property} · {tank.pumpMode} mode · {tank.waterLevel}% level
                    </p>
                    {tank.dryRun && isOn && (
                      <p className="text-xs text-error-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Dry run risk — stop pump immediately
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmTank(tank.id)}
                    disabled={isToggling}
                    className={cn(
                      'btn flex-shrink-0 active:scale-[0.98] transition-transform duration-100',
                      isOn
                        ? 'bg-success-500 text-white hover:bg-success-600 shadow-sm'
                        : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                    )}
                  >
                    {isToggling ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isOn ? (
                      <Power className="w-4 h-4" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                    {isOn ? 'STOP' : 'START'}
                  </button>
                </div>
              );
            })}
            {tanks.length === 0 && (
              <div className="text-center py-12 text-neutral-400">
                <Power className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No tanks to control</p>
                <p className="text-xs mt-1">Add tanks from the Tanks page first</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <History className="w-5 h-5" /> Pump Log History
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {pumpLogs.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No pump logs yet</p>
                <p className="text-xs mt-1">Pump activity will appear here</p>
              </div>
            ) : (
              pumpLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    log.pumpStatus === 'ON'
                      ? 'bg-success-100 dark:bg-success-500/20 text-success-600 dark:text-success-400'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
                  )}>
                    <Power className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{log.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {log.previousStatus} → {log.pumpStatus} · {log.source}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                    {formatDateTime(log.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {confirmTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setConfirmTank(null)}
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="card max-w-md w-full bg-white dark:bg-neutral-900"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                </div>
                <div>
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100">
                    {confirmTarget.pumpStatus === 'ON' ? 'Send STOP command?' : 'Send START command?'}
                  </h4>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    This writes a command to Firebase for <strong>{confirmTarget.name}</strong> and overrides automatic control.
                    The pump only physically responds once your ESP32 executes the command — this app cannot confirm that happened.
                    {confirmTarget.pumpStatus === 'OFF' && confirmTarget.dryRun && (
                      <span className="text-error-500 block mt-2">
                        Warning: Dry run flag is active. Starting the pump may cause damage.
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setConfirmTank(null)} className="btn-secondary">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleConfirmToggle}
                  className={confirmTarget.pumpStatus === 'ON' ? 'btn-danger' : 'btn-success'}
                >
                  <Power className="w-4 h-4" />
                  {confirmTarget.pumpStatus === 'ON' ? 'Send STOP Command' : 'Send START Command'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 bg-white dark:bg-neutral-900 border',
              toast.type === 'success' ? 'border-success-200 dark:border-success-500/30' : 'border-error-200 dark:border-error-500/30'
            )}
          >
            {toast.type === 'success' ? <Check className="w-5 h-5 text-success-500" /> : <AlertTriangle className="w-5 h-5 text-error-500" />}
            <span className="font-medium text-sm text-neutral-900 dark:text-neutral-100">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(PumpControls);
