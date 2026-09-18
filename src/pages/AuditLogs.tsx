import { useEffect, useState, memo } from 'react';
import { Activity, User, Phone } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { AuditLog } from '../types';
import { formatDateTime, cn } from '../lib/utils';

function AuditLogs() {
  const { auditLogs, fetchAuditLogs } = useStore();
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');

  useEffect(() => {
    (async () => {
      await fetchAuditLogs();
      setLoading(false);
    })();
  }, [fetchAuditLogs]);

  const filtered = sourceFilter === 'all' ? auditLogs : auditLogs.filter((l) => l.source === sourceFilter);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Audit Logs</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{filtered.length} entries - permanent record</p>
          </div>
          <select className="input w-auto" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">All Sources</option>
            <option value="Admin">Admin</option>
            <option value="API">API</option>
            <option value="Firebase">Firebase</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-neutral-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-neutral-400">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No audit logs yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                <tr>
                  {['Date / Time', 'User', 'Source', 'Action', 'Tank', 'Property', 'Details'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left font-semibold text-neutral-700 dark:text-neutral-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id} className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                    <td className="px-3 py-2.5 whitespace-nowrap text-neutral-600 dark:text-neutral-400">{formatDateTime(log.timestamp)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">{log.userName}</span>
                      </div>
                      {log.phoneNumber && (
                        <div className="flex items-center gap-1 text-xs text-neutral-400 mt-0.5">
                          <Phone className="w-3 h-3" /> {log.phoneNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('badge',
                        log.source === 'Admin' ? 'badge-info' :
                        log.source === 'API' ? 'badge-success' :
                        log.source === 'Firebase' ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-400' :
                        'badge-warning'
                      )}>{log.source}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('badge', log.action === 'DELETE' ? 'badge-error' : log.action === 'CREATE' ? 'badge-success' : 'badge-info')}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-700 dark:text-neutral-300">{log.name}</td>
                    <td className="px-3 py-2.5 text-neutral-600 dark:text-neutral-400">{log.property}</td>
                    <td className="px-3 py-2.5 text-neutral-500 dark:text-neutral-400 text-xs max-w-xs truncate">{log.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(AuditLogs);
