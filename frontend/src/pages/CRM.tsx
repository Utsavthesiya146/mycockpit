import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare, 
  Upload, 
  Download, 
  ExternalLink, 
  Sparkles, 
  Filter, 
  RefreshCw, 
  Layers, 
  ChevronRight,
  PhoneCall,
  Check,
  Globe,
  Briefcase,
  Copy,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { SlideOverDrawer } from '../components/common/SlideOverDrawer';
import { EmptyState } from '../components/common/EmptyState';
import { Cockpit3DLoader } from '../components/common/Cockpit3DLoader';
import { formatCurrency, createWhatsAppUrl } from '../utils/formatters';
import type { Customer, Lead, LeadActivity, LeadSourceConfig, Employee } from '../types';

export const CRM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leads' | 'customers' | 'sources'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSourceConfig[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [activeView, setActiveView] = useState<string>('all'); 
  // 'all' | 'new' | 'pending' | 'today' | 'overdue' | 'completed' | 'no_followup' | 'won' | 'lost'
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [displayMode, setDisplayMode] = useState<'cards' | 'pipeline'>('cards');

  // Modals
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // New Lead Form State
  const [leadName, setLeadName] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadValue, setLeadValue] = useState<number>(100000);
  const [leadSource, setLeadSource] = useState('BNI Connect');
  const [leadService, setLeadService] = useState('');
  const [leadPriority, setLeadPriority] = useState<Lead['priority']>('medium');
  const [leadStatus, setLeadStatus] = useState<Lead['status']>('new');
  const [leadAssignedTo, setLeadAssignedTo] = useState<string>('');
  const [leadNotes, setLeadNotes] = useState('');
  const [leadNextFollowup, setLeadNextFollowup] = useState('');
  const [leadContactMethod, setLeadContactMethod] = useState<'call' | 'email' | 'meeting' | 'whatsapp'>('call');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [forceDuplicate, setForceDuplicate] = useState(false);

  // Activity Log Modal State
  const [actType, setActType] = useState<'call' | 'email' | 'meeting' | 'whatsapp' | 'note'>('call');
  const [actTitle, setActTitle] = useState('');
  const [actDescription, setActDescription] = useState('');
  const [actOutcome, setActOutcome] = useState('');
  const [actNextDate, setActNextDate] = useState('');
  const [actNextMethod, setActNextMethod] = useState<'call' | 'email' | 'meeting' | 'whatsapp'>('call');

  // Import Leads State
  const [importSourceKey, setImportSourceKey] = useState('bni');
  const [importDuplicateStrategy, setImportDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [importCsvText, setImportCsvText] = useState('');
  const [importStatusMsg, setImportStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Customer Form State
  const [custName, setCustName] = useState('');
  const [custCompany, setCustCompany] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custCity, setCustCity] = useState('');
  const [custTaxId, setCustTaxId] = useState('');

  // Copy notification state
  const [copiedToken, setCopiedToken] = useState(false);

  const fetchData = async () => {
    try {
      const [lData, cData, sData, eData]: any = await Promise.all([
        api.get('/crm/leads'),
        api.get('/crm/customers'),
        api.get('/crm/lead-sources'),
        api.get('/hrm/employees')
      ]);
      setLeads(lData || []);
      setCustomers(cData || []);
      setLeadSources(sData || []);
      setEmployees(eData || []);
    } catch (err) {
      console.error('Failed to load CRM data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/crm/customers', {
        name: custName,
        company: custCompany,
        email: custEmail,
        phone: custPhone,
        city: custCity,
        tax_id: custTaxId
      });
      setIsCustomerModalOpen(false);
      setCustName('');
      setCustCompany('');
      setCustEmail('');
      setCustPhone('');
      setCustCity('');
      setCustTaxId('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating customer');
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateWarning(null);
    try {
      await api.post('/crm/leads', {
        name: leadName,
        company: leadCompany,
        email: leadEmail,
        phone: leadPhone,
        value: leadValue,
        source: leadSource,
        service_requirement: leadService,
        priority: leadPriority,
        status: leadStatus,
        assigned_to: leadAssignedTo ? Number(leadAssignedTo) : null,
        notes: leadNotes,
        next_followup_date: leadNextFollowup || null,
        contact_method: leadContactMethod,
        force_duplicate: forceDuplicate
      });
      setIsLeadModalOpen(false);
      resetLeadForm();
      fetchData();
    } catch (err: any) {
      if (err.data && err.data.duplicate) {
        setDuplicateWarning(err.message || 'A lead with matching contact details already exists.');
      } else {
        alert(err.message || 'Error creating lead');
      }
    }
  };

  const resetLeadForm = () => {
    setLeadName('');
    setLeadCompany('');
    setLeadEmail('');
    setLeadPhone('');
    setLeadValue(100000);
    setLeadSource('BNI Connect');
    setLeadService('');
    setLeadPriority('medium');
    setLeadStatus('new');
    setLeadAssignedTo('');
    setLeadNotes('');
    setLeadNextFollowup('');
    setDuplicateWarning(null);
    setForceDuplicate(false);
  };

  const handleLeadStatusChange = async (leadId: number, newStatus: string) => {
    try {
      await api.post(`/crm/leads/${leadId}/status`, { status: newStatus });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    }
  };

  const handleOpenDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailDrawerOpen(true);
    // Fetch latest fresh details including timeline activities
    try {
      const detailed: any = await api.get(`/crm/leads/${lead.id}`);
      if (detailed) {
        setSelectedLead(detailed);
      }
    } catch (err) {
      console.error('Error fetching lead details:', err);
    }
  };

  const handleOpenActivityModal = (lead: Lead) => {
    setSelectedLead(lead);
    setActType('call');
    setActTitle(`Call with ${lead.name}`);
    setActDescription('');
    setActOutcome('');
    setActNextDate('');
    setActNextMethod('call');
    setIsActivityModalOpen(true);
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    try {
      await api.post(`/crm/leads/${selectedLead.id}/activities`, {
        activity_type: actType,
        title: actTitle,
        description: actDescription,
        outcome: actOutcome,
        next_followup_date: actNextDate || null,
        next_contact_method: actNextMethod
      });
      setIsActivityModalOpen(false);
      // Refresh lead details if open
      if (isDetailDrawerOpen) {
        const detailed: any = await api.get(`/crm/leads/${selectedLead.id}`);
        setSelectedLead(detailed);
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error logging touchpoint');
    }
  };

  const handleImportCsv = async () => {
    setImportStatusMsg(null);
    if (!importCsvText.trim()) {
      setImportStatusMsg({ type: 'error', text: 'Please paste CSV content with header columns.' });
      return;
    }

    try {
      const lines = importCsvText.trim().split('\n');
      if (lines.length < 2) {
        setImportStatusMsg({ type: 'error', text: 'CSV must contain at least a header line and one data row.' });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const parsedLeads: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const leadObj: any = {};
        headers.forEach((h, idx) => {
          leadObj[h] = row[idx] || '';
        });
        parsedLeads.push(leadObj);
      }

      const res: any = await api.post('/crm/leads/import', {
        leads: parsedLeads,
        source_key: importSourceKey,
        duplicate_strategy: importDuplicateStrategy
      });

      setImportStatusMsg({
        type: 'success',
        text: `Import completed! Successfully imported ${res.imported} leads, skipped ${res.skipped_duplicates} duplicates, updated ${res.updated} records.`
      });
      setImportCsvText('');
      fetchData();
    } catch (err: any) {
      setImportStatusMsg({ type: 'error', text: err.message || 'Failed to parse or import CSV data.' });
    }
  };

  const handleCopyWebhookUrl = (secret: string) => {
    const origin = window.location.origin;
    const url = `${origin}/backend/api/leads/webhook?token=${secret}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // 9 Required Views from HK Sir
  const viewTabs = [
    { id: 'all', label: 'All Leads', count: leads.length },
    { id: 'new', label: 'New Leads', count: leads.filter(l => l.status === 'new').length, badgeColor: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50' },
    { id: 'pending', label: 'Pending Follow-ups', count: leads.filter(l => l.calculated_followup_status === 'pending' || (l.next_followup_date && new Date(l.next_followup_date) >= new Date() && l.status !== 'won' && l.status !== 'lost')).length },
    { id: 'today', label: 'Today\'s Follow-ups', count: leads.filter(l => l.calculated_followup_status === 'today' || (l.next_followup_date && new Date(l.next_followup_date).toDateString() === new Date().toDateString() && l.status !== 'won' && l.status !== 'lost')).length, badgeColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50' },
    { id: 'overdue', label: 'Overdue Follow-ups', count: leads.filter(l => l.calculated_followup_status === 'overdue' || (l.next_followup_date && new Date(l.next_followup_date) < new Date() && l.status !== 'won' && l.status !== 'lost')).length, badgeColor: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50' },
    { id: 'completed', label: 'Completed Follow-ups', count: leads.filter(l => Boolean((l.activities_count && l.activities_count > 0) || l.status === 'contacted' || l.status === 'qualified' || l.status === 'proposal')).length },
    { id: 'no_followup', label: 'Leads Without Follow-up', count: leads.filter(l => !l.next_followup_date && l.status !== 'won' && l.status !== 'lost').length, badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
    { id: 'won', label: 'Converted Leads', count: leads.filter(l => l.status === 'won').length, badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50' },
    { id: 'lost', label: 'Lost Leads', count: leads.filter(l => l.status === 'lost').length }
  ];

  // Lead Sources defined by HK Sir
  const sourceOptions = [
    'All Sources',
    'BNI Connect',
    'KVV Leads',
    'EAF Connect',
    'SEO / Website',
    'Manually Added',
    'Custom'
  ];

  // Filtered Leads
  const filteredLeads = leads.filter(lead => {
    // 1. View Filter
    if (activeView === 'new' && lead.status !== 'new') return false;
    if (activeView === 'won' && lead.status !== 'won') return false;
    if (activeView === 'lost' && lead.status !== 'lost') return false;
    if (activeView === 'no_followup' && (lead.next_followup_date || lead.status === 'won' || lead.status === 'lost')) return false;
    if (activeView === 'today') {
      if (!lead.next_followup_date || lead.status === 'won' || lead.status === 'lost') return false;
      const isToday = new Date(lead.next_followup_date).toDateString() === new Date().toDateString();
      if (!isToday && lead.calculated_followup_status !== 'today') return false;
    }
    if (activeView === 'overdue') {
      if (!lead.next_followup_date || lead.status === 'won' || lead.status === 'lost') return false;
      const isOverdue = new Date(lead.next_followup_date) < new Date();
      if (!isOverdue && lead.calculated_followup_status !== 'overdue') return false;
    }
    if (activeView === 'pending') {
      if (!lead.next_followup_date || lead.status === 'won' || lead.status === 'lost') return false;
      const isPending = new Date(lead.next_followup_date) >= new Date();
      if (!isPending && lead.calculated_followup_status !== 'pending') return false;
    }

    // 2. Source Filter
    if (sourceFilter !== 'all' && sourceFilter !== 'All Sources') {
      const srcNorm = (lead.source || '').toLowerCase();
      const filterNorm = sourceFilter.toLowerCase();
      if (!srcNorm.includes(filterNorm) && !filterNorm.includes(srcNorm)) return false;
    }

    // 3. Priority Filter
    if (priorityFilter !== 'all' && lead.priority !== priorityFilter) return false;

    // 4. Assigned Filter
    if (assignedFilter !== 'all' && lead.assigned_to !== Number(assignedFilter)) return false;

    // 5. Search Text Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = lead.name.toLowerCase().includes(q);
      const matchCompany = (lead.company || '').toLowerCase().includes(q);
      const matchEmail = (lead.email || '').toLowerCase().includes(q);
      const matchPhone = (lead.phone || '').toLowerCase().includes(q);
      const matchService = (lead.service_requirement || '').toLowerCase().includes(q);
      const matchSource = (lead.source || '').toLowerCase().includes(q);
      if (!matchName && !matchCompany && !matchEmail && !matchPhone && !matchService && !matchSource) {
        return false;
      }
    }

    return true;
  });

  const pipelineStages: { id: Lead['status']; label: string; headerColor: string }[] = [
    { id: 'new', label: 'New Inquiries', headerColor: 'text-[#D62839]' },
    { id: 'contacted', label: 'Contacted', headerColor: 'text-[#D97706]' },
    { id: 'qualified', label: 'Qualified', headerColor: 'text-[#B91C2C]' },
    { id: 'proposal', label: 'Proposal Sent', headerColor: 'text-[#D62839]' },
    { id: 'won', label: 'Won / Closed', headerColor: 'text-[#059669]' },
    { id: 'lost', label: 'Lost / Closed', headerColor: 'text-[#64748B]' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Cockpit3DLoader 
          variant="module"
          size="lg"
          text="Loading Customer Relationship Intelligence..."
          subtitle="Compiling customer records, sales pipeline, and touchpoint timelines"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Section Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[#D62839] dark:text-rose-400 text-xs font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-[#D62839] animate-pulse" />
            <span>HK Sir's Centralized Lead Intelligence Hub</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Centralized Lead Management & Follow-ups
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Unified intake for BNI, KVV, EAF Connect, SEO Website forms and manual sales touchpoints
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white dark:bg-[#0D111A] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-[#D62839] border border-slate-200/90 dark:border-white/[0.08] hover:border-rose-200 dark:border-rose-900/60 transition-all shadow-2xs cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#0D111A] text-slate-900 dark:text-white hover:text-[#D62839] border border-slate-200/90 dark:border-white/[0.08] hover:border-rose-200 dark:border-rose-900/60 text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#D62839]" />
            <span>Import Leads (CSV)</span>
          </button>

          <button
            onClick={() => {
              resetLeadForm();
              setIsLeadModalOpen(true);
            }}
            className="cockpit-btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Lead</span>
          </button>
        </div>
      </div>

      {/* Primary Module Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200/90 dark:border-white/[0.08] pb-1 gap-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'leads'
                ? 'bg-[#D62839] text-white shadow-xs'
                : 'bg-white dark:bg-[#0D111A] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Unified Leads Hub ({leads.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'sources'
                ? 'bg-[#D62839] text-white shadow-xs'
                : 'bg-white dark:bg-[#0D111A] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Lead Sources & Integrations ({leadSources.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-[#D62839] text-white shadow-xs'
                : 'bg-white dark:bg-[#0D111A] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Customers Directory ({customers.length})</span>
          </button>
        </div>

        {activeTab === 'leads' && (
          <div className="hidden sm:flex items-center bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => setDisplayMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                displayMode === 'cards' ? 'bg-rose-50 dark:bg-rose-950/50 text-[#D62839] dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              List Cards
            </button>
            <button
              onClick={() => setDisplayMode('pipeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                displayMode === 'pipeline' ? 'bg-rose-50 dark:bg-rose-950/50 text-[#D62839] dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Pipeline Kanban
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: UNIFIED LEADS HUB (WITH THE 9 MANDATORY VIEWS) */}
      {/* ============================================================== */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          {/* HK Sir's 9 Operational Views Horizontal Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium no-scrollbar">
            {viewTabs.map((tab) => {
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all duration-180 flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-rose-50 dark:bg-rose-950/50 text-[#D62839] dark:text-rose-400 border-rose-200 dark:border-rose-900/60 font-bold shadow-2xs'
                      : 'bg-white dark:bg-[#0D111A] text-slate-500 dark:text-slate-400 border-slate-200/90 dark:border-white/[0.08] hover:border-rose-200 dark:border-rose-900/60 hover:text-slate-900 dark:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                    tab.badgeColor || (isActive ? 'bg-[#D62839] text-white border-[#D62839]' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-slate-200/90 dark:border-white/[0.08]')
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Source Filter Controls */}
          <div className="p-4 bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search leads by name, company, phone, email, service..."
                  className="cockpit-input pl-9 pr-3 py-2 text-xs w-full"
                />
              </div>

              {/* Source Dropdown */}
              <div className="sm:w-44">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="cockpit-input py-2 text-xs w-full cursor-pointer bg-white dark:bg-[#0D111A]"
                >
                  {sourceOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Priority Dropdown */}
              <div className="sm:w-36">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="cockpit-input py-2 text-xs w-full cursor-pointer bg-white dark:bg-[#0D111A]"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 dark:text-slate-400 font-semibold">
              <span>Showing {filteredLeads.length} of {leads.length} leads</span>
              {(sourceFilter !== 'all' || activeView !== 'all' || priorityFilter !== 'all' || search) && (
                <button
                  onClick={() => {
                    setActiveView('all');
                    setSourceFilter('all');
                    setPriorityFilter('all');
                    setSearch('');
                  }}
                  className="text-[#D62839] hover:underline cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* A. CARDS VIEW (MOBILE-FIRST & FRIENDLY) */}
          {displayMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLeads.map((lead) => {
                const isWon = lead.status === 'won';
                const isLost = lead.status === 'lost';
                const isOverdue = lead.next_followup_date && new Date(lead.next_followup_date) < new Date() && !isWon && !isLost;
                const isToday = lead.next_followup_date && new Date(lead.next_followup_date).toDateString() === new Date().toDateString() && !isWon && !isLost;
                const hasNoFollowup = !lead.next_followup_date && !isWon && !isLost;

                return (
                  <div
                    key={lead.id}
                    className={`rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md ${
                      isOverdue 
                        ? 'bg-[#FEF2F2]/60 border-rose-200 dark:border-rose-900/60' 
                        : isToday 
                          ? 'bg-[#FFFBEB]/60 border-[#FDE68A]' 
                          : hasNoFollowup 
                            ? 'bg-[#F8FAFC] border-[#E2E8F0]' 
                            : 'bg-white dark:bg-[#0D111A] border-slate-200/90 dark:border-white/[0.08] hover:border-rose-200 dark:border-rose-900/60'
                    }`}
                  >
                    <div>
                      {/* Top Bar: Source Badge & Priority */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                          <Globe className="w-3 h-3" />
                          <span>{lead.source || 'General'}</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          {lead.priority === 'urgent' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DC2626] text-white">URGENT</span>
                          )}
                          {lead.priority === 'high' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-rose-200 dark:border-rose-900/60">HIGH</span>
                          )}
                          <span className="text-[11px] font-mono text-[#94A3B8]">#{lead.id}</span>
                        </div>
                      </div>

                      {/* Lead Contact Info */}
                      <div className="cursor-pointer" onClick={() => handleOpenDetail(lead)}>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight hover:text-[#D62839] transition-colors">
                          {lead.name}
                        </h3>
                        {lead.company && (
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-[#D62839]" />
                            <span>{lead.company}</span>
                          </p>
                        )}
                        {lead.service_requirement && (
                          <div className="mt-2.5 p-2 rounded-xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] text-xs text-slate-900 dark:text-white">
                            <span className="font-bold text-[#D62839]">Requirement: </span>
                            <span>{lead.service_requirement}</span>
                          </div>
                        )}
                      </div>

                      {/* Follow-up Status Strip */}
                      <div className="mt-3.5 pt-3 border-t border-slate-200/90 dark:border-white/[0.08] space-y-1.5 text-xs">
                        {isOverdue && (
                          <div className="flex items-center gap-1.5 text-[#DC2626] font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Follow-up Overdue: {new Date(lead.next_followup_date!).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(lead.next_followup_date!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                        {isToday && (
                          <div className="flex items-center gap-1.5 text-[#D97706] font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Follow-up Scheduled Today at {new Date(lead.next_followup_date!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                        {!isOverdue && !isToday && lead.next_followup_date && !isWon && !isLost && (
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-[#D62839]" />
                            <span>Next: {new Date(lead.next_followup_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                          </div>
                        )}
                        {hasNoFollowup && (
                          <div className="flex items-center gap-1.5 text-[#64748B] font-semibold">
                            <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                            <span>⚠️ No follow-up scheduled yet</span>
                          </div>
                        )}
                        {isWon && (
                          <div className="flex items-center gap-1.5 text-[#059669] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Lead Converted Successfully</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-4 pt-3.5 border-t border-slate-200/90 dark:border-white/[0.08] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="p-2 rounded-xl bg-white dark:bg-[#0D111A] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-[#D62839] border border-slate-200/90 dark:border-white/[0.08] hover:border-rose-200 dark:border-rose-900/60 transition-all cursor-pointer shadow-2xs"
                            title={`Call ${lead.name} (${lead.phone})`}
                          >
                            <PhoneCall className="w-3.5 h-3.5 text-[#059669]" />
                          </a>
                        )}
                        {lead.phone && (
                          <a
                            href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${lead.name}, connecting with you from My Cockpit regarding your requirement for ${lead.service_requirement || 'our solutions'}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-white dark:bg-[#0D111A] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-[#D62839] border border-slate-200/90 dark:border-white/[0.08] hover:border-rose-200 dark:border-rose-900/60 transition-all cursor-pointer shadow-2xs"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                          </a>
                        )}
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}?subject=${encodeURIComponent(`Inquiry Follow-up: ${lead.service_requirement || 'My Cockpit'}`)}`}
                            className="p-2 rounded-xl bg-white dark:bg-[#0D111A] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-[#D62839] border border-slate-200/90 dark:border-white/[0.08] hover:border-rose-200 dark:border-rose-900/60 transition-all cursor-pointer shadow-2xs"
                            title={`Email ${lead.email}`}
                          >
                            <Mail className="w-3.5 h-3.5 text-[#3B82F6]" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenActivityModal(lead)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-[#D62839] text-[#D62839] dark:text-rose-400 hover:text-white border border-rose-200 dark:border-rose-900/60 text-[11px] font-bold transition-all cursor-pointer"
                        >
                          Log Activity
                        </button>
                        <button
                          onClick={() => handleOpenDetail(lead)}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-[#D62839] hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                          title="View Full Details"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredLeads.length === 0 && (
                <div className="col-span-full py-16 text-center bg-white dark:bg-[#0D111A] rounded-2xl border border-dashed border-slate-200/90 dark:border-white/[0.08] p-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 flex items-center justify-center mx-auto">
                    <Filter className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">No leads match your current filter view</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Try switching tabs above, clearing search terms, or add a new lead from BNI, KVV, EAF, or manual entry.
                  </p>
                  <button
                    onClick={() => {
                      setActiveView('all');
                      setSourceFilter('all');
                      setSearch('');
                    }}
                    className="cockpit-btn-primary inline-flex"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}
            </div>
          )}

          {/* B. PIPELINE KANBAN VIEW */}
          {displayMode === 'pipeline' && (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3.5 overflow-x-auto pb-4">
              {pipelineStages.map((stage) => {
                const stageLeads = filteredLeads.filter(l => l.status === stage.id);
                const stageTotal = stageLeads.reduce((sum, l) => sum + Number(l.value), 0);

                return (
                  <div key={stage.id} className="min-w-[240px] bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-3.5 flex flex-col shadow-xs">
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/90 dark:border-white/[0.08]">
                      <div>
                        <h4 className={`text-xs font-bold uppercase tracking-wider ${stage.headerColor}`}>{stage.label}</h4>
                        <p className="text-[11px] font-mono text-slate-900 dark:text-white font-bold mt-0.5">{formatCurrency(stageTotal)}</p>
                      </div>
                      <span className="w-5 h-5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[10px] font-bold text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center">
                        {stageLeads.length}
                      </span>
                    </div>

                    <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[65vh]">
                      {stageLeads.map((lead) => (
                        <div 
                          key={lead.id} 
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/90 dark:border-white/[0.08] hover:border-rose-200 dark:border-rose-900/60 hover:shadow-xs transition-all cursor-pointer"
                          onClick={() => handleOpenDetail(lead)}
                        >
                          <div className="flex items-center justify-between text-[10px] font-semibold text-[#D62839] mb-1">
                            <span>{lead.source}</span>
                            <span className="font-mono text-[#94A3B8]">#{lead.id}</span>
                          </div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">{lead.name}</h5>
                          {lead.company && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{lead.company}</p>}
                          
                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-200/90 dark:border-white/[0.08] text-[11px]">
                            <span className="font-mono font-bold text-[#059669]">{formatCurrency(Number(lead.value))}</span>
                            <select
                              value={lead.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleLeadStatusChange(lead.id, e.target.value)}
                              className="bg-white dark:bg-[#0D111A] text-[10px] text-slate-900 dark:text-white border border-slate-200/90 dark:border-white/[0.08] rounded-md px-1.5 py-0.5 focus:outline-none focus:border-[#D62839] cursor-pointer"
                            >
                              <option value="new">New</option>
                              <option value="contacted">Contacted</option>
                              <option value="qualified">Qualified</option>
                              <option value="proposal">Proposal</option>
                              <option value="won">Won</option>
                              <option value="lost">Lost</option>
                            </select>
                          </div>
                        </div>
                      ))}
                      {stageLeads.length === 0 && (
                        <div className="text-center py-6 text-[10px] text-[#94A3B8] border border-dashed border-slate-200/90 dark:border-white/[0.08] rounded-xl bg-slate-50 dark:bg-slate-900/40">
                          No leads in this stage
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: LEAD SOURCES & INTEGRATIONS HUB */}
      {/* ============================================================== */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              External Lead Sources & Integration Architecture
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              In accordance with enterprise CRM security guidelines, each lead channel provides authorized integration methods: direct webhook intake, batch CSV importer with duplicate detection, and instant launchpads.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leadSources.map((src) => {
              const isConnected = src.status === 'connected';
              const isCsv = src.status === 'csv_import_available';

              return (
                <div key={src.id} className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-rose-200 dark:border-rose-900/60 transition-all flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 flex items-center justify-center font-bold">
                        <Globe className="w-5 h-5" />
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                        isConnected 
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50' 
                          : 'bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                      }`}>
                        {isConnected ? 'Connected & Active' : 'CSV Import Ready'}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white">{src.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Category: {src.category}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/90 dark:border-white/[0.08] space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Total Leads Captured:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{src.total_leads_count || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Converted to Won:</span>
                        <span className="font-mono font-bold text-[#059669]">{src.converted_leads_count || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Sync Count:</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">{src.sync_count || 0} batches</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/90 dark:border-white/[0.08] space-y-2">
                    {src.source_key === 'website_seo' ? (
                      <button
                        onClick={() => handleCopyWebhookUrl(src.webhook_secret || '')}
                        className="w-full py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 hover:bg-[#D62839] hover:text-white border border-rose-200 dark:border-rose-900/60 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedToken ? 'Webhook URL Copied!' : 'Copy Form Webhook URL'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setImportSourceKey(src.source_key);
                          setIsImportModalOpen(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 hover:bg-[#D62839] hover:text-white border border-rose-200 dark:border-rose-900/60 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Import {src.name} Leads</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: CUSTOMERS DIRECTORY */}
      {/* ============================================================== */}
      {activeTab === 'customers' && (
        <div className="rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200/90 dark:border-white/[0.08] flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Client Organization Directory</h3>
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="cockpit-btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Customer</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/90 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-bold">
                  <th className="py-3 px-4">Customer / Organization</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">City / Region</th>
                  <th className="py-3 px-4">Invoiced Total</th>
                  <th className="py-3 px-4">Outstanding Balance</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9EAEE]">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-rose-50 dark:hover:bg-rose-950/40/20 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{c.name}</div>
                      {c.company && <div className="text-slate-500 dark:text-slate-400 text-[11px]">{c.company}</div>}
                    </td>
                    <td className="py-3.5 px-4 space-y-0.5">
                      {c.phone && <div className="font-mono text-slate-900 dark:text-white">{c.phone}</div>}
                      {c.email && <div className="text-slate-500 dark:text-slate-400">{c.email}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">{c.city || 'India'}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(Number(c.total_invoiced || 0))}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#DC2626]">
                      {formatCurrency(Number(c.outstanding_balance || 0))}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: ADD NEW LEAD (WITH ALL HK SIR REQUIREMENTS) */}
      {/* ============================================================== */}
      <Modal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        title="Add New Business Lead"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          {duplicateWarning && (
            <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-rose-200 dark:border-rose-900/60 text-[#DC2626] text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>Duplicate Lead Detection Alert</span>
              </div>
              <p>{duplicateWarning}</p>
              <label className="flex items-center gap-2 pt-1 font-semibold text-slate-900 dark:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceDuplicate}
                  onChange={(e) => setForceDuplicate(e.target.checked)}
                  className="rounded text-[#D62839] focus:ring-[#D62839]"
                />
                <span>Allow duplicate anyway and save this lead</span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Full Name / Contact Person *
              </label>
              <input
                type="text"
                required
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="e.g. Rajesh Mehta"
                className="cockpit-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Company / Organization
              </label>
              <input
                type="text"
                value={leadCompany}
                onChange={(e) => setLeadCompany(e.target.value)}
                placeholder="e.g. Mehta Exports Pvt Ltd"
                className="cockpit-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
                placeholder="+91 9825012345"
                className="cockpit-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="name@company.com"
                className="cockpit-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Lead Source *
              </label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="cockpit-input w-full text-xs bg-white dark:bg-[#0D111A] cursor-pointer"
              >
                <option value="BNI Connect">BNI Connect</option>
                <option value="KVV Leads">KVV Leads</option>
                <option value="EAF Connect">EAF Connect</option>
                <option value="SEO / Website">SEO / Website</option>
                <option value="Manually Added">Manually Added</option>
                <option value="Direct Referral">Direct Referral</option>
                <option value="Custom Source">Custom Source</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Estimated Value (₹)
              </label>
              <input
                type="number"
                value={leadValue}
                onChange={(e) => setLeadValue(Number(e.target.value))}
                className="cockpit-input w-full text-xs font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Service / Requirement Details *
              </label>
              <input
                type="text"
                value={leadService}
                onChange={(e) => setLeadService(e.target.value)}
                placeholder="e.g. Cloud ERP, Logistics Tracker, E-commerce Portal..."
                className="cockpit-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Assigned Employee / Team Member
              </label>
              <select
                value={leadAssignedTo}
                onChange={(e) => setLeadAssignedTo(e.target.value)}
                className="cockpit-input w-full text-xs bg-white dark:bg-[#0D111A] cursor-pointer"
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.designation})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Priority
              </label>
              <select
                value={leadPriority}
                onChange={(e) => setLeadPriority(e.target.value as any)}
                className="cockpit-input w-full text-xs bg-white dark:bg-[#0D111A] cursor-pointer"
              >
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Initial Follow-up Date & Time
              </label>
              <input
                type="datetime-local"
                value={leadNextFollowup}
                onChange={(e) => setLeadNextFollowup(e.target.value)}
                className="cockpit-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Follow-up Contact Method
              </label>
              <select
                value={leadContactMethod}
                onChange={(e) => setLeadContactMethod(e.target.value as any)}
                className="cockpit-input w-full text-xs bg-white dark:bg-[#0D111A] cursor-pointer"
              >
                <option value="call">Phone Call</option>
                <option value="whatsapp">WhatsApp Message</option>
                <option value="email">Email</option>
                <option value="meeting">In-Person / Video Meeting</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Notes & Background Information
              </label>
              <textarea
                value={leadNotes}
                onChange={(e) => setLeadNotes(e.target.value)}
                rows={3}
                placeholder="Add meeting notes, referral context, specific customer expectations..."
                className="cockpit-input w-full text-xs"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/90 dark:border-white/[0.08] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsLeadModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-900/50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              <span>Save Lead Record</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 2: BATCH CSV LEAD IMPORTER */}
      {/* ============================================================== */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Batch Lead Importer (CSV / Excel Format)"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Import business leads from <strong>BNI Connect</strong>, <strong>KVV</strong>, <strong>EAF Connect</strong>, or Website exports. Duplicate detection prevents accidental double-entries.
          </p>

          {importStatusMsg && (
            <div className={`p-3.5 rounded-xl text-xs font-semibold ${
              importStatusMsg.type === 'success' 
                ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]' 
                : 'bg-[#FEF2F2] text-[#DC2626] border border-rose-200 dark:border-rose-900/60'
            }`}>
              {importStatusMsg.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Lead Source Origin *
              </label>
              <select
                value={importSourceKey}
                onChange={(e) => setImportSourceKey(e.target.value)}
                className="cockpit-input w-full text-xs bg-white dark:bg-[#0D111A] cursor-pointer"
              >
                <option value="bni">BNI Connect Export</option>
                <option value="kvv">KVV Leads Portal</option>
                <option value="eaf">EAF Connect Leads</option>
                <option value="website_seo">SEO / Website Leads</option>
                <option value="custom">Custom Lead Spreadsheet</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Duplicate Handling Strategy
              </label>
              <select
                value={importDuplicateStrategy}
                onChange={(e) => setImportDuplicateStrategy(e.target.value as any)}
                className="cockpit-input w-full text-xs bg-white dark:bg-[#0D111A] cursor-pointer"
              >
                <option value="skip">Skip duplicates (Safe & Recommended)</option>
                <option value="update">Update existing matching records</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-900 dark:text-white">
                Paste CSV Data with Headers
              </label>
              <button
                type="button"
                onClick={() => {
                  setImportCsvText(
                    `name,company,email,phone,value,service_requirement,priority,notes\n` +
                    `Ananya Roy,HealthFirst Diagnostics,ananya@healthfirst.com,+91 9724034567,420000,Patient Portal,high,Discussion at regional forum\n` +
                    `Kunal Shah,Shah Tech Ventures,kunal@shahtech.com,+91 9825123456,350000,AI Agent Integration,urgent,Initial discussion scheduled`
                  );
                }}
                className="text-[11px] text-[#D62839] font-bold hover:underline cursor-pointer"
              >
                Load Sample Template
              </button>
            </div>
            <textarea
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              rows={8}
              placeholder="name,company,email,phone,value,service_requirement,priority,notes..."
              className="cockpit-input w-full font-mono text-[11px]"
            />
          </div>

          <div className="pt-3 border-t border-slate-200/90 dark:border-white/[0.08] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-900/50 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleImportCsv}
              className="cockpit-btn-primary"
            >
              <Upload className="w-4 h-4" />
              <span>Process & Import Leads</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 3: LOG ACTIVITY & SCHEDULE NEXT FOLLOW-UP */}
      {/* ============================================================== */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title={`Log Follow-up Activity for ${selectedLead?.name || 'Lead'}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleLogActivity} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Touchpoint Type *
              </label>
              <select
                value={actType}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setActType(val);
                  setActTitle(`${val.charAt(0).toUpperCase() + val.slice(1)} with ${selectedLead?.name || 'Lead'}`);
                }}
                className="cockpit-input w-full text-xs bg-white dark:bg-[#0D111A] cursor-pointer"
              >
                <option value="call">Phone Call</option>
                <option value="whatsapp">WhatsApp Message</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting (Online/Offline)</option>
                <option value="note">Internal Note</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Activity Title *
              </label>
              <input
                type="text"
                required
                value={actTitle}
                onChange={(e) => setActTitle(e.target.value)}
                className="cockpit-input w-full text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Outcome / Result of this Interaction *
              </label>
              <input
                type="text"
                required
                value={actOutcome}
                onChange={(e) => setActOutcome(e.target.value)}
                placeholder="e.g. Discussed proposal, requested revised quotation by Friday"
                className="cockpit-input w-full text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Detailed Discussion Notes
              </label>
              <textarea
                value={actDescription}
                onChange={(e) => setActDescription(e.target.value)}
                rows={3}
                placeholder="Key objections, attendees, pricing agreements..."
                className="cockpit-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Next Follow-up Date & Time
              </label>
              <input
                type="datetime-local"
                value={actNextDate}
                onChange={(e) => setActNextDate(e.target.value)}
                className="cockpit-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                Next Contact Method
              </label>
              <select
                value={actNextMethod}
                onChange={(e) => setActNextMethod(e.target.value as any)}
                className="cockpit-input w-full text-xs bg-white dark:bg-[#0D111A] cursor-pointer"
              >
                <option value="call">Phone Call</option>
                <option value="whatsapp">WhatsApp Message</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/90 dark:border-white/[0.08] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsActivityModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-900/50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              <span>Record Touchpoint & Update Lead</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* DRAWER: DETAILED LEAD TIMELINE & AUDIT HISTORY */}
      {/* ============================================================== */}
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
              <span className="text-xs text-slate-500 font-mono">Deal Est: {formatCurrency(Number(selectedLead.value))}</span>
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
            {/* Header Snapshot */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/90 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{selectedLead.name}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                    {selectedLead.source}
                  </span>
                </div>
                {selectedLead.company && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{selectedLead.company}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedLead.phone && (
                  <a
                    href={`tel:${selectedLead.phone}`}
                    className="p-2 rounded-xl bg-white dark:bg-[#0D111A] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#059669] border border-slate-200/90 dark:border-white/[0.08] transition-all cursor-pointer shadow-2xs"
                    title="Call Contact"
                  >
                    <PhoneCall className="w-4 h-4" />
                  </a>
                )}
                {selectedLead.phone && (
                  <a
                    href={createWhatsAppUrl(selectedLead.phone, `Hello ${selectedLead.name}, connecting from My Cockpit regarding your project.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-white dark:bg-[#0D111A] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#25D366] border border-slate-200/90 dark:border-white/[0.08] transition-all cursor-pointer shadow-2xs"
                    title="Chat on WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>
                )}
                {selectedLead.email && (
                  <a
                    href={`mailto:${selectedLead.email}`}
                    className="p-2 rounded-xl bg-white dark:bg-[#0D111A] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#3B82F6] border border-slate-200/90 dark:border-white/[0.08] transition-all cursor-pointer shadow-2xs"
                    title="Send Email"
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Core Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0D111A]">
                <span className="text-slate-500 dark:text-slate-400">Value Estimate:</span>
                <p className="font-mono font-bold text-[#059669] text-sm mt-0.5">{formatCurrency(Number(selectedLead.value))}</p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0D111A]">
                <span className="text-slate-500 dark:text-slate-400">Pipeline Status:</span>
                <p className="font-bold text-slate-900 dark:text-white uppercase text-xs mt-0.5">{selectedLead.status}</p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0D111A]">
                <span className="text-slate-500 dark:text-slate-400">Assigned Person:</span>
                <p className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{selectedLead.assigned_user_name || 'Unassigned'}</p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0D111A] sm:col-span-3">
                <span className="text-slate-500 dark:text-slate-400">Requirement Details:</span>
                <p className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{selectedLead.service_requirement || 'General Requirement'}</p>
              </div>
            </div>

            {/* Follow-up Timeline & Activities Log */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Activity & Follow-up History</h4>
                <button
                  onClick={() => handleOpenActivityModal(selectedLead)}
                  className="px-3 py-1 rounded-lg bg-[#D62839] text-white text-xs font-bold hover:bg-[#B91C2C] transition-all cursor-pointer shadow-xs"
                >
                  + Add Touchpoint
                </button>
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {(selectedLead.activities || []).map((act: LeadActivity) => (
                  <div key={act.id} className="p-3 rounded-xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 text-[10px] uppercase font-mono font-bold">
                          {act.activity_type}
                        </span>
                        <span>{act.title}</span>
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {new Date(act.activity_date).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(act.activity_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed pl-2 border-l-2 border-rose-200 dark:border-rose-900/60 whitespace-pre-line">
                        {act.description}
                      </p>
                    )}
                  </div>
                ))}

                {(!selectedLead.activities || selectedLead.activities.length === 0) && (
                  <div className="text-center py-6 text-xs text-[#94A3B8] border border-dashed border-slate-200/90 dark:border-white/[0.08] rounded-xl">
                    No touchpoints logged yet. Click "+ Add Touchpoint" above to record a call or WhatsApp discussion.
                  </div>
                )}
              </div>
            </div>
          </div>
        </SlideOverDrawer>
      )}

      {/* MODAL 5: ADD NEW CUSTOMER */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Add New Customer Organization"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">Organization / Client Name *</label>
            <input
              type="text"
              required
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              placeholder="e.g. Acme Tech Solutions"
              className="cockpit-input w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">Brand Name / Group</label>
            <input
              type="text"
              value={custCompany}
              onChange={(e) => setCustCompany(e.target.value)}
              placeholder="e.g. Acme Global Group"
              className="cockpit-input w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">Email</label>
            <input
              type="email"
              value={custEmail}
              onChange={(e) => setCustEmail(e.target.value)}
              placeholder="billing@acme.com"
              className="cockpit-input w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">Phone</label>
            <input
              type="text"
              value={custPhone}
              onChange={(e) => setCustPhone(e.target.value)}
              placeholder="+91 9820011223"
              className="cockpit-input w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">City</label>
            <input
              type="text"
              value={custCity}
              onChange={(e) => setCustCity(e.target.value)}
              placeholder="e.g. Ahmedabad, Mumbai"
              className="cockpit-input w-full text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-200/90 dark:border-white/[0.08] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-900/50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              <span>Save Customer</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
