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
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
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
  // 'all' | 'bni' | 'kvv' | 'eaf' | 'seo' | 'new' | 'pending' | 'today' | 'overdue' | 'converted' | 'lost'
  
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all'); // all, today, this_week, this_month
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

  const [csvContent, setCsvContent] = useState('');
  const [importSource, setImportSource] = useState('BNI');

  // External Platform Bidirectional Sync & Conflict States
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictQueueId, setConflictQueueId] = useState<number | null>(null);
  const [conflictData, setConflictData] = useState<any>(null);
  const [syncingExternal, setSyncingExternal] = useState(false);
  const [confirmExternalSyncOpen, setConfirmExternalSyncOpen] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const fetchLeads = async () => {
    try {
      setRefreshing(true);
      const [leadsRes, empsRes, sourcesRes] = await Promise.all([
        api.get<Lead[]>('/crm/leads'),
        api.get<Employee[]>('/hrm/employees').catch(() => []),
        api.get<LeadSourceConfig[]>('/crm/lead-sources').catch(() => [])
      ]);
      setLeads(leadsRes || []);
      setEmployees(empsRes || []);
      setSources(sourcesRes || []);
    } catch (err: any) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Filtered & Sorted Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Source / Tab filter
      if (activeTabFilter === 'bni') {
        const isBni = lead.source?.toLowerCase().includes('bni') || lead.source_platform === 'bni';
        if (!isBni) return false;
      } else if (activeTabFilter === 'kvv') {
        const isKvv = lead.source?.toLowerCase().includes('kvv') || lead.source_platform === 'kvv';
        if (!isKvv) return false;
      } else if (activeTabFilter === 'eaf') {
        const isEaf = lead.source?.toLowerCase().includes('eaf') || lead.source_platform === 'eaf';
        if (!isEaf) return false;
      } else if (activeTabFilter === 'seo') {
        const isSeo = lead.source?.toLowerCase().includes('seo') || lead.source?.toLowerCase().includes('website') || lead.source_platform === 'seo';
        if (!isSeo) return false;
      } else if (activeTabFilter === 'new') {
        if (lead.status !== 'new') return false;
      } else if (activeTabFilter === 'pending') {
        if (lead.status === 'won' || lead.status === 'lost') return false;
        if (!lead.next_followup_date || new Date(lead.next_followup_date) < new Date()) return false;
      } else if (activeTabFilter === 'today') {
        if (lead.status === 'won' || lead.status === 'lost') return false;
        if (!lead.next_followup_date) return false;
        const d = new Date(lead.next_followup_date).toDateString();
        const today = new Date().toDateString();
        if (d !== today) return false;
      } else if (activeTabFilter === 'overdue') {
        if (lead.status === 'won' || lead.status === 'lost') return false;
        if (!lead.next_followup_date || new Date(lead.next_followup_date) >= new Date()) return false;
      } else if (activeTabFilter === 'converted') {
        if (lead.status !== 'won') return false;
      } else if (activeTabFilter === 'lost') {
        if (lead.status !== 'lost') return false;
      }

      // 2. Dropdown Source Filter
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) {
        return false;
      }

      // 3. Employee Filter
      if (employeeFilter !== 'all') {
        if (employeeFilter === 'unassigned' && lead.assigned_to) return false;
        if (employeeFilter !== 'unassigned' && String(lead.assigned_to) !== employeeFilter) return false;
      }

      // 4. Priority Filter
      if (priorityFilter !== 'all' && lead.priority !== priorityFilter) {
        return false;
      }

      // 5. Date Filter (Created Date)
      if (dateFilter !== 'all') {
        const leadDate = new Date(lead.created_at);
        const now = new Date();
        if (dateFilter === 'today') {
          if (leadDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'this_week') {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          if (leadDate < weekAgo) return false;
        } else if (dateFilter === 'this_month') {
          if (leadDate.getMonth() !== now.getMonth() || leadDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      // 6. Global Search
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchName = lead.name?.toLowerCase().includes(term);
        const matchComp = lead.company?.toLowerCase().includes(term);
        const matchPhone = lead.phone?.toLowerCase().includes(term);
        const matchEmail = lead.email?.toLowerCase().includes(term);
        const matchReq = lead.service_requirement?.toLowerCase().includes(term);
        const matchSource = lead.source?.toLowerCase().includes(term);
        if (!matchName && !matchComp && !matchPhone && !matchEmail && !matchReq && !matchSource) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let aVal = (a as any)[sortBy];
      let bVal = (b as any)[sortBy];

      if (sortBy === 'priority') {
        const pOrder: any = { urgent: 4, high: 3, medium: 2, low: 1 };
        aVal = pOrder[a.priority] || 0;
        bVal = pOrder[b.priority] || 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [leads, activeTabFilter, sourceFilter, employeeFilter, priorityFilter, dateFilter, search, sortBy, sortDirection]);

  // Pagination Slice
  const totalLeadsCount = filteredLeads.length;
  const totalPages = Math.ceil(totalLeadsCount / pageSize) || 1;
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const handleViewLeadDetail = async (lead: Lead) => {
    try {
      const fullLead = await api.get<Lead>(`/crm/leads/${lead.id}`);
      setSelectedLead(fullLead);
      setIsDetailDrawerOpen(true);
    } catch (err: any) {
      setSelectedLead(lead);
      setIsDetailDrawerOpen(true);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/crm/leads', {
        ...newLeadForm,
        assigned_to: newLeadForm.assigned_to ? Number(newLeadForm.assigned_to) : null
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

  const handleUpdateStatus = async (leadId: number, status: string) => {
    try {
      await api.post(`/crm/leads/${leadId}/status`, { status });
      fetchLeads();
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, status: status as any });
      }
    } catch (err: any) {
      alert('Status update failed: ' + err.message);
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
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#059669] bg-green-50 px-2 py-0.5 rounded-full border border-green-200" title="Externally verified and synchronized">
              <CheckCircle2 className="w-3 h-3" /> Ext Synced
            </span>
          );
        case 'pending_writeback':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D97706] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200" title="Awaiting external platform synchronization">
              <Clock className="w-3 h-3 animate-pulse" /> Pending Sync
            </span>
          );
        case 'conflict':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#EA580C] bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200 animate-pulse" title="External drift detected! Click to resolve conflict">
              <AlertTriangle className="w-3 h-3 text-[#EA580C]" /> Conflict
            </span>
          );
        case 'failed':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#DC2626] bg-red-50 px-2 py-0.5 rounded-full border border-red-200" title="External synchronization failed">
              <AlertTriangle className="w-3 h-3" /> Sync Failed
            </span>
          );
        case 'manual_required':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#7C3AED] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200" title="Platform does not support automated write-back">
              <User className="w-3 h-3" /> Manual Required
            </span>
          );
      }
    }

    switch (syncStatus) {
      case 'synced':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#059669]"><CheckCircle2 className="w-3 h-3" /> Auto Synced</span>;
      case 'webhook':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0284C7]"><Zap className="w-3 h-3" /> Webhook</span>;
      case 'error':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#DC2626]"><AlertTriangle className="w-3 h-3" /> Sync Error</span>;
      case 'manual':
      default:
        return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#667085]"><User className="w-3 h-3" /> Manual / CSV</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-[#EAECF0] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D62839]" />
            <h1 className="text-xl sm:text-2xl font-black text-[#20242C] tracking-tight">
              Centralized Leads Management
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#667085] mt-1">
            Universal real-time lead hub across BNI Connect, KVV, EAF Connect, SEO Forms, and Direct Outreach.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateToIntegrations && (
            <button
              onClick={onNavigateToIntegrations}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[#344054] bg-[#F9FAFB] hover:bg-[#F2F4F7] border border-[#D0D5DD] rounded-xl transition"
            >
              <Zap className="w-3.5 h-3.5 text-[#D62839]" />
              Sync Connectors Hub
            </button>
          )}

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[#344054] bg-[#F9FAFB] hover:bg-[#F2F4F7] border border-[#D0D5DD] rounded-xl transition"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>

          <button
            onClick={() => setIsNewLeadModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-[#D62839] hover:bg-[#B91C1C] rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            New Lead
          </button>

          <button
            onClick={fetchLeads}
            disabled={refreshing}
            className="p-2 border border-[#D0D5DD] rounded-xl hover:bg-[#F9FAFB] transition text-[#344054]"
            title="Refresh All Leads"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs (11 Required Views) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
        {[
          { id: 'all', label: 'All Sources' },
          { id: 'bni', label: 'BNI Connect' },
          { id: 'kvv', label: 'KVV Leads' },
          { id: 'eaf', label: 'EAF Connect' },
          { id: 'seo', label: 'SEO & Website' },
          { id: 'new', label: 'New Leads' },
          { id: 'pending', label: 'Pending Follow-ups' },
          { id: 'today', label: "Today's Follow-ups" },
          { id: 'overdue', label: 'Overdue ⚠️' },
          { id: 'converted', label: 'Converted' },
          { id: 'lost', label: 'Lost' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTabFilter(tab.id);
              setCurrentPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap shrink-0 ${
              activeTabFilter === tab.id
                ? 'bg-[#D62839] text-white shadow-sm'
                : 'bg-white text-[#475467] border border-[#EAECF0] hover:bg-[#F9FAFB]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Secondary Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-[#EAECF0] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search leads, company, phone, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs border border-[#D0D5DD] rounded-xl focus:ring-2 focus:ring-[#D62839] focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Source Dropdown */}
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 text-xs border border-[#D0D5DD] rounded-xl bg-white text-[#344054]"
          >
            <option value="all">Sources: All</option>
            {sources.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>

          {/* Assigned Employee */}
          <select
            value={employeeFilter}
            onChange={(e) => {
              setEmployeeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 text-xs border border-[#D0D5DD] rounded-xl bg-white text-[#344054]"
          >
            <option value="all">Rep: All Team</option>
            <option value="unassigned">Unassigned Rep</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 text-xs border border-[#D0D5DD] rounded-xl bg-white text-[#344054]"
          >
            <option value="all">Priority: All</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Date Created */}
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 text-xs border border-[#D0D5DD] rounded-xl bg-white text-[#344054]"
          >
            <option value="all">Created: All Time</option>
            <option value="today">Created Today</option>
            <option value="this_week">Past 7 Days</option>
            <option value="this_month">This Month</option>
          </select>

          <span className="text-xs text-[#667085] ml-2">
            Showing <strong>{filteredLeads.length}</strong> leads
          </span>
        </div>
      </div>

      {/* Central 14-Column Unified Table */}
      <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#667085] flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-[#D62839]/20 border-t-[#D62839] rounded-full animate-spin" />
            Loading centralized business leads...
          </div>
        ) : paginatedLeads.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#667085]">
            No leads match the selected criteria. Adjust filters or connect an intake source.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#EAECF0] bg-[#F9FAFB] text-[#475467] uppercase font-bold text-[10px]">
                  {/* 1. Lead Name */}
                  <th className="py-3 px-3 cursor-pointer select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Lead Name <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  {/* 2. Company */}
                  <th className="py-3 px-3">Company</th>
                  {/* 3. Phone */}
                  <th className="py-3 px-3">Phone</th>
                  {/* 4. Email */}
                  <th className="py-3 px-3">Email</th>
                  {/* 5. Lead Source */}
                  <th className="py-3 px-3 cursor-pointer select-none" onClick={() => handleSort('source')}>
                    <div className="flex items-center gap-1">Source <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  {/* 6. Service / Requirement */}
                  <th className="py-3 px-3">Service / Requirement</th>
                  {/* 7. Assigned Employee */}
                  <th className="py-3 px-3">Assigned Rep</th>
                  {/* 8. Lead Status */}
                  <th className="py-3 px-3">Status</th>
                  {/* 9. Priority */}
                  <th className="py-3 px-3 cursor-pointer select-none" onClick={() => handleSort('priority')}>
                    <div className="flex items-center gap-1">Priority <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  {/* 10. Last Contact */}
                  <th className="py-3 px-3">Last Contact</th>
                  {/* 11. Next Follow-up */}
                  <th className="py-3 px-3 cursor-pointer select-none" onClick={() => handleSort('next_followup_date')}>
                    <div className="flex items-center gap-1">Next Follow-up <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  {/* 12. Created Date */}
                  <th className="py-3 px-3 cursor-pointer select-none" onClick={() => handleSort('created_at')}>
                    <div className="flex items-center gap-1">Created Date <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  {/* 13. Sync Status */}
                  <th className="py-3 px-3">Sync Status</th>
                  {/* 14. Actions */}
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {paginatedLeads.map((lead) => {
                  const isOverdue = lead.next_followup_date && new Date(lead.next_followup_date) < new Date() && !['won', 'lost'].includes(lead.status);
                  const isToday = lead.next_followup_date && new Date(lead.next_followup_date).toDateString() === new Date().toDateString();

                  return (
                    <tr 
                      key={lead.id}
                      onClick={() => handleViewLeadDetail(lead)}
                      className="hover:bg-[#FFF5F5]/60 transition cursor-pointer"
                    >
                      {/* 1. Name */}
                      <td className="py-3 px-3 font-bold text-[#20242C] whitespace-nowrap">
                        {lead.name}
                      </td>

                      {/* 2. Company */}
                      <td className="py-3 px-3 text-[#344054] whitespace-nowrap">
                        {lead.company || '—'}
                      </td>

                      {/* 3. Phone */}
                      <td className="py-3 px-3 text-[#475467] font-mono whitespace-nowrap">
                        {lead.phone ? (
                          <a 
                            href={`tel:${lead.phone}`} 
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#D62839] hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </a>
                        ) : '—'}
                      </td>

                      {/* 4. Email */}
                      <td className="py-3 px-3 text-[#475467] whitespace-nowrap">
                        {lead.email ? (
                          <a 
                            href={`mailto:${lead.email}`} 
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-[#D62839] truncate block max-w-[130px]"
                            title={lead.email}
                          >
                            {lead.email}
                          </a>
                        ) : '—'}
                      </td>

                      {/* 5. Lead Source */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-[#1D2939] px-2 py-0.5 rounded bg-[#F2F4F7] text-[11px]">
                          {lead.source}
                        </span>
                      </td>

                      {/* 6. Service / Requirement */}
                      <td className="py-3 px-3 text-[#344054] max-w-[160px] truncate" title={lead.service_requirement || ''}>
                        {lead.service_requirement || '—'}
                      </td>

                      {/* 7. Assigned Rep */}
                      <td className="py-3 px-3 text-[#475467] whitespace-nowrap">
                        {lead.assigned_user_name || <span className="text-gray-400 italic">Unassigned</span>}
                      </td>

                      {/* 8. Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getStatusBadge(lead.status)}
                      </td>

                      {/* 9. Priority */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getPriorityBadge(lead.priority)}
                      </td>

                      {/* 10. Last Contact */}
                      <td className="py-3 px-3 text-[#667085] whitespace-nowrap">
                        {lead.last_contact_date ? new Date(lead.last_contact_date).toLocaleDateString('en-IN') : <span className="text-gray-400">None</span>}
                      </td>

                      {/* 11. Next Follow-up */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {lead.next_followup_date ? (
                          <span className={`font-semibold ${isOverdue ? 'text-[#DC2626]' : isToday ? 'text-[#D97706]' : 'text-[#344054]'}`}>
                            {new Date(lead.next_followup_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {isOverdue && ' ⚠️'}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not set</span>
                        )}
                      </td>

                      {/* 12. Created Date */}
                      <td className="py-3 px-3 text-[#667085] whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>

                      {/* 13. Sync Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getSyncStatusBadge(lead.sync_status, lead.external_sync_status)}
                      </td>

                      {/* 14. Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsFollowupModalOpen(true);
                            }}
                            className="p-1 text-[#344054] hover:text-[#D62839] hover:bg-[#FEE4E2] rounded transition"
                            title="Schedule Next Follow-up"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsActivityModalOpen(true);
                            }}
                            className="p-1 text-[#344054] hover:text-[#059669] hover:bg-[#ECFDF5] rounded transition"
                            title="Log Activity Touchpoint"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleViewLeadDetail(lead)}
                            className="p-1 text-[#667085] hover:text-[#20242C] rounded transition"
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
        <div className="p-4 border-t border-[#EAECF0] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#667085]">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-[#D0D5DD] rounded-lg bg-white"
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
              className="p-1.5 border border-[#D0D5DD] rounded-lg disabled:opacity-40 hover:bg-[#F9FAFB]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-[#20242C]">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="p-1.5 border border-[#D0D5DD] rounded-lg disabled:opacity-40 hover:bg-[#F9FAFB]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Lead Detail Panel / Drawer */}
      {isDetailDrawerOpen && selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-start justify-between pb-4 border-b border-[#EAECF0]">
              <div>
                <span className="text-[11px] font-bold text-[#667085] uppercase tracking-wider">{selectedLead.source}</span>
                <h2 className="text-xl font-bold text-[#20242C]">{selectedLead.name}</h2>
                <p className="text-xs text-[#475467]">{selectedLead.company || 'Individual Account'}</p>
              </div>
              <button onClick={() => setIsDetailDrawerOpen(false)} className="p-1 text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stage Quick Change */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#667085] uppercase">Lead Stage Pipeline</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedLead.id, st)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition capitalize ${
                      selectedLead.status === st
                        ? 'bg-[#D62839] text-white shadow-sm'
                        : 'bg-[#F2F4F7] text-[#475467] hover:bg-[#EAECF0]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-[#F9FAFB] rounded-xl border border-[#F2F4F7] text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#667085] block">Requirement</span>
                <strong className="text-[#20242C]">{selectedLead.service_requirement || 'General'}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#667085] block">Priority</span>
                {getPriorityBadge(selectedLead.priority)}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#667085] block">Contact</span>
                <span className="font-mono text-[#D62839]">{selectedLead.phone || 'No phone'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#667085] block">Assigned Rep</span>
                <span className="text-[#20242C]">{selectedLead.assigned_user_name || 'Unassigned'}</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsFollowupModalOpen(true)}
                className="flex-1 py-2 text-xs font-bold text-white bg-[#D62839] hover:bg-[#B91C1C] rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                Schedule Follow-up
              </button>
              <button
                onClick={() => setIsActivityModalOpen(true)}
                className="flex-1 py-2 text-xs font-bold text-[#344054] bg-[#F2F4F7] hover:bg-[#E4E7EC] rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Log Touchpoint
              </button>
            </div>

            {/* External Platform Bidirectional Sync & Writeback Block */}
            {selectedLead.source_platform && (
              <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0284C7]" />
                    <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                      External Platform Sync ({selectedLead.source_platform.toUpperCase()})
                    </h3>
                  </div>
                  <div>
                    {getSyncStatusBadge(selectedLead.sync_status, selectedLead.external_sync_status)}
                  </div>
                </div>

                <div className="text-xs text-[#475467] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Original Slip / Lead ID:</span>
                    <strong className="font-mono text-[#0F172A]">{selectedLead.source_lead_id || '—'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Last External Synchronization:</span>
                    <span>{selectedLead.last_external_sync_at ? new Date(selectedLead.last_external_sync_at).toLocaleString('en-IN') : 'Not yet synchronized'}</span>
                  </div>
                </div>

                {/* Conflict banner if conflict detected */}
                {selectedLead.external_sync_status === 'conflict' && (
                  <div className="p-3 bg-[#FFF7ED] rounded-xl border border-[#FDBA74] text-xs space-y-2">
                    <div className="flex items-center gap-2 text-[#C2410C] font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      External Platform Drift Detected!
                    </div>
                    <p className="text-[11px] text-[#9A3412]">
                      The record was modified directly on {selectedLead.source_platform.toUpperCase()} outside Cockpit. To prevent overwriting external work, please review differences before updating.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          const res: any = await api.get(`/crm/leads/${selectedLead.id}/sync-status`);
                          const latestQueue = res.writeback_queue?.[0];
                          if (latestQueue?.conflict_details) {
                            setConflictData(latestQueue.conflict_details);
                            setConflictQueueId(latestQueue.id);
                            setConflictModalOpen(true);
                          }
                        } catch (e) {}
                      }}
                      className="w-full py-1.5 px-3 bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Review & Resolve Conflict
                    </button>
                  </div>
                )}

                {/* Sync feedback */}
                {syncFeedback && (
                  <div className={`p-2.5 rounded-lg text-xs ${syncFeedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {syncFeedback.message}
                  </div>
                )}

                {/* Write-back button with confirmation */}
                <button
                  onClick={() => setConfirmExternalSyncOpen(true)}
                  disabled={syncingExternal}
                  className="w-full py-2 px-3 bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#0284C7] ${syncingExternal ? 'animate-spin' : ''}`} />
                  Sync Changes to {selectedLead.source_platform.toUpperCase()}
                </button>
              </div>
            )}

            {/* Activity History */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-[#20242C] uppercase tracking-wider">
                Follow-up & Activity History
              </h3>
              {(!selectedLead.activities || selectedLead.activities.length === 0) ? (
                <p className="text-xs text-gray-400 italic">No activity logs recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {selectedLead.activities.map(act => (
                    <div key={act.id} className="p-3 bg-[#F9FAFB] rounded-xl border border-[#F2F4F7] text-xs">
                      <div className="flex items-center justify-between text-[#667085] text-[10px] mb-1">
                        <span className="font-bold uppercase text-[#D62839]">{act.activity_type}</span>
                        <span>{new Date(act.activity_date).toLocaleString('en-IN')}</span>
                      </div>
                      <h4 className="font-bold text-[#20242C]">{act.title}</h4>
                      {act.description && <p className="text-[#475467] mt-0.5">{act.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Lead Modal */}
      <Modal isOpen={isNewLeadModalOpen} onClose={() => setIsNewLeadModalOpen(false)} title="Create Business Lead">
        <form onSubmit={handleCreateLead} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Contact Name *</label>
              <input
                type="text"
                required
                value={newLeadForm.name}
                onChange={e => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Company</label>
              <input
                type="text"
                value={newLeadForm.company}
                onChange={e => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={newLeadForm.phone}
                onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Email</label>
              <input
                type="email"
                value={newLeadForm.email}
                onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Lead Source</label>
              <select
                value={newLeadForm.source}
                onChange={e => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
              >
                <option value="BNI">BNI Connect</option>
                <option value="KVV">KVV Leads</option>
                <option value="EAF Connect">EAF Connect</option>
                <option value="SEO / Website">SEO / Website</option>
                <option value="Manual Added">Manual Added</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Service / Requirement</label>
              <input
                type="text"
                placeholder="e.g. ERP Implementation, Web App"
                value={newLeadForm.service_requirement}
                onChange={e => setNewLeadForm({ ...newLeadForm, service_requirement: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Priority</label>
              <select
                value={newLeadForm.priority}
                onChange={e => setNewLeadForm({ ...newLeadForm, priority: e.target.value as any })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Assign Rep</label>
              <select
                value={newLeadForm.assigned_to}
                onChange={e => setNewLeadForm({ ...newLeadForm, assigned_to: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
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
            <label className="block text-xs font-bold text-[#344054] mb-1">Initial Next Follow-up</label>
            <input
              type="datetime-local"
              value={newLeadForm.next_followup_date}
              onChange={e => setNewLeadForm({ ...newLeadForm, next_followup_date: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsNewLeadModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-[#344054] border border-[#D0D5DD] rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-[#D62839] hover:bg-[#B91C1C] rounded-xl"
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
            <label className="block text-xs font-bold text-[#344054] mb-1">Action Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Discuss Scope & Quotation"
              value={followupForm.title}
              onChange={e => setFollowupForm({ ...followupForm, title: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Contact Method</label>
              <select
                value={followupForm.contact_method}
                onChange={e => setFollowupForm({ ...followupForm, contact_method: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
              >
                <option value="call">Phone Call</option>
                <option value="whatsapp">WhatsApp Message</option>
                <option value="meeting">Video / In-person Meeting</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Scheduled Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={followupForm.scheduled_at}
                onChange={e => setFollowupForm({ ...followupForm, scheduled_at: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#344054] mb-1">Notes / Agenda</label>
            <textarea
              rows={3}
              value={followupForm.notes}
              onChange={e => setFollowupForm({ ...followupForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsFollowupModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-[#344054] border border-[#D0D5DD] rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-[#D62839] hover:bg-[#B91C1C] rounded-xl"
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
              <label className="block text-xs font-bold text-[#344054] mb-1">Activity Type</label>
              <select
                value={activityForm.activity_type}
                onChange={e => setActivityForm({ ...activityForm, activity_type: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
              >
                <option value="call">Phone Call</option>
                <option value="meeting">Meeting Held</option>
                <option value="whatsapp">WhatsApp Outreach</option>
                <option value="email">Email Sent</option>
                <option value="note">Internal Note</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1">Subject / Summary *</label>
              <input
                type="text"
                required
                placeholder="e.g. Client requested revised timeline"
                value={activityForm.title}
                onChange={e => setActivityForm({ ...activityForm, title: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#344054] mb-1">Detailed Outcome</label>
            <textarea
              rows={3}
              value={activityForm.description}
              onChange={e => setActivityForm({ ...activityForm, description: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsActivityModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-[#344054] border border-[#D0D5DD] rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] rounded-xl"
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
            <label className="block text-xs font-bold text-[#344054] mb-1">Target Lead Source</label>
            <select
              value={importSource}
              onChange={e => setImportSource(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl"
            >
              <option value="BNI">BNI Connect Export</option>
              <option value="KVV">KVV Member Export</option>
              <option value="EAF Connect">EAF Connect Export</option>
              <option value="SEO / Website">Website Leads</option>
              <option value="Manual Added">General / Custom CSV</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#344054] mb-1">Paste CSV Content (with headers: name, company, phone, email, service)</label>
            <textarea
              rows={7}
              required
              placeholder="Name,Company,Phone,Email,Service&#10;Dr. Anand,Apex Healthcare,9825012345,anand@apex.com,Hospital ERP&#10;Vikram Patel,Surat Textiles,9825099887,vikram@surattex.in,Inventory Setup"
              value={csvContent}
              onChange={e => setCsvContent(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-[#D0D5DD] rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-[#344054] border border-[#D0D5DD] rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-[#D62839] hover:bg-[#B91C1C] rounded-xl"
            >
              Import Leads
            </button>
          </div>
        </form>
      </Modal>

      {/* External Sync Confirmation Modal (Audit Requirement: Explicit User Confirmation) */}
      <Modal
        isOpen={confirmExternalSyncOpen}
        onClose={() => setConfirmExternalSyncOpen(false)}
        title={`Synchronize Changes to ${selectedLead?.source_platform?.toUpperCase() || 'External Platform'}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-[#EFF8FF] rounded-xl border border-[#B2DDFF] text-xs text-[#1E40AF] flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Audit Safety Check:</strong> This action will synchronize your current Cockpit updates (status, notes, priority) back to the original platform ({selectedLead?.source_platform?.toUpperCase()}) using your authorized member web session.
            </div>
          </div>

          <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EAECF0] text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#64748B]">External Lead / Slip:</span>
              <strong className="font-mono text-[#0F172A]">{selectedLead?.source_lead_id}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Proposed Pipeline Status:</span>
              <strong className="text-[#D62839] capitalize">{selectedLead?.status}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Contact Person:</span>
              <span className="text-[#0F172A]">{selectedLead?.name}</span>
            </div>
          </div>

          <p className="text-[11px] text-[#64748B]">
            Remote values will be verified immediately after write. No external system code or database is modified.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmExternalSyncOpen(false)}
              className="px-4 py-2 text-xs font-bold text-[#344054] border border-[#D0D5DD] rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={syncingExternal}
              onClick={() => selectedLead && handleSyncToExternalPlatform(selectedLead)}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-xl flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingExternal ? 'animate-spin' : ''}`} />
              Confirm & Synchronize
            </button>
          </div>
        </div>
      </Modal>

      {/* Conflict Resolution Modal (Side-by-Side Comparison) */}
      <Modal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title="Resolve External Platform Conflict"
      >
        <div className="space-y-4">
          <div className="p-3 bg-[#FFF7ED] rounded-xl border border-[#FDBA74] text-xs text-[#9A3412] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#C2410C]" />
            <div>
              <strong>Remote Modification Detected:</strong> The external platform record was modified outside Cockpit. Choose which version to keep to maintain data integrity.
            </div>
          </div>

          {conflictData?.differences && (
            <div className="border border-[#EAECF0] rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFC] text-[10px] font-bold text-[#64748B] uppercase">
                  <tr>
                    <th className="p-2.5">Field</th>
                    <th className="p-2.5 text-[#0F172A]">External Portal Value</th>
                    <th className="p-2.5 text-[#D62839]">Local Cockpit Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0]">
                  {Object.entries(conflictData.differences).map(([field, diff]: [string, any]) => (
                    <tr key={field} className="hover:bg-[#F9FAFB]">
                      <td className="p-2.5 font-bold uppercase text-[10px] text-[#64748B]">{field}</td>
                      <td className="p-2.5 font-semibold text-[#0F172A] bg-blue-50/40">{diff.remote_now || '—'}</td>
                      <td className="p-2.5 font-semibold text-[#D62839] bg-red-50/40">{diff.proposed_local || '—'}</td>
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
              className="px-3.5 py-2 text-xs font-bold text-[#1E40AF] bg-[#EFF8FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] rounded-xl transition"
            >
              Keep External Platform Values
            </button>
            <button
              type="button"
              disabled={syncingExternal}
              onClick={() => handleResolveConflict('keep_cockpit')}
              className="px-3.5 py-2 text-xs font-bold text-white bg-[#D62839] hover:bg-[#B91C1C] rounded-xl transition"
            >
              Keep Cockpit Changes (Overwrite External)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
