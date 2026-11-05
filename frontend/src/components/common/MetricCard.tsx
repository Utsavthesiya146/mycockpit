import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  colorScheme?: 'red' | 'emerald' | 'amber' | 'neutral' | 'indigo' | 'blue';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
  colorScheme = 'red',
  action
}) => {
  const colorMap = {
    red: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-900/50',
      text: 'text-[#D62839] dark:text-rose-400',
      glow: 'group-hover:border-rose-300 dark:group-hover:border-rose-700/60'
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-900/50',
      text: 'text-emerald-600 dark:text-emerald-400',
      glow: 'group-hover:border-emerald-300 dark:group-hover:border-emerald-700/60'
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-900/50',
      text: 'text-amber-600 dark:text-amber-400',
      glow: 'group-hover:border-amber-300 dark:group-hover:border-amber-700/60'
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-200 dark:border-blue-900/50',
      text: 'text-blue-600 dark:text-blue-400',
      glow: 'group-hover:border-blue-300 dark:group-hover:border-blue-700/60'
    },
    neutral: {
      bg: 'bg-slate-50 dark:bg-slate-800/40',
      border: 'border-slate-200 dark:border-slate-700/50',
      text: 'text-slate-600 dark:text-slate-400',
      glow: 'group-hover:border-slate-300 dark:group-hover:border-slate-600'
    },
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-200 dark:border-indigo-900/50',
      text: 'text-indigo-600 dark:text-indigo-400',
      glow: 'group-hover:border-indigo-300 dark:group-hover:border-indigo-700/60'
    }
  };

  const scheme = colorMap[colorScheme] || colorMap.red;

  return (
    <div className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-lg dark:hover:shadow-2xl transition-all duration-200 group cockpit-card-hover ${scheme.glow}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate mr-2">
          {title}
        </span>
        <div className={`w-9 h-9 rounded-xl ${scheme.bg} border ${scheme.border} flex items-center justify-center ${scheme.text} shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-2xs`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
          {value}
        </h3>
        {trend && (
          <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
            trendUp 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800' 
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800'
          }`}>
            {trend}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {subtitle && (
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
            {subtitle}
          </p>
        )}
        {action && (
          <button
            onClick={action.onClick}
            className="text-[11px] font-bold text-[#D62839] hover:underline cursor-pointer shrink-0"
          >
            {action.label} →
          </button>
        )}
      </div>
    </div>
  );
};
