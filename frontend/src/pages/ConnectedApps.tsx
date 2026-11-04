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
  AlertTriangle,
  Copy,
  Check,
  Settings2
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import type { ConnectedApp } from '../types';

interface ConnectedAppsProps {
  onNavigateToGmail?: () => void;
}

export const ConnectedApps: React.FC<ConnectedAppsProps> = ({ onNavigateToGmail }) => {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Gmail OAuth State
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [showGoogleCredsConfig, setShowGoogleCredsConfig] = useState(false);
  const [isSavingGoogleCreds, setIsSavingGoogleCreds] = useState(false);
  const [isGettingGoogleAuth, setIsGettingGoogleAuth] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);

  const fetchApps = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await api.get('/apps');
      setApps(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load connected apps', err);
      setError(err?.message || 'Failed to load connected applications. Please check your connection or session.');
    } finally {
      setLoading(false);
    }
  };

  const canonicalCallbackUri = 'http://localhost/mycockpit/backend/api/gmail/oauth/callback';

  const copyCallbackUri = () => {
    navigator.clipboard.writeText(canonicalCallbackUri);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
  };

  useEffect(() => {
    fetchApps();

    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('oauth_error');
    if (oauthError) {
      setError(`Google OAuth Authorization: ${decodeURIComponent(oauthError)}`);
    }
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
    setShowGoogleCredsConfig(false);
    setIsConnectModalOpen(true);
  };

  const handleConnectGoogle = async () => {
    setIsGettingGoogleAuth(true);
    setModalFeedback(null);
    try {
      const res: any = await api.get('/gmail/auth-url');
      if (res?.auth_url) {
        window.location.href = res.auth_url;
      } else {
        setModalFeedback({
          type: 'error',
          message: 'Could not obtain Google authorization URL.'
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to initiate Google OAuth flow.';
      setModalFeedback({
        type: 'error',
        message: msg
      });
      if (msg.toLowerCase().includes('not configured') || msg.toLowerCase().includes('client id')) {
        setShowGoogleCredsConfig(true);
      }
    } finally {
      setIsGettingGoogleAuth(false);
    }
  };

  const handleSaveGoogleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleClientId.trim() || !googleClientSecret.trim()) {
      setModalFeedback({
        type: 'error',
        message: 'Google Client ID and Client Secret are both required.'
      });
      return;
    }
    setIsSavingGoogleCreds(true);
    setModalFeedback(null);
    try {
      await api.post('/gmail/configure', {
        client_id: googleClientId.trim(),
        client_secret: googleClientSecret.trim()
      });
      setModalFeedback({
        type: 'success',
        message: 'Google OAuth Client Credentials saved and encrypted securely. You can now click "Authorize with Google".'
      });
      setShowGoogleCredsConfig(false);
    } catch (err: any) {
      setModalFeedback({
        type: 'error',
        message: err?.message || 'Failed to save Google credentials.'
      });
    } finally {
      setIsSavingGoogleCreds(false);
    }
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
      fetchApps();
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
      fetchApps();
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

  const [syncingAppId, setSyncingAppId] = useState<number | null>(null);

  const handleCardSyncNow = async (app: ConnectedApp) => {
    setSyncingAppId(app.id);
    try {
      await api.post(`/apps/${app.id}/sync-now`);
      fetchApps();
    } catch (err: any) {
      alert(err?.message || 'Synchronization failed.');
    } finally {
      setSyncingAppId(null);
    }
  };

  const handleSyncPortalNow = async () => {
    if (!selectedPortalApp) return;
    setIsSyncing(true);
    setModalFeedback(null);

    try {
      const res: any = await api.post(`/apps/${selectedPortalApp.id}/sync-now`);
      setModalFeedback({
        type: 'success',
        message: res?.message || 'Portal synchronized successfully!'
      });
      fetchApps();
    } catch (err: any) {
      setModalFeedback({
        type: 'error',
        message: err?.message || 'Synchronization failed.'
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

  const matchesCategory = (app: ConnectedApp, catId: string): boolean => {
    if (catId === 'all') return true;

    const cat = (app.category || '').toLowerCase();
    const name = (app.name || '').toLowerCase();
    const isPortal = Boolean(app.is_portal) || ['eaf', 'bni', 'kvv'].includes(app.source_key || '');

    if (catId === 'business') {
      return cat === 'business' || isPortal;
    }
    if (catId === 'productivity') {
      return cat === 'productivity' || cat === 'cloud' || name.includes('drive') || name.includes('calendar') || name.includes('notes') || name.includes('form');
    }
    if (catId === 'communication') {
      return cat === 'communication' || name.includes('gmail') || name.includes('mail');
    }
    if (catId === 'cloud') {
      return cat === 'cloud' || name.includes('drive');
    }
    if (catId === 'custom') {
      return isPortal || cat === 'custom';
    }
    return cat === catId;
  };

  const getCategoryCount = (catId: string) => {
    return apps.filter((app) => matchesCategory(app, catId)).length;
  };

  const filtered = apps.filter((app) => {
    const matchesCat = matchesCategory(app, activeCategory);
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
          {categories.map((cat) => {
            const count = getCategoryCount(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? 'bg-[#D62839] text-white shadow-xs font-bold'
                    : 'text-[#667085] hover:text-[#20242C] hover:bg-[#FFF1F2]'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeCategory === cat.id ? 'bg-white/20 text-white' : 'bg-[#F8F9FB] text-[#667085]'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
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

      {/* Applications Display with Loading & Error States */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="p-5 rounded-2xl bg-white border border-[#E9EAEE] min-h-[265px] animate-pulse flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-start justify-between mb-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100" />
                  <div className="w-5 h-5 rounded bg-slate-100" />
                </div>
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
                <div className="h-5 bg-slate-100 rounded w-1/3" />
              </div>
              <div className="h-10 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-[#FECDD3] shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FECDD3] flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-[#20242C]">Unable to load applications</h4>
          <p className="text-sm text-[#667085] mt-1 max-w-sm mx-auto">{error}</p>
          <button
            onClick={fetchApps}
            className="mt-4 px-4 py-2 rounded-xl bg-[#D62839] hover:bg-[#B91C1C] text-white text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : (
        <>
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

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="shrink-0">
                        <Badge status={app.connection_status} />
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-[#667085] bg-[#F8F9FB] border border-[#E9EAEE] uppercase tracking-wider">
                        {app.category}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  {isPortal ? (
                    <div className="mt-4 pt-3 border-t border-[#E9EAEE] space-y-2.5">
                      {/* Structured Portal Lifecycle Fields */}
                      <div className="bg-[#F8F9FB] p-3 rounded-xl border border-[#E9EAEE] space-y-2 text-xs">
                        {/* 1. Authentication Status */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[#667085] font-medium">Auth Status:</span>
                          <Badge status={app.auth_status || app.connection_status} />
                        </div>

                        {/* 2. Integration Capability */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[#667085] font-medium">Capability:</span>
                          <span className="font-semibold text-[#20242C] text-right truncate max-w-[160px]" title={app.integration_capability}>
                            {app.integration_capability || 'Manual CSV Import Only'}
                          </span>
                        </div>

                        {/* 3. Synchronization Status */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[#667085] font-medium">Sync Status:</span>
                          <Badge status={app.sync_status || 'sync_never_run'} />
                        </div>

                        {/* 4. Last Successful Sync */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[#667085] font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#94A3B8]" /> Last Sync:
                          </span>
                          <span className="font-semibold text-[#20242C]">
                            {app.last_sync_display || (app.last_synced_at ? new Date(app.last_synced_at).toLocaleString() : 'Never')}
                          </span>
                        </div>

                        {/* 5. Last Error (if present) */}
                        {app.last_error && (
                          <div className="p-2 rounded-lg bg-[#FEF2F2] border border-[#FECDD3] text-[10px] text-[#DC2626] leading-tight" title={app.last_error}>
                            <span className="font-bold">Notice: </span>
                            {app.last_error}
                          </div>
                        )}
                      </div>

                      {/* 6. Next Required Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        {app.source_key === 'gmail' && app.connection_status === 'connected' ? (
                          <>
                            <button
                              onClick={() => onNavigateToGmail ? onNavigateToGmail() : (window.location.href = '/?tab=gmail')}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#FFF1F2] hover:bg-[#D62839] text-[#D62839] hover:text-white border border-[#FECDD3] text-xs font-semibold transition-all shadow-xs cursor-pointer"
                              title="Open Gmail Workspace"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Open Workspace</span>
                            </button>
                            <button
                              onClick={() => handleCardSyncNow(app)}
                              disabled={syncingAppId === app.id}
                              className="p-2 rounded-xl bg-[#ECFDF5] hover:bg-[#059669] text-[#059669] hover:text-white border border-[#A7F3D0] transition-all cursor-pointer"
                              title="Sync Emails Now"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${syncingAppId === app.id ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              onClick={() => handleOpenConnectModal(app)}
                              className="p-2 rounded-xl bg-[#F8F9FB] hover:bg-[#E9EAEE] text-[#667085] border border-[#E9EAEE] transition-all cursor-pointer"
                              title="Manage Google OAuth Connection"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : app.next_action_key === 'sync_now' ? (
                          <>
                            <button
                              onClick={() => handleCardSyncNow(app)}
                              disabled={syncingAppId === app.id}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#ECFDF5] hover:bg-[#059669] text-[#059669] hover:text-white border border-[#A7F3D0] text-xs font-semibold transition-all shadow-xs cursor-pointer"
                              title="Run live referral sync from portal"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${syncingAppId === app.id ? 'animate-spin' : ''}`} />
                              <span>{syncingAppId === app.id ? 'Syncing...' : 'Sync Leads Now'}</span>
                            </button>
                            <button
                              onClick={() => handleOpenConnectModal(app)}
                              className="p-2 rounded-xl bg-[#F8F9FB] hover:bg-[#E9EAEE] text-[#667085] border border-[#E9EAEE] transition-all cursor-pointer"
                              title="Manage Connection Credentials"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleOpenConnectModal(app)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#F8F9FB] hover:bg-[#D62839] text-[#667085] hover:text-white border border-[#E9EAEE] text-xs font-semibold transition-all shadow-xs cursor-pointer"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>{app.source_key === 'gmail' ? 'Connect Google OAuth' : (app.next_action || 'Connect Portal')}</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleLaunch(app.app_url)}
                          className="p-2 rounded-xl bg-[#F8F9FB] hover:bg-[#FFF1F2] text-[#667085] hover:text-[#D62839] border border-[#E9EAEE] transition-all cursor-pointer"
                          title={`Visit ${app.name} in new browser tab`}
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
                No applications match this filter or search query. Switch categories or add a new application shortcut.
              </p>
            </div>
          )}
        </>
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

            {/* Conditional Portal View: Google OAuth vs Member Credentials */}
            {selectedPortalApp.source_key === 'gmail' ? (
              <div className="space-y-4">
                {/* Platform Guidance Callout */}
                <div className="p-3.5 bg-[#FFF1F2] border border-[#FECDD3] rounded-xl flex items-start gap-2.5 text-xs text-[#20242C]">
                  <Mail className="w-4 h-4 text-[#D62839] shrink-0 mt-0.5" />
                  <div className="space-y-1.5 leading-relaxed">
                    <p className="font-bold text-[#D62839]">
                      Official Google Workspace & Gmail Integration (OAuth 2.0 + PKCE)
                    </p>
                    <p className="text-[#667085]">
                      Connects directly using Google's official authorization code flow with PKCE. Access and refresh tokens are encrypted using AEAD AES-256-GCM. <strong>Passwords are never requested or stored.</strong>
                    </p>
                    <div className="pt-1">
                      <span className="font-semibold text-[#20242C]">Approved Minimal Scopes:</span>
                      <ul className="list-disc list-inside mt-0.5 text-[11px] text-[#667085] space-y-0.5">
                        <li><code className="text-[#D62839] font-mono">gmail.readonly</code> – Read emails, threads & search inbox</li>
                        <li><code className="text-[#D62839] font-mono">gmail.send</code> – Send emails & replies directly from Cockpit</li>
                        <li><code className="text-[#D62839] font-mono">gmail.compose</code> – Compose and update draft emails</li>
                        <li><code className="text-[#D62839] font-mono">gmail.modify</code> – Star, label, archive & trash emails</li>
                        <li><code className="text-[#D62839] font-mono">openid, email</code> – Authenticated user profile identity</li>
                      </ul>
                    </div>
                    <div className="p-2 rounded bg-white border border-[#FECDD3] text-[10.5px] text-[#B91C1C]">
                      <strong>Google Cloud Testing Mode Note:</strong> In Google Cloud "Testing" mode, OAuth refresh tokens expire after 7 days, and only designated Test Users can authorize.
                    </div>
                  </div>
                </div>

                {/* Canonical Redirect URI Callout */}
                <div className="p-3 bg-[#F8F9FB] border border-[#E9EAEE] rounded-xl text-xs space-y-1">
                  <span className="text-[#667085] font-medium block">Canonical Backend OAuth Callback URI:</span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white border border-[#E9EAEE] px-2.5 py-1.5 rounded-lg font-mono text-[11px] text-[#20242C] select-all truncate">
                      {canonicalCallbackUri}
                    </code>
                    <button
                      type="button"
                      onClick={copyCallbackUri}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E9EAEE] bg-white hover:bg-[#F8F9FB] text-xs font-semibold text-[#20242C] flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedCallback ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : <Copy className="w-3.5 h-3.5 text-[#667085]" />}
                      <span>{copiedCallback ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-[#94A3B8]">
                    This exact URI must be registered in your Google Cloud Console under "Authorized redirect URIs".
                  </p>
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

                {/* OAuth Actions based on connection status */}
                {selectedPortalApp.connection_status === 'connected' ? (
                  <div className="space-y-3 pt-1">
                    <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl flex items-center justify-between text-xs text-[#059669]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-bold">Connected Account:</span>
                        <span className="font-mono">{selectedPortalApp.connected_email || 'Active Google Session'}</span>
                      </div>
                      <Badge status="connected" />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E9EAEE]">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          disabled={isTesting}
                          className="cockpit-btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                          title="Validate OAuth Access Token"
                        >
                          {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />}
                          <span>Test Session</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSyncPortalNow}
                          disabled={isSyncing}
                          className="cockpit-btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                          title="Run Live Sync"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-[#D62839] ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>Sync Now</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectPortal}
                          disabled={isDisconnecting}
                          className="text-xs py-2 px-3 text-[#DC2626] hover:bg-[#FEF2F2] rounded-xl font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          <span>Disconnect</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsConnectModalOpen(false);
                          if (onNavigateToGmail) {
                            onNavigateToGmail();
                          } else {
                            window.location.href = '/?tab=gmail';
                          }
                        }}
                        className="cockpit-btn-primary text-xs py-2 px-4 flex items-center gap-1.5 ml-auto"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Open Gmail Workspace</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        disabled={isGettingGoogleAuth}
                        className="flex-1 cockpit-btn-primary text-sm py-2.5 px-4 flex items-center justify-center gap-2"
                      >
                        {isGettingGoogleAuth ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Requesting Google Consent...</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-4 h-4" />
                            <span>Authorize with Google OAuth</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowGoogleCredsConfig(!showGoogleCredsConfig)}
                        className="cockpit-btn-secondary text-xs py-2.5 px-3 flex items-center gap-1.5"
                        title="Configure Client ID and Secret"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>OAuth Credentials</span>
                      </button>
                    </div>

                    {/* Collapsible Client ID / Secret Configuration */}
                    {showGoogleCredsConfig && (
                      <form onSubmit={handleSaveGoogleCredentials} className="p-3.5 bg-[#F8F9FB] border border-[#E9EAEE] rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#20242C] flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-[#D62839]" />
                            Google Cloud OAuth 2.0 Credentials
                          </span>
                          <span className="text-[10px] text-[#667085]">AES-256-GCM Encrypted</span>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#667085] mb-1">
                            Google Client ID
                          </label>
                          <input
                            type="text"
                            required
                            value={googleClientId}
                            onChange={(e) => setGoogleClientId(e.target.value)}
                            placeholder="e.g. 123456789-xxxxxx.apps.googleusercontent.com"
                            className="cockpit-input text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#667085] mb-1">
                            Google Client Secret
                          </label>
                          <input
                            type="password"
                            required
                            value={googleClientSecret}
                            onChange={(e) => setGoogleClientSecret(e.target.value)}
                            placeholder="GOCSPX-••••••••••••••••••••"
                            className="cockpit-input text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowGoogleCredsConfig(false)}
                            className="cockpit-btn-secondary text-xs py-1.5 px-3"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSavingGoogleCreds}
                            className="cockpit-btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                          >
                            {isSavingGoogleCreds ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                            <span>Save Credentials</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Platform Guidance Callout */}
                {selectedPortalApp.source_key === 'bni' ? (
                  <div className="p-3 bg-[#EFF8FF] border border-[#B2DDFF] rounded-xl flex items-start gap-2.5 text-xs text-[#175CD3]">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">BNI Connect Authentication & AES-256-GCM: </span>
                      Enter your BNI Connect Username or Email and Password to authenticate directly with BNI Connect Global. If Cloudflare bot protection or CAPTCHA challenges appear, complete them in browser. Raw passwords are never stored in browser memory.
                    </div>
                  </div>
                ) : selectedPortalApp.source_key === 'kvv' ? (
                  <div className="p-3 bg-[#FFF8F1] border border-[#FDE68A] rounded-xl flex items-start gap-2.5 text-xs text-[#D97706]">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">KVV Member Authentication & Direct Sync: </span>
                      Enter your 10-digit registered mobile number and password to connect directly to the Kannada Vyapaara Vedike platform. Authenticated referrals will be retrieved and synchronized directly with CRM.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-[#FFF1F2] border border-[#FECDD3] rounded-xl flex items-start gap-2.5 text-xs text-[#D62839]">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Two-Way Web Automation & AES-256-GCM: </span>
                      EAF Connect member sessions are verified against your live member dashboard. Credentials are encrypted on the server with AES-256-GCM and never exposed to the client.
                    </div>
                  </div>
                )}

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
                      {selectedPortalApp.source_key === 'kvv' ? 'Registered Mobile Number (10 Digits)' : 'Member User ID / Email'}
                    </label>
                    <input
                      type="text"
                      required
                      value={portalUserId}
                      onChange={(e) => setPortalUserId(e.target.value)}
                      placeholder={
                        selectedPortalApp.source_key === 'kvv'
                          ? 'e.g. 9876543210'
                          : selectedPortalApp.source_key === 'bni'
                          ? 'BNI Username or Email'
                          : `Authorized ${selectedPortalApp.name} username or email`
                      }
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
              </>
            )}
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
