import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Radio, CheckCircle2, XCircle, Loader2, HelpCircle, Copy, Check } from 'lucide-react';
import { ref, get } from 'firebase/database';
import { getFirebaseDb } from '../lib/firebase';
import { useFirebaseConfig } from '../context/FirebaseContext';
import { FIREBASE_PATHS } from '../constants/firebasePaths';
import { isApiConfigured } from '../lib/apiAdapter';
import { cn } from '../lib/utils';

export type DataSource = 'firebase' | 'api';

export interface DeviceProfile {
  deviceId: string;
  deviceName: string;
  tankId: string;
  property: string;
  dataSource: DataSource;
  apiEndpoint: string;
  readingIntervalSec: number;
  sensors: string[];
  createdAt: number;
}

const STORAGE_KEY = 'tanksync_device_profiles';

const SENSOR_OPTIONS = [
  { key: 'waterLevel', label: 'Water Level' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'humidity', label: 'Humidity' },
  { key: 'flowRate', label: 'Flow' },
  { key: 'battery', label: 'Battery' },
  { key: 'signal', label: 'Signal' },
  { key: 'pumpStatus', label: 'Pump' },
  { key: 'leak', label: 'Leak' },
];

export function loadDeviceProfiles(): DeviceProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DeviceProfile[]) : [];
  } catch {
    return [];
  }
}

function saveDeviceProfiles(profiles: DeviceProfile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    /* localStorage unavailable — profile just won't persist across sessions */
  }
}

type TestStatus = 'idle' | 'connecting' | 'connected' | 'failed' | 'not-configured' | 'no-data' | 'stale-data';

const STALE_MS = 15 * 60 * 1000;

const STATUS_CONFIG: Record<TestStatus, { label: string; className: string }> = {
  idle: { label: 'Not tested yet', className: 'badge-neutral' },
  connecting: { label: 'Connecting…', className: 'badge-info' },
  connected: { label: 'Connected', className: 'badge-success' },
  failed: { label: 'Failed', className: 'badge-error' },
  'not-configured': { label: 'Not Configured', className: 'badge-warning' },
  'no-data': { label: 'No Data Yet', className: 'badge-warning' },
  'stale-data': { label: 'Stale Data', className: 'badge-warning' },
};

interface Props {
  onClose: () => void;
  existingTankIds: string[];
}

