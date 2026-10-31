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
      <div className="p-6 rounded-3xl bg-white border border-[#E9EAEE] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3] text-xs font-semibold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Root Super Administrator Governance</span>
          </div>
          <h2 className="text-2xl font-bold text-[#20242C] tracking-tight">Multi-Tenant Fleet Management</h2>
          <p className="text-sm text-[#667085] max-w-xl mt-1">
            Centrally oversee, monitor and manage active and suspended client tenant workspaces across your SaaS infrastructure.
          </p>
        </div>

        <button
          onClick={fetchTenants}
          className="p-2.5 rounded-xl bg-white text-[#667085] border border-[#E9EAEE] hover:text-[#D62839] hover:border-[#FECDD3] hover:bg-[#FFF1F2] transition-colors self-start md:self-center cursor-pointer shadow-2xs"
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
          colorScheme="red"
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

      {/* Tenants Surface */}
      <div className="rounded-2xl bg-white border border-[#E9EAEE] shadow-xs overflow-hidden">
        {/* Mobile Cards */}
        <div className="sm:hidden divide-y divide-[#E9EAEE]">
          {tenants.map((t) => (
            <div key={t.id} className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#20242C]">{t.name}</h4>
                  <span className="font-mono text-xs text-[#D62839]">/{t.slug}</span>
                </div>
                <Badge status={t.status} />
              </div>
              <div className="flex justify-between items-center text-xs text-[#667085] pt-1">
                <span>{t.user_count} Users • {t.customer_count} Customers</span>
                <span className="font-mono font-bold text-[#20242C]">{formatCurrency(Number(t.total_invoiced))}</span>
              </div>
              <div className="pt-2 border-t border-[#E9EAEE] flex justify-end">
                <button
                  onClick={() => handleStatusToggle(t.id, t.status)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    t.status === 'active'
                      ? 'bg-[#FEF2F2] text-[#DC2626] hover:bg-[#DC2626] hover:text-white border border-[#FECDD3]'
                      : 'bg-[#ECFDF5] text-[#059669] hover:bg-[#059669] hover:text-white border border-[#A7F3D0]'
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
          <table className="w-full text-left text-sm text-[#20242C]">
            <thead className="bg-[#F8FAFC] text-xs uppercase font-semibold text-[#667085] border-b border-[#E9EAEE]">
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
            <tbody className="divide-y divide-[#E9EAEE]">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-[#FFF1F2]/25 transition-colors">
                  <td className="px-6 py-4 font-bold text-[#20242C]">
                    {t.name}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-[#D62839]">
                    /{t.slug}
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-[#667085]">
                    {t.user_count}
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-[#667085]">
                    {t.customer_count}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-[#20242C]">
                    {formatCurrency(Number(t.total_invoiced))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge status={t.status} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleStatusToggle(t.id, t.status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        t.status === 'active'
                          ? 'bg-[#FEF2F2] text-[#DC2626] hover:bg-[#DC2626] hover:text-white border border-[#FECDD3]'
                          : 'bg-[#ECFDF5] text-[#059669] hover:bg-[#059669] hover:text-white border border-[#A7F3D0]'
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
