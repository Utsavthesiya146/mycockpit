import React from 'react';

interface BadgeProps {
  status?: string;
  type?: 'invoice' | 'task' | 'lead' | 'app' | 'generic';
  variant?: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'indigo' | 'gray';
  dot?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ status, variant, dot, className, children }) => {
  const normalize = children ? String(children) : (status || '').toLowerCase().replace(/_/g, ' ');

  const formatLabel = (val: string) => {
    const lower = val.toLowerCase();
    switch (lower) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'sync failed':
        return 'Sync Failed';
      case 'reconnect required':
        return 'Reconnect Required';
      case 'configuration required':
        return 'Configuration Required';
      case 'launcher only':
        return 'Launcher Only';
      case 'connected':
        return 'Connected';
      case 'auth required':
      case 'authentication required':
        return 'Authentication Required';
      case 'api access required':
        return 'API Access Required';
      case 'manual import only':
        return 'Manual Import Only';
      case 'sync never run':
        return 'Sync Never Run';
      case 'sync successful':
        return 'Sync Successful';
      case 'sync successful no new leads':
      case 'sync successful - no new leads':
      case 'sync_successful_no_leads':
        return 'Sync Successful (0 New)';
      case 'referral access restricted':
      case 'referral_access_restricted':
        return 'Referral Access Restricted';
      case 'captcha required':
      case 'challenge required':
        return 'CAPTCHA Challenge';
      case 'disconnected':
        return 'Disconnected';
      default:
        return val;
    }
  };

  const getStyle = () => {
    if (variant) {
      switch (variant) {
        case 'green':
          return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60';
        case 'red':
          return 'bg-rose-50 text-[#D62839] border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60 font-bold';
        case 'amber':
          return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60 font-semibold';
        case 'blue':
          return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/60';
        case 'purple':
          return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800/60';
        case 'indigo':
          return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800/60';
        case 'gray':
        default:
          return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700';
      }
    }

    switch (normalize.toLowerCase()) {
      case 'paid':
      case 'completed':
      case 'active':
      case 'won':
      case 'connected':
      case 'synced':
      case 'connected & syncing':
      case 'connected syncing':
      case 'webhook configured':
      case 'sync successful':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60 font-semibold';

      case 'syncing':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60 font-bold';

      case 'launcher only':
        return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800/60 font-medium';

      case 'sync successful no new leads':
      case 'sync successful - no new leads':
      case 'sync_successful_no_leads':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/60 font-semibold';
      
      case 'partially paid':
      case 'in progress':
      case 'qualified':
      case 'proposal':
        return 'bg-rose-50 text-[#D62839] border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60 font-bold';

      case 'pending':
      case 'sent':
      case 'scheduled':
      case 'new':
      case 'contacted':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60 font-semibold';

      case 'overdue':
      case 'urgent':
      case 'lost':
      case 'cancelled':
      case 'suspended':
      case 'terminated':
      case 'expired':
      case 'error':
      case 'sync failed':
        return 'bg-rose-50 text-[#D62839] border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60 font-bold';

      case 'high':
      case 'auth required':
      case 'authentication required':
      case 'reconnect required':
      case 'config required':
      case 'captcha required':
      case 'challenge required':
      case 'mfa required':
      case 'on leave':
      case 'referral access restricted':
      case 'referral_access_restricted':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60 font-bold';

      case 'configuration required':
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-medium';

      case 'api access required':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/60 font-bold';

      case 'draft':
      case 'medium':
      case 'low':
      case 'disconnected':
      case 'manual import only':
      case 'sync never run':
      case 'unsupported':
      case 'inactive':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider border shadow-2xs ${getStyle()} ${className || ''}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      <span>{children || formatLabel(normalize)}</span>
    </span>
  );
};
