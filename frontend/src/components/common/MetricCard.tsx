import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  colorScheme?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
  colorScheme = 'indigo'
}) => {
  const colorMap = {
    indigo: {
      bg: 'bg-[#EEF2FF]',
      border: 'border-[#E0E7FF]',
      text: 'text-[#4667E8]'
    },
    emerald: {
      bg: 'bg-[#E8F8F5]',
      border: 'border-[#CCFBF1]',
      text: 'text-[#0F9D92]'
    },
    amber: {
      bg: 'bg-[#FEF3C7]',
      border: 'border-[#FDE68A]',
      text: 'text-[#D97706]'
    },
    rose: {
      bg: 'bg-[#FFF1ED]',
      border: 'border-[#FFE4E6]',
      text: 'text-[#E11D48]'
    },
    sky: {
      bg: 'bg-[#F0F9FF]',
      border: 'border-[#E0F2FE]',
      text: 'text-[#0284C7]'
    }
  };

  const scheme = colorMap[colorScheme];

  return (
    <div className="p-5 rounded-2xl bg-white border border-[#E5EAF1] shadow-xs hover:shadow-md hover:border-[#CBD5E1] transition-all duration-200 group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">{title}</span>
        <div className={`w-9 h-9 rounded-xl ${scheme.bg} border ${scheme.border} flex items-center justify-center ${scheme.text} group-hover:scale-105 transition-transform duration-200`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-2xl font-extrabold text-[#172033] tracking-tight">{value}</h3>
        {trend && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            trendUp 
              ? 'bg-[#E8F8F5] text-[#0F9D92] border-[#CCFBF1]' 
              : 'bg-[#FFF1ED] text-[#E11D48] border-[#FFE4E6]'
          }`}>
            {trend}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-[#64748B] mt-1 font-medium">{subtitle}</p>}
    </div>
  );
};
