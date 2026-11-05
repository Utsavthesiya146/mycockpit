import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  LayoutDashboard, 
  Users2, 
  Receipt, 
  Layers, 
  Building2, 
  Calendar, 
  CheckSquare, 
  PhoneCall, 
  Mail, 
  Grid, 
  Sparkles, 
  Settings, 
  ShieldAlert, 
  Sun, 
  Moon, 
  X,
  ArrowRight
} from 'lucide-react';
import type { NavTab } from '../layout/Sidebar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: NavTab) => void;
}

interface CommandItem {
  id: string;
  label: string;
  category: 'Navigation' | 'Actions' | 'Tools';
  icon: any;
  action: () => void;
  shortcut?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, setActiveTab }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();

  const isSuperAdmin = user?.role === 'super_admin';

  const commands: CommandItem[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Go to Cockpit Overview', category: 'Navigation', icon: LayoutDashboard, action: () => { setActiveTab('dashboard'); onClose(); } },
    { id: 'nav-leads', label: 'Go to Centralized Leads Portfolio', category: 'Navigation', icon: Users2, action: () => { setActiveTab('leads'); onClose(); }, shortcut: 'G L' },
    { id: 'nav-crm', label: 'Go to CRM & Sales Pipeline', category: 'Navigation', icon: Layers, action: () => { setActiveTab('crm'); onClose(); }, shortcut: 'G C' },
    { id: 'nav-invoices', label: 'Go to Invoices & Financial Intelligence', category: 'Navigation', icon: Receipt, action: () => { setActiveTab('invoices'); onClose(); }, shortcut: 'G I' },
    { id: 'nav-tasks', label: 'Go to Task Operations & Kanban', category: 'Navigation', icon: CheckSquare, action: () => { setActiveTab('tasks'); onClose(); }, shortcut: 'G T' },
    { id: 'nav-calendar', label: 'Go to Calendar & Meetings', category: 'Navigation', icon: Calendar, action: () => { setActiveTab('calendar'); onClose(); } },
    { id: 'nav-followups', label: 'Go to Follow-up Reminders', category: 'Navigation', icon: PhoneCall, action: () => { setActiveTab('followups'); onClose(); } },
    { id: 'nav-hrm', label: 'Go to HRM & Team Directory', category: 'Navigation', icon: Building2, action: () => { setActiveTab('hrm'); onClose(); } },
    { id: 'nav-gmail', label: 'Go to Gmail Workspace', category: 'Navigation', icon: Mail, action: () => { setActiveTab('gmail'); onClose(); } },
    { id: 'nav-apps', label: 'Go to Connected Applications Hub', category: 'Navigation', icon: Grid, action: () => { setActiveTab('apps'); onClose(); } },
    { id: 'nav-ai', label: 'Ask AI Copilot Assistant', category: 'Navigation', icon: Sparkles, action: () => { setActiveTab('ai'); onClose(); } },
    { id: 'nav-settings', label: 'Open Workspace Settings', category: 'Navigation', icon: Settings, action: () => { setActiveTab('settings'); onClose(); } },
    ...(isSuperAdmin ? [{ id: 'nav-superadmin', label: 'Open Super Admin Fleet Console', category: 'Navigation' as const, icon: ShieldAlert, action: () => { setActiveTab('superadmin'); onClose(); } }] : []),

    // Actions
    { id: 'act-theme', label: `Switch to ${isDark ? 'Light' : 'Dark'} Mode`, category: 'Actions', icon: isDark ? Sun : Moon, action: () => { toggleTheme(); onClose(); } },
  ];

  const filtered = commands.filter(c => 
    c.label.toLowerCase().includes(query.toLowerCase()) || 
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Palette Dialog */}
      <div className="relative w-full max-w-xl bg-white dark:bg-[#0D111A] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden z-10">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200/90 dark:border-white/[0.08] gap-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Type a command or search modules... (Press Esc to exit)"
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-white/[0.04]">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No matching commands found for "{query}"
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                    isSelected 
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 font-semibold' 
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected 
                        ? 'bg-rose-100 dark:bg-rose-900/60 text-[#D62839] dark:text-rose-400' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {item.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'translate-x-0.5 opacity-100' : 'opacity-0'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <span>Navigate <kbd className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-1 rounded">↑</kbd> <kbd className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-1 rounded">↓</kbd></span>
            <span>Select <kbd className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-1 rounded">↵</kbd></span>
          </div>
          <span>My Cockpit AI OS</span>
        </div>
      </div>
    </div>
  );
};

