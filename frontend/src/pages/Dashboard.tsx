import React, { useEffect, useState, useMemo } from 'react';
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
  Globe,
  Filter,
  User,
  Users2,
  CheckCircle2,
  TrendingUp,
  Briefcase,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Activity,
  Zap,
  DollarSign
} from 'lucide-react';
import { api } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';
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

  // Dynamic Dashboard Filters
  const [filterSource, setFilterSource] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);

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
    won_value: 0,
    leads_by_source: [] 
  };
  const followups = data?.followups || { pending: 0, today: 0, overdue: 0, completed: 0 };
  const hrm = data?.hrm || { active_employees: 0, department_count: 0 };
  const upcomingFollowups = data?.upcoming_followups || [];
  const priorityTasks = data?.priority_tasks || [];
  const todayMeetings = data?.today_meetings || [];
  const recentActivities = data?.recent_activities || [];

  const collectionRate = fin.total_receivable > 0 
    ? Math.round((fin.total_received / fin.total_receivable) * 100) 
    : 0;

  // Lead Source Color Palette
  const sourceColors: Record<string, { bg: string; fill: string; border: string; text: string }> = {
    'BNI Connect': { bg: 'bg-rose-500', fill: '#D62839', border: 'border-rose-500', text: 'text-rose-600 dark:text-rose-400' },
    'KVV Leads': { bg: 'bg-amber-500', fill: '#F59E0B', border: 'border-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    'EAF Connect': { bg: 'bg-emerald-500', fill: '#10B981', border: 'border-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    'SEO / Website': { bg: 'bg-blue-500', fill: '#3B82F6', border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-400' },
    'Manual': { bg: 'bg-purple-500', fill: '#8B5CF6', border: 'border-purple-500', text: 'text-purple-600 dark:text-purple-400' },
    'Direct Referral': { bg: 'bg-indigo-500', fill: '#6366F1', border: 'border-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' }
  };

  const getSourceColor = (src: string) => {
    return sourceColors[src] || { bg: 'bg-slate-500', fill: '#64748B', border: 'border-slate-500', text: 'text-slate-600 dark:text-slate-400' };
  };

  // Compute SVG Donut Segments for Leads by Source
  const donutSegments = useMemo(() => {
    const list = crm.leads_by_source || [];
    const total = list.reduce((acc: number, item: any) => acc + (item.count || 0), 0);
    if (total === 0) return [];

    let currentAngle = 0;
    const radius = 38;
    const circumference = 2 * Math.PI * radius;

    return list.map((item: any) => {
      const percentage = (item.count / total) * 100;
      const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((currentAngle / 100) * circumference);
      currentAngle += percentage;
      return {
        ...item,
        percentage: Math.round(percentage * 10) / 10,
        strokeDasharray,
        strokeDashoffset,
        color: getSourceColor(item.source)
      };
    });
  }, [crm.leads_by_source]);

  // Compute Financial Progress Segments
  const financialDistribution = useMemo(() => {
    const total = fin.total_receivable || 0;
    if (total === 0) return { receivedPct: 0, pendingPct: 0, overduePct: 0 };
    return {
      receivedPct: Math.min(100, Math.round((fin.total_received / total) * 100)),
      pendingPct: Math.min(100, Math.round((fin.pending_amount / total) * 100)),
      overduePct: Math.min(100, Math.round((fin.overdue_amount / total) * 100))
    };
  }, [fin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[65vh]">
        <div className="flex flex-col items-center gap-3.5">
          <div className="w-12 h-12 border-3 border-rose-100 dark:border-rose-950/40 border-t-[#D62839] rounded-full animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">Synthesizing live business & lead telemetry...</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Connecting isolated tenant database</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* ========================================================= */}
      {/* EXECUTIVE HEADER & TELEMETRY CONTROLS                      */}
      {/* ========================================================= */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 cockpit-card-hover">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-[#D62839] dark:text-rose-400 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D62839] animate-pulse" />
              <span>Workspace: {tenant?.name || 'Enterprise'}</span>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">•</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
              Tenant ID: #{user?.tenant_id || 1}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Welcome back, {user?.name || 'Executive'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            Real-time executive cockpit uniting centralized lead velocity across BNI, KVV, EAF, automated follow-ups, and financial collections.
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-300 hover:text-[#D62839] dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-all duration-180 cursor-pointer shadow-2xs"
            title="Refresh Live Data"
            aria-label="Refresh telemetry data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => setActiveTab('leads')}
            className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:text-[#D62839] dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-200 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Users2 className="w-3.5 h-3.5 text-[#D62839]" />
            <span>Centralized Leads ({crm.total_leads})</span>
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className="cockpit-btn-primary shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DYNAMIC TELEMETRY FILTER BAR                              */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold">
          <Filter className="w-4 h-4 text-[#D62839]" />
          <span>Active Pipeline Scope:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Source Filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium cursor-pointer shadow-2xs focus:outline-none focus:border-[#D62839]"
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
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium cursor-pointer shadow-2xs focus:outline-none focus:border-[#D62839]"
          >
            <option value="all">All Time Range</option>
            <option value="today">Today</option>
            <option value="this_week">Past 7 Days</option>
            <option value="this_month">Past 30 Days</option>
          </select>

          {/* Employee / Assignee Filter */}
          <select
            value={filterAssigned}
            onChange={(e) => setFilterAssigned(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium cursor-pointer shadow-2xs focus:outline-none focus:border-[#D62839]"
          >
            <option value="all">All Assignees ({employees.length})</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>

          {(filterSource !== 'all' || filterDateRange !== 'all' || filterAssigned !== 'all') && (
            <button
              onClick={() => {
                setFilterSource('all');
                setFilterDateRange('all');
                setFilterAssigned('all');
              }}
              className="text-[11px] font-bold text-[#D62839] hover:underline px-2 py-1 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: RESPONSIVE EXECUTIVE KPI MATRIX (NO CRUSH)     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pipeline & Lead Volume */}
        <MetricCard
          title="Centralized Lead Volume"
          value={crm.total_leads}
          subtitle={`Pipeline: ${formatCurrency(crm.pipeline_value)}`}
          icon={Users2}
          colorScheme="red"
          trend={`${crm.new_leads} Fresh Inquiries`}
          trendUp={true}
          action={{
            label: 'View Leads',
            onClick: () => setActiveTab('leads')
          }}
        />

        {/* KPI 2: Collections & Receivable Liquidity */}
        <MetricCard
          title="Receivable Liquidity"
          value={formatCurrency(fin.total_receivable)}
          subtitle={`${collectionRate}% Collected (${formatCurrency(fin.total_received)})`}
          icon={CreditCard}
          colorScheme="emerald"
          trend={`${collectionRate}% Cleared`}
          trendUp={collectionRate >= 50}
          action={{
            label: 'Finance Hub',
            onClick: () => setActiveTab('invoices')
          }}
        />

        {/* KPI 3: Follow-up Velocity & Queue */}
        <MetricCard
          title="Follow-up Operations"
          value={followups.pending + followups.today}
          subtitle={`Due Today: ${followups.today} | Overdue: ${followups.overdue}`}
          icon={PhoneCall}
          colorScheme={followups.overdue > 0 ? "red" : "blue"}
          trend={followups.overdue > 0 ? `${followups.overdue} Urgent Overdue` : "All on Track"}
          trendUp={followups.overdue === 0}
          action={{
            label: 'Open Agenda',
            onClick: () => setActiveTab('followups')
          }}
        />

        {/* KPI 4: Conversion & Win Rate */}
        <MetricCard
          title="Lead Win Rate"
          value={`${crm.conversion_rate}%`}
          subtitle={`Won: ${crm.won_leads} (${formatCurrency(crm.won_value)})`}
          icon={TrendingUp}
          colorScheme="amber"
          trend={`${crm.won_leads} Converted`}
          trendUp={true}
          action={{
            label: 'CRM Funnel',
            onClick: () => setActiveTab('crm')
          }}
        />
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: INTERACTIVE SVG DATA VISUALIZATIONS            */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Visualization 1: Lead Intake by Integration Source */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 shadow-xs cockpit-card-hover flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#D62839] border border-rose-200 dark:border-rose-900/50">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Lead Source Distribution
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Proportions across BNI, KVV, EAF, SEO & direct capture
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('integrations')}
                className="text-xs font-bold text-[#D62839] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Sync Hub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Donut Chart & Legend Split */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center my-2">
              {/* SVG Donut */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center relative">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {/* Background Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="11"
                      stroke="currentColor"
                      fill="transparent"
                    />

                    {/* Donut Segments */}
                    {donutSegments.map((segment: any) => (
                      <circle
                        key={segment.source}
                        cx="50"
                        cy="50"
                        r="38"
                        stroke={segment.color.fill}
                        strokeWidth={hoveredSource === segment.source ? "14" : "11"}
                        strokeDasharray={segment.strokeDasharray}
                        strokeDashoffset={segment.strokeDashoffset}
                        fill="transparent"
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredSource(segment.source)}
                        onMouseLeave={() => setHoveredSource(null)}
                      />
                    ))}
                  </svg>

                  {/* Centered Total Indicator */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">
                      {crm.total_leads}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
                      Total Leads
                    </span>
                  </div>
                </div>
              </div>

              {/* Source List Breakdown */}
              <div className="sm:col-span-7 space-y-2.5">
                {(crm.leads_by_source || []).map((s: any) => {
                  const color = getSourceColor(s.source);
                  const isHovered = hoveredSource === s.source;

                  return (
                    <div 
                      key={s.source} 
                      onMouseEnter={() => setHoveredSource(s.source)}
                      onMouseLeave={() => setHoveredSource(null)}
                      className={`p-2.5 rounded-xl border transition-all duration-180 cursor-pointer ${
                        isHovered 
                          ? 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60' 
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                          <span>{s.source}</span>
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {s.count} ({s.percentage}%)
                        </span>
                      </div>

                      {/* Micro Progress Bar */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full ${color.bg}`}
                          style={{ width: `${Math.min(100, Math.max(4, s.percentage))}%` }} 
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        <span>Won: <strong className="text-emerald-600 dark:text-emerald-400">{s.won_count}</strong></span>
                        <span className="font-mono">{formatCurrency(s.total_value)}</span>
                      </div>
                    </div>
                  );
                })}

                {(!crm.leads_by_source || crm.leads_by_source.length === 0) && (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No lead source distribution data recorded.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Overall Win Rate: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{crm.conversion_rate}%</strong></span>
            <span>Unscheduled Leads: <strong className="text-amber-600 dark:text-amber-400 font-bold">{crm.leads_without_followup}</strong></span>
          </div>
        </div>

        {/* Visualization 2: Financial Collections & Liquidity Gauge */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 shadow-xs cockpit-card-hover flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Financial Collections & Aging
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Collection efficiency and outstanding aging breakdown
                  </p>
                </div>
              </div>

              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                collectionRate >= 70 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800'
                  : collectionRate >= 40 
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800'
                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800'
              }`}>
                {collectionRate}% Efficiency
              </span>
            </div>

            {/* Visual Multi-Segment Progress Flow */}
            <div className="space-y-3 my-3">
              <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex p-0.5 gap-0.5">
                <div 
                  className="bg-emerald-500 h-full rounded-lg transition-all duration-500" 
                  style={{ width: `${financialDistribution.receivedPct}%` }}
                  title={`Received: ${financialDistribution.receivedPct}%`}
                />
                <div 
                  className="bg-amber-500 h-full rounded-lg transition-all duration-500" 
                  style={{ width: `${financialDistribution.pendingPct}%` }}
                  title={`Pending: ${financialDistribution.pendingPct}%`}
                />
                <div 
                  className="bg-rose-500 h-full rounded-lg transition-all duration-500" 
                  style={{ width: `${financialDistribution.overduePct}%` }}
                  title={`Overdue: ${financialDistribution.overduePct}%`}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-2">
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                    Cleared
                  </span>
                  <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {formatCurrency(fin.total_received)}
                  </p>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                    {financialDistribution.receivedPct}% of billed
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                    Open Balances
                  </span>
                  <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {formatCurrency(fin.pending_amount)}
                  </p>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                    {financialDistribution.pendingPct}% active
                  </span>
                </div>

                <div className={`p-3 rounded-xl border ${
                  fin.overdue_amount > 0 
                    ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60' 
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                }`}>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${
                    fin.overdue_amount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    Overdue
                  </span>
                  <p className={`text-sm sm:text-base font-black font-mono mt-0.5 ${
                    fin.overdue_amount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                  }`}>
                    {formatCurrency(fin.overdue_amount)}
                  </p>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                    {fin.overdue_amount > 0 ? 'Urgent action' : 'Zero default'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Invoiced: <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">{formatCurrency(fin.total_receivable)}</strong></span>
            <button
              onClick={() => setActiveTab('invoices')}
              className="text-xs font-bold text-[#D62839] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Invoices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* SECTION 3: OPERATIONAL ACTION QUEUE & AGENDAS             */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 Cols): Actionable Follow-up Queue */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 shadow-xs cockpit-card-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#D62839] border border-rose-200 dark:border-rose-900/50">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Actionable Follow-up Queue
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live scheduled touchpoints with click-to-contact actions
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('followups')}
                className="text-xs font-bold text-[#D62839] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>All Follow-ups</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingFollowups.length > 0 ? (
              <div className="space-y-3">
                {upcomingFollowups.map((f: any) => {
                  const isOverdue = f.calculated_status === 'overdue';
                  const isToday = f.calculated_status === 'today';

                  return (
                    <div
                      key={f.id}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-180 ${
                        isOverdue 
                          ? 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/50' 
                          : isToday 
                            ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50' 
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[240px]">
                            {f.title}
                          </h4>
                          <span className="text-[10px] font-semibold text-[#D62839] dark:text-rose-400 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50">
                            {f.source}
                          </span>
                          {isOverdue && (
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 px-1.5 py-0.2 rounded-md bg-rose-100 dark:bg-rose-900/60 animate-pulse">
                              Overdue
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                          Client: <strong className="text-slate-900 dark:text-white font-semibold">{f.contact_name}</strong> {f.contact_company ? `(${f.contact_company})` : ''}
                        </p>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                          <span>
                            {new Date(f.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(f.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </p>
                      </div>

                      {/* Instant Action Buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {f.contact_phone && (
                          <a
                            href={`tel:${f.contact_phone}`}
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer shadow-2xs"
                            title={`Call ${f.contact_phone}`}
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {f.contact_phone && (
                          <a
                            href={`https://wa.me/${f.contact_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${f.contact_name}, connecting regarding ${f.title}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer shadow-2xs"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => setActiveTab('followups')}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#D62839] text-slate-700 dark:text-slate-200 hover:text-[#D62839] text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          Resolve →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-80" />
                <p>Follow-up queue is completely up to date! Zero pending reminders.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 Cols): Priority Tasks & Meetings Hub */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Priority Tasks Widget */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 shadow-xs cockpit-card-hover">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  Priority Tasks
                </h3>
              </div>

              <button
                onClick={() => setActiveTab('tasks')}
                className="text-xs font-bold text-[#D62839] hover:underline cursor-pointer"
              >
                All Tasks ({priorityTasks.length}) →
              </button>
            </div>

            {priorityTasks.length > 0 ? (
              <div className="space-y-2">
                {priorityTasks.slice(0, 4).map((task: any) => {
                  const isUrgent = task.priority === 'urgent';
                  const isHigh = task.priority === 'high';

                  return (
                    <div 
                      key={task.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          isUrgent ? 'bg-rose-500 animate-pulse' : isHigh ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                          isUrgent 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400' 
                            : isHigh 
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-5 text-center text-xs text-slate-400">
                No active priority tasks found.
              </div>
            )}
          </div>

          {/* Today's Meetings & Agenda */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 shadow-xs cockpit-card-hover">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  Today's Meetings & Schedule
                </h3>
              </div>

              <button
                onClick={() => setActiveTab('calendar')}
                className="text-xs font-bold text-[#D62839] hover:underline cursor-pointer"
              >
                Calendar →
              </button>
            </div>

            {todayMeetings.length > 0 ? (
              <div className="space-y-2">
                {todayMeetings.map((meet: any) => (
                  <div 
                    key={meet.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {meet.title}
                      </p>
                      {meet.location && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {meet.location}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400 shrink-0">
                      {new Date(meet.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span>No meetings scheduled for today.</span>
                <button
                  onClick={() => setActiveTab('calendar')}
                  className="text-xs font-bold text-[#D62839] hover:underline cursor-pointer"
                >
                  + Add Meeting
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 4: RECENT AUDIT TRAIL & EXECUTIVE AI COPILOT      */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recent Activity Audit Trail (7 Cols) */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 shadow-xs cockpit-card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Recent Lead Activities & Audit Trail
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Real-time Stream</span>
          </div>

          {recentActivities.length > 0 ? (
            <div className="space-y-2.5">
              {recentActivities.map((act: any) => (
                <div 
                  key={act.id} 
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                        {act.lead_name}
                      </span>
                      {act.lead_company && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          ({act.lead_company})
                        </span>
                      )}
                      <span className="px-1.5 py-0.2 rounded-md bg-rose-50 dark:bg-rose-950/60 text-[#D62839] dark:text-rose-400 text-[10px] uppercase font-mono font-bold">
                        {act.activity_type}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] truncate">
                      {act.title}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      {new Date(act.activity_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      by {act.user_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No recent audit trail entries logged.
            </div>
          )}
        </div>

        {/* Executive AI Copilot Command Card (5 Cols) */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-rose-50/80 via-white to-slate-50 dark:from-rose-950/20 dark:via-[#0F172A] dark:to-[#090D16] border border-rose-200 dark:border-rose-900/50 shadow-xs cockpit-card-hover flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#D62839] flex items-center justify-center text-white shadow-md shadow-[#D62839]/25 shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  AI Lead Intelligence Agent
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Instant natural language reasoning across all pipeline data
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Tap a quick prompt to synthesize pipeline metrics, generate smart follow-up drafts, or evaluate BNI & KVV channel efficiency:
            </p>

            <div className="space-y-2 mb-4">
              <button
                onClick={() => setActiveTab('ai')}
                className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-[#D62839] text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-[#D62839] transition-all cursor-pointer flex items-center justify-between shadow-2xs group"
              >
                <span>"Analyze BNI vs KVV lead conversion rates"</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#D62839] group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => setActiveTab('ai')}
                className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-[#D62839] text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-[#D62839] transition-all cursor-pointer flex items-center justify-between shadow-2xs group"
              >
                <span>"Draft follow-up action plan for overdue leads"</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#D62839] group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => setActiveTab('ai')}
                className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-[#D62839] text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-[#D62839] transition-all cursor-pointer flex items-center justify-between shadow-2xs group"
              >
                <span>"Summarize total outstanding receivable balance"</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#D62839] group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('ai')}
            className="w-full cockpit-btn-primary shadow-xs py-2.5"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>Open Executive AI Agent</span>
          </button>
        </div>

      </div>

    </div>
  );
};
