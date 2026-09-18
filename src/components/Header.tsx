import { memo, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useFirebaseConfig } from '../context/FirebaseContext';
import { ConnectionStatusIndicator } from './ConnectionStatus';
import { ThemeToggle } from './ThemeToggle';
import { ProfileDropdown } from './ProfileDropdown';
import { getRouteLabel } from '../constants/routes';

function HeaderComponent() {
  const location = useLocation();
  const { unreadNotifications, sourceToasts, dismissSourceToast } = useStore();
  const { hasConfig, status } = useFirebaseConfig();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const pageTitle = getRouteLabel(location.pathname);
  const isLive = status === 'connected';

  return (
    <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200/60 dark:border-neutral-800 px-6 py-4 pl-16 lg:pl-6 flex items-center justify-between flex-shrink-0 flex-wrap gap-y-2">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 truncate">{pageTitle}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 hidden sm:block">
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
        {hasConfig && <ConnectionStatusIndicator compact />}
        <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors ${isLive ? 'bg-success-50 dark:bg-success-500/10' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-success-500' : 'bg-neutral-400'}`} />
          <span className={`text-sm font-medium ${isLive ? 'text-success-700 dark:text-success-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
            {isLive ? 'Real-time' : 'Offline'}
          </span>
        </div>
        <ThemeToggle />
        <NavLink to="/notifications" className="relative p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" aria-label="Notifications">
          <Bell className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 bg-error-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
              {unreadNotifications}
            </span>
          )}
        </NavLink>
        <ProfileDropdown />
      </div>

      <AnimatePresence>
        {sourceToasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 right-8 z-50 bg-white dark:bg-neutral-900 border border-info-200 dark:border-info-500/30 rounded-2xl shadow-lg p-4 flex items-center gap-3 max-w-md cursor-pointer"
            onClick={() => dismissSourceToast(toast.id)}
          >
            <div className="w-10 h-10 rounded-xl bg-info-50 dark:bg-info-500/10 flex items-center justify-center flex-shrink-0">
              <Send className="w-5 h-5 text-info-600 dark:text-info-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm flex items-center gap-1.5 text-neutral-900 dark:text-neutral-100">
                {toast.source} Update
                <span className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded-full">{toast.tankName}</span>
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{toast.message}</p>
            </div>
            <X className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          </motion.div>
        ))}
      </AnimatePresence>
    </header>
  );
}

export const Header = memo(HeaderComponent);
