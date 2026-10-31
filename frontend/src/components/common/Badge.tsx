import React from 'react';

interface BadgeProps {
  status: string;
  type?: 'invoice' | 'task' | 'lead' | 'app' | 'generic';
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  const normalize = (status || '').toLowerCase().replace(/_/g, ' ');

  const getStyle = () => {
    switch (normalize) {
      case 'paid':
      case 'completed':
      case 'active':
      case 'won':
      case 'connected':
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
        return 'bg-[#FEF2F2] text-[#DC2626] border-[#FECDD3] font-bold';

      case 'high':
      case 'config required':
      case 'on leave':
        return 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]';

      case 'draft':
      case 'medium':
      case 'low':
      case 'unsupported':
      case 'inactive':
      default:
        return 'bg-[#F8F9FB] text-[#667085] border-[#E9EAEE]';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border shadow-2xs ${getStyle()}`}>
      {normalize}
    </span>
  );
};
