import React from 'react';

interface BadgeProps {
  status?: string;
  type?: 'invoice' | 'task' | 'lead' | 'app' | 'generic';
  variant?: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'indigo' | 'gray';
  dot?: boolean;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ status, variant, dot, children }) => {
  const normalize = children ? String(children) : (status || '').toLowerCase().replace(/_/g, ' ');

  const getStyle = () => {
    if (variant) {
      switch (variant) {
        case 'green':
          return 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]';
        case 'red':
          return 'bg-[#FEF2F2] text-[#DC2626] border-[#FECDD3] font-bold';
        case 'amber':
          return 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]';
        case 'blue':
          return 'bg-[#EFF8FF] text-[#175CD3] border-[#B2DDFF]';
        case 'purple':
          return 'bg-[#F9F5FF] text-[#6941C6] border-[#E9D7FE]';
        case 'indigo':
          return 'bg-[#EEF4FF] text-[#3538CD] border-[#C7D7FE]';
        case 'gray':
        default:
          return 'bg-[#F8F9FB] text-[#667085] border-[#E9EAEE]';
      }
    }

    switch (normalize.toLowerCase()) {
      case 'paid':
      case 'completed':
      case 'active':
      case 'won':
      case 'connected':
      case 'connected & syncing':
      case 'connected syncing':
      case 'webhook configured':
        return 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]';
      
      case 'partially paid':
      case 'in progress':
      case 'qualified':
      case 'proposal':
        return 'bg-[#FFF1F2] text-[#D62839] border-[#FECDD3] font-bold';

      case 'pending':
      case 'sent':
      case 'scheduled':
      case 'new':
      case 'contacted':
      case 'launcher only':
        return 'bg-[#FFF8F1] text-[#D97706] border-[#FDE68A]';

      case 'overdue':
      case 'urgent':
      case 'lost':
      case 'cancelled':
      case 'suspended':
      case 'terminated':
      case 'expired':
      case 'error':
        return 'bg-[#FEF2F2] text-[#DC2626] border-[#FECDD3] font-bold';

      case 'high':
      case 'auth required':
      case 'authentication required':
      case 'config required':
      case 'captcha required':
      case 'mfa required':
      case 'on leave':
        return 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]';

      case 'api access required':
        return 'bg-[#EFF8FF] text-[#175CD3] border-[#B2DDFF] font-bold';

      case 'draft':
      case 'medium':
      case 'low':
      case 'disconnected':
      case 'manual import only':
      case 'unsupported':
      case 'inactive':
      default:
        return 'bg-[#F8F9FB] text-[#667085] border-[#E9EAEE]';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border shadow-2xs ${getStyle()}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {children || normalize}
    </span>
  );
};
