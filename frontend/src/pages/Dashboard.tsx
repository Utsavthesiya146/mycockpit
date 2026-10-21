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
  Building,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';
import type { NavTab } from '../components/layout/Sidebar';

interface DashboardProps {
  setActiveTab: (tab: NavTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const { user, tenant } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const res: any = await api.get('/dashboard/stats');
      setData(res);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user?.tenant_id]);

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
          <div className="w-10 h-10 border-3 border-[#EEF2FF] border-t-[#4667E8] rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#64748B]">Synthesizing live business telemetry...</p>
        </div>
      </div>
    );
  }

  const fin = data?.financial || { total_receivable: 0, total_received: 0, pending_amount: 0, overdue_amount: 0 };
  const collectionRate = fin.total_receivable > 0 
    ? Math.round((fin.total_received / fin.total_receivable) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome & Context Banner */}
      <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#E8F8F5] border border-[#B2EBE4] text-[#0F9D92] text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#0F9D92] animate-pulse" />
            <span>Active Node: {tenant?.name || 'My Organization'}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-[#172033] tracking-tight">
            Welcome back, {user?.name}
          </h2>
          <p className="text-sm text-[#64748B] max-w-xl">
            Here is your live operations briefing, financial collections progress, and upcoming action items.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#172033] border border-[#E5EAF1] transition-all duration-180 shadow-2xs cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
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

      {/* Financial KPI Metrics Cards (Accurate MySQL Totals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Receivable"
          value={formatCurrency(fin.total_receivable)}
          subtitle="Gross invoices billed"
          icon={CreditCard}
          colorScheme="indigo"
          trend={`${data?.crm?.customer_count || 0} Accounts`}
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
          colorScheme="rose"
          trend={fin.overdue_amount > 0 ? "Requires Follow-up" : "Zero Overdue"}
          trendUp={fin.overdue_amount === 0}
        />
      </div>

      {/* Main Grid: Schedule & Tasks & CRM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Schedule & Priorities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Meetings Widget */}
          <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#EEF2FF] text-[#4667E8] border border-[#E0E7FF]">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172033] tracking-tight">Today's Schedule</h3>
                  <p className="text-xs text-[#64748B]">Client meetings and conference appointments</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('calendar')}
                className="text-xs text-[#4667E8] hover:text-[#3855D4] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Full Calendar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {data?.today_meetings?.length > 0 ? (
              <div className="space-y-2.5">
                {data.today_meetings.map((m: any) => (
                  <div key={m.id} className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E5EAF1] flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#172033]">{m.title}</h4>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        {new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {m.location_or_url || 'Office Meeting Room'}
                      </p>
                    </div>
                    <Badge status={m.event_type} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[#94A3B8] text-xs">
                No meetings scheduled for today. Your day is open for focused execution.
              </div>
            )}
          </div>

          {/* Priority Action Tasks Widget */}
          <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#EEF2FF] text-[#4667E8] border border-[#E0E7FF]">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172033] tracking-tight">Priority Action Items</h3>
                  <p className="text-xs text-[#64748B]">Immediate deliverables and milestones</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('tasks')}
                className="text-xs text-[#4667E8] hover:text-[#3855D4] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>All Tasks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {data?.priority_tasks?.length > 0 ? (
              <div className="space-y-2.5">
                {data.priority_tasks.map((t: any) => (
                  <div key={t.id} className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E5EAF1] flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#172033]">{t.title}</h4>
                      <p className="text-xs text-[#64748B] mt-0.5">Due date: {t.due_date || 'Ongoing'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status={t.priority} />
                      <Badge status={t.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[#94A3B8] text-xs">
                All priority tasks completed. Outstanding work is up to date.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Assistant Card & Pending Follow-ups */}
        <div className="space-y-6">
          {/* AI Copilot Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#EEF2FF] via-white to-white border border-[#C7D2FE] shadow-xs relative overflow-hidden">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#4667E8] flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#172033]">Personal AI Copilot</h3>
                <p className="text-[11px] text-[#64748B]">Instant database intelligence</p>
              </div>
            </div>
            <p className="text-xs text-[#475569] leading-relaxed mb-4">
              "What is my pending payment amount?" or "Which customers need follow-up?"
            </p>
            <button
              onClick={() => setActiveTab('ai')}
              className="w-full py-2.5 rounded-xl bg-[#4667E8] hover:bg-[#3855D4] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all duration-180 cursor-pointer"
            >
              <span>Launch AI Conversation</span>
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pending Follow-ups Widget */}
          <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#172033] tracking-tight">Pending Follow-ups</h3>
              <button 
                onClick={() => setActiveTab('followups')}
                className="text-xs text-[#4667E8] hover:text-[#3855D4] font-semibold cursor-pointer"
              >
                View All →
              </button>
            </div>

            {data?.pending_followups?.length > 0 ? (
              <div className="space-y-3">
                {data.pending_followups.map((f: any) => (
                  <div key={f.id} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5EAF1]">
                    <p className="text-xs font-bold text-[#172033]">{f.title}</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Client: <span className="text-[#4667E8] font-semibold">{f.customer_name || 'General Lead'}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-[#94A3B8] text-xs">
                No pending customer follow-ups.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
