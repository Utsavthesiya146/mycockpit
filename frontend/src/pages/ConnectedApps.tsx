import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ExternalLink, 
  Pin, 
  Calendar, 
  Mail, 
  HardDrive, 
  Users, 
  Briefcase, 
  FileText, 
  BookOpen, 
  Globe, 
  Trash2, 
  ShieldCheck, 
  Search,
  Building2,
  Share2,
  Eye,
  EyeOff,
  Lock,
  Link2,
  Clock,
  RefreshCw,
  Unlink,
  AlertCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import type { ConnectedApp } from '../types';

export const ConnectedApps: React.FC = () => {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add App Form State
  const [name, setName] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [category, setCategory] = useState<ConnectedApp['category']>('business');
  const [iconName, setIconName] = useState('Globe');
  const [connectionStatus, setConnectionStatus] = useState<ConnectedApp['connection_status']>('launcher_only');
  const [isPinned, setIsPinned] = useState(false);

  // Portal Connection Modal State
  const [selectedPortalApp, setSelectedPortalApp] = useState<ConnectedApp | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [portalUserId, setPortalUserId] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const fetchApps = async () => {
    try {
      const data: any = await api.get('/apps');
      setApps(data || []);
    } catch (err) {
      console.error('Failed to load connected apps', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/apps', {
        name,
        app_url: appUrl,
        category,
        icon_name: iconName,
        connection_status: connectionStatus,
        is_pinned: isPinned ? 1 : 0
      });
      setIsAddModalOpen(false);
      setName('');
      setAppUrl('');
      setIsPinned(false);
      fetchApps();
    } catch (err: any) {
      alert(err.message || 'Error adding application');
    }
  };

  const handleTogglePin = async (id: number) => {
    try {
      await api.post(`/apps/${id}/pin`);
      fetchApps();
    } catch (err: any) {
      alert(err.message || 'Error toggling pin');
    }
  };

  const handleDeleteApp = async (id: number) => {
    if (!confirm('Are you sure you want to remove this application shortcut?')) return;
    try {
      await api.delete(`/apps/${id}`);
      fetchApps();
    } catch (err: any) {
      alert(err.message || 'Error deleting app');
    }
  };

  const handleLaunch = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Portal Modal Handlers
  const handleOpenConnectModal = (app: ConnectedApp) => {
    setSelectedPortalApp(app);
    setPortalUserId('');
    setPortalPassword('');
    setShowPassword(false);
    setModalFeedback(null);
    setIsConnectModalOpen(true);
  };

  const handleConnectPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortalApp) return;

    if (!portalUserId.trim() || !portalPassword) {
      setModalFeedback({ type: 'error', message: 'User ID / Email and Password are required.' });
      return;
    }

    setIsConnecting(true);
    setModalFeedback(null);

    try {
      const res: any = await api.post(`/apps/${selectedPortalApp.id}/connect`, {
        userId: portalUserId.trim(),
        password: portalPassword
      });

      // Secure cleanup: never keep password in memory or state
      setPortalPassword('');
      setModalFeedback({
        type: 'success',
        message: res.message || 'Credentials encrypted via AES-256-GCM and stored. Live production authentication will be validated in Phase 2.'
      });
      fetchApps();
    } catch (err: any) {
      setModalFeedback({
        type: 'error',
        message: err.message || 'Failed to save portal connection.'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedPortalApp) return;
    setIsTesting(true);
    setModalFeedback(null);

    try {
      const res: any = await api.post(`/apps/${selectedPortalApp.id}/test-connection`);
      setModalFeedback({
        type: 'success',
        message: res.message || 'Stored encrypted credentials validated.'
      });
      fetchApps();
    } catch (err: any) {
      setModalFeedback({
        type: 'error',
        message: err.message || 'Test connection check failed.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnectPortal = async () => {
    if (!selectedPortalApp) return;
    if (!confirm(`Are you sure you want to disconnect ${selectedPortalApp.name} and purge all stored credentials?`)) return;

    setIsDisconnecting(true);
    setModalFeedback(null);

    try {
      const res: any = await api.post(`/apps/${selectedPortalApp.id}/disconnect`);
      setModalFeedback({
        type: 'info',
        message: res.message || 'Portal disconnected and credentials removed.'
      });
      fetchApps();
    } catch (err: any) {
      setModalFeedback({
        type: 'error',
        message: err.message || 'Failed to disconnect portal.'
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSyncPortalNow = async () => {
    if (!selectedPortalApp) return;
    setIsSyncing(true);
    setModalFeedback(null);

    try {
      await api.post(`/apps/${selectedPortalApp.id}/sync-now`);
      fetchApps();
    } catch (err: any) {
      setModalFeedback({
        type: 'info',
        message: err.message || 'Automated sync is scheduled for Phase 4.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Calendar': return Calendar;
      case 'Mail': return Mail;
      case 'HardDrive': return HardDrive;
      case 'Users': return Users;
      case 'Briefcase': return Briefcase;
      case 'FileText': return FileText;
      case 'BookOpen': return BookOpen;
      case 'Building2': return Building2;
      case 'Share2': return Share2;
      default: return Globe;
    }
  };

  const categories = [
    { id: 'all', label: 'All Applications' },
    { id: 'business', label: 'Business & CRM' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'communication', label: 'Communication' },
    { id: 'cloud', label: 'Cloud Storage' },
    { id: 'custom', label: 'Custom Portals' }
  ];

  const filtered = apps.filter((app) => {
    const matchesCat = activeCategory === 'all' || app.category === activeCategory;
    const matchesQuery = (app.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (app.app_url || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#20242C] tracking-tight">Connected Applications Hub</h2>
          <p className="text-sm text-[#667085] mt-0.5">
            Unified launchpad and master lead integration console for EAF Connect, BNI Connect, KVV, and enterprise cloud tools
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="cockpit-btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Add Application Shortcut</span>
        </button>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E9EAEE] shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-semibold">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#D62839] text-white shadow-xs font-bold'
                  : 'text-[#667085] hover:text-[#20242C] hover:bg-[#FFF1F2]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="cockpit-input pl-9 pr-3 py-1.5 text-xs"
          />
        </div>
      </div>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((app) => {
          const Icon = getIcon(app.icon_name);
          const isPinned = Number(app.is_pinned) === 1;
          const isPortal = Boolean(app.is_portal);

          return (
            <div 
              key={app.id}
              className={`p-5 rounded-2xl bg-white border transition-all flex flex-col justify-between h-full min-h-[265px] group shadow-xs ${
                isPortal 
                  ? 'border-[#FECDD3] hover:border-[#D62839] hover:shadow-md ring-1 ring-[#FFF1F2]' 
                  : 'border-[#E9EAEE] hover:border-[#FECDD3] hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-3.5">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center group-hover:scale-105 transition-transform ${
                    isPortal 
                      ? 'bg-[#FFF1F2] text-[#D62839] border-[#FECDD3]' 
                      : 'bg-[#F8F9FB] text-[#20242C] border-[#E9EAEE]'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePin(app.id)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isPinned ? 'text-[#D62839] bg-[#FFF1F2]' : 'text-[#94A3B8] hover:text-[#20242C]'
                      }`}
                      title={isPinned ? 'Unpin Application' : 'Pin to Top'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    {!isPortal && (
                      <button
                        onClick={() => handleDeleteApp(app.id)}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#DC2626] transition-colors cursor-pointer"
                        title="Delete Application"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#20242C] tracking-tight">{app.name}</h3>
                  {isPortal && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3] uppercase tracking-wider">
                      Master CRM
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#667085] font-mono truncate mt-0.5 max-w-[240px]">{app.app_url}</p>

                <div className="mt-3 flex items-center justify-between">
                  <Badge status={app.connection_status} />
                  <span className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider">{app.category}</span>
                </div>
              </div>

              {/* Card Footer Actions */}
              {isPortal ? (
                <div className="mt-5 pt-3 border-t border-[#E9EAEE] space-y-3">
                  {/* Real Sync Metadata */}
                  <div className="bg-[#F8F9FB] p-2.5 rounded-xl border border-[#E9EAEE] text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-[#667085]">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-[#94A3B8]" /> Last Sync:
                      </span>
                      <span className="font-semibold text-[#20242C]">
                        {app.last_synced_at ? new Date(app.last_synced_at).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                    {app.last_error && (
                      <p className="text-[10px] text-[#DC2626] font-medium truncate" title={app.last_error}>
                        Error: {app.last_error}
                      </p>
                    )}
                  </div>

                  {/* Connect / Reconnect / Manage Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenConnectModal(app)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                        app.connection_status === 'connected'
                          ? 'bg-[#ECFDF5] hover:bg-[#059669] text-[#059669] hover:text-white border border-[#A7F3D0]'
                          : app.connection_status === 'expired' || app.connection_status === 'captcha_required'
                          ? 'bg-[#FEF2F2] hover:bg-[#DC2626] text-[#DC2626] hover:text-white border border-[#FECDD3]'
                          : 'bg-[#FFF1F2] hover:bg-[#D62839] text-[#D62839] hover:text-white border border-[#FECDD3]'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>
                        {app.connection_status === 'connected'
                          ? 'Manage Connection'
                          : app.connection_status === 'expired' || app.connection_status === 'captcha_required'
                          ? 'Reconnect Portal'
                          : 'Connect Portal'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleLaunch(app.app_url)}
                      className="p-2 rounded-xl bg-[#F8F9FB] hover:bg-[#FFF1F2] text-[#667085] hover:text-[#D62839] border border-[#E9EAEE] transition-all cursor-pointer"
                      title={`Visit ${app.name} Portal in new tab`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 pt-3 border-t border-[#E9EAEE] flex items-center gap-2">
                  <button
                    onClick={() => handleLaunch(app.app_url)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#FFF1F2] hover:bg-[#D62839] text-[#D62839] hover:text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
                  >
                    <span>Launch Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-16 text-center rounded-2xl bg-white border border-[#E9EAEE] shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3] flex items-center justify-center mb-3">
            <Globe className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-[#20242C]">No applications found</h4>
          <p className="text-sm text-[#667085] mt-1 max-w-sm mx-auto">
            Add shortcuts to external SaaS services, partner networks, or internal enterprise URLs.
          </p>
        </div>
      )}

      {/* Security notice regarding external logins */}
      <div className="p-4 rounded-2xl bg-white border border-[#E9EAEE] shadow-xs flex items-start gap-3 text-xs text-[#667085]">
        <ShieldCheck className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[#20242C]">Enterprise Cryptographic Security & AES-256-GCM Isolation</p>
          <p className="mt-0.5 leading-relaxed text-[#667085]">
            Portal credentials are encrypted using AEAD AES-256-GCM on the server before storage. Raw passwords, session tokens, and cookies are never stored in browser memory, localStorage, or sent to unauthenticated clients.
          </p>
        </div>
      </div>

      {/* SECURE PORTAL CONNECTION MODAL */}
      <Modal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        title={selectedPortalApp ? `Connect ${selectedPortalApp.name}` : 'Connect Portal'}
      >
        {selectedPortalApp && (
          <div className="space-y-4">
            {/* Status and metadata overview */}
            <div className="bg-[#F8F9FB] border border-[#E9EAEE] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#667085] font-medium">Portal Target</p>
                <p className="text-xs font-mono font-bold text-[#20242C] mt-0.5">{selectedPortalApp.app_url}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#667085] font-medium">Status</p>
                <div className="mt-0.5">
                  <Badge status={selectedPortalApp.connection_status} />
                </div>
              </div>
            </div>

            {/* Security Callout */}
            <div className="p-3 bg-[#FFF1F2] border border-[#FECDD3] rounded-xl flex items-start gap-2.5 text-xs text-[#D62839]">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Encrypted Credentials: </span>
                Your credentials are encrypted using server-side AES-256-GCM. They are never logged, exposed to third parties, or stored in plaintext.
              </div>
            </div>

            {/* Feedback Alert */}
            {modalFeedback && (
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                modalFeedback.type === 'success'
                  ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
                  : modalFeedback.type === 'error'
                  ? 'bg-[#FEF2F2] border-[#FECDD3] text-[#DC2626]'
                  : 'bg-[#EFF8FF] border-[#B2DDFF] text-[#175CD3]'
              }`}>
                {modalFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : modalFeedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div className="font-medium leading-relaxed">{modalFeedback.message}</div>
              </div>
            )}

            {/* Connection Form */}
            <form onSubmit={handleConnectPortal} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
                  Member User ID / Email
                </label>
                <input
                  type="text"
                  required
                  value={portalUserId}
                  onChange={(e) => setPortalUserId(e.target.value)}
                  placeholder={`Authorized ${selectedPortalApp.name} username or email`}
                  className="cockpit-input"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
                  Portal Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={portalPassword}
                    onChange={(e) => setPortalPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="cockpit-input pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#20242C] transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Credentials are used solely to establish an authorized member session.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#E9EAEE]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="cockpit-btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                    title="Validate stored encrypted credentials"
                  >
                    {isTesting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
                    )}
                    <span>Test Connection</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncPortalNow}
                    disabled={isSyncing}
                    className="cockpit-btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                    title="Trigger immediate sync"
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-[#D62839]" />
                    )}
                    <span>Sync Now</span>
                  </button>

                  {selectedPortalApp.has_stored_credentials && (
                    <button
                      type="button"
                      onClick={handleDisconnectPortal}
                      disabled={isDisconnecting}
                      className="text-xs py-2 px-3 text-[#DC2626] hover:bg-[#FEF2F2] rounded-xl font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      title="Disconnect and purge saved credentials"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsConnectModalOpen(false)}
                    className="cockpit-btn-secondary text-xs py-2 px-3"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="cockpit-btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Encrypting & Saving...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Save & Connect</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* ADD APPLICATION SHORTCUT MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Application Shortcut"
      >
        <form onSubmit={handleCreateApp} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
              Application Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Right Form or Custom ERP"
              className="cockpit-input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
              Application URL
            </label>
            <input
              type="url"
              required
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="https://example.com"
              className="cockpit-input font-mono"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="cockpit-input"
              >
                <option value="business">Business & CRM</option>
                <option value="productivity">Productivity</option>
                <option value="communication">Communication</option>
                <option value="cloud">Cloud Storage</option>
                <option value="custom">Custom Web Portal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
                Icon Representation
              </label>
              <select
                value={iconName}
                onChange={(e) => setIconName(e.target.value)}
                className="cockpit-input"
              >
                <option value="Globe">Globe / Web</option>
                <option value="Calendar">Calendar</option>
                <option value="Mail">Email / Mail</option>
                <option value="HardDrive">Cloud Drive</option>
                <option value="Users">Networking / Users</option>
                <option value="Briefcase">Enterprise Briefcase</option>
                <option value="FileText">Forms & Docs</option>
                <option value="BookOpen">Notes & Knowledge</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
              Connection Status
            </label>
            <select
              value={connectionStatus}
              onChange={(e) => setConnectionStatus(e.target.value as any)}
              className="cockpit-input"
            >
              <option value="launcher_only">Launcher Only (Direct Link)</option>
              <option value="connected">Connected (OAuth / API)</option>
              <option value="config_required">Configuration Required</option>
              <option value="unsupported">Unsupported</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E9EAEE]">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="cockpit-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              Save Application
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ConnectedApps;
