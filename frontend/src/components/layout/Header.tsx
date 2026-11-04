import React, { useState } from 'react';
import { 
  Menu, 
  Sparkles, 
  Link as LinkIcon, 
  Check 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { NavTab } from './Sidebar';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  setIsSidebarOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, setIsSidebarOpen }) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const getTabTitle = (tab: NavTab) => {
    switch (tab) {
      case 'dashboard': return 'Cockpit Overview';
      case 'leads': return 'Centralized All Leads Portfolio';
      case 'integrations': return 'Universal Lead Sync Hub';
      case 'invoices': return 'Invoices & Financial Intelligence';
      case 'crm': return 'Customer Relationship & Pipeline';
      case 'hrm': return 'Human Resources & Team Directory';
      case 'calendar': return 'Calendar, Meetings & Events';
      case 'tasks': return 'Task Operations & Action Items';
      case 'followups': return 'Client Follow-ups & Reminders';
      case 'apps': return 'Connected Applications Hub';
      case 'gmail': return 'Gmail Workspace & Communications';
      case 'ai': return 'Personal AI Assistant';
      case 'superadmin': return 'Super Admin Fleet Governance';
      case 'settings': return 'Workspace & Organization Settings';
      default: return 'Cockpit';
    }
  };

  const personalUrl = user?.tenant_slug 
    ? `http://localhost:5173/${user.tenant_slug}`
    : `http://localhost:5173/admin`;

  const copyUrl = () => {
    navigator.clipboard.writeText(personalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-[#E9EAEE] px-4 sm:px-6 flex items-center justify-between shadow-2xs">
      {/* Left: Mobile trigger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-xl text-[#667085] hover:text-[#D62839] hover:bg-[#FFF1F2] transition-colors lg:hidden cursor-pointer"
          aria-label="Open navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-[#D62839] rounded-full hidden sm:block" />
          <h1 className="text-base sm:text-lg font-bold text-[#20242C] tracking-tight">
            {getTabTitle(activeTab)}
          </h1>
        </div>
      </div>

      {/* Right Controls: Personal URL, AI Summon */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Personal Client URL Badge */}
        {user?.tenant_slug && (
          <button
            onClick={copyUrl}
            title="Click to copy Personal Client URL"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FFF1F2] text-[#20242C] hover:text-[#D62839] border border-[#E9EAEE] hover:border-[#FECDD3] text-xs font-mono transition-all duration-180 shadow-2xs cursor-pointer"
          >
            <LinkIcon className="w-3.5 h-3.5 text-[#D62839]" />
            <span>localhost:5173/{user.tenant_slug}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : null}
          </button>
        )}

        {/* AI Summon Action Button */}
        <button
          onClick={() => setActiveTab('ai')}
          className="cockpit-btn-primary"
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span className="hidden sm:inline">Ask AI Copilot</span>
        </button>
      </div>
    </header>
  );
};
