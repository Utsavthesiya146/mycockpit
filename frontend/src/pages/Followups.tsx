import React, { useState, useEffect } from 'react';
import { PhoneCall, Plus, Clock, User, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import type { Followup, Customer } from '../types';

export const Followups: React.FC = () => {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState<number>(0);
  const [scheduledAt, setScheduledAt] = useState(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    try {
      const [fData, cData]: any = await Promise.all([
        api.get('/followups'),
        api.get('/crm/customers')
      ]);
      setFollowups(fData);
      setCustomers(cData);
      if (cData.length > 0 && !customerId) {
        setCustomerId(cData[0].id);
      }
    } catch (err) {
      console.error('Failed to load follow-ups', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/followups', {
        title,
        customer_id: customerId || null,
        scheduled_at: scheduledAt,
        notes
      });
      setIsModalOpen(false);
      setTitle('');
      setNotes('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating follow-up');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#172033] tracking-tight">Customer Follow-ups & Reminders</h2>
          <p className="text-sm text-[#64748B] mt-0.5">
            Maintain customer relationships, track payment confirmations, and never miss a renewal deadline
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="cockpit-btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#4667E8] text-white text-sm font-semibold shadow-sm hover:bg-[#3b5bd6] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Follow-up</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {followups.map((f) => {
          const isDone = f.status === 'completed';
          const isOverdue = f.calculated_status === 'overdue' && !isDone;

          return (
            <div 
              key={f.id}
              className={`p-5 rounded-2xl border transition-all ${
                isDone 
                  ? 'bg-[#F8FAFC]/70 border-[#E5EAF1] opacity-75' 
                  : isOverdue 
                    ? 'bg-[#FFF1ED]/40 border-[#F07865]/40 shadow-sm' 
                    : 'bg-white border-[#E5EAF1] shadow-sm hover:border-[#4667E8]/40 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    isOverdue 
                      ? 'bg-[#FFF1ED] text-[#F07865] border border-[#F07865]/20' 
                      : 'bg-[#EEF2FF] text-[#4667E8]'
                  }`}>
                    {isOverdue ? <AlertTriangle className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className={`text-base font-bold tracking-tight ${isDone ? 'line-through text-[#94A3B8]' : 'text-[#172033]'}`}>
                      {f.title}
                    </h3>
                    <p className="text-xs font-semibold text-[#4667E8] mt-0.5">
                      Client: {f.customer_name || f.lead_name || 'General Account'}
                    </p>
                    {f.notes && <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">{f.notes}</p>}
                    <p className="text-xs text-[#64748B] font-medium mt-2.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#4667E8]" />
                      Scheduled: {new Date(f.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(f.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <Badge status={f.calculated_status || f.status} />
              </div>

              <div className="mt-4 pt-3.5 border-t border-[#E5EAF1] flex items-center justify-between">
                <span className="text-xs text-[#64748B]">
                  {isDone ? 'Task resolved' : isOverdue ? 'Action required immediately' : 'Pending touchpoint'}
                </span>
                <button
                  onClick={() => handleToggle(f)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isDone 
                      ? 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E5EAF1] hover:text-[#172033]' 
                      : 'bg-[#E8F8F5] text-[#0F9D92] hover:bg-[#0F9D92] hover:text-white border border-[#0F9D92]/20'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isDone ? 'Mark Incomplete' : 'Mark Completed'}</span>
                </button>
              </div>
            </div>
          );
        })}

        {followups.length === 0 && (
          <div className="col-span-2 p-16 text-center rounded-2xl bg-white border border-[#E5EAF1] shadow-sm">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#EEF2FF] text-[#4667E8] flex items-center justify-center mb-3">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-[#172033]">No pending follow-ups</h4>
            <p className="text-sm text-[#64748B] mt-1 max-w-sm mx-auto">
              Schedule reminders to check in with leads, confirm contract renewals, or collect payment receipts.
            </p>
          </div>
        )}
      </div>

      {/* CREATE FOLLOWUP MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Follow-up Reminder"
      >
        <form onSubmit={handleCreateFollowup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Follow-up Objective
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Confirm wire transfer status for INV-UTS-001"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Related Customer
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.company || 'Direct'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Scheduled Date & Time
            </label>
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Notes / Context
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key talking points or prior agreements"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5EAF1]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:text-[#172033] text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary px-5 py-2 rounded-xl bg-[#4667E8] text-white text-sm font-semibold shadow-sm hover:bg-[#3b5bd6] transition-all"
            >
              Save Follow-up
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default Followups;
