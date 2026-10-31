import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  colorScheme?: 'red' | 'emerald' | 'amber' | 'neutral' | 'indigo';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
  colorScheme = 'red'
}) => {
  const colorMap = {
    red: {
      bg: 'bg-[#FFF1F2]',
      border: 'border-[#FECDD3]',
      text: 'text-[#D62839]'
    },
    emerald: {
      bg: 'bg-[#ECFDF5]',
      border: 'border-[#A7F3D0]',
      text: 'text-[#059669]'
    },
    amber: {
      bg: 'bg-[#FEF3C7]',
      border: 'border-[#FDE68A]',
      text: 'text-[#D97706]'
    },
    neutral: {
      bg: 'bg-[#F8F9FB]',
      border: 'border-[#E9EAEE]',
      text: 'text-[#667085]'
    },
    indigo: {
      bg: 'bg-[#FFF1F2]',
      border: 'border-[#FECDD3]',
      text: 'text-[#D62839]'
    }
  };

  const scheme = colorMap[colorScheme] || colorMap.red;

  return (
    <div className="p-5 rounded-2xl bg-white border border-[#E9EAEE] shadow-xs hover:shadow-md hover:border-[#FECDD3] transition-all duration-200 group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">{title}</span>
        <div className={`w-9 h-9 rounded-xl ${scheme.bg} border ${scheme.border} flex items-center justify-center ${scheme.text} group-hover:scale-105 transition-transform duration-200`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-2xl font-extrabold text-[#20242C] tracking-tight">{value}</h3>
        {trend && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            trendUp 
              ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]' 
              : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECDD3]'
          }`}>
            {trend}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-[#667085] mt-1 font-medium">{subtitle}</p>}
    </div>
  );
};
