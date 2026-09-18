import { useEffect, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, BellOff, Send } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDateTime, cn } from '../lib/utils';

function NotificationsPage() {
  const { notifications, unreadNotifications, markNotificationRead, markAllNotificationsRead, fetchNotifications } = useStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  const sourceColor = (source: string) => {
    if (source === 'Admin') return 'badge-info';
    if (source === 'API') return 'badge-success';
    if (source === 'Firebase') return 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-400';
    return 'badge-warning';
  };

  const sourceIcon = (source: string) => {
    if (source === 'Firebase') return <Send className="w-5 h-5" />;
    return <Bell className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Notifications</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{unreadNotifications} unread of {notifications.length} total</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilter('all')} className={cn('btn', filter === 'all' ? 'bg-primary-600 text-white' : 'btn-secondary')}>All</button>
            <button onClick={() => setFilter('unread')} className={cn('btn', filter === 'unread' ? 'bg-primary-600 text-white' : 'btn-secondary')}>Unread ({unreadNotifications})</button>
            {unreadNotifications > 0 && (
              <button onClick={markAllNotificationsRead} className="btn-success">
                <Check className="w-4 h-4" /> Mark all read
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <BellOff className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n, idx) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut', delay: Math.min(idx * 0.03, 0.5) }}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer',
                  n.isRead ? 'bg-neutral-50 dark:bg-neutral-800/30 border-neutral-200 dark:border-neutral-800' : 'bg-primary-50/50 dark:bg-primary-500/5 border-primary-200 dark:border-primary-500/20 hover:bg-primary-50 dark:hover:bg-primary-500/10'
                )}
                onClick={() => !n.isRead && markNotificationRead(n.id)}
              >
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  n.source === 'Admin' ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400' :
                  n.source === 'API' ? 'bg-success-100 dark:bg-success-500/20 text-success-600 dark:text-success-400' :
                  'bg-accent-100 dark:bg-accent-500/20 text-accent-600 dark:text-accent-400'
                )}>
                  {sourceIcon(n.source)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">{n.title}</p>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary-500" />}
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">{n.message}</p>
                  {(n.previousValue || n.newValue) && (
                    <div className="flex gap-3 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {n.previousValue && <span>Previous: {n.previousValue}%</span>}
                      {n.newValue && <span>Current: {n.newValue}%</span>}
                      <span>By: {n.updatedBy}</span>
                    </div>
                  )}
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{formatDateTime(n.timestamp)}</p>
                </div>
                <span className={cn('badge', sourceColor(n.source))}>{n.source}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(NotificationsPage);
