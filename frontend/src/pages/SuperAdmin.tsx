import React, { useState, useEffect } from 'react';
import { ShieldAlert, Building, Users, CreditCard, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { MetricCard } from '../components/common/MetricCard';
import type { Tenant } from '../types';

export const SuperAdmin: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = async () => {
    try {
      const data: any = await api.get('/tenants');
      setTenants(data);
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const totalInvoicedAll = tenants.reduce((sum, t) => sum + Number(t.total_invoiced || 0), 0);
  const totalUsersAll = tenants.reduce((sum, t) => sum + Number(t.user_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Super Admin Notice Banner */}
      <div className="p-6 rounded-3xl bg-white border border-[#E5EAF1] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEF2FF] text-[#4667E8] text-xs font-semibold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Root Super Administrator Governance</span>
          </div>
          <h2 className="text-2xl font-bold text-[#172033] tracking-tight">Multi-Tenant Fleet Management</h2>
          <p className="text-sm text-[#64748B] max-w-xl mt-1">
            Centrally oversee, monitor and manage active and suspended client tenant workspaces across your SaaS infrastructure.
          </p>
        </div>

        <button
          onClick={fetchTenants}
          className="p-2.5 rounded-xl bg-[#F8FAFC] text-[#64748B] border border-[#E5EAF1] hover:text-[#172033] hover:border-[#4667E8] transition-colors self-start md:self-center"
          title="Refresh Fleet Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Aggregated Fleet Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Organizations"
          value={tenants.length}
          subtitle="Provisioned tenants"
          icon={Building}
          colorScheme="indigo"
        />
        <MetricCard
          title="Total Fleet Users"
          value={totalUsersAll}
          subtitle="Active team credentials"
          icon={Users}
          colorScheme="emerald"
        />
        <MetricCard
          title="System Gross Volume"
          value={formatCurrency(totalInvoicedAll)}
          subtitle="All tenant invoices sum"
          icon={CreditCard}
          colorScheme="amber"
        />
      </div>

      {/* Tenants Table */}
      <div className="rounded-2xl bg-white border border-[#E5EAF1] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#172033]">
            <thead className="bg-[#F8FAFC] text-xs uppercase font-semibold text-[#64748B] border-b border-[#E5EAF1]">
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
            <tbody className="divide-y divide-[#E5EAF1]">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-6 py-4 font-bold text-[#172033]">
                    {t.name}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-[#4667E8]">
                    /{t.slug}
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-[#64748B]">
                    {t.user_count}
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-[#64748B]">
                    {t.customer_count}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-[#172033]">
                    {formatCurrency(Number(t.total_invoiced))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge status={t.status} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleStatusToggle(t.id, t.status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        t.status === 'active'
                          ? 'bg-[#FFF1ED] text-[#F07865] hover:bg-[#F07865] hover:text-white border border-[#F07865]/20'
                          : 'bg-[#E8F8F5] text-[#0F9D92] hover:bg-[#0F9D92] hover:text-white border border-[#0F9D92]/20'
                      }`}
                    >
                      {t.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default SuperAdmin;
