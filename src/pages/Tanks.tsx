import { useState, useEffect, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, RefreshCw, Trash2, Edit3, CheckCircle2, AlertCircle, Droplets, Battery, Signal, Thermometer, Activity, Power, FlaskConical } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { TankInput as TankInputType, TankShape, PumpStatus, PumpMode, SensorHealth, Tank } from '../types';
import { TankVisualization } from '../components/TankVisualization';
import { Skeleton } from '../components/Skeleton';
import { cn, formatDateTime, formatNumber, getBatteryColor, getSignalColor, getLevelColor } from '../lib/utils';

const shapes: TankShape[] = ['Rectangle', 'Circle', 'Vertical Cylinder', 'Horizontal Cylinder', 'Square', 'Custom Image'];
const sensorHealths: SensorHealth[] = ['Good', 'Fair', 'Poor', 'Offline'];

const emptyForm: TankInputType = {
  property: '',
  name: '',
  shape: 'Vertical Cylinder',
  capacity: 0,
  currentWater: 0,
  waterLevel: 0,
  pump: 'OFF',
  pumpMode: 'Auto',
  battery: 0,
  batteryVoltage: 0,
  signal: 0,
  temperature: 0,
  humidity: 0,
  flowRate: 0,
  leak: false,
  overflow: false,
  dryRun: false,
  sensorHealth: 'Good',
  remarks: '',
};

