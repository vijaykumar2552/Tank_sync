import { motion } from 'framer-motion';
import { Droplets } from 'lucide-react';

export function LoadingSplash() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-14 h-14 rounded-2xl bg-primary-500 flex items-center justify-center"
        >
          <Droplets className="w-7 h-7 text-white" />
        </motion.div>
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm font-medium text-neutral-500 dark:text-neutral-400"
        >
          Loading TankSync...
        </motion.p>
      </motion.div>
    </div>
  );
}
