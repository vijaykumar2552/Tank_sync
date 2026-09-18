import { memo } from 'react';
import { cn } from '../lib/utils';
import { useFirebaseConfig } from '../context/FirebaseContext';
import type { ConnectionStatus } from '../types';

const statusConfig: Record<ConnectionStatus, { dot: string; text: string; bg: string; label: string }> = {
  connected: { dot: 'bg-success-500', text: 'text-success-700 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-500/10', label: 'Connected' },
  connecting: { dot: 'bg-warning-500 animate-pulse', text: 'text-warning-700 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-500/10', label: 'Connecting...' },
  reconnecting: { dot: 'bg-warning-600 animate-pulse', text: 'text-warning-700 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-500/10', label: 'Reconnecting...' },
  offline: { dot: 'bg-neutral-400', text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800/50', label: 'Offline' },
  demo: { dot: 'bg-accent-500 animate-pulse', text: 'text-accent-700 dark:text-accent-400', bg: 'bg-accent-50 dark:bg-accent-500/10', label: 'Demo Mode' },
};

function ConnectionStatusIndicatorComponent({ compact = false }: { compact?: boolean }) {
  const { status, projectName, latency, lastSync, reconnectAttempts } = useFirebaseConfig();
  const cfg = statusConfig[status];

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors', cfg.bg)} title={`Firebase: ${cfg.label}${projectName ? ' - ' + projectName : ''}`}>
        <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
        <span className={cn('text-sm font-medium whitespace-nowrap', cfg.text)}>
          {compact && status === 'connected' ? 'Live' : cfg.label}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl', cfg.bg)}>
      <div className={cn('w-2.5 h-2.5 rounded-full', cfg.dot)} />
      <div className="min-w-0">
        <p className={cn('text-sm font-semibold', cfg.text)}>{cfg.label}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
          {projectName}
          {latency !== null && ` - ${latency}ms`}
          {reconnectAttempts > 0 && ` - retries: ${reconnectAttempts}`}
        </p>
      </div>
    </div>
  );
}

export const ConnectionStatusIndicator = memo(ConnectionStatusIndicatorComponent);
