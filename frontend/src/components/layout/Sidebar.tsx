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
  X,
  Zap,
  Mail,
  ChevronLeft
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab = 
  | 'dashboard' 
  | 'leads'
  | 'integrations'
  | 'gmail'
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
  isCollapsed?: boolean;
  setIsCollapsed?: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isOpen, 
  setIsOpen,
  isCollapsed = false,
  setIsCollapsed
}) => {
  const { user, tenant, logout } = useAuth();

  const isSuperAdmin = user?.role === 'super_admin';

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Cockpit Overview', icon: LayoutDashboard },
    { id: 'leads' as NavTab, label: 'Centralized Leads', icon: Users2, badge: '244+', badgeRed: true },
    { id: 'integrations' as NavTab, label: 'Lead Sync Hub', icon: Zap },
    { id: 'ai' as NavTab, label: 'Personal AI Agent', icon: Sparkles, badge: 'Live' },
    { id: 'invoices' as NavTab, label: 'Invoices & Finance', icon: Receipt },
    { id: 'crm' as NavTab, label: 'CRM & Accounts', icon: Layers },
    { id: 'hrm' as NavTab, label: 'HRM & Team', icon: Building2 },
    { id: 'calendar' as NavTab, label: 'Calendar & Meetings', icon: Calendar },
    { id: 'tasks' as NavTab, label: 'Tasks & Priority', icon: CheckSquare },
    { id: 'followups' as NavTab, label: 'Follow-up Reminders', icon: PhoneCall },
    { id: 'apps' as NavTab, label: 'Connected Apps Hub', icon: Grid },
    { id: 'gmail' as NavTab, label: 'Gmail Workspace', icon: Mail },
    ...(isSuperAdmin ? [{ id: 'superadmin' as NavTab, label: 'Super Admin Fleet', icon: ShieldAlert, badge: 'Root', badgeAmber: true }] : []),
    { id: 'settings' as NavTab, label: 'Workspace Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 bg-white dark:bg-[#0B0F19] border-r border-slate-200 dark:border-slate-800/80 flex flex-col
        transition-all duration-250 ease-in-out shadow-xs
        ${isCollapsed ? 'lg:w-20' : 'lg:w-72'}
        w-72
        lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Header */}
        <div className={`p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#D62839] flex items-center justify-center shadow-md shadow-[#D62839]/25 text-white shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  MY COCKPIT <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-[#D62839] dark:bg-rose-950/60 dark:text-rose-400 font-mono font-bold border border-rose-200 dark:border-rose-900/60">AI</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px] font-medium">
                  {tenant?.name || 'Enterprise System'}
                </p>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button 
            onClick={() => setIsOpen(false)} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#D62839] hover:bg-rose-50 dark:hover:bg-rose-950/40 lg:hidden cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Identifier (Hidden when collapsed on desktop) */}
        {!isCollapsed && (
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Workspace:</span>
              <span className="font-mono px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-[#D62839] dark:text-rose-400 font-semibold border border-slate-200 dark:border-slate-700 shadow-2xs">
                /{user?.tenant_slug || (isSuperAdmin ? 'system-root' : 'isolated')}
              </span>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
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
                title={isCollapsed ? item.label : undefined}
                className={`
                  w-full flex items-center ${isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-between px-3'} py-2.5 rounded-xl text-sm font-medium transition-all duration-180 group cursor-pointer
                  ${isActive 
                    ? 'bg-rose-50 text-[#D62839] border border-rose-200 shadow-2xs font-bold dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#D62839] dark:text-rose-400' : 'text-slate-400 group-hover:text-[#D62839] dark:group-hover:text-rose-400'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isCollapsed && (
                  item.badge ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border shrink-0 ${
                      item.badgeRed 
                        ? 'bg-rose-50 text-[#D62839] border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/60' 
                        : item.badgeAmber 
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/60'
                          : 'bg-rose-50 text-[#D62839] border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/60'
                    }`}>
                      {item.badge}
                    </span>
                  ) : (
                    isActive && <ChevronRight className="w-3.5 h-3.5 text-[#D62839] dark:text-rose-400 opacity-80" />
                  )
                )}
              </button>
            );
          })}
        </nav>

        {/* Profile Card & Session Controls */}
        <div className={`p-3.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 ${isCollapsed ? 'lg:p-2' : ''}`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-xs font-bold text-[#D62839] dark:text-rose-400 shrink-0 shadow-2xs">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="truncate min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#D62839] hover:text-[#B91C2C] bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-900/60 transition-all duration-180 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div 
                title={`${user?.name} (${user?.email})`}
                className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-xs font-bold text-[#D62839] dark:text-rose-400 shrink-0 shadow-2xs cursor-pointer"
              >
                {user?.name?.charAt(0) || 'U'}
              </div>
              <button
                onClick={logout}
                title="Sign Out Session"
                className="p-2 rounded-xl text-[#D62839] hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
