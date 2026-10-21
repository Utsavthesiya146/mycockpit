import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import type { Customer, Lead } from '../types';

export const CRM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'customers' | 'leads'>('leads');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  // New Customer Form
  const [custName, setCustName] = useState('');
  const [custCompany, setCustCompany] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custCity, setCustCity] = useState('');
  const [custTaxId, setCustTaxId] = useState('');

  // New Lead Form
  const [leadName, setLeadName] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadValue, setLeadValue] = useState<number>(100000);
  const [leadSource, setLeadSource] = useState('Direct Referral');
  const [leadStatus, setLeadStatus] = useState<Lead['status']>('new');

  const fetchData = async () => {
    try {
      const [cData, lData]: any = await Promise.all([
        api.get('/crm/customers'),
        api.get('/crm/leads')
      ]);
      setCustomers(cData);
      setLeads(lData);
    } catch (err) {
      console.error('Failed to load CRM data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating customer');
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/crm/leads', {
        name: leadName,
        company: leadCompany,
        value: leadValue,
        source: leadSource,
        status: leadStatus
      });
      setIsLeadModalOpen(false);
      setLeadName('');
      setLeadCompany('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating lead');
    }
  };

  const handleLeadStatusChange = async (leadId: number, newStatus: string) => {
    try {
      await api.post(`/crm/leads/${leadId}/status`, { status: newStatus });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const pipelineStages: { id: Lead['status']; label: string; headerColor: string }[] = [
    { id: 'new', label: 'New Inquiries', headerColor: 'text-[#0284C7]' },
    { id: 'contacted', label: 'Contacted', headerColor: 'text-[#4667E8]' },
    { id: 'qualified', label: 'Qualified', headerColor: 'text-[#8B5CF6]' },
    { id: 'proposal', label: 'Proposal Sent', headerColor: 'text-[#D97706]' },
    { id: 'won', label: 'Won / Closed', headerColor: 'text-[#0F9D92]' },
  ];

  return (
    <div className="space-y-6">
      {/* Subnav & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E5EAF1] rounded-xl text-xs font-semibold shadow-2xs">
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2 rounded-lg transition-all duration-180 cursor-pointer ${
              activeTab === 'leads' ? 'bg-[#4667E8] text-white shadow-xs font-bold' : 'text-[#64748B] hover:text-[#172033]'
            }`}
          >
            Sales Pipeline ({leads.length})
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2 rounded-lg transition-all duration-180 cursor-pointer ${
              activeTab === 'customers' ? 'bg-[#4667E8] text-white shadow-xs font-bold' : 'text-[#64748B] hover:text-[#172033]'
            }`}
          >
            Customers Directory ({customers.length})
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter records..."
              className="cockpit-input pl-9 pr-3 py-1.5 text-xs w-48 sm:w-64"
            />
          </div>

          {activeTab === 'leads' ? (
            <button
              onClick={() => setIsLeadModalOpen(true)}
              className="cockpit-btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lead</span>
            </button>
          ) : (
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="cockpit-btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* SALES PIPELINE KANBAN VIEW */}
      {activeTab === 'leads' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {pipelineStages.map((stage) => {
            const stageLeads = leads.filter(l => l.status === stage.id && 
              (l.name.toLowerCase().includes(search.toLowerCase()) || (l.company || '').toLowerCase().includes(search.toLowerCase()))
            );
            const stageTotal = stageLeads.reduce((sum, l) => sum + Number(l.value), 0);

            return (
              <div key={stage.id} className="min-w-[260px] bg-white rounded-2xl border border-[#E5EAF1] p-3.5 flex flex-col shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E5EAF1]">
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${stage.headerColor}`}>{stage.label}</h3>
                    <p className="text-[11px] font-mono text-[#172033] font-bold mt-0.5">{formatCurrency(stageTotal)}</p>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-[#F1F5F9] text-[11px] font-bold text-[#64748B] flex items-center justify-center">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[65vh]">
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E5EAF1] hover:border-[#CBD5E1] hover:shadow-xs transition-all duration-180">
                      <h4 className="text-sm font-bold text-[#172033] tracking-tight">{lead.name}</h4>
                      {lead.company && <p className="text-xs text-[#64748B] mt-0.5">{lead.company}</p>}
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#E5EAF1] text-xs">
                        <span className="font-mono font-bold text-[#0F9D92]">{formatCurrency(Number(lead.value))}</span>
                        <select
                          value={lead.status}
                          onChange={(e) => handleLeadStatusChange(lead.id, e.target.value)}
                          className="bg-white text-[11px] text-[#475569] border border-[#E5EAF1] rounded-lg px-2 py-0.5 focus:outline-none focus:border-[#4667E8]"
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
                    <div className="text-center py-8 text-[11px] text-[#94A3B8] border border-dashed border-[#E5EAF1] rounded-xl bg-[#F8FAFC]/50">
                      Empty stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CUSTOMERS DIRECTORY TABLE */}
      {activeTab === 'customers' && (
        <div className="rounded-2xl bg-white border border-[#E5EAF1] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#172033]">
              <thead className="bg-[#F8FAFC] text-xs uppercase font-bold text-[#64748B] border-b border-[#E5EAF1]">
                <tr>
                  <th className="px-6 py-4">Client Contact</th>
                  <th className="px-6 py-4">Company Organization</th>
                  <th className="px-6 py-4">Contact Details</th>
                  <th className="px-6 py-4">Region / City</th>
                  <th className="px-6 py-4">GST / Tax ID</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF1]">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-6 py-4 font-bold text-[#172033]">
                      {c.name}
                    </td>
                    <td className="px-6 py-4 text-[#475569] font-medium">
                      {c.company || '—'}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      <p className="text-[#172033] font-medium">{c.email || 'No email'}</p>
                      <p className="text-[#64748B]">{c.phone || 'No phone'}</p>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#64748B]">
                      {c.city || 'India'}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-[#64748B]">
                      {c.tax_id || '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge status={c.status} />
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[#94A3B8] text-sm">
                      No customers found. Click "Add Customer" to register one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE CUSTOMER MODAL */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Add Customer Organization"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
              Contact Full Name
            </label>
            <input
              type="text"
              required
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              placeholder="e.g. Ramesh Patel"
              className="cockpit-input"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
              Company Name
            </label>
            <input
              type="text"
              value={custCompany}
              onChange={(e) => setCustCompany(e.target.value)}
              placeholder="e.g. TechCorp Solutions Ltd"
              className="cockpit-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={custEmail}
                onChange={(e) => setCustEmail(e.target.value)}
                placeholder="contact@company.com"
                className="cockpit-input"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                Phone
              </label>
              <input
                type="text"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="cockpit-input font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                City / Region
              </label>
              <input
                type="text"
                value={custCity}
                onChange={(e) => setCustCity(e.target.value)}
                placeholder="Mumbai"
                className="cockpit-input"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                GST / Tax ID
              </label>
              <input
                type="text"
                value={custTaxId}
                onChange={(e) => setCustTaxId(e.target.value)}
                placeholder="27AABCT1234A1Z5"
                className="cockpit-input font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5EAF1]">
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              className="cockpit-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              Save Customer
            </button>
          </div>
        </form>
      </Modal>

      {/* CREATE LEAD MODAL */}
      <Modal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        title="Add Pipeline Lead"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
              Opportunity Title
            </label>
            <input
              type="text"
              required
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              placeholder="e.g. Enterprise Cloud Integration"
              className="cockpit-input"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
              Company
            </label>
            <input
              type="text"
              value={leadCompany}
              onChange={(e) => setLeadCompany(e.target.value)}
              placeholder="e.g. Wipro Digital"
              className="cockpit-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                Deal Value (₹)
              </label>
              <input
                type="number"
                min="0"
                required
                value={leadValue}
                onChange={(e) => setLeadValue(Number(e.target.value))}
                className="cockpit-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                Initial Stage
              </label>
              <select
                value={leadStatus}
                onChange={(e) => setLeadStatus(e.target.value as any)}
                className="cockpit-input"
              >
                <option value="new">New Inquiry</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="proposal">Proposal Sent</option>
                <option value="won">Won / Closed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
              Lead Source
            </label>
            <input
              type="text"
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
              placeholder="e.g. BNI Connect, Inbound, Direct"
              className="cockpit-input"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5EAF1]">
            <button
              type="button"
              onClick={() => setIsLeadModalOpen(false)}
              className="cockpit-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              Save Pipeline Lead
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
