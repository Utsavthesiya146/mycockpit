import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  badge,
  primaryAction,
  secondaryAction,
  className = ''
}) => {
  const PrimaryIcon = primaryAction?.icon;
  const SecondaryIcon = secondaryAction?.icon;

  return (
    <div className={`p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.1] bg-slate-50/50 dark:bg-slate-900/20 max-w-xl mx-auto my-6 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center text-[#D62839] dark:text-rose-400 mx-auto shadow-xs">
        <Icon className="w-6 h-6" />
      </div>

      <div className="mt-4 space-y-1.5">
        {badge && (
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {badge}
          </span>
        )}
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="cockpit-btn-primary flex items-center gap-2 py-2 px-4 text-xs font-semibold shadow-md shadow-[#D62839]/20"
            >
              {PrimaryIcon && <PrimaryIcon className="w-3.5 h-3.5" />}
              <span>{primaryAction.label}</span>
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="cockpit-btn-secondary flex items-center gap-2 py-2 px-4 text-xs font-semibold"
            >
              {SecondaryIcon && <SecondaryIcon className="w-3.5 h-3.5" />}
              <span>{secondaryAction.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

