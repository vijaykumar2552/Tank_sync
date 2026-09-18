import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-[180ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed',
        checked ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700'
      )}
    >
      <motion.span
        className="inline-block h-4 w-4 rounded-full bg-white shadow"
        animate={{ x: checked ? 22 : 4 }}
        transition={{ type: 'tween', duration: 0.18, ease: 'easeInOut' }}
      />
    </button>
  );
}
