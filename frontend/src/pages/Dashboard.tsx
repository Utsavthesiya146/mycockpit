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
  DollarSign,
  Award,
  Send,
  ShieldCheck,
  Check,
  TrendingDown
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Cockpit3DLoader } from '../components/common/Cockpit3DLoader';
import { formatCurrency, formatCompactCurrency } from '../utils/formatters';
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
  const [quickPrompt, setQuickPrompt] = useState('');

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

    // Non-blocking background automatic synchronization check on dashboard load
    api.post('/apps/sync-auto')
      .then((res: any) => {
        if (res?.synced_any) {
          fetchStats();
        }
      })
      .catch((err) => {
        console.warn('Dashboard auto-sync background check notice:', err);
      });
  }, [user?.tenant_id, filterSource, filterDateRange, filterAssigned]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
    api.post('/apps/sync-auto')
      .then((res: any) => {
        if (res?.synced_any) fetchStats();
      })
      .catch(() => {});
  };

  const handleAskAI = (promptText?: string) => {
    const q = promptText || quickPrompt;
    if (q.trim()) {
      sessionStorage.setItem('cockpit_pending_ai_query', q.trim());
    }
    setActiveTab('ai');
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

  // Source Color Mapping
  const sourceColors: Record<string, { bg: string; fill: string; border: string; text: string; glow: string }> = {
    'BNI Connect': { bg: 'bg-rose-500', fill: '#D62839', border: 'border-rose-500', text: 'text-rose-600 dark:text-rose-400', glow: 'shadow-rose-500/20' },
    'KVV Leads': { bg: 'bg-amber-500', fill: '#F59E0B', border: 'border-amber-500', text: 'text-amber-600 dark:text-amber-400', glow: 'shadow-amber-500/20' },
    'EAF Connect': { bg: 'bg-emerald-500', fill: '#10B981', border: 'border-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', glow: 'shadow-emerald-500/20' },
    'SEO / Website': { bg: 'bg-blue-500', fill: '#3B82F6', border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-400', glow: 'shadow-blue-500/20' },
    'Manual': { bg: 'bg-purple-500', fill: '#8B5CF6', border: 'border-purple-500', text: 'text-purple-600 dark:text-purple-400', glow: 'shadow-purple-500/20' },
    'Direct Referral': { bg: 'bg-indigo-500', fill: '#6366F1', border: 'border-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', glow: 'shadow-indigo-500/20' }
  };

  const getSourceColor = (src: string) => {
    return sourceColors[src] || { bg: 'bg-slate-500', fill: '#64748B', border: 'border-slate-500', text: 'text-slate-600 dark:text-slate-400', glow: 'shadow-slate-500/20' };
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

  // Compute Financial Liquidity Proportions
  const financialDistribution = useMemo(() => {
    const total = fin.total_receivable || 0;
    if (total === 0) return { receivedPct: 0, pendingPct: 0, overduePct: 0 };
    return {
      receivedPct: Math.min(100, Math.round((fin.total_received / total) * 100)),
      pendingPct: Math.min(100, Math.round((fin.pending_amount / total) * 100)),
      overduePct: Math.min(100, Math.round((fin.overdue_amount / total) * 100))
    };
  }, [fin]);

  // Derived Autonomous AI Insights from actual data
  const aiInsights = useMemo(() => {
    const insights = [];
    const topSource = [...(crm.leads_by_source || [])].sort((a, b) => b.count - a.count)[0];

    if (topSource && topSource.count > 0) {
      insights.push({
        type: 'acquisition',
        badge: 'Top Acquisition Channel',
        color: 'text-rose-500 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
        title: `${topSource.source} Dominance`,
        body: `${topSource.source} accounts for ${topSource.count} leads (${topSource.percentage}%) and ${formatCurrency(topSource.total_value)} in active pipeline.`
      });
    }

    if (followups.overdue > 0) {
      insights.push({
        type: 'urgent',
        badge: 'Immediate Action Due',
        color: 'text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
        title: `${followups.overdue} Overdue Reminders`,
        body: `You have ${followups.overdue} client follow-ups past their scheduled time. Immediate contact recommended to prevent deal drop-off.`
      });
    } else {
      insights.push({
        type: 'healthy',
        badge: 'Pipeline Hygiene Nominal',
        color: 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        title: 'Zero Overdue Backlog',
        body: `All client interactions are on track. ${followups.today} follow-ups scheduled for today.`
      });
    }

    if (fin.overdue_amount > 0) {
      insights.push({
        type: 'finance',
        badge: 'Cash Flow Aging Alert',
        color: 'text-rose-500 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
        title: `${formatCurrency(fin.overdue_amount)} Past Due`,
        body: `Outstanding balances past contractual due dates. Current collection efficiency is at ${collectionRate}%.`
      });
    } else {
      insights.push({
        type: 'finance',
        badge: 'Liquidity Healthy',
        color: 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        title: `${collectionRate}% Collection Cleared`,
        body: `${formatCurrency(fin.total_received)} collected out of ${formatCurrency(fin.total_receivable)} gross billed.`
      });
    }

    return insights;
  }, [crm, fin, followups, collectionRate]);

  // Current formatted date
  const currentDateFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date());
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[65vh]">
        <Cockpit3DLoader 
          variant="module"
          size="lg"
          text="Initializing AI Business Command Center..."
          subtitle="Synthesizing live pipeline, follow-ups, and financial telemetry"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* ========================================================= */}
      {/* 1. HERO AI BUSINESS COMMAND CENTER BANNER                  */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0D111A] shadow-lg dark:shadow-2xl transition-all">
        {/* Ambient background glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-rose-500/10 dark:bg-rose-500/[0.12] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/[0.08] rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-8 space-y-6">
          {/* Top Bar: Live AI Telemetry Pill & Date */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-[#D62839] dark:text-rose-400 text-xs font-bold shadow-2xs">
                <span className="ai-pulse-dot" />
                <span>AI Command Engine Active</span>
              </div>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentDateFormatted}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                Workspace: /{user?.tenant_slug || 'system'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                Tenant #{user?.tenant_id || 1}
              </span>
            </div>
          </div>

          {/* Main Hero Grid */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Welcome back, {user?.name || 'Executive'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                Your centralized AI command cockpit orchestrating multi-channel intake across <strong className="text-slate-900 dark:text-white">BNI Connect, KVV, and EAF</strong>, active client follow-ups, and cash flow velocity.
              </p>

              {/* Micro-telemetry chips */}
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <Globe className="w-3.5 h-3.5 text-[#D62839]" />
                  <span>{crm.total_leads} Centralized Leads</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{collectionRate}% Collection Rate</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <PhoneCall className="w-3.5 h-3.5 text-amber-500" />
                  <span>{followups.pending + followups.today} Action Reminders</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-300 hover:text-[#D62839] border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
                title="Refresh Live Data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setActiveTab('leads')}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-[#D62839] border border-slate-200 dark:border-slate-700 hover:border-rose-300 text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <Users2 className="w-4 h-4 text-[#D62839]" />
                <span>Centralized Leads ({crm.total_leads})</span>
              </button>

              <button
                onClick={() => setActiveTab('invoices')}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold transition-all shadow-md flex items-center gap-2 hover:opacity-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Invoice</span>
              </button>

              <button
                onClick={() => handleAskAI()}
                className="cockpit-btn-primary shadow-lg shadow-rose-500/25"
              >
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
                <span>Ask AI Agent</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. DYNAMIC PIPELINE SCOPE & FILTER BAR                     */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs text-xs">
        <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-bold">
          <Filter className="w-4 h-4 text-[#D62839]" />
          <span>Telemetry Scope Filter:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Source Filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            aria-label="Filter telemetry by lead source"
            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer shadow-2xs focus:outline-none focus:border-[#D62839]"
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
            aria-label="Filter telemetry by date range"
            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer shadow-2xs focus:outline-none focus:border-[#D62839]"
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
            aria-label="Filter telemetry by assignee"
            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer shadow-2xs focus:outline-none focus:border-[#D62839]"
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
      {/* 3. DISTINCTIVE ASYMMETRIC PREMIUM KPI CARDS               */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* KPI 1: Pipeline & Gross Revenue Volume (Red / Primary) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D111A] border border-rose-200/80 dark:border-rose-900/40 shadow-xs hover:shadow-xl transition-all duration-200 group relative overflow-hidden cockpit-card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Gross Pipeline Volume
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-[#D62839] dark:text-rose-400 group-hover:scale-105 transition-transform shadow-2xs">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {formatCurrency(crm.pipeline_value)}
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{crm.total_leads} Total Leads</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-slate-500 dark:text-slate-400 font-semibold truncate">
                +{crm.new_leads} fresh inquiries
              </span>
            </div>
          </div>

          {/* Inline SVG Sparkline */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <div className="w-24 h-6">
              <svg viewBox="0 0 100 24" className="w-full h-full text-rose-500 overflow-visible">
                <path
                  d="M0 20 L20 16 L40 18 L60 10 L80 12 L100 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <button
              onClick={() => setActiveTab('leads')}
              className="text-[11px] font-bold text-[#D62839] dark:text-rose-400 hover:underline cursor-pointer"
            >
              Inspect Leads →
            </button>
          </div>
        </div>

        {/* KPI 2: Collections & Cash Flow Liquidity (Emerald) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D111A] border border-emerald-200/80 dark:border-emerald-900/40 shadow-xs hover:shadow-xl transition-all duration-200 group relative overflow-hidden cockpit-card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Cash Flow Collections
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shadow-2xs">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {formatCurrency(fin.total_received)}
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {collectionRate}% Cleared
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-slate-500 dark:text-slate-400 font-semibold truncate">
                Pending: {formatCurrency(fin.pending_amount)}
              </span>
            </div>
          </div>

          {/* Mini Progress Arc */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mr-3">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${collectionRate}%` }} 
              />
            </div>
            <button
              onClick={() => setActiveTab('invoices')}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer shrink-0"
            >
              Invoices →
            </button>
          </div>
        </div>

        {/* KPI 3: Operational Follow-up Velocity (Amber / Warning Beacon) */}
        <div className={`p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D111A] border shadow-xs hover:shadow-xl transition-all duration-200 group relative overflow-hidden cockpit-card-hover ${
          followups.overdue > 0 
            ? 'border-rose-300 dark:border-rose-900/60' 
            : 'border-slate-200/90 dark:border-white/[0.08]'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Follow-up Operations
            </span>
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs ${
              followups.overdue > 0
                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400'
                : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900/60 text-amber-600 dark:text-amber-400'
            }`}>
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {followups.pending + followups.today}
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span className={`font-bold ${followups.overdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {followups.today} Due Today
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className={`font-semibold truncate ${followups.overdue > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                {followups.overdue > 0 ? `⚠️ ${followups.overdue} Overdue` : 'Zero Overdue'}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {followups.completed} touchpoints logged
            </span>
            <button
              onClick={() => setActiveTab('followups')}
              className="text-[11px] font-bold text-[#D62839] hover:underline cursor-pointer"
            >
              Open Agenda →
            </button>
          </div>
        </div>

        {/* KPI 4: Win Velocity & CRM Retention (Indigo) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D111A] border border-indigo-200/80 dark:border-indigo-900/40 shadow-xs hover:shadow-xl transition-all duration-200 group relative overflow-hidden cockpit-card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Lead Win Velocity
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform shadow-2xs">
              <Award className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {crm.conversion_rate}%
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {crm.won_leads} Won Accounts
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-slate-500 dark:text-slate-400 font-semibold truncate">
                {formatCurrency(crm.won_value)} closed
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {hrm.active_employees || employees.length || 0} active team members
            </span>
            <button
              onClick={() => setActiveTab('crm')}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              CRM Funnel →
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 4. PROMINENT AI BUSINESS INTELLIGENCE COMMAND CENTER       */}
      {/* ========================================================= */}
      <div className="rounded-3xl border border-rose-200/90 dark:border-white/[0.08] bg-gradient-to-br from-rose-50/60 via-white to-slate-50/80 dark:from-[#131826] dark:via-[#0D111A] dark:to-[#07090E] p-6 sm:p-8 shadow-md dark:shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#D62839] flex items-center justify-center text-white shadow-lg shadow-rose-500/30 shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Autonomous AI Business Intelligence
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-[#D62839] dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                    Live Telemetry
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time algorithmic synthesis derived from your active isolated tenant database
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('ai')}
              className="text-xs font-bold text-[#D62839] dark:text-rose-400 hover:underline flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
            >
              <span>Open Full AI Assistant</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 3 Live AI Synthesis Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiInsights.map((ins, idx) => (
              <div 
                key={idx}
                className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/[0.08] shadow-xs hover:border-[#D62839] transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ins.color}`}>
                    {ins.badge}
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#D62839] transition-colors" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  {ins.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                  {ins.body}
                </p>
              </div>
            ))}
          </div>

          {/* Interactive AI Prompt Launcher */}
          <div className="pt-2 space-y-3">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Executive AI Inquiries (Click to execute):
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleAskAI('Analyze conversion rates between BNI Connect and KVV leads')}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-[#D62839] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-[#D62839] dark:hover:text-rose-400 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                <span>"Compare BNI vs KVV lead conversion rates"</span>
              </button>

              <button
                onClick={() => handleAskAI('Draft follow-up action plan for overdue leads')}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-[#D62839] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-[#D62839] dark:hover:text-rose-400 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>"Draft follow-up plan for overdue leads"</span>
              </button>

              <button
                onClick={() => handleAskAI('Summarize outstanding receivable balances and collection efficiency')}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-[#D62839] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-[#D62839] dark:hover:text-rose-400 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                <span>"Summarize outstanding collections aging"</span>
              </button>
            </div>

            {/* Quick Ask Input Bar */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleAskAI();
              }}
              className="relative flex items-center mt-3"
            >
              <input
                type="text"
                value={quickPrompt}
                onChange={(e) => setQuickPrompt(e.target.value)}
                placeholder="Ask Cockpit AI anything about your pipeline, leads, or financial status..."
                aria-label="Quick AI prompt inquiry"
                className="w-full py-3 pl-4 pr-24 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.1] text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#D62839] shadow-inner"
              />
              <button
                type="submit"
                className="absolute right-1.5 px-3 py-2 rounded-xl bg-[#D62839] hover:bg-[#B91C2C] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Ask AI</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. INTERACTIVE ANALYTICS & CONVERSION FUNNEL               */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 Cols): Multi-Channel Lead Acquisition Donut */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs cockpit-card-hover flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-[#D62839] border border-rose-200 dark:border-rose-900/60">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Lead Acquisition by Channel
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Proportions and monetary pipeline across BNI, KVV, EAF, SEO, and manual intake
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('integrations')}
                className="text-xs font-bold text-[#D62839] dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Sync Hub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Split Donut & Breakdown List */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center my-3">
              {/* SVG Donut */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center relative">
                <div className="relative w-44 h-44">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {/* Background Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      className="text-slate-100 dark:text-slate-800/80"
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

                  {/* Centered Readout */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-3xl font-black text-slate-900 dark:text-white font-mono leading-none">
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
                      className={`p-3 rounded-2xl border transition-all duration-180 cursor-pointer ${
                        isHovered 
                          ? 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60' 
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                          <span>{s.source}</span>
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {s.count} ({s.percentage}%)
                        </span>
                      </div>

                      {/* Progress Track */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full ${color.bg}`} 
                          style={{ width: `${Math.min(100, Math.max(5, s.percentage))}%` }} 
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        <span>Converted: <strong className="text-emerald-600 dark:text-emerald-400">{s.won_count}</strong></span>
                        <span className="font-mono font-bold">{formatCurrency(s.total_value)}</span>
                      </div>
                    </div>
                  );
                })}

                {(!crm.leads_by_source || crm.leads_by_source.length === 0) && (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No lead source distribution data recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Overall Conversion Rate: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{crm.conversion_rate}%</strong></span>
            <span>Unscheduled Next Actions: <strong className="text-amber-600 dark:text-amber-400 font-bold">{crm.leads_without_followup}</strong></span>
          </div>
        </div>

        {/* Right Column (5 Cols): Pipeline Conversion Funnel & Collections */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Visual Pipeline Funnel */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs cockpit-card-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Pipeline Conversion Funnel
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Stages from intake to won retention</p>
                </div>
              </div>

              <span className="text-xs font-mono font-bold text-[#D62839]">
                {crm.conversion_rate}% Win Rate
              </span>
            </div>

            {/* Funnel Stages */}
            <div className="space-y-3 pt-2">
              {/* Stage 1: Inquiries */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">1. Total Lead Inquiries</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{crm.total_leads}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full w-full" />
                </div>
              </div>

              {/* Stage 2: Active Pipeline */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">2. Active Pipeline (Non-lost)</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{Math.max(0, crm.total_leads - crm.lost_leads)}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full rounded-full" 
                    style={{ width: `${crm.total_leads > 0 ? Math.round(((crm.total_leads - crm.lost_leads) / crm.total_leads) * 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Stage 3: Follow-ups Scheduled */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">3. Client Touchpoints Scheduled</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{followups.pending + followups.today}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full" 
                    style={{ width: `${crm.total_leads > 0 ? Math.min(100, Math.round(((followups.pending + followups.today) / crm.total_leads) * 100)) : 0}%` }}
                  />
                </div>
              </div>

              {/* Stage 4: Won Deals */}
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">4. Won Accounts Closed</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{crm.won_leads}</span>
                </div>
                <div className="w-full bg-emerald-200 dark:bg-emerald-900/60 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full" 
                    style={{ width: `${Math.min(100, Math.max(4, crm.conversion_rate))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Financial Liquidity & Aging Gauge */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs cockpit-card-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Liquidity & Collections Aging
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Invoiced liquidity and past due breakdown</p>
                </div>
              </div>

              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {collectionRate}% Efficiency
              </span>
            </div>

            {/* Segmented Flow */}
            <div className="space-y-3">
              <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex p-0.5 gap-0.5">
                <div 
                  className="bg-emerald-500 h-full rounded-lg transition-all duration-500" 
                  style={{ width: `${financialDistribution.receivedPct}%` }}
                />
                <div 
                  className="bg-amber-500 h-full rounded-lg transition-all duration-500" 
                  style={{ width: `${financialDistribution.pendingPct}%` }}
                />
                <div 
                  className="bg-rose-500 h-full rounded-lg transition-all duration-500" 
                  style={{ width: `${financialDistribution.overduePct}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">Cleared</span>
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {formatCurrency(fin.total_received)}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">Pending</span>
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {formatCurrency(fin.pending_amount)}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl border ${
                  fin.overdue_amount > 0 ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200'
                }`}>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${
                    fin.overdue_amount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                  }`}>Overdue</span>
                  <p className={`text-xs sm:text-sm font-black font-mono mt-0.5 ${
                    fin.overdue_amount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                  }`}>
                    {formatCurrency(fin.overdue_amount)}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ========================================================= */}
      {/* 6. OPERATIONAL CENTER (ACTION QUEUE & AGENDAS)             */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 Cols): Actionable Follow-up Queue */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs cockpit-card-hover">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-[#D62839] border border-rose-200 dark:border-rose-900/60">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Actionable Follow-up Queue
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live scheduled touchpoints with click-to-contact actions
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('followups')}
                className="text-xs font-bold text-[#D62839] dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>All Reminders</span>
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
                      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-180 ${
                        isOverdue 
                          ? 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/50' 
                          : isToday 
                            ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50' 
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs shrink-0 shadow-2xs">
                          {f.contact_name?.charAt(0) || 'C'}
                        </div>

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
                            Contact: <strong className="text-slate-900 dark:text-white font-semibold">{f.contact_name}</strong> {f.contact_company ? `(${f.contact_company})` : ''}
                          </p>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                            <span>
                              {new Date(f.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(f.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Direct Click to Action */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {f.contact_phone && (
                          <a
                            href={`tel:${f.contact_phone}`}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer shadow-2xs"
                            title={`Call ${f.contact_phone}`}
                          >
                            <PhoneCall className="w-4 h-4" />
                          </a>
                        )}

                        {f.contact_phone && (
                          <a
                            href={`https://wa.me/${f.contact_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${f.contact_name}, connecting regarding ${f.title}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer shadow-2xs"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                        )}

                        <button
                          onClick={() => setActiveTab('followups')}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#D62839] text-slate-800 dark:text-slate-200 hover:text-[#D62839] text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          Resolve →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500 flex flex-col items-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-80" />
                <p>Follow-up queue is completely cleared! All scheduled client touches are resolved.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 Cols): Priority Tasks & Schedule Hub */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Priority Tasks Widget */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs cockpit-card-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Priority Tasks
                </h3>
              </div>

              <button
                onClick={() => setActiveTab('tasks')}
                className="text-xs font-bold text-[#D62839] dark:text-rose-400 hover:underline cursor-pointer"
              >
                All Tasks ({priorityTasks.length}) →
              </button>
            </div>

            {priorityTasks.length > 0 ? (
              <div className="space-y-2.5">
                {priorityTasks.slice(0, 4).map((task: any) => {
                  const isUrgent = task.priority === 'urgent';
                  const isHigh = task.priority === 'high';

                  return (
                    <div 
                      key={task.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isUrgent ? 'bg-rose-500 animate-pulse' : isHigh ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                          isUrgent 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400' 
                            : isHigh 
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                No active priority tasks found.
              </div>
            )}
          </div>

          {/* Today's Meetings & Agenda */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs cockpit-card-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/60">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Today's Calendar Agenda
                </h3>
              </div>

              <button
                onClick={() => setActiveTab('calendar')}
                className="text-xs font-bold text-[#D62839] dark:text-rose-400 hover:underline cursor-pointer"
              >
                Calendar →
              </button>
            </div>

            {todayMeetings.length > 0 ? (
              <div className="space-y-2.5">
                {todayMeetings.map((meet: any) => (
                  <div 
                    key={meet.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {meet.title}
                      </p>
                      {meet.location && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {meet.location}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 shrink-0">
                      {new Date(meet.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-5 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span>No meetings scheduled on your calendar for today.</span>
                <button
                  onClick={() => setActiveTab('calendar')}
                  className="text-xs font-bold text-[#D62839] dark:text-rose-400 hover:underline cursor-pointer"
                >
                  + Add Event
                </button>
              </div>
            )}
          </div>

          {/* Recent Audit Trail Stream */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs cockpit-card-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Lead Activity Audit Trail
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Real-time</span>
            </div>

            {recentActivities.length > 0 ? (
              <div className="space-y-2.5">
                {recentActivities.slice(0, 4).map((act: any) => (
                  <div 
                    key={act.id} 
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/[0.06] text-xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                          {act.lead_name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-md bg-rose-50 dark:bg-rose-950/60 text-[#D62839] dark:text-rose-400 text-[9px] uppercase font-mono font-bold">
                          {act.activity_type}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
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
              <div className="py-6 text-center text-xs text-slate-400">
                No recent activity events logged.
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};
