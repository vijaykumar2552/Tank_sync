import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Settings as SettingsIcon, Webhook, Code, Save, CheckCircle2, Check,
  Database, Plug, PlugZap, Power, RotateCcw, AlertCircle, Loader2,
  RefreshCw, Wifi, WifiOff, FlaskConical, Undo2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirebaseConfig } from '../context/FirebaseContext';
import { validateConfig } from '../lib/firebase';
import type { FirebaseConfig } from '../types';
import { DEFAULT_CONFIG } from '../constants/config';
import { ConfigField } from '../components/ConfigField';
import { Switch } from '../components/Switch';
import { ConnectionStatusIndicator } from '../components/ConnectionStatus';
import { cn } from '../lib/utils';

export default function SettingsPage() {
  const {
    config, hasConfig, configSource, missingEnvVars, hasSavedConfig,
    status, lastSync, latency, reconnectAttempts, projectName,
    isDemoMode, saveAndConnect, useSavedConfig, disconnect, testConnection,
    resetConfig, restoreDefaults, setDemoMode,
  } = useFirebaseConfig();

  // Purely local form state — zero typing lag, no global state updates while typing
  const [form, setForm] = useState<FirebaseConfig>(config);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);

  const errors = useMemo(() => validateConfig(form), [form]);
  const hasErrors = errors.length > 0;

  useEffect(() => {
    setForm(config);
  }, [config]);

  const updateField = useCallback((field: keyof FirebaseConfig, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  }, []);

  const handleSave = useCallback(() => {
    if (hasErrors) return;
    setSaving(true);
    saveAndConnect(form);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 500);
  }, [form, hasErrors, saveAndConnect]);

  const handleTest = useCallback(async () => {
    if (hasErrors) return;
    setTesting(true);
    setTestResult(null);
    const result = await testConnection(form);
    setTestResult(result);
    setTesting(false);
  }, [form, hasErrors, testConnection]);

  const handleReset = useCallback(() => {
    setForm(DEFAULT_CONFIG);
    setTestResult(null);
    resetConfig();
  }, [resetConfig]);

  const handleRestoreDefaults = useCallback(() => {
    restoreDefaults();
    setForm(config);
    setTestResult(null);
  }, [restoreDefaults, config]);

  const handleUseSaved = useCallback(() => {
    useSavedConfig();
    setTestResult(null);
  }, [useSavedConfig]);

  const handleGeneralSave = () => {
    setGeneralSaved(true);
    setTimeout(() => setGeneralSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Firebase Settings Manager */}
      <div className="card">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary-600 dark:text-primary-400" /> Firebase Realtime Database
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Configure ESP32 telemetry sync via Firebase Realtime Database
            </p>
          </div>
          <ConnectionStatusIndicator />
        </div>

        {/* Status bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatusMetric label="Status" value={status === 'connected' ? 'Connected' : status === 'demo' ? 'Demo' : status === 'connecting' ? 'Connecting' : status === 'reconnecting' ? 'Reconnecting' : 'Offline'} icon={status === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />} color={status === 'connected' ? 'success' : status === 'demo' ? 'accent' : 'neutral'} />
          <StatusMetric label="Project" value={hasConfig ? projectName : 'Not set'} icon={<Database className="w-4 h-4" />} color="primary" />
          <StatusMetric label="Latency" value={latency !== null ? `${latency}ms` : '—'} icon={<RefreshCw className="w-4 h-4" />} color="accent" />
          <StatusMetric label="Last Sync" value={lastSync ? lastSync.toLocaleTimeString() : '—'} icon={<CheckCircle2 className="w-4 h-4" />} color="neutral" />
        </div>

        {configSource === 'env' && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-primary-50 dark:bg-primary-500/10 rounded-xl text-sm text-primary-700 dark:text-primary-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Firebase credentials are loaded from environment variables (.env). This takes precedence — saving a different config below won't take effect while .env is fully set.</span>
          </div>
        )}

        {configSource === 'saved' && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-accent-50 dark:bg-accent-500/10 rounded-xl text-sm text-accent-700 dark:text-accent-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Using a configuration saved in this browser (not from .env). It was activated explicitly and won't change on its own.</span>
          </div>
        )}

        {configSource === 'none' && missingEnvVars.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-warning-50 dark:bg-warning-500/10 rounded-xl">
            <div className="flex items-start gap-2 text-sm text-warning-700 dark:text-warning-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Firebase environment config is incomplete — missing:</p>
                <ul className="list-disc list-inside mt-1 font-mono text-xs">
                  {missingEnvVars.map((v) => <li key={v}>{v}</li>)}
                </ul>
                <p className="mt-2">Set these in <code className="font-mono">.env</code> at the project root and restart the dev server. Values themselves are never shown here.</p>
              </div>
            </div>
            {hasSavedConfig && (
              <div className="mt-3 flex items-center gap-2">
                <button onClick={handleUseSaved} className="btn-secondary text-xs py-1.5">
                  <Undo2 className="w-3.5 h-3.5" /> Use previously saved configuration
                </button>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">A config was saved here before but is not active until you choose to use it.</span>
              </div>
            )}
          </div>
        )}

        {/* Config fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConfigField label="API Key" value={form.apiKey} onChange={(v) => updateField('apiKey', v)} placeholder="AIzaSy..." helperText="From Firebase Console > Project Settings > Web API Key" />
          <ConfigField label="Auth Domain" value={form.authDomain} onChange={(v) => updateField('authDomain', v)} placeholder="your-project.firebaseapp.com" helperText="Firebase auth domain" />
          <ConfigField label="Database URL" value={form.databaseURL} onChange={(v) => updateField('databaseURL', v)} placeholder="https://your-project-default-rtdb.firebaseio.com" helperText="Must start with https://" />
          <ConfigField label="Project ID" value={form.projectId} onChange={(v) => updateField('projectId', v)} placeholder="your-project-id" helperText="Firebase project identifier" />
          <ConfigField label="Storage Bucket" value={form.storageBucket} onChange={(v) => updateField('storageBucket', v)} placeholder="your-project.appspot.com" helperText="Optional — for file storage" />
          <ConfigField label="Messaging Sender ID" value={form.messagingSenderId} onChange={(v) => updateField('messagingSenderId', v)} placeholder="123456789012" helperText="From Firebase Console > Cloud Messaging" />
          <ConfigField label="App ID" value={form.appId} onChange={(v) => updateField('appId', v)} placeholder="1:1234:web:abc123" helperText="From Firebase Console > Project Settings > General" />
          <ConfigField label="Measurement ID" value={form.measurementId} onChange={(v) => updateField('measurementId', v)} placeholder="G-XXXXXXXXXX" helperText="Optional — enables Analytics only; never blocks Auth or Database" />
          <ConfigField label="Telemetry Path" value={form.telemetryPath} onChange={(v) => updateField('telemetryPath', v)} placeholder="/tanks" helperText="Firebase path where ESP32 writes tank data" />
        </div>

        {hasErrors && (
          <div className="mt-4 flex items-start gap-2 px-4 py-3 bg-error-50 dark:bg-error-500/10 rounded-xl">
            <AlertCircle className="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-error-600 dark:text-error-400">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          </div>
        )}

        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium',
              testResult.ok
                ? 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400'
                : 'bg-error-50 dark:bg-error-500/10 text-error-600 dark:text-error-400'
            )}
          >
            {testResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {testResult.message}
          </motion.div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mt-6">
          <button onClick={handleSave} disabled={hasErrors || saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save & Connect'}
          </button>
          <button onClick={handleTest} disabled={hasErrors || testing} className="btn-secondary">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            Test Connection
          </button>
          {hasConfig && (
            <button onClick={disconnect} className="btn-secondary text-error-600 dark:text-error-400">
              <Power className="w-4 h-4" /> Disconnect
            </button>
          )}
          <button onClick={handleReset} className="btn-secondary" title="Clears any saved Settings configuration from this browser and re-checks .env">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button onClick={handleRestoreDefaults} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Restore Defaults
          </button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-neutral-700">
            {isDemoMode ? <PlugZap className="w-4 h-4 text-primary-500" /> : <Plug className="w-4 h-4 text-neutral-400" />}
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Demo Mode</span>
            <Switch checked={isDemoMode} onChange={(v) => setDemoMode(v)} label="Toggle demo mode" />
          </div>
          <AnimatePresence>
            {saved && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5 text-success-600 dark:text-success-400 font-medium text-sm self-center"
              >
                <CheckCircle2 className="w-4 h-4" /> Saved &amp; connected
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* ESP32 Payload Schema */}
        <div className="mt-6 bg-primary-50 dark:bg-primary-500/10 rounded-xl p-4">
          <p className="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-2">ESP32 Sensor Payload Schema</p>
          <div className="bg-neutral-900 rounded-lg p-3 overflow-x-auto">
            <pre className="text-xs text-primary-200 font-mono">{`{
  "tanks": {
    "Main": {
      "waterLevel": 80,
      "pumpStatus": "ON",
      "lastUpdated": "2026-07-30T17:45:00Z"
    }
  }
}`}</pre>
          </div>
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-2">
            The ESP32 writes each tank under <code className="font-mono">/tanks/&lt;TankName&gt;</code>. Optional fields: <code className="font-mono">battery</code>, <code className="font-mono">temperature</code>.
          </p>
        </div>
      </div>

      {/* Remaining settings in grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary-600 dark:text-primary-400" /> Firebase REST API
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label">Database REST Endpoint</label>
              <input className="input bg-neutral-50 dark:bg-neutral-800/50" readOnly value={`${config.databaseURL}/tanks.json`} />
            </div>
            <div>
              <label className="label">Auth Method</label>
              <input className="input bg-neutral-50 dark:bg-neutral-800/50" readOnly value="Firebase Realtime Database access rules" />
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/30 rounded-xl p-4">
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Available Paths</p>
              <div className="space-y-1.5 text-sm font-mono text-neutral-600 dark:text-neutral-400">
                <div><span className="badge-info mr-2">GET</span>/tanks.json</div>
                <div><span className="badge-success mr-2">PUT</span>/tanks/&lt;id&gt;.json</div>
                <div><span className="badge-success mr-2">PATCH</span>/tanks/&lt;id&gt;.json</div>
                <div><span className="badge-warning mr-2">POST</span>/tanks.json</div>
                <div><span className="badge-error mr-2">DEL</span>/tanks/&lt;id&gt;.json</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <Code className="w-5 h-5 text-accent-600 dark:text-accent-400" /> Firebase Integration Example
          </h3>
          <div className="bg-neutral-900 rounded-xl p-4 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">{`import { getDatabase, ref, update } from 'firebase/database';

const db = getDatabase();
await update(ref(db, 'tanks/tank_1'), {
  waterLevel: 73,
  pumpStatus: 'ON',
  lastUpdated: Date.now()
});`}</pre>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" /> General Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Default Tank Shape</label>
              <select className="input"><option>Vertical Cylinder</option><option>Rectangle</option><option>Circle</option></select>
            </div>
            <div>
              <label className="label">Low Level Alert Threshold (%)</label>
              <input type="number" className="input" defaultValue={20} />
            </div>
            <div>
              <label className="label">High Level Alert Threshold (%)</label>
              <input type="number" className="input" defaultValue={90} />
            </div>
            <div>
              <label className="label">Low Battery Alert Threshold (%)</label>
              <input type="number" className="input" defaultValue={20} />
            </div>
          </div>
          <div className="mt-4">
            <button onClick={handleGeneralSave} className="btn-primary">
              <Save className="w-4 h-4" /> Save Settings
            </button>
            {generalSaved && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center gap-1.5 ml-3 text-success-600 dark:text-success-400 font-medium text-sm"
              >
                <CheckCircle2 className="w-4 h-4" /> Settings saved
              </motion.span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusMetric({ label, value, icon, color }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'error' | 'accent' | 'neutral';
}) {
  const colors = {
    primary: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10',
    success: 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-500/10',
    warning: 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-500/10',
    error: 'text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-500/10',
    accent: 'text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-500/10',
    neutral: 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/50',
  };
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', colors[color])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{value}</p>
      </div>
    </div>
  );
}
