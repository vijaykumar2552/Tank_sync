import { memo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, Menu, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { ROUTE_GROUPS } from '../constants/routes';

function SidebarComponent() {
  const unreadNotifications = useStore((s) => s.unreadNotifications);
  const tanks = useStore((s) => s.tanks);
  const activePumps = tanks.filter((t) => t.pumpStatus === 'ON').length;
  const alerts = tanks.filter((t) => t.leak || t.overflow || t.dryRun).length;
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <aside className="w-64 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 flex flex-col flex-shrink-0 overflow-y-auto border-r border-[#E5E7EB] dark:border-neutral-800 h-full">
      <div className="p-5 border-b border-[#E5E7EB] dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-neutral-900 dark:text-white font-bold text-lg tracking-tight">TankSync</h1>
            <p className="text-xs text-neutral-500">Smart Water Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
        {ROUTE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold text-neutral-400 dark:text-neutral-600 uppercase tracking-wider">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.routes.map((route) => {
                const Icon = route.icon;
                const badge = route.path === '/notifications' ? unreadNotifications : 0;
                return (
                  <NavLink
                    key={route.path}
                    to={route.path}
                    end={route.path === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'relative flex items-center gap-3 h-11 px-3 rounded-[11px] text-sm font-medium transition-colors duration-150',
                        isActive
                          ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-500'
                          : 'text-neutral-500 dark:text-neutral-400 hover:bg-[#F3F4F6] dark:hover:bg-neutral-800/80 hover:text-neutral-900 dark:hover:text-white'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active-indicator"
                            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary-500"
                            transition={{ type: 'spring', stiffness: 500, damping: 40, mass: 0.6 }}
                          />
                        )}
                        <Icon className="w-[18px] h-[18px] flex-shrink-0 transition-transform duration-150" />
                        <span className="flex-1">{route.label}</span>
                        {badge > 0 && (
                          <span className="bg-error-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold min-w-[20px] text-center">
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-[#E5E7EB] dark:border-neutral-800 space-y-2 bg-[#FAFAF8] dark:bg-neutral-925/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Active Pumps</span>
          <span className="text-success-600 dark:text-success-400 font-semibold">{activePumps}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Alerts</span>
          <span className={alerts > 0 ? 'text-error-600 dark:text-error-400 font-semibold' : 'text-neutral-400 font-semibold'}>
            {alerts}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Total Tanks</span>
          <span className="text-neutral-900 dark:text-white font-semibold">{tanks.length}</span>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-white text-neutral-700 shadow-md border border-[#E5E7EB]"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-0 h-full"
            >
              {navContent}
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="hidden lg:block">{navContent}</div>
    </>
  );
}

export const Sidebar = memo(SidebarComponent);
