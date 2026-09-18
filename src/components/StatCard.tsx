import { memo } from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  label: string;
  value: number;
  icon: LucideIcon;
  trend?: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'accent' | 'neutral';
  suffix?: string;
  index?: number;
}

function StatCardComponent({ label, value, icon: Icon, trend, color = 'primary', suffix, index = 0 }: Props) {
  const colorClasses = {
    primary: { text: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-500/10' },
    success: { text: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-500/10' },
    warning: { text: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-500/10' },
    error: { text: 'text-error-600 dark:text-error-400', bg: 'bg-error-50 dark:bg-error-500/10' },
    accent: { text: 'text-accent-600 dark:text-accent-400', bg: 'bg-accent-50 dark:bg-accent-500/10' },
    neutral: { text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800' },
  };

  const c = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: Math.min(index, 3) * 0.05 }}
      whileHover={{ y: -2 }}
      className="card transition-shadow duration-[180ms] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:border-neutral-300 dark:hover:border-neutral-700"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{label}</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            <AnimatedNumber value={value} suffix={suffix} />
          </p>
          {trend && <p className={cn('text-xs mt-1', c.text)}>{trend}</p>}
        </div>
        <motion.div whileHover={{ y: -1 }} className={cn('w-12 h-12 rounded-xl flex items-center justify-center', c.bg)}>
          <Icon className={cn('w-6 h-6', c.text)} />
        </motion.div>
      </div>
    </motion.div>
  );
}

export const StatCard = memo(StatCardComponent);
