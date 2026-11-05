import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`skeleton-shimmer rounded-xl bg-slate-200/70 dark:bg-white/[0.05] ${className}`} />
);

export const CockpitSkeletonCard: React.FC = () => (
  <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="w-24 h-4" />
      <Skeleton className="w-8 h-8 rounded-xl" />
    </div>
    <Skeleton className="w-32 h-8" />
    <Skeleton className="w-40 h-3" />
  </div>
);

export const CockpitSkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs overflow-hidden">
    <div className="p-4 border-b border-slate-200/90 dark:border-white/[0.08] flex items-center justify-between">
      <Skeleton className="w-36 h-5" />
      <Skeleton className="w-24 h-8 rounded-xl" />
    </div>
    <div className="divide-y divide-slate-200/80 dark:divide-white/[0.06]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <div className="space-y-1.5 flex-1 max-w-sm">
              <Skeleton className="w-3/4 h-4" />
              <Skeleton className="w-1/2 h-3" />
            </div>
          </div>
          <Skeleton className="w-20 h-6 rounded-full" />
          <Skeleton className="w-24 h-4" />
        </div>
      ))}
    </div>
  </div>
);

