import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
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
import type { NavTab } from './components/layout/Sidebar';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Check URL pathname on initial load for personal client URL routing (e.g. /utsav, /rahul)
  useEffect(() => {
    const path = window.location.pathname.replace(/^\//, '').trim();
    if (path && !['login', 'register', 'admin', 'api'].includes(path.toLowerCase())) {
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
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-[#D62839]/20 border-t-[#D62839] rounded-full animate-spin" />
          <p className="text-xs font-bold text-[#20242C] tracking-tight">Initializing MY COCKPIT AI Platform...</p>
          <p className="text-[11px] text-[#667085]">Connecting secure workspace session</p>
        </div>
      </div>
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
        return <ConnectedApps />;
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
    <div className="min-h-screen bg-[#FAFAFA] text-[#20242C] flex antialiased">
      {/* Sidebar Navigation (Desktop Drawer & Mobile Full Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen min-w-0">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setIsSidebarOpen={setIsSidebarOpen}
        />

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {renderActiveView()}
        </main>

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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
