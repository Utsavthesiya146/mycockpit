import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, 
  Plus, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare, 
  Mail, 
  Calendar, 
  Building2, 
  Filter, 
  RefreshCw, 
  ChevronRight,
  Check,
  Search
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import type { Followup, Customer, Lead, Employee } from '../types';

export const Followups: React.FC = () => {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'overdue' | 'pending' | 'completed'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [activeFollowup, setActiveFollowup] = useState<Followup | null>(null);

  // Form State for New Follow-up
  const [targetType, setTargetType] = useState<'lead' | 'customer'>('lead');
  const [selectedLeadId, setSelectedLeadId] = useState<number | ''>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [contactMethod, setContactMethod] = useState<'call' | 'email' | 'meeting' | 'whatsapp' | 'other'>('call');
  const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Form State for Completing Follow-up
  const [outcome, setOutcome] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState('');
  const [nextTitle, setNextTitle] = useState('');
  const [nextMethod, setNextMethod] = useState<'call' | 'email' | 'meeting' | 'whatsapp'>('call');

  const fetchData = async () => {
    try {
      const [fData, cData, lData, eData]: any = await Promise.all([
        api.get('/followups'),
        api.get('/crm/customers'),
        api.get('/crm/leads'),
        api.get('/hrm/employees')
      ]);
      setFollowups(fData || []);
      setCustomers(cData || []);
      setLeads(lData || []);
      setEmployees(eData || []);

      if (lData && lData.length > 0 && !selectedLeadId) {
        setSelectedLeadId(lData[0].id);
      }
    } catch (err) {
      console.error('Failed to load follow-ups', err);
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

  const handleCreateFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/followups', {
        title,
        customer_id: targetType === 'customer' ? (selectedCustomerId || null) : null,
        lead_id: targetType === 'lead' ? (selectedLeadId || null) : null,
        scheduled_at: scheduledAt,
        contact_method: contactMethod,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        notes
      });
      setIsCreateModalOpen(false);
      setTitle('');
      setNotes('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating follow-up');
    }
  };

  const handleOpenCompleteModal = (f: Followup) => {
    setActiveFollowup(f);
    setOutcome('');
    setCompleteNotes('');
    setScheduleNext(false);
    setNextDate('');
    setNextTitle(`Next step following ${f.title}`);
    setNextMethod('call');
    setIsCompleteModalOpen(true);
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFollowup) return;

    try {
      await api.post(`/followups/${activeFollowup.id}/complete`, {
        outcome: outcome || 'Follow-up interaction completed successfully.',
        notes: completeNotes,
        next_scheduled_at: scheduleNext && nextDate ? nextDate : null,
        next_title: nextTitle,
        next_method: nextMethod
      });
      setIsCompleteModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error completing follow-up');
    }
  };

  const handleToggle = async (f: Followup) => {
    const nextStatus = f.status === 'completed' ? 'pending' : 'completed';
    try {
      await api.post(`/followups/${f.id}/toggle`, { status: nextStatus });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    }
  };

  // Filtered Follow-ups
  const filtered = followups.filter((f) => {
    const isDone = f.status === 'completed';
    const isOverdue = f.calculated_status === 'overdue' && !isDone;
    const isToday = (f.calculated_status === 'today' || new Date(f.scheduled_at).toDateString() === new Date().toDateString()) && !isDone;
    const isPending = !isDone && !isOverdue && !isToday;

    // Status Filter
    if (statusFilter === 'completed' && !isDone) return false;
    if (statusFilter === 'overdue' && !isOverdue) return false;
    if (statusFilter === 'today' && !isToday) return false;
    if (statusFilter === 'pending' && !isPending && !isToday) return false;

    // Method Filter
    if (methodFilter !== 'all' && f.contact_method !== methodFilter) return false;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = f.title.toLowerCase().includes(q);
      const matchNotes = (f.notes || '').toLowerCase().includes(q);
      const matchLead = (f.lead_name || '').toLowerCase().includes(q);
      const matchCust = (f.customer_name || '').toLowerCase().includes(q);
      const matchComp = (f.lead_company || '').toLowerCase().includes(q);
      if (!matchTitle && !matchNotes && !matchLead && !matchCust && !matchComp) return false;
    }

    return true;
  });

  const getMethodIcon = (method?: string) => {
    switch (method) {
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4 text-[#25D366]" />;
      case 'email':
        return <Mail className="w-4 h-4 text-[#3B82F6]" />;
      case 'meeting':
        return <Calendar className="w-4 h-4 text-[#8B5CF6]" />;
      default:
        return <PhoneCall className="w-4 h-4 text-[#059669]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#FFF1F2] border border-[#FECDD3] text-[#D62839] text-xs font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-[#D62839] animate-pulse" />
            <span>High Priority Lead & Account Touchpoints</span>
          </div>
          <h2 className="text-2xl font-extrabold text-[#20242C] tracking-tight">
            Follow-up Reminders & Interaction Tracker
          </h2>
          <p className="text-sm text-[#667085] mt-0.5">
            Never let a lead silently slip away. Track calls, WhatsApp conversations, meetings, and automated reminder alerts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white hover:bg-[#FFF1F2] text-[#667085] hover:text-[#D62839] border border-[#E9EAEE] hover:border-[#FECDD3] transition-all shadow-2xs cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="cockpit-btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Follow-up</span>
          </button>
        </div>
      </div>

      {/* Filter Horizontal Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-[#E9EAEE] shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium no-scrollbar">
          {[
            { id: 'all', label: 'All Follow-ups', count: followups.length },
            { id: 'today', label: 'Today\'s Scheduled', count: followups.filter(f => f.status === 'pending' && (f.calculated_status === 'today' || new Date(f.scheduled_at).toDateString() === new Date().toDateString())).length, badgeColor: 'bg-[#FEF3C7] text-[#D97706]' },
            { id: 'overdue', label: 'Overdue Alerts', count: followups.filter(f => f.status === 'pending' && (f.calculated_status === 'overdue' || new Date(f.scheduled_at) < new Date())).length, badgeColor: 'bg-[#FEF2F2] text-[#DC2626]' },
            { id: 'pending', label: 'Upcoming Future', count: followups.filter(f => f.status === 'pending' && new Date(f.scheduled_at) > new Date()).length },
            { id: 'completed', label: 'Completed Touchpoints', count: followups.filter(f => f.status === 'completed').length, badgeColor: 'bg-[#ECFDF5] text-[#059669]' },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all duration-180 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#FFF1F2] text-[#D62839] border-[#FECDD3] font-bold shadow-2xs'
                    : 'bg-white text-[#667085] border-[#E9EAEE] hover:border-[#FECDD3] hover:text-[#20242C]'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                  tab.badgeColor || (isActive ? 'bg-[#D62839] text-white border-[#D62839]' : 'bg-[#F8F9FB] text-[#667085] border-[#E9EAEE]')
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search follow-ups..."
              className="cockpit-input pl-9 pr-3 py-1.5 text-xs w-full"
            />
          </div>

          <div className="w-36">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="cockpit-input py-1.5 text-xs w-full cursor-pointer bg-white"
            >
              <option value="all">All Methods</option>
              <option value="call">Phone Calls</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Emails</option>
              <option value="meeting">Meetings</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Follow-up Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((f) => {
          const isDone = f.status === 'completed';
          const isOverdue = f.calculated_status === 'overdue' && !isDone;
          const isToday = (f.calculated_status === 'today' || new Date(f.scheduled_at).toDateString() === new Date().toDateString()) && !isDone;
          const contactPhone = f.lead_phone || f.customer_phone;
          const contactEmail = f.lead_email || f.customer_email;
          const contactName = f.lead_name || f.customer_name || 'General Client';
          const companyName = f.lead_company;

          return (
            <div
              key={f.id}
              className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                isDone 
                  ? 'bg-[#F8FAFC]/75 border-[#E9EAEE] opacity-80' 
                  : isOverdue 
                    ? 'bg-[#FEF2F2]/60 border-[#FECDD3] shadow-xs hover:border-[#DC2626]' 
                    : isToday 
                      ? 'bg-[#FFFBEB]/60 border-[#FDE68A] shadow-xs' 
                      : 'bg-white border-[#E9EAEE] shadow-xs hover:border-[#FECDD3]'
              }`}
            >
              <div>
                {/* Top Strip */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2.5 rounded-xl border ${
                      isOverdue 
                        ? 'bg-[#FEF2F2] border-[#FECDD3] text-[#DC2626]' 
                        : isToday 
                          ? 'bg-[#FEF3C7] border-[#FDE68A] text-[#D97706]' 
                          : 'bg-[#FFF1F2] border-[#FECDD3] text-[#D62839]'
                    }`}>
                      {getMethodIcon(f.contact_method)}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#D62839] font-mono">
                        {f.contact_method || 'Call'} Follow-up
                      </span>
                      <h3 className={`text-base font-extrabold tracking-tight ${isDone ? 'line-through text-[#94A3B8]' : 'text-[#20242C]'}`}>
                        {f.title}
                      </h3>
                    </div>
                  </div>

                  <Badge status={f.calculated_status || f.status} />
                </div>

                {/* Contact and context */}
                <div className="p-3 rounded-xl bg-white/80 border border-[#E9EAEE] space-y-1 text-xs mb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#20242C]">{contactName}</span>
                    {f.lead_source && (
                      <span className="text-[10px] font-semibold text-[#D62839] px-2 py-0.5 rounded-md bg-[#FFF1F2]">
                        Source: {f.lead_source}
                      </span>
                    )}
                  </div>
                  {companyName && (
                    <p className="text-[#667085] flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-[#94A3B8]" />
                      <span>{companyName}</span>
                    </p>
                  )}
                  {f.notes && (
                    <p className="text-[#667085] pt-1 leading-relaxed border-t border-[#E9EAEE] mt-1">
                      {f.notes}
                    </p>
                  )}
                </div>

                {/* Timing */}
                <div className="flex items-center justify-between text-xs font-semibold text-[#667085]">
                  <span className="flex items-center gap-1.5">
                    <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-[#DC2626]' : 'text-[#D62839]'}`} />
                    <span>
                      {isOverdue && <strong className="text-[#DC2626]">Overdue: </strong>}
                      {new Date(f.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(f.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>

                  {f.assigned_user_name && (
                    <span className="text-[11px] text-[#94A3B8]">
                      Assigned: {f.assigned_user_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom One-Click Communication Action Strip */}
              <div className="mt-4 pt-3.5 border-t border-[#E9EAEE] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {contactPhone && (
                    <a
                      href={`tel:${contactPhone}`}
                      className="p-2 rounded-xl bg-white hover:bg-[#FFF1F2] text-[#059669] border border-[#E9EAEE] hover:border-[#FECDD3] transition-all cursor-pointer shadow-2xs"
                      title={`Call ${contactPhone}`}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {contactPhone && (
                    <a
                      href={`https://wa.me/${contactPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${contactName}, following up regarding ${f.title}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-white hover:bg-[#FFF1F2] text-[#25D366] border border-[#E9EAEE] hover:border-[#FECDD3] transition-all cursor-pointer shadow-2xs"
                      title="Open WhatsApp Chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {contactEmail && (
                    <a
                      href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Follow-up: ${f.title}`)}`}
                      className="p-2 rounded-xl bg-white hover:bg-[#FFF1F2] text-[#3B82F6] border border-[#E9EAEE] hover:border-[#FECDD3] transition-all cursor-pointer shadow-2xs"
                      title={`Email ${contactEmail}`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isDone ? (
                    <button
                      onClick={() => handleOpenCompleteModal(f)}
                      className="px-3 py-1.5 rounded-xl bg-[#D62839] hover:bg-[#B91C2C] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Complete Follow-up</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggle(f)}
                      className="px-3 py-1.5 rounded-xl bg-white text-[#667085] hover:text-[#20242C] border border-[#E9EAEE] text-xs font-bold transition-all cursor-pointer"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-[#E9EAEE] p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF1F2] text-[#D62839] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-[#20242C]">No follow-ups in this filter</h4>
            <p className="text-xs text-[#667085] max-w-sm mx-auto">
              You are all caught up! Click below to schedule a new touchpoint with an active lead or customer.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="cockpit-btn-primary inline-flex"
            >
              Schedule New Follow-up
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: SCHEDULE NEW FOLLOW-UP */}
      {/* ============================================================== */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule New Follow-up Touchpoint"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateFollowup} className="space-y-4">
          <div className="flex items-center gap-2 p-1 bg-[#F8F9FB] border border-[#E9EAEE] rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setTargetType('lead')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                targetType === 'lead' ? 'bg-[#D62839] text-white shadow-2xs' : 'text-[#667085]'
              }`}
            >
              Sales Lead ({leads.length})
            </button>
            <button
              type="button"
              onClick={() => setTargetType('customer')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                targetType === 'customer' ? 'bg-[#D62839] text-white shadow-2xs' : 'text-[#667085]'
              }`}
            >
              Existing Customer ({customers.length})
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {targetType === 'lead' ? (
              <div>
                <label className="block text-xs font-bold text-[#20242C] mb-1">Select Lead *</label>
                <select
                  required
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(Number(e.target.value))}
                  className="cockpit-input w-full bg-white cursor-pointer"
                >
                  <option value="">Select a lead...</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.company ? `(${l.company})` : ''} — {l.source}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-[#20242C] mb-1">Select Customer *</label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                  className="cockpit-input w-full bg-white cursor-pointer"
                >
                  <option value="">Select a customer organization...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#20242C] mb-1">Follow-up Objective / Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Discuss revised scope, confirm proposal pricing"
                className="cockpit-input w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#20242C] mb-1">Contact Method</label>
                <select
                  value={contactMethod}
                  onChange={(e) => setContactMethod(e.target.value as any)}
                  className="cockpit-input w-full bg-white cursor-pointer"
                >
                  <option value="call">Phone Call</option>
                  <option value="whatsapp">WhatsApp Message</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                  <option value="other">Other Touchpoint</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20242C] mb-1">Scheduled Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="cockpit-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#20242C] mb-1">Assigned Employee</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="cockpit-input w-full bg-white cursor-pointer"
              >
                <option value="">Current User / Self</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.designation})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#20242C] mb-1">Notes & Context</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add background context, discussion talking points..."
                className="cockpit-input w-full"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#E9EAEE] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#E9EAEE] text-xs font-bold text-[#667085] hover:bg-[#F8F9FB] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              <span>Save & Schedule Follow-up</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 2: COMPLETE FOLLOW-UP WITH OUTCOME & SCHEDULE NEXT */}
      {/* ============================================================== */}
      <Modal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        title="Complete Follow-up & Record Outcome"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCompleteSubmit} className="space-y-4">
          <p className="text-xs text-[#667085]">
            Mark <strong>"{activeFollowup?.title}"</strong> as resolved and log the interaction result to the lead timeline.
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-xs font-bold text-[#20242C] mb-1">
                Outcome Summary *
              </label>
              <input
                type="text"
                required
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="e.g. Client agreed to quotation; requested contract draft"
                className="cockpit-input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#20242C] mb-1">
                Additional Touchpoint Notes
              </label>
              <textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                rows={3}
                placeholder="Any special terms discussed, delivery dates, or objections..."
                className="cockpit-input w-full"
              />
            </div>

            <div className="pt-2 border-t border-[#E9EAEE]">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-[#20242C]">
                <input
                  type="checkbox"
                  checked={scheduleNext}
                  onChange={(e) => setScheduleNext(e.target.checked)}
                  className="rounded text-[#D62839] focus:ring-[#D62839]"
                />
                <span>Schedule Next Follow-up Immediately</span>
              </label>
            </div>

            {scheduleNext && (
              <div className="p-3.5 rounded-xl bg-[#FFF1F2]/60 border border-[#FECDD3] space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#20242C] mb-1">Next Action Title</label>
                  <input
                    type="text"
                    value={nextTitle}
                    onChange={(e) => setNextTitle(e.target.value)}
                    className="cockpit-input w-full text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[#20242C] mb-1">Contact Method</label>
                    <select
                      value={nextMethod}
                      onChange={(e) => setNextMethod(e.target.value as any)}
                      className="cockpit-input w-full text-xs bg-white cursor-pointer"
                    >
                      <option value="call">Phone Call</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                      <option value="meeting">Meeting</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#20242C] mb-1">Next Scheduled Date</label>
                    <input
                      type="datetime-local"
                      required={scheduleNext}
                      value={nextDate}
                      onChange={(e) => setNextDate(e.target.value)}
                      className="cockpit-input w-full text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E9EAEE] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsCompleteModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#E9EAEE] text-xs font-bold text-[#667085] hover:bg-[#F8F9FB] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              <Check className="w-4 h-4" />
              <span>Save & Complete Follow-up</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