export function DeviceConnect({ onClose, existingTankIds }: Props) {
  const { hasConfig, isDemoMode } = useFirebaseConfig();
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [tankId, setTankId] = useState(existingTankIds[0] || '');
  const [property, setProperty] = useState('');
  const [dataSource, setDataSource] = useState<DataSource>('firebase');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [readingInterval, setReadingInterval] = useState(30);
  const [sensors, setSensors] = useState<string[]>(['waterLevel', 'battery', 'signal']);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [copied, setCopied] = useState(false);
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);

  useEffect(() => {
    setProfiles(loadDeviceProfiles());
  }, []);

  const toggleSensor = useCallback((key: string) => {
    setSensors((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }, []);

  const effectiveTankId = tankId || deviceId || 'YOUR_TANK_ID';

  const examplePayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    if (sensors.includes('waterLevel')) payload.waterLevel = 68;
    if (sensors.includes('temperature')) payload.temperature = 27.5;
    if (sensors.includes('humidity')) payload.humidity = 52;
    if (sensors.includes('flowRate')) payload.flowRate = 3.2;
    if (sensors.includes('battery')) { payload.battery = 82; payload.batteryVoltage = 3.9; }
    if (sensors.includes('signal')) payload.signal = 90;
    if (sensors.includes('pumpStatus')) payload.pumpStatus = 'OFF';
    if (sensors.includes('leak')) payload.leak = false;
    payload.lastUpdated = Date.now();
    return payload;
  }, [sensors]);

  const firebasePath = `${FIREBASE_PATHS.tanks}/${effectiveTankId}`;
  const payloadJson = JSON.stringify(examplePayload, null, 2);

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(firebasePath).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [firebasePath]);

  const handleTestConnection = useCallback(async () => {
    if (dataSource === 'api') {
      setTestStatus(isApiConfigured() ? 'connecting' : 'not-configured');
      if (!isApiConfigured()) return;
      try {
        const res = await fetch(`${apiEndpoint || ''}`, { method: 'HEAD' }).catch(() => null);
        setTestStatus(res && res.ok ? 'connected' : 'failed');
      } catch {
        setTestStatus('failed');
      }
      return;
    }

    if (isDemoMode) {
      setTestStatus('not-configured');
      return;
    }
    if (!hasConfig) {
      setTestStatus('not-configured');
      return;
    }
    setTestStatus('connecting');
    try {
      const database = getFirebaseDb();
      if (!database) {
        setTestStatus('failed');
        return;
      }
      const snap = await get(ref(database, `${FIREBASE_PATHS.tanks}/${effectiveTankId}`));
      const val = snap.val() as { lastUpdated?: number } | null;
      if (!val) {
        setTestStatus('no-data');
        return;
      }
      if (val.lastUpdated && Date.now() - val.lastUpdated > STALE_MS) {
        setTestStatus('stale-data');
        return;
      }
      setTestStatus('connected');
    } catch {
      setTestStatus('failed');
    }
  }, [dataSource, apiEndpoint, isDemoMode, hasConfig, effectiveTankId]);

  const handleSaveProfile = useCallback(() => {
    if (!deviceId.trim()) return;
    const profile: DeviceProfile = {
      deviceId: deviceId.trim(), deviceName: deviceName.trim() || deviceId.trim(),
      tankId: effectiveTankId, property: property.trim(), dataSource, apiEndpoint,
      readingIntervalSec: readingInterval, sensors, createdAt: Date.now(),
    };
    const next = [profile, ...profiles.filter((p) => p.deviceId !== profile.deviceId)];
    setProfiles(next);
    saveDeviceProfiles(next);
  }, [deviceId, deviceName, effectiveTankId, property, dataSource, apiEndpoint, readingInterval, sensors, profiles]);

  const handleDeleteProfile = useCallback((id: string) => {
    const next = profiles.filter((p) => p.deviceId !== id);
    setProfiles(next);
    saveDeviceProfiles(next);
  }, [profiles]);

  const status = STATUS_CONFIG[testStatus];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.98, opacity: 0, y: 6 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.98, opacity: 0, y: 6 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="card max-w-2xl w-full max-h-[85vh] overflow-y-auto bg-white dark:bg-neutral-900"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Connect a Sensor / Device</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Device ID</label>
              <input className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="ESP32_001" />
            </div>
            <div>
              <label className="label">Device Name</label>
              <input className="input" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="Rooftop Sensor" />
            </div>
            <div>
              <label className="label">Tank</label>
              {existingTankIds.length > 0 ? (
                <select className="input" value={tankId} onChange={(e) => setTankId(e.target.value)}>
                  <option value="">Use Device ID as Tank ID</option>
                  {existingTankIds.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              ) : (
                <input className="input" value={tankId} onChange={(e) => setTankId(e.target.value)} placeholder="TANK001" />
              )}
            </div>
            <div>
              <label className="label">Property</label>
              <input className="input" value={property} onChange={(e) => setProperty(e.target.value)} placeholder="Home" />
            </div>
            <div>
              <label className="label">Data Source</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDataSource('firebase')}
                  className={cn('btn flex-1', dataSource === 'firebase' ? 'bg-primary-600 text-white' : 'btn-secondary')}
                >
                  Firebase
                </button>
                <button
                  onClick={() => setDataSource('api')}
                  className={cn('btn flex-1', dataSource === 'api' ? 'bg-primary-600 text-white' : 'btn-secondary')}
                  title={isApiConfigured() ? '' : 'Requires VITE_API_BASE_URL and a real backend'}
                >
                  REST API {!isApiConfigured() && '(not configured)'}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Reading Interval (seconds)</label>
              <input type="number" min={1} className="input" value={readingInterval} onChange={(e) => setReadingInterval(Number(e.target.value) || 30)} />
            </div>
            {dataSource === 'api' && (
              <div className="sm:col-span-2">
                <label className="label">API Endpoint</label>
                <input className="input" value={apiEndpoint} onChange={(e) => setApiEndpoint(e.target.value)} placeholder="https://your-backend.example.com/api/tanks" />
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="label">Sensor Types</label>
            <div className="flex flex-wrap gap-2">
              {SENSOR_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => toggleSensor(s.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    sensors.includes(s.key)
                      ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-500/10 dark:border-primary-500/40 dark:text-primary-300'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {dataSource === 'firebase' && (
            <div className="bg-neutral-50 dark:bg-neutral-800/30 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Firebase Path Your ESP32 Should Write To</p>
                <button onClick={handleCopyPath} className="text-xs flex items-center gap-1 text-primary-600 dark:text-primary-400">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copy
                </button>
              </div>
              <code className="block text-sm font-mono text-primary-700 dark:text-primary-400 mb-3">{firebasePath}</code>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Example payload (only the fields you selected above; missing fields safely default):</p>
              <pre className="bg-neutral-900 text-accent-300 text-xs font-mono rounded-lg p-3 overflow-x-auto">{payloadJson}</pre>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 flex items-start gap-1">
                <HelpCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Your firmware doesn't have to use these exact field names — see the sensor field aliases documented in <code>src/lib/sensorAdapter.ts</code> and the README.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <button onClick={handleTestConnection} className="btn-secondary" disabled={testStatus === 'connecting'}>
              {testStatus === 'connecting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
              Test Connection
            </button>
            <span className={cn('badge flex items-center gap-1', status.className)}>
              {testStatus === 'connected' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {(testStatus === 'failed' || testStatus === 'not-configured') && <XCircle className="w-3.5 h-3.5" />}
              {status.label}
            </span>
          </div>

          <div className="flex justify-end gap-3 mb-6">
            <button onClick={onClose} className="btn-secondary">Close</button>
            <button onClick={handleSaveProfile} disabled={!deviceId.trim()} className="btn-success disabled:opacity-50">
              Save Device Profile
            </button>
          </div>

          {profiles.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                Saved Device Profiles <span className="text-xs font-normal text-neutral-400">(stored in this browser only)</span>
              </p>
              <div className="space-y-2">
                {profiles.map((p) => (
                  <div key={p.deviceId} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-sm">
                    <div>
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">{p.deviceName}</span>
                      <span className="text-neutral-400 mx-1.5">·</span>
                      <span className="text-neutral-500 dark:text-neutral-400">Tank {p.tankId}</span>
                      <span className="text-neutral-400 mx-1.5">·</span>
                      <span className="text-neutral-500 dark:text-neutral-400">{p.dataSource}</span>
                    </div>
                    <button onClick={() => handleDeleteProfile(p.deviceId)} className="text-error-500 hover:text-error-600 text-xs">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
