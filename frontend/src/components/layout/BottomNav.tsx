import React from 'react';
import { LayoutDashboard, Receipt, Users2, Sparkles, Menu } from 'lucide-react';
import type { NavTab } from './Sidebar';

interface BottomNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  openDrawer: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, openDrawer }) => {
  const tabs = [
    { id: 'dashboard' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'invoices' as NavTab, label: 'Invoices', icon: Receipt },
    { id: 'crm' as NavTab, label: 'CRM', icon: Users2 },
    { id: 'ai' as NavTab, label: 'AI Copilot', icon: Sparkles, isAi: true },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation Bar"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E9EAEE] shadow-[0_-4px_16px_rgba(32,36,44,0.04)] px-2 py-1 safe-area-bottom"
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 touch-target rounded-xl transition-all duration-180 relative cursor-pointer ${
                isActive 
                  ? 'text-[#D62839]' 
                  : 'text-[#667085] hover:text-[#20242C]'
              }`}
            >
              {tab.isAi && (
                <span className="absolute top-1 right-1/4 w-2 h-2 rounded-full bg-[#D62839] animate-pulse" />
              )}
              <div className={`p-1 rounded-xl transition-transform ${isActive ? 'scale-110 bg-[#FFF1F2]' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#D62839]' : 'text-[#667085]'}`} />
              </div>
              <span className={`text-[10px] tracking-tight mt-0.5 ${isActive ? 'font-bold text-[#D62839]' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* More Drawer Trigger */}
        <button
          onClick={openDrawer}
          className="flex flex-col items-center justify-center flex-1 py-1 px-1 touch-target rounded-xl text-[#667085] hover:text-[#D62839] transition-all duration-180 cursor-pointer"
          aria-label="Open full menu"
        >
          <div className="p-1 rounded-xl">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">
            More
          </span>
        </button>
      </div>
    </nav>
  );
};
