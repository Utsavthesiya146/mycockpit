import React, { useState } from 'react';
import { 
  Menu, 
  Sparkles, 
  Link as LinkIcon, 
  Check, 
  ArrowRightLeft, 
  Bell
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { NavTab } from './Sidebar';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  setIsSidebarOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, setIsSidebarOpen }) => {
  const { user, switchDemoAccount } = useAuth();
  const [copied, setCopied] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Development mode check: demo switcher only active in local dev
  const isDevMode = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const getTabTitle = (tab: NavTab) => {
    switch (tab) {
      case 'dashboard': return 'Cockpit Overview';
      case 'invoices': return 'Invoices & Financial Intelligence';
      case 'crm': return 'Customer Relationship & Pipeline';
      case 'hrm': return 'Human Resources & Team Directory';
      case 'calendar': return 'Calendar, Meetings & Events';
      case 'tasks': return 'Task Operations & Action Items';
      case 'followups': return 'Client Follow-ups & Reminders';
      case 'apps': return 'Connected Applications Hub';
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

  const handleDemoSwitch = async (target: 'admin' | 'clientA' | 'clientB') => {
    setSwitching(true);
    try {
      await switchDemoAccount(target);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-[#E5EAF1] px-4 sm:px-6 flex items-center justify-between shadow-2xs">
      {/* Left: Mobile trigger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-xl text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] transition-colors lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-[#172033] tracking-tight">
            {getTabTitle(activeTab)}
          </h1>
        </div>
      </div>

      {/* Right Controls: Personal URL, Demo Switcher, AI Summon */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Quick Demo Switcher (Only visible in verified local dev mode) */}
        {isDevMode && (
          <div className="hidden lg:flex items-center gap-1 p-1 bg-[#F1F5F9] border border-[#E5EAF1] rounded-xl text-xs">
            <div className="flex items-center gap-1 px-2 text-[#64748B]">
              <ArrowRightLeft className="w-3.5 h-3.5 text-[#4667E8]" />
              <span className="font-semibold text-[10px] uppercase tracking-wider">Dev Switch:</span>
            </div>
            <button
              disabled={switching}
              onClick={() => handleDemoSwitch('admin')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all duration-180 ${
                user?.role === 'super_admin'
                  ? 'bg-white text-[#D97706] font-bold shadow-2xs border border-[#FDE68A]'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
              }`}
            >
              Super Admin
            </button>
            <button
              disabled={switching}
              onClick={() => handleDemoSwitch('clientA')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all duration-180 ${
                user?.tenant_slug === 'utsav'
                  ? 'bg-[#4667E8] text-white font-bold shadow-2xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
              }`}
            >
              Client A (Utsav)
            </button>
            <button
              disabled={switching}
              onClick={() => handleDemoSwitch('clientB')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all duration-180 ${
                user?.tenant_slug === 'rahul'
                  ? 'bg-[#4667E8] text-white font-bold shadow-2xs'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
              }`}
            >
              Client B (Rahul)
            </button>
          </div>
        )}

        {/* Personal Client URL Badge */}
        {user?.tenant_slug && (
          <button
            onClick={copyUrl}
            title="Click to copy Personal Client URL"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#172033] border border-[#E5EAF1] text-xs font-mono transition-all duration-180 shadow-2xs"
          >
            <LinkIcon className="w-3.5 h-3.5 text-[#4667E8]" />
            <span>akiradigital.com/{user.tenant_slug}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-[#0F9D92]" /> : null}
          </button>
        )}

        {/* AI Summon Action Button */}
        <button
          onClick={() => setActiveTab('ai')}
          className="cockpit-btn-primary"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ask AI Copilot</span>
        </button>
      </div>
    </header>
  );
};
