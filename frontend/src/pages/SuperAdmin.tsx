import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, Building, Users, CreditCard, RefreshCw, Activity, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { MetricCard } from '../components/common/MetricCard';
import { EmptyState } from '../components/common/EmptyState';
import { formatCurrency } from '../utils/formatters';
import type { Tenant } from '../types';

export const SuperAdmin: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = async () => {
    try {
      const data: any = await api.get('/tenants');
      setTenants(data || []);
    } catch (err) {
      console.error('Failed to load tenants', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleStatusToggle = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await api.post(`/tenants/${id}/status`, { status: nextStatus });
      fetchTenants();
    } catch (err: any) {
      alert(err.message || 'Error updating tenant status');
    }
  };

  const totalInvoicedAll = useMemo(() => {
    return tenants.reduce((sum, t) => sum + Number(t.total_invoiced || 0), 0);
  }, [tenants]);

  const totalUsersAll = useMemo(() => {
    return tenants.reduce((sum, t) => sum + Number(t.user_count || 0), 0);
  }, [tenants]);

  const activeTenantsCount = useMemo(() => {
    return tenants.filter(t => t.status === 'active').length;
  }, [tenants]);

  return (
    <div className="space-y-6">
      {/* Super Admin Notice Banner */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Root Super Administrator Governance</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Multi-Tenant Fleet Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mt-1">
            Centrally oversee, monitor and manage active and suspended client tenant workspaces across your SaaS infrastructure.
          </p>
        </div>

        <button
          onClick={fetchTenants}
          className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-white/[0.08] hover:text-[#D62839] hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors self-start md:self-center cursor-pointer shadow-xs"
          title="Refresh Fleet Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Aggregated Fleet Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Organizations"
          value={tenants.length}
          subtitle={`${activeTenantsCount} active tenant workspaces`}
          icon={Building}
          colorScheme="red"
        />
        <MetricCard
          title="Total Fleet Users"
          value={totalUsersAll}
          subtitle="Provisioned employee credentials"
          icon={Users}
          colorScheme="emerald"
        />
        <MetricCard
          title="System Gross Volume"
          value={formatCurrency(totalInvoicedAll)}
          subtitle="Aggregate invoice billing volume"
          icon={CreditCard}
          colorScheme="amber"
        />
      </div>

      {/* Tenants Surface */}
      <div className="rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs overflow-hidden">
        {/* Mobile Cards */}
        <div className="sm:hidden divide-y divide-slate-200/80 dark:divide-white/[0.06]">
          {tenants.map((t) => (
            <div key={t.id} className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t.name}</h4>
                  <span className="font-mono text-xs text-[#D62839] dark:text-rose-400">/{t.slug}</span>
                </div>
                <Badge status={t.status} />
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span>{t.user_count} Users • {t.customer_count} Customers</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(Number(t.total_invoiced))}</span>
              </div>
              <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.06] flex justify-end">
                <button
                  onClick={() => handleStatusToggle(t.id, t.status)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    t.status === 'active'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-200 dark:border-rose-900/50'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-900/50'
                  }`}
                >
                  {t.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-900 dark:text-white">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200/90 dark:border-white/[0.08]">
              <tr>
                <th className="px-6 py-4">Tenant Organization</th>
                <th className="px-6 py-4">URL Route</th>
                <th className="px-6 py-4 text-center">Users</th>
                <th className="px-6 py-4 text-center">Customers</th>
                <th className="px-6 py-4 text-right">Total Invoiced</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-white/[0.06]">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                    {t.name}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-[#D62839] dark:text-rose-400">
                    /{t.slug}
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-slate-500 dark:text-slate-400">
                    {t.user_count}
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-slate-500 dark:text-slate-400">
                    {t.customer_count}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(Number(t.total_invoiced))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge status={t.status} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleStatusToggle(t.id, t.status)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        t.status === 'active'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-200 dark:border-rose-900/50'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-900/50'
                      }`}
                    >
                      {t.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8">
                    <EmptyState
                      icon={Building}
                      title="No tenant organizations registered yet"
                      description="Once client organizations register or are provisioned, their telemetry, user counts, and billing volume will be centralized here."
                      secondaryAction={{
                        label: "Refresh Fleet Data",
                        onClick: fetchTenants,
                        icon: RefreshCw
                      }}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default SuperAdmin;
