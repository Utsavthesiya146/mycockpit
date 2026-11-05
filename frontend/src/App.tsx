import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { CommandPalette } from './components/common/CommandPalette';
import { Cockpit3DLoader } from './components/common/Cockpit3DLoader';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Invoices } from './pages/Invoices';
import { CRM } from './pages/CRM';
import { HRM } from './pages/HRM';
import { CalendarPage } from './pages/Calendar';
import { Tasks } from './pages/Tasks';
import { Followups } from './pages/Followups';
import { ConnectedApps } from './pages/ConnectedApps';
import { AIAssistant } from './pages/AIAssistant';
import { SuperAdmin } from './pages/SuperAdmin';
import { SettingsPage } from './pages/Settings';
import { Leads } from './pages/Leads';
import { Integrations } from './pages/Integrations';
import { GmailWorkspace } from './pages/GmailWorkspace';
import type { NavTab } from './components/layout/Sidebar';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab')?.toLowerCase();
    if (tabParam === 'gmail') return 'gmail';
    if (tabParam === 'apps') return 'apps';
    if (tabParam === 'leads') return 'leads';
    if (tabParam === 'integrations') return 'integrations';

    const path = window.location.pathname.toLowerCase().replace(/^\//, '').trim();
    if (path === 'gmail') return 'gmail';
    if (path === 'leads') return 'leads';
    if (path === 'integrations') return 'integrations';
    return 'dashboard';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Global Command Palette Shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check URL pathname on initial load for personal client URL routing
  useEffect(() => {
    const path = window.location.pathname.replace(/^\//, '').trim();
    if (path && !['login', 'register', 'admin', 'api', 'leads', 'integrations'].includes(path.toLowerCase())) {
      console.log(`Navigating to personal client route: /${path}`);
    }
  }, []);

  // Android Native Hardware Back Button Handler
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backHandler: any;
    const registerBackHandler = async () => {
      backHandler = await CapApp.addListener('backButton', () => {
        if (isSidebarOpen) {
          setIsSidebarOpen(false);
        } else if (activeTab !== 'dashboard') {
          setActiveTab('dashboard');
        } else {
          CapApp.minimizeApp();
        }
      });
    };

    registerBackHandler();

    return () => {
      if (backHandler && typeof backHandler.remove === 'function') {
        backHandler.remove();
      }
    };
  }, [isSidebarOpen, activeTab]);

  if (isLoading) {
    return (
      <Cockpit3DLoader 
        variant="fullscreen" 
        size="lg" 
        text="Initializing MY COCKPIT AI Platform..."
        subtitle="Establishing encrypted multi-tenant telemetry and session security"
      />
    );
  }

  if (!isAuthenticated) {
    if (authView === 'register') {
      return <Register onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <Login onSwitchToRegister={() => setAuthView('register')} />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'leads':
        return <Leads onNavigateToIntegrations={() => setActiveTab('integrations')} />;
      case 'integrations':
        return <Integrations />;
      case 'invoices':
        return <Invoices />;
      case 'crm':
        return <CRM />;
      case 'hrm':
        return <HRM />;
      case 'calendar':
        return <CalendarPage />;
      case 'tasks':
        return <Tasks />;
      case 'followups':
        return <Followups />;
      case 'apps':
        return <ConnectedApps onNavigateToGmail={() => setActiveTab('gmail')} />;
      case 'gmail':
        return <GmailWorkspace />;
      case 'ai':
        return <AIAssistant />;
      case 'superadmin':
        return <SuperAdmin />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex antialiased selection:bg-rose-500/20 selection:text-[#D62839]">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className={`flex-1 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'} flex flex-col min-h-screen min-w-0 transition-all duration-250 ease-in-out`}>
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setIsSidebarOpen={setIsSidebarOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />

        <main className="flex-1 p-3.5 sm:p-5 lg:p-7 max-w-7xl w-full mx-auto pb-24 lg:pb-10">
          {renderActiveView()}
        </main>

        {/* Global Command Palette */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          setActiveTab={setActiveTab}
        />

        {/* Mobile Native App Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          openDrawer={() => setIsSidebarOpen(true)}
        />
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
