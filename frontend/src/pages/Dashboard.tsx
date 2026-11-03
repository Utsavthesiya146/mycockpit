import React, { useEffect, useState } from 'react';
import { 
  CreditCard, 
  ArrowUpRight, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  CheckSquare, 
  Sparkles, 
  Plus,
  RefreshCw,
  ArrowRight,
  Layers,
  PhoneCall,
  MessageSquare,
  Mail,
  CheckCircle2,
  TrendingUp,
  Globe,
  Filter,
  User,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';
import type { NavTab } from '../components/layout/Sidebar';
import type { Employee } from '../types';

interface DashboardProps {
  setActiveTab: (tab: NavTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const { user, tenant } = useAuth();
  const [data, setData] = useState<any>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic Dashboard Filters (Requirement #4)
  const [filterSource, setFilterSource] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filterSource !== 'all') params.append('source', filterSource);
      if (filterDateRange !== 'all') params.append('date_range', filterDateRange);
      if (filterAssigned !== 'all') params.append('assigned_to', filterAssigned);

      const [res, empRes]: any = await Promise.all([
        api.get(`/dashboard/stats?${params.toString()}`),
        api.get('/hrm/employees')
      ]);

      setData(res);
      setEmployees(empRes || []);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user?.tenant_id, filterSource, filterDateRange, filterAssigned]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#FFF1F2] border-t-[#D62839] rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#667085]">Synthesizing live business & lead telemetry...</p>
        </div>
      </div>
    );
  }

  const fin = data?.financial || { total_receivable: 0, total_received: 0, pending_amount: 0, overdue_amount: 0 };
  const crm = data?.crm || { 
    customer_count: 0, 
    total_leads: 0, 
    new_leads: 0, 
    won_leads: 0, 
    lost_leads: 0, 
    leads_without_followup: 0, 
    conversion_rate: 0, 
    pipeline_value: 0, 
    leads_by_source: [] 
  };
  const followups = data?.followups || { pending: 0, today: 0, overdue: 0, completed: 0 };

  const collectionRate = fin.total_receivable > 0 
    ? Math.round((fin.total_received / fin.total_receivable) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome & Context Banner */}
      <div className="p-6 rounded-2xl bg-white border border-[#E9EAEE] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#FFF1F2] border border-[#FECDD3] text-[#D62839] text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#D62839] animate-pulse" />
            <span>Active Organization: {tenant?.name || 'My Organization'}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-[#20242C] tracking-tight">
            Welcome back, {user?.name}
          </h2>
          <p className="text-sm text-[#667085] max-w-xl">
            Here is your centralized lead flow, active follow-up agenda, and financial accounts telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white hover:bg-[#FFF1F2] text-[#667085] hover:text-[#D62839] border border-[#E9EAEE] hover:border-[#FECDD3] transition-all duration-180 shadow-2xs cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => setActiveTab('crm')}
            className="px-3.5 py-2 rounded-xl bg-white text-[#20242C] hover:text-[#D62839] border border-[#E9EAEE] hover:border-[#FECDD3] text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-[#D62839]" />
            <span>Manage Leads</span>
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className="cockpit-btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Invoice</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: CENTRALIZED LEAD MANAGEMENT & FOLLOW-UP KPI */}
      {/* ========================================================= */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#FFF1F2] text-[#D62839]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#20242C] tracking-tight">
                Centralized Lead & Follow-up Intelligence
              </h3>
              <p className="text-xs text-[#667085]">Live pipeline conversions across BNI, KVV, EAF, SEO Website, and manual intake</p>
            </div>
          </div>

          {/* Dynamic Filters (Requirement #4) */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Source Filter */}
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="cockpit-input py-1 px-2.5 text-xs bg-white cursor-pointer"
            >
              <option value="all">All Lead Sources</option>
              <option value="BNI Connect">BNI Connect</option>
              <option value="KVV Leads">KVV Leads</option>
              <option value="EAF Connect">EAF Connect</option>
              <option value="SEO / Website">SEO / Website</option>
              <option value="Manual">Manual Entry</option>
            </select>

            {/* Date Range Filter */}
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              className="cockpit-input py-1 px-2.5 text-xs bg-white cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this_week">Past 7 Days</option>
              <option value="this_month">Past 30 Days</option>
            </select>

            {/* Employee Filter */}
            <select
              value={filterAssigned}
              onChange={(e) => setFilterAssigned(e.target.value)}
              className="cockpit-input py-1 px-2.5 text-xs bg-white cursor-pointer"
            >
              <option value="all">All Assignees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lead & Followup KPI Cards (Requirement #4) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-[#E9EAEE] shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-[#667085]">Total Leads</span>
            <p className="text-xl font-extrabold text-[#20242C] font-mono">{crm.total_leads}</p>
            <p className="text-[10px] text-[#667085] truncate">{formatCurrency(crm.pipeline_value)}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#E9EAEE] shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-[#667085]">New Inquiries</span>
            <p className="text-xl font-extrabold text-[#D62839] font-mono">{crm.new_leads}</p>
            <span className="text-[10px] font-bold text-[#D62839] px-1.5 py-0.2 rounded-full bg-[#FFF1F2]">Fresh</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#E9EAEE] shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-[#667085]">Pending Follow-up</span>
            <p className="text-xl font-extrabold text-[#3B82F6] font-mono">{followups.pending}</p>
            <span className="text-[10px] text-[#667085]">Scheduled</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#FDE68A] bg-[#FFFBEB]/50 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-[#D97706]">Today's Follow-up</span>
            <p className="text-xl font-extrabold text-[#D97706] font-mono">{followups.today}</p>
            <span className="text-[10px] font-bold text-[#D97706]">Action Due</span>
          </div>

          <div className={`p-3.5 rounded-2xl border shadow-2xs space-y-1 ${
            followups.overdue > 0 ? 'bg-[#FEF2F2] border-[#FECDD3]' : 'bg-white border-[#E9EAEE]'
          }`}>
            <span className={`text-[11px] font-bold ${followups.overdue > 0 ? 'text-[#DC2626]' : 'text-[#667085]'}`}>
              Overdue Alerts
            </span>
            <p className={`text-xl font-extrabold font-mono ${followups.overdue > 0 ? 'text-[#DC2626]' : 'text-[#20242C]'}`}>
              {followups.overdue}
            </p>
            <span className="text-[10px] font-bold text-[#DC2626]">
              {followups.overdue > 0 ? '⚠️ Urgent' : 'Zero Overdue'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#E9EAEE] shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-[#667085]">Completed</span>
            <p className="text-xl font-extrabold text-[#059669] font-mono">{followups.completed}</p>
            <span className="text-[10px] text-[#059669] font-bold">Touchpoints</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#E9EAEE] shadow-2xs space-y-1">
            <span className="text-[11px] font-semibold text-[#667085]">Converted (Won)</span>
            <p className="text-xl font-extrabold text-[#059669] font-mono">{crm.won_leads}</p>
            <span className="text-[10px] text-[#059669] font-bold">{crm.conversion_rate}% Conv</span>
          </div>

          <div className={`p-3.5 rounded-2xl border shadow-2xs space-y-1 ${
            crm.leads_without_followup > 0 ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-white border-[#E9EAEE]'
          }`}>
            <span className="text-[11px] font-semibold text-[#667085]">No Follow-up</span>
            <p className="text-xl font-extrabold text-[#64748B] font-mono">{crm.leads_without_followup}</p>
            <span className="text-[10px] text-[#94A3B8]">Needs Schedule</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: LEADS BY SOURCE & ACTIONABLE TOUCHPOINTS */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Leads by Source & Urgent Touchpoints */}
        <div className="lg:col-span-2 space-y-6">
          {/* Leads by Source Breakdown (Requirement #4) */}
          <div className="p-6 rounded-2xl bg-white border border-[#E9EAEE] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3]">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#20242C] tracking-tight">Leads Intake by Source</h3>
                  <p className="text-xs text-[#667085]">Distribution across authorized integration channels</p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('crm')}
                className="text-xs text-[#D62839] hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>View Full Pipeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {(crm.leads_by_source || []).map((s: any) => (
                <div key={s.source} className="p-3.5 rounded-xl bg-[#F8F9FB] border border-[#E9EAEE] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#20242C] text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#D62839]" />
                      <span>{s.source}</span>
                    </span>
                    <span className="font-mono font-bold text-xs text-[#20242C]">
                      {s.count} leads ({s.percentage}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-[#E9EAEE] rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-[#D62839] h-1.5 rounded-full" 
                      style={{ width: `${Math.min(100, Math.max(5, s.percentage))}%` }} 
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#667085]">
                    <span>Converted: <strong className="text-[#059669]">{s.won_count}</strong></span>
                    <span className="font-mono">{formatCurrency(s.total_value)}</span>
                  </div>
                </div>
              ))}

              {(!crm.leads_by_source || crm.leads_by_source.length === 0) && (
                <div className="col-span-full py-8 text-center text-xs text-[#94A3B8]">
                  No lead source records captured yet.
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Actionable Follow-ups Stream (Requirement #4) */}
          <div className="p-6 rounded-2xl bg-white border border-[#E9EAEE] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3]">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#20242C] tracking-tight">Actionable Follow-up Queue</h3>
                  <p className="text-xs text-[#667085]">Upcoming scheduled touchpoints with click-to-contact actions</p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('followups')}
                className="text-xs text-[#D62839] hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>All Follow-ups</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {data?.upcoming_followups?.length > 0 ? (
              <div className="space-y-2.5">
                {data.upcoming_followups.map((f: any) => {
                  const isOverdue = f.calculated_status === 'overdue';
                  const isToday = f.calculated_status === 'today';

                  return (
                    <div
                      key={f.id}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isOverdue 
                          ? 'bg-[#FEF2F2]/60 border-[#FECDD3]' 
                          : isToday 
                            ? 'bg-[#FFFBEB]/60 border-[#FDE68A]' 
                            : 'bg-[#F8F9FB] border-[#E9EAEE]'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-[#20242C]">{f.title}</h4>
                          <span className="text-[10px] font-semibold text-[#D62839] px-2 py-0.2 rounded-md bg-white border border-[#FECDD3]">
                            {f.source}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#667085]">
                          Contact: <strong className="text-[#20242C]">{f.contact_name}</strong> {f.contact_company ? `(${f.contact_company})` : ''}
                        </p>
                        <p className="text-[11px] text-[#667085] flex items-center gap-1">
                          <Clock className={`w-3 h-3 ${isOverdue ? 'text-[#DC2626]' : 'text-[#D62839]'}`} />
                          <span>
                            {isOverdue && <strong className="text-[#DC2626]">Overdue: </strong>}
                            {new Date(f.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(f.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </p>
                      </div>

                      {/* Direct Click to action */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        {f.contact_phone && (
                          <a
                            href={`tel:${f.contact_phone}`}
                            className="p-2 rounded-xl bg-white hover:bg-[#FFF1F2] text-[#059669] border border-[#E9EAEE] hover:border-[#FECDD3] transition-all cursor-pointer shadow-2xs"
                            title="Call Now"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {f.contact_phone && (
                          <a
                            href={`https://wa.me/${f.contact_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${f.contact_name}, connecting regarding ${f.title}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-white hover:bg-[#FFF1F2] text-[#25D366] border border-[#E9EAEE] hover:border-[#FECDD3] transition-all cursor-pointer shadow-2xs"
                            title="WhatsApp Chat"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => setActiveTab('followups')}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E9EAEE] hover:border-[#D62839] text-[#20242C] hover:text-[#D62839] text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          Resolve →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-[#94A3B8] text-xs">
                No pending follow-ups in queue. All client interactions are currently up to date.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Assistant & Recent Activities Stream */}
        <div className="space-y-6">
          {/* AI Copilot Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#FFF1F2] via-white to-white border border-[#FECDD3] shadow-xs relative overflow-hidden">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#D62839] flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#20242C]">AI Lead Intelligence Agent</h3>
                <p className="text-[11px] text-[#667085]">Instant natural language queries</p>
              </div>
            </div>
            <p className="text-xs text-[#667085] leading-relaxed mb-4">
              Ask anything: *"Show all my BNI leads"*, *"Show today's follow-ups"*, or *"Suggest next action for a lead"*
            </p>
            <button
              onClick={() => setActiveTab('ai')}
              className="w-full py-2.5 rounded-xl bg-[#D62839] hover:bg-[#B91C2C] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all duration-180 cursor-pointer"
            >
              <span>Ask AI Copilot</span>
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Recent Lead Activities Feed */}
          <div className="p-6 rounded-2xl bg-white border border-[#E9EAEE] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#20242C] tracking-tight">Recent Lead Activities</h3>
              <span className="text-[11px] text-[#94A3B8]">Audit Trail</span>
            </div>

            {data?.recent_activities?.length > 0 ? (
              <div className="space-y-3">
                {data.recent_activities.map((act: any) => (
                  <div key={act.id} className="p-3 rounded-xl bg-[#F8F9FB] border border-[#E9EAEE] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#20242C]">{act.lead_name}</span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {new Date(act.activity_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-[#667085] font-semibold text-[11px] flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded-md bg-[#FFF1F2] text-[#D62839] text-[9px] uppercase font-mono font-bold">
                        {act.activity_type}
                      </span>
                      <span>{act.title}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-[#94A3B8] text-xs">
                No recent activity records found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 3: FINANCIAL KPI METRICS CARDS (PRESERVED) */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-extrabold text-[#20242C] tracking-tight">
            Financial Collections Telemetry
          </h3>
          <button 
            onClick={() => setActiveTab('invoices')}
            className="text-xs text-[#D62839] hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>Invoices & Payments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Receivable"
            value={formatCurrency(fin.total_receivable)}
            subtitle="Gross invoices billed"
            icon={CreditCard}
            colorScheme="red"
            trend={`${crm.customer_count || 0} Accounts`}
            trendUp={true}
          />
          <MetricCard
            title="Total Received"
            value={formatCurrency(fin.total_received)}
            subtitle={`${collectionRate}% Collection Rate`}
            icon={ArrowUpRight}
            colorScheme="emerald"
            trend="Cleared"
            trendUp={true}
          />
          <MetricCard
            title="Pending Amount"
            value={formatCurrency(fin.pending_amount)}
            subtitle="Open balances"
            icon={Clock}
            colorScheme="amber"
            trend="Actionable"
            trendUp={false}
          />
          <MetricCard
            title="Overdue Amount"
            value={formatCurrency(fin.overdue_amount)}
            subtitle="Past contractual due date"
            icon={AlertTriangle}
            colorScheme="red"
            trend={fin.overdue_amount > 0 ? "Requires Follow-up" : "Zero Overdue"}
            trendUp={fin.overdue_amount === 0}
          />
        </div>
      </div>
    </div>
  );
};
