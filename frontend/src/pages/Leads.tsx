import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users2, 
  Search, 
  Filter, 
  Plus, 
  Upload, 
  Download, 
  RefreshCw, 
  Building2, 
  Mail, 
  Phone, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare, 
  ExternalLink, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  PhoneCall, 
  Globe, 
  Layers, 
  ShieldCheck, 
  Sparkles,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  Check,
  Info,
  TrendingUp,
  Award
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { SlideOverDrawer } from '../components/common/SlideOverDrawer';
import { EmptyState } from '../components/common/EmptyState';
import { Cockpit3DLoader } from '../components/common/Cockpit3DLoader';
import { formatCurrency, createWhatsAppUrl } from '../utils/formatters';
import type { Lead, LeadActivity, Followup, Employee, LeadSourceConfig } from '../types';

interface LeadsProps {
  onNavigateToIntegrations?: () => void;
}

export const Leads: React.FC<LeadsProps> = ({ onNavigateToIntegrations }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sources, setSources] = useState<LeadSourceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [activeTabFilter, setActiveTabFilter] = useState<string>('all'); 
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals & Drawers
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // External sync state
  const [syncingExternal, setSyncingExternal] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmExternalSyncOpen, setConfirmExternalSyncOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState<any>(null);
  const [conflictQueueId, setConflictQueueId] = useState<number | null>(null);

  // CSV Import State
  const [csvContent, setCsvContent] = useState('');
  const [importSource, setImportSource] = useState('BNI');

  // Form states
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    service_requirement: '',
    priority: 'medium',
    source: 'Manual Added',
    value: 0,
    assigned_to: '',
    notes: '',
    next_followup_date: ''
  });

  const [followupForm, setFollowupForm] = useState({
    title: '',
    contact_method: 'call',
    scheduled_at: '',
    notes: '',
    assigned_to: ''
  });

  const [activityForm, setActivityForm] = useState({
    activity_type: 'call',
    title: '',
    description: ''
  });

  const fetchLeads = async () => {
    try {
      setRefreshing(true);
      const [leadsRes, empRes, sourcesRes]: any = await Promise.all([
        api.get('/crm/leads'),
        api.get('/hrm/employees'),
        api.get('/crm/leads/sources')
      ]);
      setLeads(leadsRes || []);
      setEmployees(empRes || []);
      setSources(sourcesRes || []);
    } catch (err) {
      console.error('Failed to fetch centralized leads data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Compute KPI summaries from leads
  const stats = useMemo(() => {
    const total = leads.length;
    const fresh = leads.filter(l => l.status === 'new').length;
    const won = leads.filter(l => l.status === 'won').length;
    const overdue = leads.filter(l => l.next_followup_date && new Date(l.next_followup_date) < new Date() && !['won', 'lost'].includes(l.status)).length;
    const bniCount = leads.filter(l => l.source?.includes('BNI')).length;
    const kvvCount = leads.filter(l => l.source?.includes('KVV')).length;
    const eafCount = leads.filter(l => l.source?.includes('EAF')).length;
    return { total, fresh, won, overdue, bniCount, kvvCount, eafCount };
  }, [leads]);

  // Filtering Logic
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // 1. Tab View Filter
      if (activeTabFilter === 'bni' && !lead.source?.includes('BNI')) return false;
      if (activeTabFilter === 'kvv' && !lead.source?.includes('KVV')) return false;
      if (activeTabFilter === 'eaf' && !lead.source?.includes('EAF')) return false;
      if (activeTabFilter === 'seo' && !lead.source?.toLowerCase().includes('seo') && !lead.source?.toLowerCase().includes('website')) return false;
      if (activeTabFilter === 'new' && lead.status !== 'new') return false;
      if (activeTabFilter === 'converted' && lead.status !== 'won') return false;
      if (activeTabFilter === 'lost' && lead.status !== 'lost') return false;
      if (activeTabFilter === 'pending' && (!lead.next_followup_date || ['won', 'lost'].includes(lead.status))) return false;
      if (activeTabFilter === 'today') {
        if (!lead.next_followup_date) return false;
        const d = new Date(lead.next_followup_date).toDateString();
        if (d !== new Date().toDateString()) return false;
      }
      if (activeTabFilter === 'overdue') {
        if (!lead.next_followup_date) return false;
        if (new Date(lead.next_followup_date) >= new Date() || ['won', 'lost'].includes(lead.status)) return false;
      }

      // 2. Dropdown Filters
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
      if (employeeFilter !== 'all') {
        if (employeeFilter === 'unassigned' && lead.assigned_to) return false;
        if (employeeFilter !== 'unassigned' && String(lead.assigned_to) !== employeeFilter) return false;
      }
      if (priorityFilter !== 'all' && lead.priority !== priorityFilter) return false;
      if (dateFilter !== 'all') {
        const leadDate = new Date(lead.created_at);
        const now = new Date();
        if (dateFilter === 'today' && leadDate.toDateString() !== now.toDateString()) return false;
        if (dateFilter === 'this_week') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (leadDate < sevenDaysAgo) return false;
        }
        if (dateFilter === 'this_month') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (leadDate < thirtyDaysAgo) return false;
        }
      }

      // 3. Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = lead.name?.toLowerCase().includes(q);
        const matchesCompany = lead.company?.toLowerCase().includes(q);
        const matchesPhone = lead.phone?.toLowerCase().includes(q);
        const matchesEmail = lead.email?.toLowerCase().includes(q);
        const matchesService = lead.service_requirement?.toLowerCase().includes(q);
        if (!matchesName && !matchesCompany && !matchesPhone && !matchesEmail && !matchesService) return false;
      }

      return true;
    });
  }, [leads, activeTabFilter, sourceFilter, employeeFilter, priorityFilter, dateFilter, search]);

  // Sorting
  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a: any, b: any) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';
      if (sortBy === 'created_at' || sortBy === 'next_followup_date' || sortBy === 'last_contact_date') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      }
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLeads, sortBy, sortDirection]);

  // Pagination
  const totalLeadsCount = sortedLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalLeadsCount / pageSize));
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const handleViewLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailDrawerOpen(true);
    try {
      const fullLead: any = await api.get(`/crm/leads/${lead.id}`);
      setSelectedLead(fullLead);
    } catch (err) {
      console.error('Failed to load full lead details', err);
    }
  };

  const handleUpdateStatus = async (leadId: number, newStatus: Lead['status']) => {
    try {
      await api.put(`/crm/leads/${leadId}`, { status: newStatus });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      if (selectedLead?.id === leadId) {
        setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      alert('Failed to update lead status: ' + (err.message || 'Error'));
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/crm/leads', {
        ...newLeadForm,
        assigned_to: newLeadForm.assigned_to ? Number(newLeadForm.assigned_to) : null,
        value: Number(newLeadForm.value) || 0
      });
      setIsNewLeadModalOpen(false);
      setNewLeadForm({
        name: '',
        company: '',
        email: '',
        phone: '',
        service_requirement: '',
        priority: 'medium',
        source: 'Manual Added',
        value: 0,
        assigned_to: '',
        notes: '',
        next_followup_date: ''
      });
      fetchLeads();
    } catch (err: any) {
      alert('Failed to create lead: ' + err.message);
    }
  };

  const handleCreateFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      await api.post('/followups', {
        lead_id: selectedLead.id,
        title: followupForm.title,
        contact_method: followupForm.contact_method,
        scheduled_at: followupForm.scheduled_at,
        notes: followupForm.notes,
        assigned_to: followupForm.assigned_to ? Number(followupForm.assigned_to) : selectedLead.assigned_to
      });
      setIsFollowupModalOpen(false);
      setFollowupForm({ title: '', contact_method: 'call', scheduled_at: '', notes: '', assigned_to: '' });
      handleViewLeadDetail(selectedLead);
      fetchLeads();
    } catch (err: any) {
      alert('Failed to schedule follow-up: ' + err.message);
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      await api.post(`/crm/leads/${selectedLead.id}/activities`, activityForm);
      setIsActivityModalOpen(false);
      setActivityForm({ activity_type: 'call', title: '', description: '' });
      handleViewLeadDetail(selectedLead);
      fetchLeads();
    } catch (err: any) {
      alert('Failed to log activity: ' + err.message);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) return;
    try {
      const res: any = await api.post('/crm/leads/import', {
        source: importSource,
        csv_data: csvContent
      });
      alert(`Import Success: ${res.imported_count} leads imported, ${res.skipped_count} skipped duplicates.`);
      setIsImportModalOpen(false);
      setCsvContent('');
      fetchLeads();
    } catch (err: any) {
      alert('Import failed: ' + err.message);
    }
  };

  const handleSyncToExternalPlatform = async (lead: Lead) => {
    if (!lead.source_platform || !lead.source_lead_id) return;
    try {
      setSyncingExternal(true);
      setSyncFeedback(null);
      const res: any = await api.post(`/crm/leads/${lead.id}/queue-writeback`, {
        changes: {
          status: lead.status,
          priority: lead.priority,
          phone: lead.phone,
          service_requirement: lead.service_requirement,
          notes: lead.notes
        },
        auto_confirm: true
      });
      setSyncFeedback({ type: 'success', message: res.message || 'Changes successfully synchronized to external platform!' });
      fetchLeads();
      handleViewLeadDetail(lead);
    } catch (err: any) {
      if (err.data?.status === 'conflict_detected' || err.conflict) {
        setConflictData(err.data?.conflict || err.conflict);
        setConflictQueueId(err.data?.queue_id || err.queue_id);
        setConflictModalOpen(true);
      } else {
        setSyncFeedback({ type: 'error', message: err.message || 'External sync failed.' });
      }
    } finally {
      setSyncingExternal(false);
      setConfirmExternalSyncOpen(false);
    }
  };

  const handleResolveConflict = async (resolution: 'keep_cockpit' | 'keep_external') => {
    if (!conflictQueueId) return;
    try {
      setSyncingExternal(true);
      const res: any = await api.post(`/crm/leads/queue/${conflictQueueId}/resolve`, { resolution });
      setSyncFeedback({ type: 'success', message: res.message });
      setConflictModalOpen(false);
      fetchLeads();
      if (selectedLead) {
        handleViewLeadDetail(selectedLead);
      }
    } catch (err: any) {
      setSyncFeedback({ type: 'error', message: err.message || 'Conflict resolution failed.' });
    } finally {
      setSyncingExternal(false);
    }
  };

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case 'urgent':
        return <Badge variant="red" dot>Urgent</Badge>;
      case 'high':
        return <Badge variant="amber">High</Badge>;
      case 'medium':
        return <Badge variant="blue">Medium</Badge>;
      case 'low':
      default:
        return <Badge variant="gray">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="blue" dot>New</Badge>;
      case 'contacted':
        return <Badge variant="amber">Contacted</Badge>;
      case 'qualified':
        return <Badge variant="purple">Qualified</Badge>;
      case 'proposal':
        return <Badge variant="indigo">Proposal</Badge>;
      case 'won':
        return <Badge variant="green">Won</Badge>;
      case 'lost':
        return <Badge variant="red">Lost</Badge>;
      default:
        return <Badge variant="gray">{status}</Badge>;
    }
  };

  const getSyncStatusBadge = (syncStatus?: string, extSyncStatus?: string) => {
    if (extSyncStatus && extSyncStatus !== 'not_applicable') {
      switch (extSyncStatus) {
        case 'synced':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800" title="Externally verified and synchronized">
              <CheckCircle2 className="w-3 h-3" /> Ext Synced
            </span>
          );
        case 'pending_writeback':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800" title="Awaiting external platform synchronization">
              <Clock className="w-3 h-3 animate-pulse" /> Pending Sync
            </span>
          );
        case 'conflict':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800 animate-pulse" title="External drift detected! Click to resolve conflict">
              <AlertTriangle className="w-3 h-3" /> Conflict
            </span>
          );
        case 'failed':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800" title="External synchronization failed">
              <AlertTriangle className="w-3 h-3" /> Sync Failed
            </span>
          );
        case 'manual_required':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800" title="Platform does not support automated write-back">
              <User className="w-3 h-3" /> Manual Required
            </span>
          );
      }
    }

    switch (syncStatus) {
      case 'synced':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Auto Synced</span>;
      case 'webhook':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400"><Zap className="w-3 h-3" /> Webhook</span>;
      case 'error':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400"><AlertTriangle className="w-3 h-3" /> Sync Error</span>;
      case 'manual':
      default:
        return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400"><User className="w-3 h-3" /> Manual / CSV</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 cockpit-card-hover">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-6 bg-[#D62839] rounded-full shrink-0" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Centralized Leads Portfolio
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-[#D62839] dark:bg-rose-950/60 dark:text-rose-400 font-mono font-bold border border-rose-200 dark:border-rose-900/60">
              {stats.total} Total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Unified intake connecting BNI Chapter referrals, KVV Portal members, EAF Connect, SEO, and Direct Outreach.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateToIntegrations && (
            <button
              onClick={onNavigateToIntegrations}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 text-[#D62839]" />
              <span>Lead Sync Hub</span>
            </button>
          )}

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => setIsNewLeadModalOpen(true)}
            className="cockpit-btn-primary shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Lead</span>
          </button>

          <button
            onClick={fetchLeads}
            disabled={refreshing}
            className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-300 cursor-pointer shadow-2xs"
            title="Refresh All Leads"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Micro-Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total Leads</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">{stats.total}</p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">All authenticated sources</span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Fresh Inquiries</span>
          <p className="text-2xl font-black text-[#D62839] dark:text-rose-400 font-mono mt-1">{stats.fresh}</p>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Awaiting first contact</span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Converted Won</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">{stats.won}</p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Successfully closed</span>
        </div>
        <div className={`p-4 rounded-2xl border shadow-xs ${stats.overdue > 0 ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' : 'bg-white dark:bg-[#0D111A] border-slate-200/90 dark:border-white/[0.08]'}`}>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Overdue Follow-ups</span>
          <p className={`text-2xl font-black font-mono mt-1 ${stats.overdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{stats.overdue}</p>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{stats.overdue > 0 ? '⚠️ Action Required' : 'Zero overdue'}</span>
        </div>
      </div>

      {/* Filter Tabs Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
        {[
          { id: 'all', label: `All Leads (${stats.total})` },
          { id: 'bni', label: `BNI Connect (${stats.bniCount})` },
          { id: 'kvv', label: `KVV Leads (${stats.kvvCount})` },
          { id: 'eaf', label: `EAF Connect (${stats.eafCount})` },
          { id: 'seo', label: 'SEO & Website' },
          { id: 'new', label: `New (${stats.fresh})` },
          { id: 'pending', label: 'Pending Follow-ups' },
          { id: 'today', label: "Today's Follow-ups" },
          { id: 'overdue', label: `Overdue (${stats.overdue}) ⚠️` },
          { id: 'converted', label: `Converted (${stats.won})` },
          { id: 'lost', label: 'Lost' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTabFilter(tab.id);
              setCurrentPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap shrink-0 cursor-pointer ${
              activeTabFilter === tab.id
                ? 'bg-[#D62839] text-white shadow-xs font-bold'
                : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search leads, company, phone, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="cockpit-input pl-10"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">Sources: All</option>
            {sources.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>

          <select
            value={employeeFilter}
            onChange={(e) => {
              setEmployeeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">Rep: All Team</option>
            <option value="unassigned">Unassigned Rep</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">Priority: All</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">Created: All Time</option>
            <option value="today">Created Today</option>
            <option value="this_week">Past 7 Days</option>
            <option value="this_month">This Month</option>
          </select>

          <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 font-medium">
            Showing <strong>{filteredLeads.length}</strong> leads
          </span>
        </div>
      </div>

      {/* Central Unified Table */}
      <div className="bg-white dark:bg-[#0D111A] rounded-3xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Cockpit3DLoader 
              variant="module"
              size="md"
              text="Loading Centralized Business Leads..."
              subtitle="Retrieving real-time records from BNI, KVV, EAF, and SEO channels"
            />
          </div>
        ) : paginatedLeads.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="No leads match the selected criteria"
            description="Adjust your active filters or create a new business inquiry to start building your qualified pipeline."
            primaryAction={{
              label: "Create Business Lead",
              onClick: () => setIsNewLeadModalOpen(true),
              icon: Plus
            }}
            secondaryAction={onNavigateToIntegrations ? {
              label: "Universal Sync Hub",
              onClick: onNavigateToIntegrations
            } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-3 cursor-pointer select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Lead Name <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3 px-3">Company</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3 cursor-pointer select-none" onClick={() => handleSort('source')}>
                    <div className="flex items-center gap-1">Source <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3 px-3">Requirement</th>
                  <th className="py-3 px-3">Assigned Rep</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 cursor-pointer select-none" onClick={() => handleSort('priority')}>
                    <div className="flex items-center gap-1">Priority <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3 px-3 cursor-pointer select-none" onClick={() => handleSort('next_followup_date')}>
                    <div className="flex items-center gap-1">Next Follow-up <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3 px-3">Sync Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {paginatedLeads.map((lead) => {
                  const isOverdue = lead.next_followup_date && new Date(lead.next_followup_date) < new Date() && !['won', 'lost'].includes(lead.status);
                  const isToday = lead.next_followup_date && new Date(lead.next_followup_date).toDateString() === new Date().toDateString();

                  return (
                    <tr 
                      key={lead.id}
                      onClick={() => handleViewLeadDetail(lead)}
                      className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition cursor-pointer group"
                    >
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-700 dark:text-slate-300 shrink-0">
                            {lead.name?.charAt(0) || 'L'}
                          </div>
                          <span>{lead.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                        {lead.company || '—'}
                      </td>

                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {lead.phone ? (
                            <a 
                              href={`tel:${lead.phone}`} 
                              className="text-[#D62839] hover:underline font-mono text-xs flex items-center gap-1 font-semibold"
                            >
                              <Phone className="w-3 h-3" /> {lead.phone}
                            </a>
                          ) : '—'}
                          {lead.phone && (
                            <a
                              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${lead.name}, connecting regarding ${lead.service_requirement || 'your inquiry'}.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] border border-slate-200 dark:border-slate-700">
                          {lead.source}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-[160px] truncate" title={lead.service_requirement || ''}>
                        {lead.service_requirement || '—'}
                      </td>

                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {lead.assigned_user_name || <span className="text-slate-400 italic">Unassigned</span>}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {getStatusBadge(lead.status)}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {getPriorityBadge(lead.priority)}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {lead.next_followup_date ? (
                          <span className={`font-semibold ${isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : isToday ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {new Date(lead.next_followup_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {isOverdue && ' ⚠️'}
                          </span>
                        ) : (
                          <span className="text-slate-400">Not set</span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {getSyncStatusBadge(lead.sync_status, lead.external_sync_status)}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsFollowupModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-[#D62839] hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                            title="Schedule Next Follow-up"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsActivityModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition cursor-pointer"
                            title="Log Activity Touchpoint"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleViewLeadDetail(lead)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition cursor-pointer"
                            title="View Full Details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalLeadsCount)} of {totalLeadsCount} leads</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-slate-800 dark:text-slate-200">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Lead Detail Drawer */}
      {selectedLead && (
        <SlideOverDrawer
          isOpen={isDetailDrawerOpen}
          onClose={() => setIsDetailDrawerOpen(false)}
          title={selectedLead.name}
          subtitle={selectedLead.company || 'Individual Account'}
          badge={
            <Badge variant="red" className="text-[10px]">
              {selectedLead.source}
            </Badge>
          }
          maxWidth="max-w-xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500 font-mono">Lead Record #{selectedLead.id}</span>
              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="cockpit-btn-secondary py-1.5 px-4 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Pipeline Stage Quick Changer */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pipeline Stage</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedLead.id, st)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition capitalize cursor-pointer ${
                      selectedLead.status === st
                        ? 'bg-[#D62839] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Requirement</span>
                <strong className="text-slate-900 dark:text-white">{selectedLead.service_requirement || 'General Inquiry'}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Priority</span>
                {getPriorityBadge(selectedLead.priority)}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Estimated Deal Value</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(selectedLead.value || 0)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Specialist</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{selectedLead.assigned_user_name || 'Unassigned'}</span>
              </div>
            </div>

            {/* Direct Communication Channels */}
            {selectedLead.phone && (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone Contact</span>
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">{selectedLead.phone}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${selectedLead.phone}`}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 text-slate-700 dark:text-slate-200 hover:text-[#D62839] border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-[#D62839]" />
                    <span>Call</span>
                  </a>
                  <a
                    href={createWhatsAppUrl(selectedLead.phone, `Hello ${selectedLead.name}, following up regarding your requirement: ${selectedLead.service_requirement || 'our service'}.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="flex gap-2.5">
              <button
                onClick={() => setIsFollowupModalOpen(true)}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#D62839] hover:bg-[#B91C1C] rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule Follow-up</span>
              </button>
              <button
                onClick={() => setIsActivityModalOpen(true)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Log Touchpoint</span>
              </button>
            </div>

            {/* External Platform Writeback */}
            {selectedLead.source_platform && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Platform Writeback ({selectedLead.source_platform.toUpperCase()})
                    </h3>
                  </div>
                  <div>
                    {getSyncStatusBadge(selectedLead.sync_status, selectedLead.external_sync_status)}
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Slip / Record ID:</span>
                    <strong className="font-mono text-slate-900 dark:text-white">{selectedLead.source_lead_id || '—'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Sync:</span>
                    <span>{selectedLead.last_external_sync_at ? new Date(selectedLead.last_external_sync_at).toLocaleString('en-IN') : 'Not yet synchronized'}</span>
                  </div>
                </div>

                <button
                  onClick={() => setConfirmExternalSyncOpen(true)}
                  disabled={syncingExternal}
                  className="w-full py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-sky-500 ${syncingExternal ? 'animate-spin' : ''}`} />
                  <span>Sync Changes to {selectedLead.source_platform.toUpperCase()}</span>
                </button>
              </div>
            )}

            {/* Activity History */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Follow-up & Activity History
              </h3>
              {(!selectedLead.activities || selectedLead.activities.length === 0) ? (
                <p className="text-xs text-slate-400 italic">No activity logs recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {selectedLead.activities.map(act => (
                    <div key={act.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-white/[0.04] text-xs">
                      <div className="flex items-center justify-between text-slate-500 text-[10px] mb-1">
                        <span className="font-bold uppercase text-[#D62839]">{act.activity_type}</span>
                        <span>{new Date(act.activity_date).toLocaleString('en-IN')}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white">{act.title}</h4>
                      {act.description && <p className="text-slate-500 dark:text-slate-400 mt-0.5">{act.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SlideOverDrawer>
      )}

      {/* New Lead Modal */}
      <Modal isOpen={isNewLeadModalOpen} onClose={() => setIsNewLeadModalOpen(false)} title="Create Business Lead">
        <form onSubmit={handleCreateLead} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Name *</label>
              <input
                type="text"
                required
                value={newLeadForm.name}
                onChange={e => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                className="cockpit-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Company</label>
              <input
                type="text"
                value={newLeadForm.company}
                onChange={e => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                className="cockpit-input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={newLeadForm.phone}
                onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                className="cockpit-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={newLeadForm.email}
                onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                className="cockpit-input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Lead Source</label>
              <select
                value={newLeadForm.source}
                onChange={e => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                className="cockpit-input text-xs"
              >
                <option value="BNI">BNI Connect</option>
                <option value="KVV">KVV Leads</option>
                <option value="EAF Connect">EAF Connect</option>
                <option value="SEO / Website">SEO / Website</option>
                <option value="Manual Added">Manual Added</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Service / Requirement</label>
              <input
                type="text"
                placeholder="e.g. ERP Implementation, Web App"
                value={newLeadForm.service_requirement}
                onChange={e => setNewLeadForm({ ...newLeadForm, service_requirement: e.target.value })}
                className="cockpit-input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={newLeadForm.priority}
                onChange={e => setNewLeadForm({ ...newLeadForm, priority: e.target.value as any })}
                className="cockpit-input text-xs"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assign Rep</label>
              <select
                value={newLeadForm.assigned_to}
                onChange={e => setNewLeadForm({ ...newLeadForm, assigned_to: e.target.value })}
                className="cockpit-input text-xs"
              >
                <option value="">Unassigned</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Initial Next Follow-up</label>
            <input
              type="datetime-local"
              value={newLeadForm.next_followup_date}
              onChange={e => setNewLeadForm({ ...newLeadForm, next_followup_date: e.target.value })}
              className="cockpit-input text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsNewLeadModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              Create Lead
            </button>
          </div>
        </form>
      </Modal>

      {/* Schedule Followup Modal */}
      <Modal isOpen={isFollowupModalOpen} onClose={() => setIsFollowupModalOpen(false)} title={`Schedule Follow-up: ${selectedLead?.name}`}>
        <form onSubmit={handleCreateFollowup} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Action Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Discuss Scope & Quotation"
              value={followupForm.title}
              onChange={e => setFollowupForm({ ...followupForm, title: e.target.value })}
              className="cockpit-input text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Method</label>
              <select
                value={followupForm.contact_method}
                onChange={e => setFollowupForm({ ...followupForm, contact_method: e.target.value })}
                className="cockpit-input text-xs"
              >
                <option value="call">Phone Call</option>
                <option value="whatsapp">WhatsApp Message</option>
                <option value="meeting">Video / In-person Meeting</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Scheduled Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={followupForm.scheduled_at}
                onChange={e => setFollowupForm({ ...followupForm, scheduled_at: e.target.value })}
                className="cockpit-input text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Agenda</label>
            <textarea
              rows={3}
              value={followupForm.notes}
              onChange={e => setFollowupForm({ ...followupForm, notes: e.target.value })}
              className="cockpit-input text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsFollowupModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              Confirm Follow-up
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Activity Touchpoint Modal */}
      <Modal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} title={`Log Activity: ${selectedLead?.name}`}>
        <form onSubmit={handleLogActivity} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Activity Type</label>
              <select
                value={activityForm.activity_type}
                onChange={e => setActivityForm({ ...activityForm, activity_type: e.target.value })}
                className="cockpit-input text-xs"
              >
                <option value="call">Phone Call</option>
                <option value="meeting">Meeting Held</option>
                <option value="whatsapp">WhatsApp Outreach</option>
                <option value="email">Email Sent</option>
                <option value="note">Internal Note</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Subject / Summary *</label>
              <input
                type="text"
                required
                placeholder="e.g. Client requested revised timeline"
                value={activityForm.title}
                onChange={e => setActivityForm({ ...activityForm, title: e.target.value })}
                className="cockpit-input text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Detailed Outcome</label>
            <textarea
              rows={3}
              value={activityForm.description}
              onChange={e => setActivityForm({ ...activityForm, description: e.target.value })}
              className="cockpit-input text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsActivityModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer shadow-xs"
            >
              Save Activity
            </button>
          </div>
        </form>
      </Modal>

      {/* Import CSV Modal */}
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Import CSV Batch Leads">
        <form onSubmit={handleImportCsv} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Target Lead Source</label>
            <select
              value={importSource}
              onChange={e => setImportSource(e.target.value)}
              className="cockpit-input text-xs"
            >
              <option value="BNI">BNI Connect Export</option>
              <option value="KVV">KVV Member Export</option>
              <option value="EAF Connect">EAF Connect Export</option>
              <option value="SEO / Website">Website Leads</option>
              <option value="Manual Added">General / Custom CSV</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Paste CSV Content (with headers: name, company, phone, email, service)</label>
            <textarea
              rows={7}
              required
              placeholder="Name,Company,Phone,Email,Service&#10;Dr. Anand,Apex Healthcare,9825012345,anand@apex.com,Hospital ERP&#10;Vikram Patel,Surat Textiles,9825099887,vikram@surattex.in,Inventory Setup"
              value={csvContent}
              onChange={e => setCsvContent(e.target.value)}
              className="cockpit-input text-xs font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              Import Leads
            </button>
          </div>
        </form>
      </Modal>

      {/* External Sync Confirmation Modal */}
      <Modal
        isOpen={confirmExternalSyncOpen}
        onClose={() => setConfirmExternalSyncOpen(false)}
        title={`Synchronize Changes to ${selectedLead?.source_platform?.toUpperCase() || 'External Platform'}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div>
              <strong>Audit Safety Check:</strong> This action will synchronize your current Cockpit updates (status, notes, priority) back to the original platform ({selectedLead?.source_platform?.toUpperCase()}) using your authorized member web session.
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/[0.06] text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">External Lead / Slip:</span>
              <strong className="font-mono text-slate-900 dark:text-white">{selectedLead?.source_lead_id}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Proposed Pipeline Status:</span>
              <strong className="text-[#D62839] capitalize">{selectedLead?.status}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Contact Person:</span>
              <span className="text-slate-900 dark:text-white">{selectedLead?.name}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Remote values will be verified immediately after write. No external system code or database is modified.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmExternalSyncOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={syncingExternal}
              onClick={() => selectedLead && handleSyncToExternalPlatform(selectedLead)}
              className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingExternal ? 'animate-spin' : ''}`} />
              <span>Confirm & Synchronize</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Conflict Resolution Modal */}
      <Modal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title="Resolve External Platform Conflict"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>Remote Modification Detected:</strong> The external platform record was modified outside Cockpit. Choose which version to keep to maintain data integrity.
            </div>
          </div>

          {conflictData?.differences && (
            <div className="border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="p-2.5">Field</th>
                    <th className="p-2.5 text-slate-900 dark:text-white">External Portal Value</th>
                    <th className="p-2.5 text-[#D62839]">Local Cockpit Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {Object.entries(conflictData.differences).map(([field, diff]: [string, any]) => (
                    <tr key={field} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold uppercase text-[10px] text-slate-500">{field}</td>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-white bg-blue-50/40 dark:bg-blue-950/20">{diff.remote_now || '—'}</td>
                      <td className="p-2.5 font-semibold text-[#D62839] bg-rose-50/40 dark:bg-rose-950/20">{diff.proposed_local || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={syncingExternal}
              onClick={() => handleResolveConflict('keep_external')}
              className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-xl transition cursor-pointer"
            >
              Keep External Platform Values
            </button>
            <button
              type="button"
              disabled={syncingExternal}
              onClick={() => handleResolveConflict('keep_cockpit')}
              className="cockpit-btn-primary"
            >
              Keep Cockpit Changes
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
