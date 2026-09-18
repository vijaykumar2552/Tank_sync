import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CardSkeleton } from './components/Skeleton';
import { useRealtime } from './hooks/useRealtime';
import { useFirebaseTanks } from './hooks/useFirebaseTanks';
import { useDemoMode } from './hooks/useDemoMode';
import { useAlertsEngine } from './lib/alertsEngine';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AIInsights = lazy(() => import('./pages/AIInsights'));
const Tanks = lazy(() => import('./pages/Tanks'));
const Devices = lazy(() => import('./pages/Devices'));
const PumpControls = lazy(() => import('./pages/PumpControls'));
const Reports = lazy(() => import('./pages/Reports'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const SettingsPage = lazy(() => import('./pages/Settings'));

function PageFallback() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
    </div>
  );
}

export default function App() {
  useRealtime();
  useFirebaseTanks();
  useDemoMode();
  useAlertsEngine();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Suspense fallback={<PageFallback />}>
                <Routes location={location}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/ai-insights" element={<AIInsights />} />
                  <Route path="/tanks" element={<Tanks />} />
                  <Route path="/devices" element={<Devices />} />
                  <Route path="/pump-controls" element={<PumpControls />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/audit-logs" element={<AuditLogs />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
