import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-[#4667E8]/20 border-t-[#4667E8] rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#64748B]">Initializing MY COCKPIT AI Platform...</p>
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
    <div className="min-h-screen bg-[#F8FAFC] text-[#172033] flex antialiased">
      {/* Sidebar Navigation */}
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

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderActiveView()}
        </main>
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
