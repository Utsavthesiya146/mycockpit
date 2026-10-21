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
        return 'bg-[#E8F8F5] text-[#0F9D92] border-[#B2EBE4]';
      
      case 'partially paid':
      case 'in progress':
      case 'qualified':
      case 'proposal':
        return 'bg-[#EEF2FF] text-[#4667E8] border-[#C7D2FE]';

      case 'pending':
      case 'sent':
      case 'scheduled':
      case 'new':
      case 'contacted':
      case 'launcher only':
        return 'bg-[#F0F9FF] text-[#0284C7] border-[#BAE6FD]';

      case 'overdue':
      case 'urgent':
      case 'lost':
      case 'cancelled':
      case 'suspended':
      case 'terminated':
        return 'bg-[#FFF1ED] text-[#E11D48] border-[#FECDD3]';

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
        return 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border shadow-2xs ${getStyle()}`}>
      {normalize}
    </span>
  );
};
