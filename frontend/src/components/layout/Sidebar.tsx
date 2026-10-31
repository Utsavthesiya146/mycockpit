import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Users2, 
  Building2, 
  Calendar, 
  CheckSquare, 
  PhoneCall, 
  Grid, 
  Sparkles, 
  ShieldAlert, 
  Settings, 
  LogOut, 
  Layers,
  ChevronRight,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab = 
  | 'dashboard' 
  | 'invoices' 
  | 'crm' 
  | 'hrm' 
  | 'calendar' 
  | 'tasks' 
  | 'followups' 
  | 'apps' 
  | 'ai' 
  | 'superadmin' 
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
  const { user, tenant, logout } = useAuth();

  const isSuperAdmin = user?.role === 'super_admin';

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Cockpit Overview', icon: LayoutDashboard },
    { id: 'ai' as NavTab, label: 'Personal AI Agent', icon: Sparkles, badge: 'Live', badgeRed: true },
    { id: 'invoices' as NavTab, label: 'Invoices & Finance', icon: Receipt },
    { id: 'crm' as NavTab, label: 'CRM & Pipeline', icon: Users2 },
    { id: 'hrm' as NavTab, label: 'HRM & Team', icon: Building2 },
    { id: 'calendar' as NavTab, label: 'Calendar & Meetings', icon: Calendar },
    { id: 'tasks' as NavTab, label: 'Tasks & Priority', icon: CheckSquare },
    { id: 'followups' as NavTab, label: 'Follow-up Reminders', icon: PhoneCall },
    { id: 'apps' as NavTab, label: 'Connected Apps Hub', icon: Grid },
    ...(isSuperAdmin ? [{ id: 'superadmin' as NavTab, label: 'Super Admin Fleet', icon: ShieldAlert, badge: 'Root', badgeAmber: true }] : []),
    { id: 'settings' as NavTab, label: 'Workspace Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-[#E9EAEE] flex flex-col
        transition-transform duration-250 ease-in-out shadow-xs
        lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-[#E9EAEE] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D62839] flex items-center justify-center shadow-md shadow-[#D62839]/25 text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-[#20242C] flex items-center gap-1.5">
                MY COCKPIT <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FFF1F2] text-[#D62839] font-mono font-bold border border-[#FECDD3]">AI</span>
              </div>
              <p className="text-[11px] text-[#667085] truncate max-w-[150px] font-medium">
                {tenant?.name || 'Enterprise System'}
              </p>
            </div>
          </div>
          {/* Mobile close button */}
          <button 
            onClick={() => setIsOpen(false)} 
            className="p-1.5 rounded-lg text-[#667085] hover:text-[#D62839] hover:bg-[#FFF1F2] lg:hidden cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Identifier */}
        <div className="px-4 py-2.5 bg-[#F8F9FB] border-b border-[#E9EAEE]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#667085] font-medium">Workspace:</span>
            <span className="font-mono px-2 py-0.5 rounded-md bg-white text-[#D62839] font-semibold border border-[#E9EAEE] shadow-2xs">
              /{user?.tenant_slug || (isSuperAdmin ? 'system-root' : 'isolated')}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-180 group cursor-pointer
                  ${isActive 
                    ? 'bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3] shadow-2xs font-bold' 
                    : 'text-[#667085] hover:text-[#20242C] hover:bg-[#FFF1F2]/50 border border-transparent'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#D62839]' : 'text-[#94A3B8] group-hover:text-[#D62839]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    item.badgeRed 
                      ? 'bg-[#FFF1F2] text-[#D62839] border-[#FECDD3]' 
                      : item.badgeAmber 
                        ? 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]'
                        : 'bg-[#FFF1F2] text-[#D62839] border-[#FECDD3]'
                  }`}>
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-3.5 h-3.5 text-[#D62839] opacity-80" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Profile Card & Session Controls */}
        <div className="p-4 border-t border-[#E9EAEE] bg-[#F8F9FB]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#FFF1F2] border border-[#FECDD3] flex items-center justify-center text-xs font-bold text-[#D62839] shrink-0 shadow-2xs">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-[#20242C] truncate">{user?.name}</p>
                <p className="text-[11px] text-[#667085] truncate">{user?.email}</p>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#D62839] hover:text-[#B91C2C] bg-[#FFF1F2] hover:bg-[#FFE4E6] border border-[#FECDD3] transition-all duration-180 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>
    </>
  );
};
