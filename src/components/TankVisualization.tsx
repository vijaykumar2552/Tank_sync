import { memo } from 'react';
import { motion } from 'framer-motion';
import type { Tank } from '../types';
import { getLevelBg } from '../lib/utils';

interface Props {
  tank: Tank;
  size?: 'sm' | 'md' | 'lg';
}

function TankVisualizationComponent({ tank, size = 'md' }: Props) {
  const pct = Math.max(0, Math.min(100, tank.waterLevel));
  const dims = {
    sm: { w: 120, h: 140 },
    md: { w: 180, h: 220 },
    lg: { w: 240, h: 280 },
  }[size];

  const waterHeight = (pct / 100) * (dims.h - 20);

  if (tank.shape === 'Custom Image' && tank.customImageUrl) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative overflow-hidden rounded-2xl" style={{ width: dims.w, height: dims.h }}>
          <img src={tank.customImageUrl} alt={tank.name} className="w-full h-full object-cover rounded-2xl" />
          <div
            className="absolute bottom-0 left-0 right-0 water-fill water-wave"
            style={{
              height: `${pct}%`,
              background: pct >= 75 ? 'rgba(34,197,94,0.55)' : pct >= 40 ? 'rgba(251,191,36,0.55)' : 'rgba(239,68,68,0.55)',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white drop-shadow-lg">{pct}%</span>
          </div>
        </div>
        <div className="text-center">
          <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{pct}%</span>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {tank.currentWater} / {tank.capacity} L
          </p>
        </div>
      </div>
    );
  }

  const renderShape = () => {
    switch (tank.shape) {
      case 'Circle':
      case 'Vertical Cylinder':
        return (
          <div className="relative rounded-full border-4 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden" style={{ width: dims.w, height: dims.h }}>
            <div className="absolute bottom-0 left-0 right-0 water-fill" style={{ height: waterHeight }}>
              <div className={`absolute inset-0 ${getLevelBg(pct)} opacity-80`} />
              <motion.div
                className={`absolute bottom-0 left-0 right-0 h-2 ${getLevelBg(pct)}`}
                animate={{ y: [-2, 2, -2] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="absolute inset-0 water-wave opacity-30" />
            </div>
          </div>
        );

      case 'Horizontal Cylinder':
        return (
          <div className="relative rounded-3xl border-4 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden" style={{ width: dims.w, height: dims.h * 0.6 }}>
            <div className="absolute bottom-0 left-0 right-0 water-fill" style={{ height: (pct / 100) * (dims.h * 0.6 - 8) }}>
              <div className={`absolute inset-0 ${getLevelBg(pct)} opacity-80`} />
              <div className="absolute inset-0 water-wave opacity-30" />
            </div>
          </div>
        );

      case 'Square':
        return (
          <div className="relative border-4 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden" style={{ width: dims.w * 0.85, height: dims.w * 0.85 }}>
            <div className="absolute bottom-0 left-0 right-0 water-fill" style={{ height: (pct / 100) * (dims.w * 0.85 - 8) }}>
              <div className={`absolute inset-0 ${getLevelBg(pct)} opacity-80`} />
              <motion.div
                className={`absolute bottom-0 left-0 right-0 h-2 ${getLevelBg(pct)}`}
                animate={{ y: [-2, 2, -2] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="absolute inset-0 water-wave opacity-30" />
            </div>
          </div>
        );

      case 'Rectangle':
      default:
        return (
          <div className="relative rounded-xl border-4 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden" style={{ width: dims.w, height: dims.h }}>
            <div className="absolute bottom-0 left-0 right-0 water-fill" style={{ height: waterHeight }}>
              <div className={`absolute inset-0 ${getLevelBg(pct)} opacity-80`} />
              <motion.div
                className={`absolute bottom-0 left-0 right-0 h-2 ${getLevelBg(pct)}`}
                animate={{ y: [-2, 2, -2] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="absolute inset-0 water-wave opacity-30" />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {renderShape()}
      <div className="text-center">
        <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{pct}%</span>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {tank.currentWater} / {tank.capacity} L
        </p>
      </div>
    </div>
  );
}

export const TankVisualization = memo(TankVisualizationComponent);