function TankInput() {
  const tanks = useStore((s) => s.tanks);
  const loading = useStore((s) => s.loading);
  const saveTank = useStore((s) => s.saveTank);
  const updateTank = useStore((s) => s.updateTank);
  const deleteTank = useStore((s) => s.deleteTank);
  const [form, setForm] = useState<TankInputType>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof TankInputType, string>>>({});

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const validate = (): boolean => {
    const e: Partial<Record<keyof TankInputType, string>> = {};
    if (!form.property.trim()) e.property = 'Property is required';
    if (!form.name.trim()) e.name = 'Tank name is required';
    if (form.capacity <= 0) e.capacity = 'Capacity must be greater than 0';
    if (form.currentWater < 0) e.currentWater = 'Current water cannot be negative';
    if (form.currentWater > form.capacity) e.currentWater = 'Cannot exceed capacity';
    if (form.waterLevel < 0 || form.waterLevel > 100) e.waterLevel = 'Must be 0-100';
    if (form.battery < 0 || form.battery > 100) e.battery = 'Must be 0-100';
    if (form.batteryVoltage < 0) e.batteryVoltage = 'Cannot be negative';
    if (form.signal < 0 || form.signal > 100) e.signal = 'Must be 0-100';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const update = (field: keyof TankInputType, value: string | number | boolean) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === 'currentWater' && next.capacity > 0) {
        next.waterLevel = Math.round((next.currentWater / next.capacity) * 100);
      }
      if (field === 'capacity' && (value as number) > 0) {
        next.waterLevel = Math.round((next.currentWater / (value as number)) * 100);
      }
      if (field === 'waterLevel') {
        next.currentWater = Math.round(((value as number) / 100) * next.capacity);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!validate()) return;
    const result = await saveTank(form, 'Admin', 'Admin');
    setToast({ type: result.success ? 'success' : 'error', message: result.message });
    if (result.success) handleReset();
  };

  const handleUpdate = async () => {
    if (!editingId || !validate()) return;
    const result = await updateTank(editingId, form, 'Admin', 'Admin');
    setToast({ type: result.success ? 'success' : 'error', message: result.message });
    if (result.success) handleReset();
  };

  const handleDelete = async () => {
    if (!editingId) return;
    const result = await deleteTank(editingId);
    setToast({ type: result.success ? 'success' : 'error', message: result.message });
    if (result.success) handleReset();
  };

  const handleReset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setErrors({});
  };

  const handleEdit = (tank: Tank) => {
    setEditingId(tank.id);
    setForm({
      property: tank.property,
      name: tank.name,
      shape: tank.shape,
      capacity: tank.capacity,
      currentWater: tank.currentWater,
      waterLevel: tank.waterLevel,
      pump: tank.pumpStatus,
      pumpMode: tank.pumpMode,
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
      remarks: tank.remarks,
    });
  };

  const previewTank: Tank = {
    id: 'preview',
    property: form.property || 'Preview',
    name: form.name || 'New Tank',
    shape: form.shape || 'Vertical Cylinder',
    capacity: form.capacity,
    currentWater: form.currentWater,
    quantitySource: 'measured',
    waterLevel: form.waterLevel,
    pumpStatus: form.pump,
    pumpMode: form.pumpMode || 'Auto',
    battery: form.battery,
    batteryVoltage: form.batteryVoltage,
    signal: form.signal,
    temperature: form.temperature,
    humidity: form.humidity,
    flowRate: form.flowRate,
    ph: null,
    leak: form.leak,
    overflow: form.overflow,
    dryRun: form.dryRun,
    sensorHealth: form.sensorHealth,
    remarks: form.remarks,
    customImageUrl: form.customImageUrl || null,
    status: 'normal',
    lastUpdated: Date.now(),
  };

  return (
    <div className="space-y-6">
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
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-success-500" /> : <AlertCircle className="w-5 h-5 text-error-500" />}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && tanks.length === 0 && (
        <div aria-busy="true" aria-label="Loading tanks...">
          <Skeleton className="w-32 h-5 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-neutral-200/60 dark:border-neutral-800 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <Skeleton className="w-20 h-4" />
                  <Skeleton className="w-14 h-4 rounded-full" />
                </div>
                <Skeleton className="w-full h-28 rounded-xl my-3" />
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 5 }).map((_, j) => <Skeleton key={j} className="h-10 rounded-lg" />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tanks.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4">Tank Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tanks.map((tank) => {
              const isCritical = tank.leak || tank.dryRun || tank.sensorHealth === 'Offline';
              const isWarning = tank.overflow || tank.waterLevel <= 20 || tank.sensorHealth === 'Poor';
              return (
                <div
                  key={tank.id}
                  className={cn(
                    'border rounded-2xl p-4 hover:shadow-card-hover hover:-translate-y-[3px] transition-all duration-200 cursor-pointer',
                    editingId === tank.id
                      ? 'border-primary-300 dark:border-primary-500/30 bg-primary-50/30 dark:bg-primary-500/5'
                      : 'border-neutral-200/60 dark:border-neutral-800'
                  )}
                  onClick={() => handleEdit(tank)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">{tank.name}</h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{tank.property}</p>
                    </div>
                    <span className={cn(
                      'badge flex-shrink-0',
                      isCritical ? 'badge-error' : isWarning ? 'badge-warning' : 'badge-success'
                    )}>
                      {isCritical ? 'Critical' : isWarning ? 'Warning' : 'Healthy'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <TankVisualization tank={tank} size="sm" />
                    <div className="flex-1 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-neutral-500 dark:text-neutral-400">Level</span>
                        <span className={cn('font-semibold', getLevelColor(tank.waterLevel))}>{tank.waterLevel}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-500 dark:text-neutral-400">Water</span>
                        <span className="text-right">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                            {tank.quantitySource === 'unavailable' ? 'Unavailable' : `${formatNumber(tank.currentWater)} L`}
                          </span>
                          {tank.quantitySource === 'calculated' && (
                            <span className="block text-[10px] text-neutral-400 dark:text-neutral-500 leading-tight">Calculated from level</span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500 dark:text-neutral-400">Capacity</span>
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">{formatNumber(tank.capacity)} L</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500 dark:text-neutral-400">Pump</span>
                        <span className={cn('font-semibold', tank.pumpStatus === 'ON' ? 'text-success-500' : 'text-neutral-500')}>
                          {tank.pumpStatus} ({tank.pumpMode})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1 text-center">
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-1.5">
                      <Battery className={cn('w-3.5 h-3.5 mx-auto mb-0.5', getBatteryColor(tank.battery))} />
                      <p className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">{tank.battery}%</p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-1.5">
                      <Signal className={cn('w-3.5 h-3.5 mx-auto mb-0.5', getSignalColor(tank.signal))} />
                      <p className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">{tank.signal}%</p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-1.5">
                      <Thermometer className="w-3.5 h-3.5 mx-auto mb-0.5 text-warning-500" />
                      <p className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">{tank.temperature}&deg;C</p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-1.5">
                      <FlaskConical className="w-3.5 h-3.5 mx-auto mb-0.5 text-accent-500" />
                      <p className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">{tank.ph !== null ? tank.ph.toFixed(1) : 'N/A'}</p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-1.5">
                      <Activity className={cn('w-3.5 h-3.5 mx-auto mb-0.5',
                        tank.sensorHealth === 'Good' ? 'text-success-500' :
                        tank.sensorHealth === 'Fair' ? 'text-warning-500' :
                        'text-error-500')} />
                      <p className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">{tank.sensorHealth}</p>
                    </div>
                  </div>

                  {(tank.leak || tank.overflow || tank.dryRun) && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {tank.leak && <span className="badge-error text-[10px]">Leak</span>}
                      {tank.overflow && <span className="badge-warning text-[10px]">Overflow</span>}
                      {tank.dryRun && <span className="badge-error text-[10px]">Dry Run</span>}
                    </div>
                  )}

                  {tank.lastUpdated > 0 && (
                    <p className="text-[10px] text-neutral-400 mt-2">Updated {formatDateTime(tank.lastUpdated)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              {editingId ? 'Edit Tank' : 'Add New Tank'}
            </h3>
            {editingId && (
              <span className="badge-info">
                <Edit3 className="w-3 h-3" /> Editing mode
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Property <span className="text-error-500">*</span></label>
              <input
                className={cn('input', errors.property && 'border-error-500')}
                value={form.property}
                onChange={(e) => update('property', e.target.value)}
                placeholder="e.g., Apartment A"
              />
              {errors.property && <p className="text-xs text-error-500 mt-1">{errors.property}</p>}
            </div>

            <div>
              <label className="label">Tank Name <span className="text-error-500">*</span></label>
              <input
                className={cn('input', errors.name && 'border-error-500')}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g., Main Rooftop Tank"
              />
              {errors.name && <p className="text-xs text-error-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="label">Tank Shape</label>
              <select className="input" value={form.shape} onChange={(e) => update('shape', e.target.value)}>
                {shapes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {form.shape === 'Custom Image' && (
              <div>
                <label className="label">Custom Image URL</label>
                <input
                  className="input"
                  value={form.customImageUrl || ''}
                  onChange={(e) => setForm((f) => ({ ...f, customImageUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            )}

            <div>
              <label className="label">Capacity (Litres) <span className="text-error-500">*</span></label>
              <input
                type="number"
                className={cn('input', errors.capacity && 'border-error-500')}
                value={form.capacity || ''}
                onChange={(e) => update('capacity', Number(e.target.value))}
                placeholder="5000"
              />
              {errors.capacity && <p className="text-xs text-error-500 mt-1">{errors.capacity}</p>}
            </div>

            <div>
              <label className="label">Current Water (Litres)</label>
              <input
                type="number"
                className={cn('input', errors.currentWater && 'border-error-500')}
                value={form.currentWater || ''}
                onChange={(e) => update('currentWater', Number(e.target.value))}
                placeholder="3650"
              />
              {errors.currentWater && <p className="text-xs text-error-500 mt-1">{errors.currentWater}</p>}
            </div>

            <div>
              <label className="label">Water Level (%)</label>
              <input
                type="number"
                className={cn('input', errors.waterLevel && 'border-error-500')}
                value={form.waterLevel || ''}
                onChange={(e) => update('waterLevel', Number(e.target.value))}
                placeholder="73"
                min={0} max={100}
              />
              {errors.waterLevel && <p className="text-xs text-error-500 mt-1">{errors.waterLevel}</p>}
            </div>

            <div>
              <label className="label">Pump Status</label>
              <div className="flex gap-2">
                {(['ON', 'OFF'] as PumpStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => update('pump', s)}
                    className={cn('btn flex-1', form.pump === s ? (s === 'ON' ? 'bg-success-500 text-white' : 'bg-neutral-200 text-neutral-700') : 'btn-secondary')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Pump Mode</label>
              <div className="flex gap-2">
                {(['Manual', 'Auto'] as PumpMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => update('pumpMode', m)}
                    className={cn('btn flex-1', form.pumpMode === m ? 'bg-primary-600 text-white' : 'btn-secondary')}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Battery Percentage</label>
              <input
                type="number"
                className={cn('input', errors.battery && 'border-error-500')}
                value={form.battery || ''}
                onChange={(e) => update('battery', Number(e.target.value))}
                placeholder="87" min={0} max={100}
              />
              {errors.battery && <p className="text-xs text-error-500 mt-1">{errors.battery}</p>}
            </div>

            <div>
              <label className="label">Battery Voltage</label>
              <input
                type="number" step="0.01"
                className={cn('input', errors.batteryVoltage && 'border-error-500')}
                value={form.batteryVoltage || ''}
                onChange={(e) => update('batteryVoltage', Number(e.target.value))}
                placeholder="3.92"
              />
            </div>

            <div>
              <label className="label">Signal Strength (%)</label>
              <input
                type="number"
                className={cn('input', errors.signal && 'border-error-500')}
                value={form.signal || ''}
                onChange={(e) => update('signal', Number(e.target.value))}
                placeholder="94" min={0} max={100}
              />
            </div>

            <div>
              <label className="label">Temperature (&deg;C)</label>
              <input type="number" className="input" value={form.temperature || ''} onChange={(e) => update('temperature', Number(e.target.value))} placeholder="24" />
            </div>

            <div>
              <label className="label">Humidity (%)</label>
              <input type="number" className="input" value={form.humidity || ''} onChange={(e) => update('humidity', Number(e.target.value))} placeholder="62" />
            </div>

            <div>
              <label className="label">Flow Rate (L/min)</label>
              <input type="number" className="input" value={form.flowRate || ''} onChange={(e) => update('flowRate', Number(e.target.value))} placeholder="18" />
            </div>

            <div>
              <label className="label">Sensor Health</label>
              <select className="input" value={form.sensorHealth} onChange={(e) => update('sensorHealth', e.target.value)}>
                {sensorHealths.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label">Status Flags</label>
              <div className="flex gap-3 flex-wrap">
                {([
                  { key: 'leak', label: 'Leak Detected' },
                  { key: 'overflow', label: 'Overflow' },
                  { key: 'dryRun', label: 'Dry Run' },
                ] as const).map((flag) => (
                  <label key={flag.key} className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    <input
                      type="checkbox"
                      checked={form[flag.key]}
                      onChange={(e) => setForm((f) => ({ ...f, [flag.key]: e.target.checked }))}
                      className="w-4 h-4 rounded accent-error-500"
                    />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">{flag.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="label">Remarks</label>
              <textarea
                className="input min-h-[80px]"
                value={form.remarks}
                onChange={(e) => update('remarks', e.target.value)}
                placeholder="Normal operation..."
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            {!editingId ? (
              <button onClick={handleSave} className="btn-primary">
                <Save className="w-4 h-4" /> Save
              </button>
            ) : (
              <button onClick={handleUpdate} className="btn-primary">
                <Save className="w-4 h-4" /> Update
              </button>
            )}
            {editingId && (
              <button onClick={handleDelete} className="btn-danger">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
            <button onClick={handleReset} className="btn-secondary">
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-4">Live Preview</h3>
            <div className="flex justify-center">
              <TankVisualization tank={previewTank} size="md" />
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-neutral-500">Pump</span><span className="font-semibold">{form.pump}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Battery</span><span className="font-semibold">{form.battery}%</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Signal</span><span className="font-semibold">{form.signal}%</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Sensor</span><span className="font-semibold">{form.sensorHealth}</span></div>
            </div>
          </div>

          {tanks.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-3">Existing Tanks ({tanks.length})</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {tanks.map((tank) => (
                  <button
                    key={tank.id}
                    onClick={() => handleEdit(tank)}
                    className={cn(
                      'w-full flex items-center gap-2 p-2.5 rounded-xl text-left transition-colors',
                      editingId === tank.id ? 'bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-transparent'
                    )}
                  >
                    <Droplets className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{tank.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{tank.property} - {tank.waterLevel}%</p>
                    </div>
                    <Edit3 className="w-3.5 h-3.5 text-neutral-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TankInput);
