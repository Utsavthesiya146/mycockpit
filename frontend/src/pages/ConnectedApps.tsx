import React, { useState, useEffect, useRef } from 'react';
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
  Settings2,
  MoreVertical,
  Sliders,
  ChevronDown,
  Info,
  KeyRound
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { Cockpit3DLoader } from '../components/common/Cockpit3DLoader';
import type { ConnectedApp } from '../types';

interface ConnectedAppsProps {
  onNavigateToGmail?: () => void;
}

export const ConnectedApps: React.FC<ConnectedAppsProps> = ({ onNavigateToGmail }) => {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Three-dot Action Menu State (App ID currently showing dropdown)
  const [activeMenuAppId, setActiveMenuAppId] = useState<number | null>(null);

  // Add Application Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [category, setCategory] = useState<ConnectedApp['category']>('business');
  const [iconName, setIconName] = useState('Globe');
  const [connectionStatus, setConnectionStatus] = useState<ConnectedApp['connection_status']>('launcher_only');
  const [isPinned, setIsPinned] = useState(false);

  // Edit Application Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<ConnectedApp | null>(null);
  const [editName, setEditName] = useState('');
  const [editAppUrl, setEditAppUrl] = useState('');
  const [editCategory, setEditCategory] = useState<ConnectedApp['category']>('business');
  const [editIconName, setEditIconName] = useState('Globe');
  const [editSyncInterval, setEditSyncInterval] = useState<number>(15);
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editFeedback, setEditFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Reconnect / Change Account Modal State
  const [isReconnectModalOpen, setIsReconnectModalOpen] = useState(false);
  const [reconnectingApp, setReconnectingApp] = useState<ConnectedApp | null>(null);
  const [reconnectUserId, setReconnectUserId] = useState('');
  const [reconnectPassword, setReconnectPassword] = useState('');
  const [showReconnectPassword, setShowReconnectPassword] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnect3DLoading, setReconnect3DLoading] = useState(false);
  const [reconnectFeedback, setReconnectFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Delete Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingApp, setDeletingApp] = useState<ConnectedApp | null>(null);
  const [isDeletingApp, setIsDeletingApp] = useState(false);

  // Disconnect Confirmation Modal State
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [disconnectingApp, setDisconnectingApp] = useState<ConnectedApp | null>(null);
  const [isDisconnectingApp, setIsDisconnectingApp] = useState(false);

  // Legacy/Full Portal Connection Modal State (for full manage & test view)
  const [selectedPortalApp, setSelectedPortalApp] = useState<ConnectedApp | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [portalUserId, setPortalUserId] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Gmail Custom OAuth Keys State
  const [showGoogleCredsConfig, setShowGoogleCredsConfig] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [isSavingGoogleCreds, setIsSavingGoogleCreds] = useState(false);
  const [isGettingGoogleAuth, setIsGettingGoogleAuth] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);

  // Sync state
  const [syncingAppId, setSyncingAppId] = useState<number | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncAllFeedback, setSyncAllFeedback] = useState<string | null>(null);

  // -------------------------------------------------------------
  // DATA FETCHING
  // -------------------------------------------------------------
  const fetchApps = async () => {
    try {
      setError(null);
      const res: any = await api.get('/apps');
      if (res && Array.isArray(res.data)) {
        setApps(res.data);
      } else if (Array.isArray(res)) {
        setApps(res);
      } else {
        setApps([]);
      }
    } catch (err: any) {
      console.error('Failed to load connected apps', err);
      setError(err?.message || 'Failed to load connected applications. Please check your connection or session.');
    } finally {
      setLoading(false);
    }
  };

  const displayedCallbackUri = selectedPortalApp?.redirect_uri || (
    typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? `${window.location.origin}/api/gmail/oauth/callback`
      : 'http://localhost/mycockpit/backend/api/gmail/oauth/callback'
  );

  const copyCallbackUri = () => {
    navigator.clipboard.writeText(displayedCallbackUri);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    setSyncAllFeedback(null);
    try {
      await api.post('/apps/sync-all');
      setSyncAllFeedback('All connected applications synchronized successfully!');
      fetchApps();
      setTimeout(() => setSyncAllFeedback(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to synchronize all applications.');
    } finally {
      setIsSyncingAll(false);
    }
  };

  useEffect(() => {
    fetchApps();

    // Non-blocking automatic synchronization check on page mount
    api.post('/apps/sync-auto')
      .then((res: any) => {
        if (res?.synced_any) {
          fetchApps();
        }
      })
      .catch((err) => {
        console.warn('Auto-sync background check notice:', err);
      });

    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('oauth_error');
    if (oauthError) {
      setError(`Google OAuth Authorization: ${decodeURIComponent(oauthError)}`);
    }

    // Global click listener to close action menus when clicking outside
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.app-action-menu-container')) {
        setActiveMenuAppId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // -------------------------------------------------------------
  // EDIT APPLICATION HANDLERS
  // -------------------------------------------------------------
  const handleOpenEditModal = (app: ConnectedApp) => {
    setEditingApp(app);
    setEditName(app.name || '');
    setEditAppUrl(app.app_url || '');
    setEditCategory(app.category || 'business');
    setEditIconName(app.icon_name || 'Globe');
    setEditSyncInterval(app.sync_interval_minutes || 15);
    setEditNotes(app.settings_json?.notes || '');
    setEditFeedback(null);
    setIsEditModalOpen(true);
    setActiveMenuAppId(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp) return;

    setIsSavingEdit(true);
    setEditFeedback(null);

    try {
      await api.put(`/apps/${editingApp.id}`, {
        name: editName.trim(),
        app_url: editAppUrl.trim(),
        category: editCategory,
        icon_name: editIconName,
        sync_interval_minutes: editSyncInterval,
        settings_json: {
          notes: editNotes.trim(),
          updated_at: new Date().toISOString()
        }
      });

      setEditFeedback({
        type: 'success',
        message: 'Application configuration saved successfully!'
      });

      fetchApps();

      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditingApp(null);
      }, 900);
    } catch (err: any) {
      setEditFeedback({
        type: 'error',
        message: err?.message || 'Failed to save application configuration.'
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // -------------------------------------------------------------
  // RECONNECT / CHANGE ACCOUNT HANDLERS (WITH COCKPIT 3D LOADER)
  // -------------------------------------------------------------
  const handleOpenReconnectModal = (app: ConnectedApp) => {
    setReconnectingApp(app);
    setReconnectUserId('');
    setReconnectPassword('');
    setShowReconnectPassword(false);
    setReconnectFeedback(null);
    setShowGoogleCredsConfig(false);
    setIsReconnectModalOpen(true);
    setActiveMenuAppId(null);
  };

  const handleExecuteReconnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reconnectingApp) return;

    setReconnect3DLoading(true);
    setIsReconnecting(true);
    setReconnectFeedback(null);

    try {
      const payload: any = {};
      if (reconnectUserId.trim()) payload.username = reconnectUserId.trim();
      if (reconnectPassword) payload.password = reconnectPassword;

      const res: any = await api.post(`/apps/${reconnectingApp.id}/reconnect`, payload);

      // If Gmail OAuth returns an authorization URL, redirect to official Google consent flow
      if (res?.data?.auth_url || res?.auth_url) {
        window.location.href = res?.data?.auth_url || res?.auth_url;
        return;
      }

      setReconnectFeedback({
        type: 'success',
        message: res?.message || `Successfully connected with ${reconnectingApp.name}!`
      });

      // Clear password from state immediately
      setReconnectPassword('');
      fetchApps();

      setTimeout(() => {
        setIsReconnectModalOpen(false);
        setReconnectingApp(null);
      }, 1400);
    } catch (err: any) {
      setReconnectFeedback({
        type: 'error',
        message: err?.message || `Reconnection failed. Please check your credentials for ${reconnectingApp.name}.`
      });
    } finally {
      setIsReconnecting(false);
      setReconnect3DLoading(false);
    }
  };

  // -------------------------------------------------------------
  // DELETE APPLICATION HANDLERS
  // -------------------------------------------------------------
  const handleOpenDeleteModal = (app: ConnectedApp) => {
    setDeletingApp(app);
    setIsDeleteModalOpen(true);
    setActiveMenuAppId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingApp) return;
    setIsDeletingApp(true);
    try {
      await api.delete(`/apps/${deletingApp.id}`);
      setIsDeleteModalOpen(false);
      setDeletingApp(null);
      fetchApps();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete application.');
    } finally {
      setIsDeletingApp(false);
    }
  };

  // -------------------------------------------------------------
  // DISCONNECT PORTAL HANDLERS
  // -------------------------------------------------------------
  const handleOpenDisconnectModal = (app: ConnectedApp) => {
    setDisconnectingApp(app);
    setIsDisconnectModalOpen(true);
    setActiveMenuAppId(null);
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectingApp) return;
    setIsDisconnectingApp(true);
    try {
      await api.post(`/apps/${disconnectingApp.id}/disconnect`);
      setIsDisconnectModalOpen(false);
      setDisconnectingApp(null);
      fetchApps();
    } catch (err: any) {
      alert(err?.message || 'Failed to disconnect application.');
    } finally {
      setIsDisconnectingApp(false);
    }
  };

  // -------------------------------------------------------------
  // SYNC & PORTAL MODAL HANDLERS
  // -------------------------------------------------------------
  const handleCardSyncNow = async (app: ConnectedApp) => {
    setSyncingAppId(app.id);
    setActiveMenuAppId(null);
    try {
      if (app.source_key) {
        await api.post(`/apps/sync/${app.source_key}`);
      } else {
        await api.post(`/apps/${app.id}/sync-now`);
      }
      fetchApps();
    } catch (err: any) {
      alert(err?.message || 'Synchronization failed.');
    } finally {
      setSyncingAppId(null);
    }
  };

  const handleTogglePin = async (id: number) => {
    try {
      await api.post(`/apps/${id}/pin`);
      fetchApps();
    } catch (err: any) {
      alert(err?.message || 'Error toggling pin');
    }
  };

  const handleLaunch = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setActiveMenuAppId(null);
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
    try {
      await api.post('/gmail/credentials', {
        client_id: googleClientId.trim(),
        client_secret: googleClientSecret.trim()
      });
      setShowGoogleCredsConfig(false);
      setModalFeedback({
        type: 'success',
        message: 'Google OAuth Client ID and Secret saved securely (AES-256-GCM). Starting authorization...'
      });
      setTimeout(() => {
        handleConnectGoogle();
      }, 1000);
    } catch (err: any) {
      setModalFeedback({
        type: 'error',
        message: err?.message || 'Failed to save Google credentials.'
      });
    } finally {
      setIsSavingGoogleCreds(false);
    }
  };

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
      fetchApps();
    } catch (err: any) {
      alert(err?.message || 'Error adding application');
    }
  };

  // Helper icon lookup
  const getIcon = (name: string) => {
    switch (name) {
      case 'Calendar': return Calendar;
      case 'Mail': return Mail;
      case 'HardDrive': return HardDrive;
      case 'Users': return Users;
      case 'Briefcase': return Briefcase;
      case 'FileText': return FileText;
      case 'BookOpen': return BookOpen;
      case 'Building2': return Building2;
      case 'Share2': return Share2;
      case 'Link2': return Link2;
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

  const getCategoryCount = (catId: string) => {
    if (catId === 'all') return apps.length;
    return apps.filter(a => a.category === catId).length;
  };

  const filtered = apps.filter(app => {
    const matchesCat = activeCategory === 'all' || app.category === activeCategory;
    const matchesQuery = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         app.app_url.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Header with Title and Global Sync */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Connected Applications Hub</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Auto-Sync Active
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enterprise integrations, Master CRM portals, and cloud application launchpad with live AES-256-GCM encryption.
          </p>
        </div>
        
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="cockpit-btn-secondary text-xs flex items-center gap-2 py-2 px-3.5 shadow-xs cursor-pointer"
            title="Trigger automated synchronization across all configured platforms"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D62839] ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>{isSyncingAll ? 'Syncing All Portals...' : 'Sync All Portals'}</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="cockpit-btn-primary text-xs flex items-center gap-1.5 py-2 px-3.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Shortcut</span>
          </button>
        </div>
      </div>

      {/* Sync All Feedback Banner */}
      {syncAllFeedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 shadow-xs animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold">{syncAllFeedback}</span>
        </div>
      )}

      {/* Categories & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => {
            const count = getCategoryCount(cat.id);
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-rose-50 text-[#D62839] border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60 shadow-2xs' 
                    : 'bg-white dark:bg-[#0D111A] text-slate-600 dark:text-slate-400 border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-900/60'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-[#D62839] text-white' : 'bg-slate-100 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
            <div key={n} className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] min-h-[280px] animate-pulse flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-start justify-between mb-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/[0.05]" />
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.05]" />
                </div>
                <div className="h-4 bg-slate-100 dark:bg-white/[0.05] rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-100 dark:bg-white/[0.05] rounded w-1/2 mb-3" />
                <div className="h-5 bg-slate-100 dark:bg-white/[0.05] rounded w-1/3" />
              </div>
              <div className="h-10 bg-slate-100 dark:bg-white/[0.05] rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-10 text-center rounded-2xl bg-white dark:bg-[#0D111A] border border-rose-200 dark:border-rose-900/50 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-[#DC2626] border border-rose-200 dark:border-rose-900/50 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-900 dark:text-white">Unable to load applications</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">{error}</p>
          <button
            onClick={fetchApps}
            className="mt-4 cockpit-btn-primary inline-flex items-center gap-1.5"
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
              const isMenuOpen = activeMenuAppId === app.id;
              const isSyncSupported = Boolean(app.source_key && ['bni', 'eaf', 'kvv', 'gmail'].includes(app.source_key));
              const isConnected = app.connection_status === 'connected';

              return (
                <div 
                  key={app.id}
                  className={`p-5 rounded-2xl bg-white dark:bg-[#0D111A] border transition-all flex flex-col justify-between h-full min-h-[300px] group shadow-xs ${
                    isMenuOpen ? 'z-40 relative ring-2 ring-[#D62839]/30' : 'relative'
                  } ${
                    isPortal 
                      ? 'border-rose-200 dark:border-rose-900/40 hover:border-[#D62839] hover:shadow-md' 
                      : 'border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Top Row: Icon + Pin + Highly Visible Three-Dot Action Menu */}
                    <div className="flex items-start justify-between mb-3.5">
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center group-hover:scale-105 transition-transform ${
                        isPortal 
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border-rose-200 dark:border-rose-900/50' 
                          : 'bg-slate-50 dark:bg-white/[0.05] text-slate-900 dark:text-white border-slate-200/90 dark:border-white/[0.08]'
                      }`}>
                        <Icon className="w-6 h-6" />
                      </div>

                      <div className="flex items-center gap-1.5 app-action-menu-container relative">
                        {/* Pin Button */}
                        <button
                          onClick={() => handleTogglePin(app.id)}
                          className={`p-2 rounded-xl transition-all cursor-pointer border ${
                            isPinned 
                              ? 'text-[#D62839] dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50' 
                              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border-slate-200/80 dark:border-white/[0.08]'
                          }`}
                          title={isPinned ? 'Unpin Application' : 'Pin to Top'}
                          aria-label="Pin application"
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>

                        {/* Highly Visible Three-Dot Action Menu Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuAppId(isMenuOpen ? null : app.id);
                          }}
                          className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center border shadow-xs ${
                            isMenuOpen 
                              ? 'text-white bg-[#D62839] border-[#D62839] ring-2 ring-rose-500/30 shadow-sm' 
                              : 'text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-300 dark:border-white/[0.15]'
                          }`}
                          title="Application options & configuration"
                          aria-label="Application options"
                        >
                          <MoreVertical className="w-4 h-4 stroke-[2.5]" />
                        </button>

                        {/* Dropdown Popover Menu */}
                        {isMenuOpen && (
                          <div 
                            className="absolute right-0 top-11 z-50 w-60 bg-white dark:bg-[#121722] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.12] py-2 backdrop-blur-md text-xs animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="px-3.5 py-1.5 border-b border-slate-100 dark:border-white/[0.06] mb-1">
                              <p className="font-extrabold text-slate-900 dark:text-white truncate">{app.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{app.category}</p>
                              {app.connected_account_identifier && (
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium truncate mt-0.5">
                                  ✓ {app.connected_account_identifier}
                                </p>
                              )}
                            </div>

                            {/* 1. Edit Configuration */}
                            <button
                              onClick={() => handleOpenEditModal(app)}
                              className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-2.5 cursor-pointer font-medium transition-colors"
                            >
                              <Settings2 className="w-4 h-4 text-slate-500 shrink-0" />
                              <span>{isPortal ? 'Edit Configuration' : 'Edit Application'}</span>
                            </button>

                            {/* 2. Reconnect / Change Account (for portals) */}
                            {isPortal && (
                              <button
                                onClick={() => handleOpenReconnectModal(app)}
                                className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-2.5 cursor-pointer font-medium transition-colors"
                              >
                                <RefreshCw className="w-4 h-4 text-[#D62839] shrink-0" />
                                <span>{app.source_key === 'gmail' ? 'Reconnect / Change Google Account' : 'Reconnect / Change Account'}</span>
                              </button>
                            )}

                            {/* 3. Sync Now (for sync-capable portals) */}
                            {isSyncSupported && (
                              <button
                                onClick={() => handleCardSyncNow(app)}
                                disabled={syncingAppId === app.id}
                                className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-2.5 cursor-pointer font-medium transition-colors"
                              >
                                <RefreshCw className={`w-4 h-4 text-emerald-600 shrink-0 ${syncingAppId === app.id ? 'animate-spin' : ''}`} />
                                <span>{syncingAppId === app.id ? 'Syncing...' : 'Sync Leads Now'}</span>
                              </button>
                            )}

                            {/* 4. Launch Portal */}
                            <button
                              onClick={() => handleLaunch(app.app_url)}
                              className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-2.5 cursor-pointer font-medium transition-colors"
                            >
                              <ExternalLink className="w-4 h-4 text-slate-500 shrink-0" />
                              <span>Launch Portal</span>
                            </button>

                            <div className="my-1 border-t border-slate-100 dark:border-white/[0.06]" />

                            {/* 5. Disconnect (for portals) */}
                            {isPortal && (
                              <button
                                onClick={() => handleOpenDisconnectModal(app)}
                                className="w-full px-3.5 py-2 text-left text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2.5 cursor-pointer font-medium transition-colors"
                              >
                                <Unlink className="w-4 h-4 shrink-0" />
                                <span>Disconnect</span>
                              </button>
                            )}

                            {/* 6. Delete Application (for all) */}
                            <button
                              onClick={() => handleOpenDeleteModal(app)}
                              className="w-full px-3.5 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 cursor-pointer font-medium transition-colors"
                            >
                              <Trash2 className="w-4 h-4 shrink-0" />
                              <span>Delete Application</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* App Title & Identity */}
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">{app.name}</h3>
                      {isPortal && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 dark:bg-rose-950/50 text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 uppercase tracking-wider">
                          Master CRM
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5 max-w-[240px]">{app.app_url}</p>

                    {/* Badges: Connection status + Category */}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="shrink-0">
                        <Badge status={app.live_badge || app.connection_status} dot={app.is_syncing || app.live_badge === 'Syncing'} />
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.05] border border-slate-200/90 dark:border-white/[0.08] uppercase tracking-wider">
                        {app.category}
                      </span>
                    </div>
                  </div>

                  {/* Card Body & Footer Actions */}
                  {isPortal ? (
                    <div className="mt-4 pt-3 border-t border-slate-200/90 dark:border-white/[0.08] space-y-2.5">
                      {/* Structured Portal Lifecycle Fields */}
                      <div className="bg-slate-50/80 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06] space-y-2 text-xs">
                        {/* 1. Connected Account Display */}
                        <div className="flex items-center justify-between gap-1 py-1 px-1 bg-white/60 dark:bg-white/[0.02] rounded-lg border border-slate-200/50 dark:border-white/[0.04]">
                          <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>{app.source_key === 'kvv' ? 'Registered Mobile:' : 'Connected Account:'}</span>
                          </span>
                          <span className="font-mono font-semibold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                            {app.connected_account_identifier || (app.source_key === 'gmail' && app.connected_email ? app.connected_email : 'Active Session')}
                          </span>
                        </div>

                        {/* 2. Sync Status */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Sync Status:</span>
                          <Badge status={app.live_badge || app.connection_status} dot={app.is_syncing || app.live_badge === 'Syncing'} />
                        </div>

                        {/* 3. Integration Cadence */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Cadence:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            Every {app.sync_interval_minutes || 15}m auto-check
                          </span>
                        </div>

                        {/* 4. Last Successful Sync */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#94A3B8]" /> Last Synced:
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {app.last_synced_at ? new Date(app.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (app.last_sync_display || 'Never')}
                          </span>
                        </div>

                        {/* 5. Total Records Synchronized */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Records Synced:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {app.records_synced ?? (app.latest_sync_log ? app.latest_sync_log.leads_created + app.latest_sync_log.leads_updated : 0)} leads
                          </span>
                        </div>

                        {/* 6. Next Auto-Sync Countdown */}
                        {app.next_sync_at && (
                          <div className="flex items-center justify-between gap-1 text-[11px] pt-1 border-t border-slate-200/60 dark:border-white/[0.04]">
                            <span className="text-slate-500 dark:text-slate-400">Next Sync:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {app.seconds_until_next && app.seconds_until_next > 0 
                                ? `in ${Math.ceil(app.seconds_until_next / 60)} min`
                                : 'Due on refresh'}
                            </span>
                          </div>
                        )}

                        {/* 7. Last Error / Notice (if present) */}
                        {app.last_error && (
                          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[10px] text-rose-600 dark:text-rose-400 leading-tight" title={app.last_error}>
                            <span className="font-bold">Notice: </span>
                            {app.last_error}
                          </div>
                        )}
                      </div>

                      {/* Primary & Secondary Action Buttons */}
                      <div className="pt-1">
                        {app.source_key === 'gmail' ? (
                          /* GMAIL PROMINENT ACTION */
                          <div className="flex flex-col gap-2 w-full">
                            {/* Primary Button: Sync Leads Now (when connected) */}
                            {app.connection_status === 'connected' && (
                              <button
                                onClick={() => handleCardSyncNow(app)}
                                disabled={syncingAppId === app.id}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold tracking-wide transition-all shadow-sm cursor-pointer hover:shadow-md"
                                title="Sync emails and extract latest leads from Gmail"
                              >
                                <RefreshCw className={`w-4 h-4 ${syncingAppId === app.id ? 'animate-spin' : ''}`} />
                                <span>{syncingAppId === app.id ? 'Syncing Leads...' : 'Sync Leads Now'}</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenReconnectModal(app)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#D62839] hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer hover:shadow-md"
                              title="Reconnect or switch to a different Google Account"
                            >
                              <Mail className="w-4 h-4" />
                              <span>Reconnect / Change Google Account</span>
                            </button>
                            
                            {app.connection_status === 'connected' && (
                              <button
                                onClick={() => onNavigateToGmail ? onNavigateToGmail() : (window.location.href = '/?tab=gmail')}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open Gmail Workspace</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          /* PORTALS (BNI, EAF, KVV): HIGHLY PROMINENT SYNC LEADS NOW + RECONNECT/EDIT */
                          <div className="flex flex-col gap-2 w-full">
                            {/* 1. HIGH-IMPACT PRIMARY BUTTON: SYNC LEADS NOW */}
                            <button
                              onClick={() => handleCardSyncNow(app)}
                              disabled={syncingAppId === app.id}
                              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold tracking-wide transition-all shadow-sm cursor-pointer hover:shadow-md"
                              title={`Run live lead sync from ${app.name}`}
                            >
                              <RefreshCw className={`w-4 h-4 ${syncingAppId === app.id ? 'animate-spin' : ''}`} />
                              <span>{syncingAppId === app.id ? 'Syncing Leads...' : 'Sync Leads Now'}</span>
                            </button>

                            {/* 2. SECONDARY CONTROLS ROW: RECONNECT / CHANGE ACCOUNT + EDIT + LAUNCH */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenReconnectModal(app)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold border border-slate-200/90 dark:border-white/[0.08] transition-all cursor-pointer truncate"
                                title={`Reconnect or switch account credentials for ${app.name}`}
                              >
                                <RefreshCw className="w-3 h-3 text-[#D62839] shrink-0" />
                                <span className="truncate">Reconnect / Change</span>
                              </button>

                              <button
                                onClick={() => handleOpenEditModal(app)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] transition-all cursor-pointer shrink-0"
                                title="Edit Configuration"
                              >
                                <Settings2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleLaunch(app.app_url)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-[#D62839] border border-slate-200 dark:border-white/[0.08] transition-all cursor-pointer shrink-0"
                                title={`Visit ${app.name} in new browser tab`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* LAUNCHER-ONLY APPLICATIONS (Google Calendar, Drive, My iNotes, Right Form) */
                    <div className="mt-5 pt-3 border-t border-slate-200/90 dark:border-white/[0.08] space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                        <span>Integration Mode:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">Direct Web Shortcut</span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleLaunch(app.app_url)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-[#D62839] dark:hover:bg-[#D62839] text-slate-700 dark:text-slate-200 hover:text-white border border-slate-200 dark:border-white/[0.08] text-xs font-semibold transition-all shadow-xs cursor-pointer"
                          title={`Open ${app.name} in new browser tab`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Launch Portal</span>
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(app)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] transition-all cursor-pointer"
                          title="Edit Configuration"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
              <EmptyState
                icon={Globe}
                title="No applications found"
                description={searchQuery ? `No shortcuts match "${searchQuery}".` : 'No connected applications found for this category.'}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 cockpit-btn-secondary text-xs"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Security Notice Card */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] flex items-start gap-3.5 shadow-xs">
        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Enterprise Cryptographic Security & AES-256-GCM Isolation</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400">
              Zero Plaintext Exposure
            </span>
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Portal credentials are encrypted using AES-256-GCM prior to database storage. Raw passwords, session tokens, and web cookies are never stored in browser memory, local storage, or sent to unauthorized clients. Multi-tenant boundary isolation guarantees complete data segregation.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. EDIT APPLICATION CONFIGURATION MODAL */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingApp(null);
        }}
        title={editingApp ? `Edit ${editingApp.name}` : 'Edit Application'}
      >
        {editingApp && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Status & Identity Ribbon */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-white/[0.08] rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Integration Type</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                  {editingApp.is_portal ? 'Master CRM / Portal Integration' : 'Direct Browser Shortcut'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Status</p>
                <div className="mt-0.5">
                  <Badge status={editingApp.live_badge || editingApp.connection_status} />
                </div>
              </div>
            </div>

            {/* Application Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Application Name *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. BNI Connect, EAF Connect"
                className="cockpit-input"
              />
            </div>

            {/* Application URL */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Portal URL *
              </label>
              <input
                type="url"
                required
                value={editAppUrl}
                onChange={(e) => setEditAppUrl(e.target.value)}
                placeholder="https://..."
                className="cockpit-input font-mono text-xs"
              />
            </div>

            {/* Category & Icon Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as any)}
                  className="cockpit-input"
                >
                  <option value="business">Business & CRM</option>
                  <option value="productivity">Productivity</option>
                  <option value="communication">Communication</option>
                  <option value="cloud">Cloud Storage</option>
                  <option value="custom">Custom Portals</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Application Icon
                </label>
                <select
                  value={editIconName}
                  onChange={(e) => setEditIconName(e.target.value)}
                  className="cockpit-input"
                >
                  <option value="Users">Users / Network</option>
                  <option value="Briefcase">Briefcase / Business</option>
                  <option value="Mail">Mail / Gmail</option>
                  <option value="Calendar">Calendar / Scheduling</option>
                  <option value="HardDrive">HardDrive / Cloud Storage</option>
                  <option value="BookOpen">BookOpen / Notes</option>
                  <option value="FileText">FileText / Forms</option>
                  <option value="Globe">Globe / Web Portal</option>
                  <option value="Share2">Share2 / Integrations</option>
                </select>
              </div>
            </div>

            {/* Sync Frequency (only for portal sources) */}
            {editingApp.is_portal && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Automatic Sync Cadence</span>
                  <span className="text-[11px] text-slate-400 normal-case">Minimum 5 min</span>
                </label>
                <select
                  value={editSyncInterval}
                  onChange={(e) => setEditSyncInterval(Number(e.target.value))}
                  className="cockpit-input"
                >
                  <option value={5}>Every 5 minutes (Real-time)</option>
                  <option value={15}>Every 15 minutes (Standard recommendation)</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every 1 hour</option>
                  <option value={360}>Every 6 hours</option>
                  <option value={1440}>Every 24 hours (Daily)</option>
                </select>
              </div>
            )}

            {/* Administrative Notes */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Administrative Notes
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional configuration notes, department access rules, or custom instructions..."
                rows={2}
                className="cockpit-input resize-none text-xs"
              />
            </div>

            {/* Feedback Alert */}
            {editFeedback && (
              <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                editFeedback.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-[#059669] dark:text-emerald-400' 
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-[#DC2626] dark:text-rose-400'
              }`}>
                {editFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span className="font-semibold">{editFeedback.message}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/90 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingApp(null);
                }}
                className="cockpit-btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="cockpit-btn-primary text-xs flex items-center gap-1.5"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Configuration</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 2. RECONNECT / CHANGE ACCOUNT MODAL (WITH COCKPIT 3D LOADER) */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isReconnectModalOpen}
        onClose={() => {
          setIsReconnectModalOpen(false);
          setReconnectingApp(null);
        }}
        title={reconnectingApp ? `${reconnectingApp.name} — Reconnect & Change Account` : 'Reconnect Application'}
      >
        {reconnectingApp && (
          <div className="space-y-4">
            {/* Header info with Target Endpoint & Live Status */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-white/[0.08] rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Target Endpoint</p>
                <p className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5">{reconnectingApp.app_url}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Connection Status</p>
                <div className="mt-0.5">
                  <Badge status={reconnectingApp.live_badge || reconnectingApp.connection_status} />
                </div>
              </div>
            </div>

            {/* Existing Connected Account Identifier Banner */}
            {reconnectingApp.connected_account_identifier ? (
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      {reconnectingApp.source_key === 'kvv' ? 'Existing Registered Mobile' : 'Existing Connected Account'}
                    </p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {reconnectingApp.connected_account_identifier}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  <CheckCircle2 className="w-3 h-3" />
                  Active Vault
                </span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>No active session configured yet. Enter account credentials below to connect.</span>
              </div>
            )}

            {/* Safe Account Switching Guarantee Notice */}
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <span className="font-bold">Safe Account Switching: </span>
                If authentication fails with new credentials, your existing connection is safely retained. Previously synchronized CRM leads, contact histories, and pipeline records are permanently preserved ($0$ leads lost).
              </p>
            </div>

            {/* 3D Loading Overlay during authentication */}
            {reconnect3DLoading ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <Cockpit3DLoader 
                  variant="sync" 
                  size="md" 
                  text={`Authenticating with ${reconnectingApp.name}...`}
                  subtitle="Verifying credentials and updating AES-256-GCM encryption..."
                />
              </div>
            ) : reconnectingApp.source_key === 'gmail' ? (
              /* GMAIL OAUTH RECONNECT EXPERIENCE */
              <div className="space-y-4">
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start gap-2.5 text-xs">
                  <Mail className="w-4 h-4 text-[#D62839] dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-[#D62839] dark:text-rose-400">
                      Official Google Workspace OAuth 2.0 Authorization
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      Click below to sign in with Google and choose an account. Authentication tokens are securely encrypted using AES-256-GCM. Passwords are never requested or stored.
                    </p>
                  </div>
                </div>

                {/* Reconnect Feedback */}
                {reconnectFeedback && (
                  <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    reconnectFeedback.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-[#059669] dark:text-emerald-400'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-[#DC2626] dark:text-rose-400'
                  }`}>
                    {reconnectFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div className="font-semibold leading-relaxed">{reconnectFeedback.message}</div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleExecuteReconnect()}
                    disabled={isReconnecting}
                    className="w-full flex-1 cockpit-btn-primary py-2.5 text-xs flex items-center justify-center gap-2 cursor-pointer font-bold"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Reconnect / Change Google Account</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGoogleCredsConfig(!showGoogleCredsConfig)}
                    className="w-full sm:w-auto cockpit-btn-secondary py-2.5 text-xs flex items-center justify-center gap-1.5"
                    title="Configure Google Cloud OAuth Client ID and Secret"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>Client Keys</span>
                  </button>
                </div>

                {/* Collapsible Client ID / Secret Configuration */}
                {showGoogleCredsConfig && (
                  <form onSubmit={handleSaveGoogleCredentials} className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.08] rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-[#D62839]" />
                        Google Cloud OAuth 2.0 Client Keys
                      </span>
                      <span className="text-[10px] text-slate-400">AES-256-GCM Encrypted</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Client ID
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
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Client Secret
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
                        <span>Save Client Keys</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* PORTAL (BNI, EAF, KVV) RECONNECT & ACCOUNT CHANGE FORM */
              <form onSubmit={handleExecuteReconnect} className="space-y-4">
                {/* Platform Specific Guidance */}
                {reconnectingApp.source_key === 'bni' ? (
                  <div className="p-3 bg-[#EFF8FF] dark:bg-blue-950/40 border border-[#B2DDFF] dark:border-blue-900/50 rounded-xl flex items-start gap-2.5 text-xs text-[#175CD3] dark:text-blue-300">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                    <div>
                      <span className="font-bold">BNI Connect Account Authentication: </span>
                      Enter your authorized BNI Connect username/email and password. You can enter new credentials to change to a different account.
                    </div>
                  </div>
                ) : reconnectingApp.source_key === 'kvv' ? (
                  <div className="p-3 bg-[#FFF8F1] dark:bg-amber-950/40 border border-[#FDE68A] dark:border-amber-900/50 rounded-xl flex items-start gap-2.5 text-xs text-[#D97706] dark:text-amber-300">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <span className="font-bold">KVV Portal Member Authentication: </span>
                      Enter your 10-digit registered mobile number and password to connect or switch accounts.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-2.5 text-xs text-[#D62839] dark:text-rose-400">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">EAF Connect Account Authentication: </span>
                      Enter your registered member email and password. Dynamic session cookies are validated and stored with AES-256-GCM encryption.
                    </div>
                  </div>
                )}

                {/* Account Identifier Input */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    {reconnectingApp.source_key === 'kvv' 
                      ? 'New 10-Digit Mobile Number *' 
                      : reconnectingApp.source_key === 'bni'
                      ? 'New BNI Username / Email *'
                      : 'New EAF Email / Username *'
                    }
                  </label>
                  <input
                    type={reconnectingApp.source_key === 'kvv' ? 'tel' : 'text'}
                    required
                    pattern={reconnectingApp.source_key === 'kvv' ? '[0-9]{10}' : undefined}
                    maxLength={reconnectingApp.source_key === 'kvv' ? 10 : undefined}
                    value={reconnectUserId}
                    onChange={(e) => setReconnectUserId(e.target.value)}
                    placeholder={
                      reconnectingApp.source_key === 'kvv'
                        ? 'e.g. 9876543210'
                        : reconnectingApp.source_key === 'bni'
                        ? 'Enter BNI username or email'
                        : `Enter ${reconnectingApp.name} email or username`
                    }
                    className="cockpit-input"
                    autoComplete="username"
                  />
                  {reconnectingApp.source_key === 'kvv' && (
                    <p className="text-[10px] text-slate-400 mt-1">Must be exactly 10 numerical digits.</p>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    {reconnectingApp.source_key === 'kvv' 
                      ? 'KVV Member Password *' 
                      : reconnectingApp.source_key === 'bni'
                      ? 'BNI Portal Password *'
                      : 'EAF Portal Password *'
                    }
                  </label>
                  <div className="relative">
                    <input
                      type={showReconnectPassword ? 'text' : 'password'}
                      required
                      value={reconnectPassword}
                      onChange={(e) => setReconnectPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="cockpit-input pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowReconnectPassword(!showReconnectPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title={showReconnectPassword ? 'Hide password' : 'Show password'}
                    >
                      {showReconnectPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Credentials are encrypted with AES-256-GCM. Passwords are never returned in responses or browser memory.
                  </p>
                </div>

                {/* Reconnect Feedback Alert */}
                {reconnectFeedback && (
                  <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    reconnectFeedback.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-[#059669] dark:text-emerald-400'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-[#DC2626] dark:text-rose-400'
                  }`}>
                    {reconnectFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div className="font-semibold leading-relaxed">{reconnectFeedback.message}</div>
                  </div>
                )}

                {/* Stored credentials auto-renewal button (if already active) */}
                {reconnectingApp.has_stored_credentials && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-white/[0.08] rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">Keep current credentials</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExecuteReconnect()}
                      disabled={isReconnecting}
                      className="cockpit-btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin' : ''}`} />
                      <span>Re-validate Active Session</span>
                    </button>
                  </div>
                )}

                {/* Modal Action Buttons */}
                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200/90 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReconnectModalOpen(false);
                      setReconnectingApp(null);
                    }}
                    className="cockpit-btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isReconnecting}
                    className="cockpit-btn-primary text-xs flex items-center gap-1.5 font-bold"
                  >
                    {isReconnecting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying & Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Update Credentials & Reconnect</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 3. DELETE APPLICATION CONFIRMATION MODAL */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingApp(null);
        }}
        title="Delete Application Shortcut"
      >
        {deletingApp && (
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start gap-3 text-xs text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-900 dark:text-rose-200">
                  Are you sure you want to delete '{deletingApp.name}'?
                </p>
                <p className="leading-relaxed">
                  This will remove the application shortcut from your Connected Applications Hub.
                </p>
              </div>
            </div>

            {/* Permanent CRM Data Preservation Assurance */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-bold">CRM Leads Preserved: </span>
                All previously imported or synchronized CRM leads, interaction notes, customer records, and invoices are permanently retained in your database.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/90 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingApp(null);
                }}
                className="cockpit-btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingApp}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingApp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Shortcut</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 4. DISCONNECT CONFIRMATION MODAL */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isDisconnectModalOpen}
        onClose={() => {
          setIsDisconnectModalOpen(false);
          setDisconnectingApp(null);
        }}
        title={disconnectingApp ? `Disconnect ${disconnectingApp.name}` : 'Disconnect Application'}
      >
        {disconnectingApp && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
              <Unlink className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Disconnect active session for {disconnectingApp.name}?
                </p>
                <p className="leading-relaxed">
                  Disconnecting will securely purge stored encrypted credentials and authentication tokens from the server vault. Background automated synchronization will be paused.
                </p>
              </div>
            </div>

            {/* Permanent CRM Data Preservation Guarantee */}
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-bold">Zero Lead Loss Guarantee: </span>
                Your previously synchronized CRM leads, customer contact records, notes, and activity histories will be permanently preserved and remain fully accessible in the CRM.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/90 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setIsDisconnectModalOpen(false);
                  setDisconnectingApp(null);
                }}
                className="cockpit-btn-secondary text-xs"
              >
                Keep Connected
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                disabled={isDisconnectingApp}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isDisconnectingApp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Disconnecting...</span>
                  </>
                ) : (
                  <>
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Confirm Disconnect</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 5. ADD APPLICATION SHORTCUT MODAL */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Application Shortcut"
      >
        <form onSubmit={handleCreateApp} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Application Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Linear, Notion, Stripe"
              className="cockpit-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Portal URL *
            </label>
            <input
              type="url"
              required
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="https://..."
              className="cockpit-input font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
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
                <option value="custom">Custom Portals</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Icon
              </label>
              <select
                value={iconName}
                onChange={(e) => setIconName(e.target.value)}
                className="cockpit-input"
              >
                <option value="Globe">Globe</option>
                <option value="Briefcase">Briefcase</option>
                <option value="Users">Users</option>
                <option value="Mail">Mail</option>
                <option value="Calendar">Calendar</option>
                <option value="HardDrive">HardDrive</option>
                <option value="BookOpen">BookOpen</option>
                <option value="FileText">FileText</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isPinnedAdd"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-slate-300 text-[#D62839] focus:ring-[#D62839]"
            />
            <label htmlFor="isPinnedAdd" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              Pin to top of applications grid
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/90 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="cockpit-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Shortcut</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
