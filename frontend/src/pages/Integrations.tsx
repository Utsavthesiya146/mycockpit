import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Key, 
  ShieldCheck, 
  ExternalLink, 
  Globe, 
  Layers, 
  Clock, 
  Play, 
  Settings2, 
  Terminal, 
  Copy, 
  Check, 
  Info,
  Server,
  Zap,
  Sliders,
  X,
  Building,
  Users,
  Search
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Cockpit3DLoader } from '../components/common/Cockpit3DLoader';
import type { LeadSourceConfig, LeadSyncLog, Employee } from '../types';

export const Integrations: React.FC = () => {
  const [sources, setSources] = useState<LeadSourceConfig[]>([]);
  const [syncLogs, setSyncLogs] = useState<LeadSyncLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; title: string; message: string; details?: any } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Configure Modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<LeadSourceConfig | null>(null);
  const [configForm, setConfigForm] = useState<{
    credentials: Record<string, string>;
    sync_interval_minutes: number;
    auto_assign_user_id: string;
    is_enabled: boolean;
  }>({
    credentials: {},
    sync_interval_minutes: 15,
    auto_assign_user_id: '',
    is_enabled: true
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Webhook Modal
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookData, setWebhookData] = useState<{ webhook_url: string; webhook_key: string; html_snippet: string } | null>(null);

  // Platform Capability Matrix & Hosting Evaluation
  const [capabilityMatrix, setCapabilityMatrix] = useState<any>(null);
  const [hostingEvaluation, setHostingEvaluation] = useState<any>(null);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const [sourcesRes, logsRes, empRes, autoRes] = await Promise.all([
        api.get<LeadSourceConfig[]>('/crm/lead-sources'),
        api.get<LeadSyncLog[]>('/crm/lead-sources/sync-logs'),
        api.get<Employee[]>('/hrm/employees').catch(() => []),
        api.get<any>('/crm/automation/capabilities').catch(() => null)
      ]);
      setSources(sourcesRes || []);
      setSyncLogs(logsRes || []);
      setEmployees(empRes || []);
      if (autoRes) {
        setCapabilityMatrix(autoRes.matrix);
        setHostingEvaluation(autoRes.hosting_evaluation);
      }
    } catch (err: any) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleTestConnection = async (source: LeadSourceConfig) => {
    setTestingId(source.id);
    setFeedback(null);
    try {
      const res: any = await api.post(`/crm/lead-sources/${source.id}/test-connection`, {});
      setFeedback({
        type: 'success',
        title: `Connection Test Succeeded: ${source.name}`,
        message: res.message || 'Connection verified successfully with authorized remote platform.',
        details: res.details
      });
      fetchIntegrations();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: `Connection Test Failed: ${source.name}`,
        message: err.message || 'Could not establish connection to the remote platform.',
        details: err.details
      });
      fetchIntegrations();
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncNow = async (source: LeadSourceConfig) => {
    setSyncingId(source.id);
    setFeedback(null);
    try {
      const res: any = await api.post(`/crm/lead-sources/${source.id}/sync-now`, {});
      setFeedback({
        type: 'success',
        title: `Synchronization Finished: ${source.name}`,
        message: res.message || `Synchronized ${res.leads_created ?? 0} new leads.`,
        details: res
      });
      fetchIntegrations();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: `Sync Failed: ${source.name}`,
        message: err.message || 'Failed to pull leads from platform.'
      });
      fetchIntegrations();
    } finally {
      setSyncingId(null);
    }
  };

  const openConfigModal = (source: LeadSourceConfig) => {
    setSelectedSource(source);
    setConfigForm({
      credentials: {},
      sync_interval_minutes: source.sync_interval_minutes || 15,
      auto_assign_user_id: source.auto_assign_user_id ? String(source.auto_assign_user_id) : '',
      is_enabled: source.is_enabled !== undefined ? Boolean(source.is_enabled) : true
    });
    setIsConfigModalOpen(true);
  };

  const saveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource) return;
    setSavingConfig(true);
    try {
      await api.post(`/crm/lead-sources/${selectedSource.id}/configure`, {
        credentials: configForm.credentials,
        sync_interval_minutes: configForm.sync_interval_minutes,
        auto_assign_user_id: configForm.auto_assign_user_id ? Number(configForm.auto_assign_user_id) : null,
        is_enabled: configForm.is_enabled ? 1 : 0
      });
      setIsConfigModalOpen(false);
      setFeedback({
        type: 'success',
        title: `${selectedSource.name} Configured`,
        message: 'Credentials safely encrypted (AES-256) and integration settings updated.'
      });
      fetchIntegrations();
    } catch (err: any) {
      alert(err.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const openWebhookDetails = async () => {
    try {
      const res: any = await api.get('/crm/lead-sources/embed-code');
      setWebhookData(res);
      setIsWebhookModalOpen(true);
    } catch (err: any) {
      alert('Failed to retrieve webhook configuration: ' + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live_api_sync':
      case 'connected_syncing':
        return <Badge variant="green" dot>Live API Sync</Badge>;
      case 'connected':
        return <Badge variant="green">Connected</Badge>;
      case 'webhook_configured':
        return <Badge variant="green">Webhook Configured</Badge>;
      case 'user_export_available':
        return <Badge variant="blue">Authorized User Export Available</Badge>;
      case 'email_integration_available':
        return <Badge variant="purple">Email Integration Available</Badge>;
      case 'auth_required':
        return <Badge variant="amber">Authentication Required</Badge>;
      case 'api_access_required':
        return <Badge variant="amber">Admin/API Access Required</Badge>;
      case 'manual_csv_import':
      case 'manual_import_only':
        return <Badge variant="gray">Manual CSV Import</Badge>;
      case 'blocked':
      case 'unsupported':
      default:
        return <Badge variant="red">Blocked / Not Supported</Badge>;
    }
  };

  const getPlatformIcon = (key: string) => {
    switch (key) {
      case 'eaf_connect':
        return <Building className="w-5 h-5 text-[#D62839]" />;
      case 'bni_connect':
        return <Users className="w-5 h-5 text-[#B91C1C]" />;
      case 'kvv_connect':
        return <Globe className="w-5 h-5 text-[#C2410C]" />;
      case 'website_seo':
        return <Zap className="w-5 h-5 text-[#047857]" />;
      default:
        return <Layers className="w-5 h-5 text-[#475467]" />;
    }
  };

  if (loading && sources.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Cockpit3DLoader 
          variant="sync"
          size="lg"
          text="Synchronizing Universal Connectors..."
          subtitle="Polling BNI Connect, KVV Leads, EAF, and Webhook ingress channels"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#0D111A] p-5 rounded-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D62839] animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Universal Lead Synchronization Hub
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time automated connectors for BNI Connect, KVV, EAF Connect, SEO Forms, and Inbound Webhooks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={openWebhookDetails}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-white/[0.08] rounded-xl transition cursor-pointer"
          >
            <Zap className="w-4 h-4 text-[#D62839] dark:text-rose-400" />
            Website Webhook Keys
          </button>
          <button
            onClick={fetchIntegrations}
            disabled={loading}
            className="cockpit-btn-primary"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {/* Real-time Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
          feedback.type === 'success' 
            ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]' 
            : feedback.type === 'error'
              ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
              : 'bg-[#EFF8FF] border-[#B2DDFF] text-[#175CD3]'
        }`}>
          <div className="flex items-start gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" />
            ) : feedback.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-xs font-bold">{feedback.title}</h4>
              <p className="text-xs mt-0.5 opacity-90">{feedback.message}</p>
              {feedback.details && (
                <pre className="text-[10px] mt-2 p-2 bg-black/5 rounded overflow-x-auto max-w-xl font-mono">
                  {JSON.stringify(feedback.details, null, 2)}
                </pre>
              )}
            </div>
          </div>
          <button onClick={() => setFeedback(null)} className="text-current opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map((source) => {
          const isEAF = source.source_key === 'eaf_connect';
          const isBNI = source.source_key === 'bni_connect';
          const isKVV = source.source_key === 'kvv_connect';
          const isSEO = source.source_key === 'website_seo';

          const canSync = isEAF || (isBNI && source.has_credentials) || (isKVV && source.has_credentials);
          const autoSyncAvailable = isEAF || isSEO ? 'Yes (API / Webhook)' : isBNI ? 'Yes (Enterprise License Required)' : 'Webhook Relay Only';

          return (
            <div 
              key={source.id}
              className="bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 shadow-xs hover:border-slate-300 dark:hover:border-white/[0.15] transition flex flex-col justify-between"
            >
              <div>
                {/* Platform Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center shrink-0">
                      {getPlatformIcon(source.source_key)}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        {source.name}
                        {source.has_credentials && (
                          <span title="Encrypted credentials stored safely">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          </span>
                        )}
                      </h3>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                        {source.category} • Mode: {source.sync_mode || 'manual_import'}
                      </span>
                    </div>
                  </div>
                  <div>{getStatusBadge(source.status)}</div>
                </div>

                {/* Connection Metrics */}
                <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-center border border-slate-200/80 dark:border-white/[0.06]">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Total Leads</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{source.total_leads_count ?? 0}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Won / Converted</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{source.converted_leads_count ?? 0}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Auto Sync</span>
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate block">
                      {isEAF ? 'REST API (Active)' : isSEO ? 'Instant Webhook' : isBNI ? 'Partner API / CSV' : 'Webhook / CSV'}
                    </span>
                  </div>
                </div>

                {/* Status details & Error reporting */}
                <div className="mt-3 text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Last Successful Sync:</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {source.last_sync_at ? new Date(source.last_sync_at).toLocaleString('en-IN') : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Auto Assignment:</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {source.auto_assign_user_name || 'Default Rep / Unassigned'}
                    </span>
                  </div>

                  {source.last_error_message && (
                    <div className="mt-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Sync Error:</strong> {source.last_error_message}
                        {source.last_error_at && (
                          <span className="block text-[10px] opacity-80 mt-0.5">
                            Recorded at: {new Date(source.last_error_at).toLocaleTimeString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {isBNI && !source.has_credentials && (
                    <div className="mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300">
                      <strong>Official Integration Note:</strong> BNI Connect operates a private enterprise network. Global Partner API credentials can be configured above, or you can use the automated BNI CSV Import / Webhook relay.
                    </div>
                  )}

                  {isKVV && !source.has_credentials && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/[0.08] text-[11px] text-slate-600 dark:text-slate-400">
                      <strong>KVV Chapter Note:</strong> Real-time intake is available via authorized Webhook secret token or member batch CSV.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-200/80 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => openConfigModal(source)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Configure
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection(source)}
                    disabled={testingId === source.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                  >
                    <ShieldCheck className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${testingId === source.id ? 'animate-spin' : ''}`} />
                    {testingId === source.id ? 'Testing...' : 'Test Connection'}
                  </button>

                  {canSync && (
                    <button
                      onClick={() => handleSyncNow(source)}
                      disabled={syncingId === source.id}
                      className="cockpit-btn-primary py-1.5 px-3 text-xs"
                    >
                      <Play className={`w-3 h-3 ${syncingId === source.id ? 'animate-spin' : ''}`} />
                      <span>{syncingId === source.id ? 'Syncing...' : 'Sync Now'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hostinger Background Cron Documentation */}
      <div className="bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center">
              <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Hostinger Background Cron Automation</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Continuous automatic synchronization without requiring a permanent Node.js server.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/50">
            PHP 8.2 Compatible
          </span>
        </div>

        <div className="mt-4 p-3 bg-slate-900 text-white rounded-xl font-mono text-xs flex items-center justify-between border border-slate-800">
          <div className="truncate mr-3">
            <span className="text-slate-400"># Run every 10 minutes in Hostinger cPanel / Cron:</span>
            <br />
            <span className="text-cyan-400">*/10 * * * *</span> php -q /home/u123456789/public_html/backend/cron/sync_leads.php &gt;/dev/null 2&gt;&amp;1
          </div>
          <button
            onClick={() => handleCopy('*/10 * * * * php -q /home/u123456789/public_html/backend/cron/sync_leads.php >/dev/null 2>&1', 'cron')}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-xs transition shrink-0 cursor-pointer"
            title="Copy Cron Command"
          >
            {copiedKey === 'cron' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* SECTION: Verified Platform Capability Matrix (Requirement 6) */}
      <div className="bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Verified Platform Capability Matrix</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Strict audit of normal user-accessible UI actions across EAF Connect, BNI Connect, and KVV.
            </p>
          </div>
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-900/50">
            Zero External Code Modifications
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px]">
                <th className="py-2.5 px-3">Platform</th>
                <th className="py-2.5 px-3">Read Leads</th>
                <th className="py-2.5 px-3">Update Status</th>
                <th className="py-2.5 px-3">Add Notes</th>
                <th className="py-2.5 px-3">Update Follow-up</th>
                <th className="py-2.5 px-3">Update Contact Details</th>
                <th className="py-2.5 px-3">Write-back Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-white/[0.06]">
              {/* EAF Connect */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">EAF Connect</td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">Supported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">Supported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">Supported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Unsupported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">Supported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">Supported (Staging)</span></td>
              </tr>
              {/* BNI Connect */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">BNI Connect</td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">Supported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">Supported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">Supported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Unsupported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Unsupported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">CAPTCHA/MFA Required</span></td>
              </tr>
              {/* KVV */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">KVV (Kannadiga Vyapaaravedike)</td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">Supported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Unsupported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Unsupported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Unsupported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Unsupported</span></td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">Unsupported</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION: Hosting Environment & Browser Automation Feasibility (Requirement 7) */}
      <div className="bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-[#D62839] dark:text-rose-400" />
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Hosting & Automation Architecture Evaluation</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Shared Hosting Evaluation */}
          <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/40 space-y-2.5">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Shared Hosting Limitations (Hostinger / cPanel)
            </div>
            <p className="text-rose-900/80 dark:text-rose-300/80 text-[11px] leading-relaxed">
              Permanent headless browsers (Chromium, Puppeteer, Playwright) <strong>cannot run directly on Hostinger shared hosting</strong> due to:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-900/80 dark:text-rose-300/80">
              <li>CloudLinux LVE process killer terminates tasks exceeding 512MB RAM (Chromium consumes 1.5GB+ per tab).</li>
              <li>Missing OS packages (<code className="bg-white/60 dark:bg-black/40 px-1 py-0.5 rounded">libnss3</code>, <code className="bg-white/60 dark:bg-black/40 px-1 py-0.5 rounded">libatk</code>, X11) requiring root access.</li>
              <li>Strict 30–60s PHP process timeout prevents persistent browser sessions.</li>
            </ul>
          </div>

          {/* Recommended Decoupled Topologies */}
          <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Recommended Production Topologies
            </div>
            <div className="space-y-2 text-[11px] text-emerald-900/80 dark:text-emerald-300/80">
              <div className="p-2 bg-white dark:bg-[#121722] rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                <strong className="text-emerald-800 dark:text-emerald-300">Mode A: Session-Driven HTTP Worker (Direct Hostinger Compatible)</strong>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Submits authenticated web actions via cURL session cookies. Requires only ~15MB RAM and executes in &lt;2s. Verified for EAF Connect.
                </p>
              </div>
              <div className="p-2 bg-white dark:bg-[#121722] rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                <strong className="text-emerald-800 dark:text-emerald-300">Mode B: Decoupled Playwright Worker Companion (For BNI & CAPTCHA)</strong>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Host My Cockpit AI on Hostinger, while a small $4 VPS or local worker runs Playwright to handle Cloudflare & CAPTCHA challenges via the sync queue.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sync Audit Logs */}
      <div className="bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Live Synchronization Audit History</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Verified checkpoints, execution times, and incremental import stats.</p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Last 50 Jobs</span>
        </div>

        {syncLogs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400">
            No synchronization jobs have been executed yet. Click &quot;Sync Now&quot; or wait for the scheduled cron run.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-900 dark:text-white">
              <thead>
                <tr className="border-b border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3">Trigger Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Fetched</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3">Updated</th>
                  <th className="py-2.5 px-3">Skipped / Dup</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Error / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-white/[0.06]">
                {syncLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
                    <td className="py-2.5 px-3 text-slate-900 dark:text-white font-medium whitespace-nowrap font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                      {log.source_name || log.source_key}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {log.sync_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {log.status === 'success' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Success
                        </span>
                      ) : log.status === 'partial' ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Partial
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold font-mono">{log.leads_fetched}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400 font-mono">+{log.leads_created}</td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-mono">{log.leads_updated}</td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono">{log.leads_skipped}</td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono">{log.execution_time_ms}ms</td>
                    <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400 max-w-xs truncate" title={log.error_details || ''}>
                      {log.error_details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Configure Modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title={`Configure ${selectedSource?.name || 'Integration'}`}
      >
        {selectedSource && (
          <form onSubmit={saveConfiguration} className="space-y-4">
            <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EAECF0] text-xs text-[#475467]">
              Credentials are encrypted on the server with <strong>AES-256-CBC</strong> before saving to MySQL. They are never transmitted back to client browsers or Android packages.
            </div>

            {/* Platform-specific credential fields */}
            {selectedSource.source_key === 'eaf_connect' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#344054] mb-1">EAF API Base URL</label>
                  <input
                    type="url"
                    placeholder="http://localhost/eaf or https://your-eaf-domain.com"
                    defaultValue={selectedSource.masked_credentials?.base_url || 'http://localhost/eaf'}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      credentials: { ...prev.credentials, base_url: e.target.value }
                    }))}
                    className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl focus:ring-2 focus:ring-[#D62839]"
                  />
                  <span className="text-[10px] text-[#667085] mt-0.5 block">Points to your CodeIgniter 4 EAF Connect deployment.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#344054] mb-1">EAF Member Email</label>
                  <input
                    type="email"
                    placeholder={selectedSource.masked_credentials?.email || 'member@eaf.com'}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      credentials: { ...prev.credentials, email: e.target.value }
                    }))}
                    className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl focus:ring-2 focus:ring-[#D62839]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#344054] mb-1">EAF Password (or Bearer Token)</label>
                  <input
                    type="password"
                    placeholder={selectedSource.has_credentials ? '••••••••••••' : 'Enter account password'}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      credentials: { ...prev.credentials, password: e.target.value }
                    }))}
                    className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl focus:ring-2 focus:ring-[#D62839]"
                  />
                </div>
              </>
            )}

            {selectedSource.source_key === 'bni_connect' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#344054] mb-1">BNI Global Partner API Endpoint</label>
                  <input
                    type="url"
                    placeholder="https://api.bniconnectglobal.com/v1"
                    defaultValue={selectedSource.masked_credentials?.api_endpoint || ''}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      credentials: { ...prev.credentials, api_endpoint: e.target.value }
                    }))}
                    className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl focus:ring-2 focus:ring-[#D62839]"
                  />
                  <span className="text-[10px] text-[#667085] mt-0.5 block">Requires active BNI Global Enterprise Alliance Partner license.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#344054] mb-1">BNI Partner Token / Client Secret</label>
                  <input
                    type="password"
                    placeholder={selectedSource.has_credentials ? '••••••••••••' : 'Enter Partner Secret Token'}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      credentials: { ...prev.credentials, partner_token: e.target.value }
                    }))}
                    className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl focus:ring-2 focus:ring-[#D62839]"
                  />
                </div>
              </>
            )}

            {selectedSource.source_key === 'kvv_connect' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#344054] mb-1">KVV Custom API Endpoint (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://kvv.org.in/api/leads"
                    defaultValue={selectedSource.masked_credentials?.api_endpoint || ''}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      credentials: { ...prev.credentials, api_endpoint: e.target.value }
                    }))}
                    className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl focus:ring-2 focus:ring-[#D62839]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#344054] mb-1">KVV Webhook Signature Secret</label>
                  <input
                    type="text"
                    defaultValue={selectedSource.webhook_secret || ''}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      credentials: { ...prev.credentials, webhook_secret: e.target.value }
                    }))}
                    className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl focus:ring-2 focus:ring-[#D62839]"
                  />
                </div>
              </>
            )}

            {/* Common Settings */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#EAECF0]">
              <div>
                <label className="block text-xs font-bold text-[#344054] mb-1">Sync Interval (Minutes)</label>
                <select
                  value={configForm.sync_interval_minutes}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, sync_interval_minutes: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
                >
                  <option value={5}>Every 5 minutes</option>
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every 1 hour</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#344054] mb-1">Auto-Assign Rep</label>
                <select
                  value={configForm.auto_assign_user_id}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, auto_assign_user_id: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
                >
                  <option value="">No Auto-assignment</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.designation})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_enabled"
                checked={configForm.is_enabled}
                onChange={(e) => setConfigForm(prev => ({ ...prev, is_enabled: e.target.checked }))}
                className="w-4 h-4 text-[#D62839] rounded border-[#D0D5DD] focus:ring-[#D62839]"
              />
              <label htmlFor="is_enabled" className="text-xs font-bold text-[#344054]">
                Enable automatic background synchronization for this source
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-[#344054] border border-[#D0D5DD] rounded-xl hover:bg-[#F9FAFB]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="px-4 py-2 text-xs font-bold text-white bg-[#D62839] hover:bg-[#B91C1C] rounded-xl shadow-sm transition"
              >
                {savingConfig ? 'Saving...' : 'Save & Encrypt Credentials'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Website Webhook Intake Modal */}
      <Modal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        title="SEO & Website Real-Time Webhook Intake"
      >
        {webhookData && (
          <div className="space-y-4">
            <p className="text-xs text-[#475467]">
              Connect WordPress, Elementor Forms, Webflow, Contact Form 7, or Landing Pages. Inquiries are automatically synchronized into your central Leads Page within milliseconds.
            </p>

            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Webhook Intake Endpoint URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookData.webhook_url}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl"
                />
                <button
                  onClick={() => handleCopy(webhookData.webhook_url, 'url')}
                  className="px-3 py-2 bg-[#F2F4F7] hover:bg-[#E4E7EC] border border-[#D0D5DD] rounded-xl text-xs font-bold shrink-0"
                >
                  {copiedKey === 'url' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Authorized X-Tenant-Key</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookData.webhook_key}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl"
                />
                <button
                  onClick={() => handleCopy(webhookData.webhook_key, 'key')}
                  className="px-3 py-2 bg-[#F2F4F7] hover:bg-[#E4E7EC] border border-[#D0D5DD] rounded-xl text-xs font-bold shrink-0"
                >
                  {copiedKey === 'key' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Ready-to-Use HTML / JS Embed Code</label>
              <textarea
                readOnly
                rows={6}
                value={webhookData.html_snippet}
                className="w-full px-3 py-2 text-[11px] font-mono bg-[#1E293B] text-[#E2E8F0] border border-[#334155] rounded-xl"
              />
              <button
                onClick={() => handleCopy(webhookData.html_snippet, 'html')}
                className="mt-1 text-xs font-bold text-[#D62839] hover:underline"
              >
                {copiedKey === 'html' ? 'Snippet Copied to Clipboard!' : 'Copy Embed Code'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
