import React, { useState } from 'react';
import { 
  Menu, 
  Sparkles, 
  Link as LinkIcon, 
  Check, 
  Sun, 
  Moon, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { NavTab } from './Sidebar';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  setIsSidebarOpen: (open: boolean) => void;
  isSidebarCollapsed?: boolean;
  setIsSidebarCollapsed?: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab, 
  setIsSidebarOpen,
  isSidebarCollapsed = false,
  setIsSidebarCollapsed,
  onOpenCommandPalette
}) => {
  const { user, tenant } = useAuth();
  const { isDark, toggleTheme } = useTheme();
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

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mycockpit-0e86.onrender.com';
  const personalUrl = user?.tenant_slug 
    ? `${origin}/${user.tenant_slug}`
    : `${origin}/admin`;

  const copyUrl = () => {
    navigator.clipboard.writeText(personalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-[#0B0F19]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-3.5 sm:px-6 flex items-center justify-between transition-colors duration-200 shadow-2xs">
      {/* Left: Sidebar Toggles & Breadcrumb Header */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-xl text-slate-500 hover:text-[#D62839] hover:bg-rose-50 dark:hover:bg-rose-950/40 lg:hidden cursor-pointer transition-colors"
          aria-label="Open mobile navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop sidebar collapse/expand trigger */}
        {setIsSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
            className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isSidebarCollapsed ? "Expand sidebar (full view)" : "Collapse sidebar (compact view)"}
            aria-label="Toggle sidebar collapse"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Page Identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2 h-2 rounded-full bg-[#D62839] hidden sm:block shrink-0 animate-pulse" />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {getTabTitle(activeTab)}
            </h1>
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span className="truncate">{tenant?.name || 'My Organization'}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Sync Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Controls: Command Bar, Personal URL, Theme Switcher, AI Summon */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Command Palette Trigger */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-900/60 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400 transition-all cursor-pointer shadow-2xs"
            title="Press Ctrl+K to search or run commands"
            aria-label="Open command palette"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline font-medium">Quick search...</span>
            <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400">Ctrl K</kbd>
          </button>
        )}
        {/* Personal Client URL Badge */}
        {user?.tenant_slug && (
          <button
            onClick={copyUrl}
            title="Click to copy Personal Client URL"
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-[#D62839] dark:hover:text-rose-400 border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900/50 text-xs font-mono transition-all duration-180 shadow-2xs cursor-pointer"
          >
            <LinkIcon className="w-3.5 h-3.5 text-[#D62839]" />
            <span className="truncate max-w-[150px]">/{user.tenant_slug}</span>
            {copied ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="w-3 h-3" /> Copied
              </span>
            ) : null}
          </button>
        )}

        {/* Theme Switcher Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-all duration-180 cursor-pointer flex items-center gap-1.5"
          title={isDark ? "Switch to Crisp Light Mode" : "Switch to Obsidian Dark Mode"}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 animate-in fade-in zoom-in duration-200" />
              <span className="hidden sm:inline text-xs font-semibold">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-700 animate-in fade-in zoom-in duration-200" />
              <span className="hidden sm:inline text-xs font-semibold">Dark</span>
            </>
          )}
        </button>

        {/* AI Summon Action Button */}
        <button
          onClick={() => setActiveTab('ai')}
          className="cockpit-btn-primary shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
          <span className="hidden sm:inline">Ask AI Copilot</span>
        </button>
      </div>
    </header>
  );
};
