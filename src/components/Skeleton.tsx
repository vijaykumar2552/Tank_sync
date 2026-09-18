import { cn } from '../lib/utils';

interface Props {
  className?: string;
  lines?: number;
}

export function Skeleton({ className, lines = 1 }: Props) {
  if (lines > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse"
            style={{ width: `${90 - i * 10}%` }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className={cn('h-4 rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse', className)} />
  );
}

export function CardSkeleton() {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="w-24 h-4" />
        <div className="w-12 h-12 rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
      </div>
      <Skeleton className="w-20 h-8" />
      <Skeleton className="w-16 h-3 mt-2" />
    </div>
  );
}
