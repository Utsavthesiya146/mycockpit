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
  ChevronRight
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
    { id: 'ai' as NavTab, label: 'Personal AI Agent', icon: Sparkles, badge: 'Live', badgeTeal: true },
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
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-[#E5EAF1] flex flex-col
        transition-transform duration-250 ease-in-out shadow-xs
        lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Header */}
        <div className="p-5 border-b border-[#E5EAF1] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4667E8] flex items-center justify-center shadow-md shadow-[#4667E8]/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-[#172033] flex items-center gap-1.5">
                MY COCKPIT <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#4667E8] font-mono font-bold border border-[#C7D2FE]">AI</span>
              </div>
              <p className="text-[11px] text-[#64748B] truncate max-w-[150px] font-medium">
                {tenant?.name || 'Enterprise System'}
              </p>
            </div>
          </div>
        </div>

        {/* Workspace Identifier */}
        <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E5EAF1]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#64748B] font-medium">Workspace:</span>
            <span className="font-mono px-2 py-0.5 rounded bg-white text-[#4667E8] font-semibold border border-[#E5EAF1] shadow-2xs">
              /{user?.tenant_slug || (isSuperAdmin ? 'system-root' : 'isolated')}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
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
                  w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-180 group
                  ${isActive 
                    ? 'bg-[#EEF2FF] text-[#4667E8] border border-[#C7D2FE] shadow-2xs font-semibold' 
                    : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC] border border-transparent'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#4667E8]' : 'text-[#94A3B8] group-hover:text-[#172033]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    item.badgeTeal 
                      ? 'bg-[#E8F8F5] text-[#0F9D92] border-[#B2EBE4]' 
                      : item.badgeAmber 
                        ? 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]'
                        : 'bg-[#EEF2FF] text-[#4667E8] border-[#C7D2FE]'
                  }`}>
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-3.5 h-3.5 text-[#4667E8] opacity-70" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Profile Card & Session Controls */}
        <div className="p-4 border-t border-[#E5EAF1] bg-[#F8FAFC]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-xs font-bold text-[#4667E8] shrink-0 shadow-2xs">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-[#172033] truncate">{user?.name}</p>
                <p className="text-[11px] text-[#64748B] truncate">{user?.email}</p>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#F07865] hover:text-[#D95D4A] bg-[#FFF1ED] hover:bg-[#FEE2DD] border border-[#F07865]/20 transition-all duration-180"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>
    </>
  );
};
