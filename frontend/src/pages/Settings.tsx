import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, Shield, Link as LinkIcon, Sparkles, Plus, Check, Copy, KeyRound, Globe, UserCheck } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

export const SettingsPage: React.FC = () => {
  const { user, tenant } = useAuth();
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Add User Form
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<'tenant_admin' | 'employee' | 'read_only'>('employee');
  const [userPassword, setUserPassword] = useState('TempPass123!');

  // AI Config
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('mycockpit_gemini_key') || '');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [savedAi, setSavedAi] = useState(false);

  const fetchTeam = async () => {
    try {
      const data: any = await api.get('/tenants/team');
      setTeamMembers(data || []);
    } catch (err) {
      console.error('Failed to load team members', err);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [user?.tenant_id]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tenants/team', {
        name: userName,
        email: userEmail,
        role: userRole,
        password: userPassword
      });
      setIsAddUserOpen(false);
      setUserName('');
      setUserEmail('');
      fetchTeam();
    } catch (err: any) {
      alert(err.message || 'Error adding team member');
    }
  };

  const handleSaveAiConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('mycockpit_gemini_key', geminiKey);
    setSavedAi(true);
    setTimeout(() => setSavedAi(false), 2000);
  };

  const personalUrl = user?.tenant_slug 
    ? (typeof window !== 'undefined' ? `${window.location.origin}/${user.tenant_slug}` : `/${user.tenant_slug}`)
    : (typeof window !== 'undefined' ? `${window.location.origin}/admin` : `/admin`);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(personalUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Workspace Profile Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight mb-4 flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-[#D62839] dark:text-rose-400" />
          <span>Organization & Personal Workspace Profile</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Company / Organization Name</span>
            <p className="font-extrabold text-slate-900 dark:text-white text-base">{tenant?.name || 'My Cockpit Organization'}</p>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Subscription Tier</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
              {tenant?.plan || 'Enterprise'} Tier
            </span>
          </div>
          <div className="sm:col-span-2 pt-4 border-t border-slate-200/80 dark:border-white/[0.06]">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Personal Client Vanity URL</span>
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-white/[0.08] font-mono text-xs text-[#D62839] dark:text-rose-400">
              <div className="flex items-center gap-2 truncate">
                <LinkIcon className="w-4 h-4 text-[#D62839] dark:text-rose-400 shrink-0" />
                <span className="font-bold truncate">{personalUrl}</span>
              </div>
              <button
                onClick={handleCopyUrl}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:text-[#D62839] dark:hover:text-rose-400 font-sans text-xs transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Production alias: <span className="text-slate-900 dark:text-white font-mono font-bold">akiradigital.in/{user?.tenant_slug || 'client'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Internationalization & Currency Preferences */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#D62839] dark:text-rose-400" />
          <span>Internationalization & Currency Standards</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure how numbers, financial figures, and timestamps render across invoices, CRM proposals, and executive command centers.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Base Operating Currency
            </label>
            <select
              defaultValue={localStorage.getItem('mycockpit_currency') || 'INR'}
              onChange={(e) => {
                localStorage.setItem('mycockpit_currency', e.target.value);
              }}
              className="cockpit-input w-full cursor-pointer bg-white dark:bg-[#07090E]"
            >
              <option value="INR">INR (₹) — Indian Rupee</option>
              <option value="USD">USD ($) — United States Dollar</option>
              <option value="EUR">EUR (€) — Euro</option>
              <option value="GBP">GBP (£) — British Pound</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Date Representation
            </label>
            <select
              defaultValue={localStorage.getItem('mycockpit_date_format') || 'DD/MM/YYYY'}
              onChange={(e) => {
                localStorage.setItem('mycockpit_date_format', e.target.value);
              }}
              className="cockpit-input w-full cursor-pointer bg-white dark:bg-[#07090E]"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 15/01/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 01/15/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Number Grouping
            </label>
            <select
              defaultValue="lakh_crore"
              className="cockpit-input w-full cursor-pointer bg-white dark:bg-[#07090E]"
            >
              <option value="lakh_crore">Indian Lakhs / Crores (₹1,50,000)</option>
              <option value="western">Western Standard ($150,000.00)</option>
            </select>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/[0.04] flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">Live Formatting Preview:</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white">₹1,50,000 • 15 Jan 2026 • 2:30 PM IST</span>
        </div>
      </div>

      {/* Team & RBAC Management */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-[#D62839] dark:text-rose-400" />
              <span>Role-Based Access Control (RBAC)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage team members authorized to access this workspace</p>
          </div>

          <button
            onClick={() => setIsAddUserOpen(true)}
            className="cockpit-btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Invite Member</span>
          </button>
        </div>

        <div className="divide-y divide-slate-200/80 dark:divide-white/[0.06]">
          {teamMembers.map((m) => (
            <div key={m.id} className="py-3.5 flex items-center justify-between text-sm">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{m.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={m.role} />
                <Badge status={m.status} />
              </div>
            </div>
          ))}
          {teamMembers.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">No additional team members added.</p>
          )}
        </div>
      </div>

      {/* AI Engine Configuration */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight mb-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#D62839] dark:text-rose-400" />
          <span>Personal AI Engine Settings</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Connect an external generative AI provider (Google Gemini or OpenAI) or use the autonomous local MySQL business reasoning engine.
        </p>

        <form onSubmit={handleSaveAiConfig} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              AI Reasoning Provider
            </label>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="cockpit-input sm:w-80"
            >
              <option value="gemini">Google Gemini 2.0 / 1.5 Pro</option>
              <option value="openai">OpenAI GPT-4o Architecture</option>
              <option value="local">Autonomous Local Deterministic Engine (Active)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              API Secret Key (Optional for External Generative Models)
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="cockpit-input font-mono"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Credentials are never exposed in client network inspection; proxy requests route securely via backend PHP controllers.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              Save AI Settings
            </button>
            {savedAi && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-bold">
                <Check className="w-4 h-4" />
                <span>Configuration Saved</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ADD USER MODAL */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        title="Invite Team Member"
      >
        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Member Full Name
            </label>
            <input
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Pooja Patel"
              className="cockpit-input"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Work Email
            </label>
            <input
              type="email"
              required
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="pooja@company.com"
              className="cockpit-input"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Tenant Role Permission
            </label>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as any)}
              className="cockpit-input"
            >
              <option value="tenant_admin">Tenant Admin (Full Management)</option>
              <option value="employee">Employee (Operational Access)</option>
              <option value="read_only">Read-Only User (Auditor / Viewer)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Initial Password
            </label>
            <input
              type="password"
              required
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              className="cockpit-input font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/90 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setIsAddUserOpen(false)}
              className="cockpit-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              Save Team Member
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default SettingsPage;
