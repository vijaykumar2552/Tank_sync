import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Radio, Battery, Signal, Thermometer, Power, AlertTriangle, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { TankVisualization } from '../components/TankVisualization';
import { DeviceConnect } from '../components/DeviceConnect';
import { cn, getBatteryColor, getSignalColor, formatRelativeTime } from '../lib/utils';

function Devices() {
  const tanks = useStore((s) => s.tanks);
  const [showConnect, setShowConnect] = useState(false);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary-600 dark:text-primary-400" /> Connected Devices ({tanks.length})
          </h3>
          <button onClick={() => setShowConnect(true)} className="btn-success">
            <Plus className="w-4 h-4" /> Connect Device
          </button>
        </div>
        {tanks.length === 0 ? (
          <div className="text-center py-12 text-neutral-400">
            <Radio className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No devices registered. Add tanks via Tank Input.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tanks.map((tank, idx) => (
              <motion.div
                key={tank.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                whileHover={{ y: -3 }}
                className="border border-neutral-200/60 dark:border-neutral-800 rounded-2xl p-5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow duration-200 bg-white dark:bg-neutral-900/50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-neutral-100">{tank.name}</h4>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{tank.property}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Shape: {tank.shape}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        tank.sensorHealth === 'Good' ? 'bg-success-500' :
                        tank.sensorHealth === 'Fair' ? 'bg-warning-500 animate-pulse' :
                        'bg-error-500'
                      )} />
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">{tank.sensorHealth}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
                      {formatRelativeTime(tank.lastUpdated) ?? 'Waiting for first reading'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center mb-4">
                  <TankVisualization tank={tank} size="sm" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2">
                    <Power className={cn('w-4 h-4', tank.pumpStatus === 'ON' ? 'text-success-600 dark:text-success-400' : 'text-neutral-400')} />
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Pump</p>
                      <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{tank.pumpStatus} - {tank.pumpMode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2">
                    <Battery className={cn('w-4 h-4', getBatteryColor(tank.battery))} />
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Battery</p>
                      <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{tank.battery}% / {tank.batteryVoltage}V</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2">
                    <Signal className={cn('w-4 h-4', getSignalColor(tank.signal))} />
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Signal</p>
                      <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{tank.signal}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2">
                    <Thermometer className="w-4 h-4 text-warning-500" />
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Climate</p>
                      <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{tank.temperature}&deg;C / {tank.humidity}%</p>
                    </div>
                  </div>
                </div>

                {(tank.leak || tank.overflow || tank.dryRun) && (
                  <div className="mt-3 flex gap-1 flex-wrap">
                    {tank.leak && <span className="badge-error"><AlertTriangle className="w-3 h-3" /> Leak</span>}
                    {tank.overflow && <span className="badge-warning">Overflow</span>}
                    {tank.dryRun && <span className="badge-error">Dry Run</span>}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {showConnect && (
        <DeviceConnect onClose={() => setShowConnect(false)} existingTankIds={tanks.map((t) => t.id)} />
      )}
    </div>
  );
}

export default memo(Devices);
