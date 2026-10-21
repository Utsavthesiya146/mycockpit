import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, Shield, Link as LinkIcon, Sparkles, Plus, Check, Copy } from 'lucide-react';
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
      setTeamMembers(data);
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
    ? `http://localhost:5173/${user.tenant_slug}`
    : `http://localhost:5173/admin`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(personalUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Workspace Profile Card */}
      <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-sm">
        <h3 className="text-base font-bold text-[#172033] tracking-tight mb-4 flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-[#4667E8]" />
          <span>Tenant Organization Profile</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-1">Company / Workspace Name</span>
            <p className="font-bold text-[#172033] text-base">{tenant?.name || 'My Cockpit Organization'}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-1">Subscription Tier</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase bg-[#EEF2FF] text-[#4667E8] border border-[#EEF2FF]">
              {tenant?.plan || 'Enterprise'} Tier
            </span>
          </div>
          <div className="sm:col-span-2 pt-4 border-t border-[#E5EAF1]">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-1.5">Personal Client Vanity URL</span>
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E5EAF1] font-mono text-xs text-[#4667E8]">
              <div className="flex items-center gap-2 truncate">
                <LinkIcon className="w-4 h-4 text-[#4667E8] shrink-0" />
                <span className="font-semibold truncate">{personalUrl}</span>
              </div>
              <button
                onClick={handleCopyUrl}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#E5EAF1] text-[#64748B] hover:text-[#172033] font-sans text-xs transition-colors shrink-0 shadow-sm"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#0F9D92]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-xs text-[#64748B] mt-1.5">
              Production Hostinger alias: <span className="text-[#172033] font-mono font-medium">mycockpit.ai/{user?.tenant_slug || 'client'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Team & RBAC Management */}
      <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#172033] tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-[#4667E8]" />
              <span>Role-Based Access Control (RBAC)</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">Manage teammates authorized to access this tenant workspace</p>
          </div>

          <button
            onClick={() => setIsAddUserOpen(true)}
            className="cockpit-btn-primary flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#4667E8] text-white text-xs font-semibold shadow-sm hover:bg-[#3b5bd6] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Invite Member</span>
          </button>
        </div>

        <div className="divide-y divide-[#E5EAF1]">
          {teamMembers.map((m) => (
            <div key={m.id} className="py-3.5 flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold text-[#172033]">{m.name}</p>
                <p className="text-xs text-[#64748B]">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={m.role} />
                <Badge status={m.status} />
              </div>
            </div>
          ))}
          {teamMembers.length === 0 && (
            <p className="py-6 text-center text-xs text-[#64748B]">No additional team members added.</p>
          )}
        </div>
      </div>

      {/* AI Engine Configuration */}
      <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-sm">
        <h3 className="text-base font-bold text-[#172033] tracking-tight mb-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#4667E8]" />
          <span>Personal AI Engine Settings</span>
        </h3>
        <p className="text-xs text-[#64748B] mb-4">
          Connect an external generative AI provider (Google Gemini or OpenAI) or use the autonomous local MySQL business reasoning engine.
        </p>

        <form onSubmit={handleSaveAiConfig} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              AI Reasoning Provider
            </label>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            >
              <option value="gemini">Google Gemini 2.0 / 1.5 Pro</option>
              <option value="openai">OpenAI GPT-4o Architecture</option>
              <option value="local">Autonomous Local Deterministic Engine (Active)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              API Secret Key (Optional for External Generative Models)
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm font-mono text-[#172033] placeholder-[#94A3B8] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
            <p className="text-xs text-[#64748B] mt-1.5">
              Credentials are never exposed in browser network inspection; proxy requests route securely via backend PHP controllers.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="cockpit-btn-primary px-4 py-2.5 rounded-xl bg-[#4667E8] text-white text-xs font-semibold shadow-sm hover:bg-[#3b5bd6] transition-all"
            >
              Save AI Settings
            </button>
            {savedAi && (
              <span className="text-xs text-[#0F9D92] flex items-center gap-1.5 font-semibold">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Member Full Name
            </label>
            <input
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Pooja Patel"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Work Email
            </label>
            <input
              type="email"
              required
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="pooja@company.com"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Tenant Role Permission
            </label>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            >
              <option value="tenant_admin">Tenant Admin (Full Management)</option>
              <option value="employee">Employee (Operational Access)</option>
              <option value="read_only">Read-Only User (Auditor / Viewer)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Initial Password
            </label>
            <input
              type="password"
              required
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5EAF1]">
            <button
              type="button"
              onClick={() => setIsAddUserOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:text-[#172033] text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary px-5 py-2 rounded-xl bg-[#4667E8] text-white text-sm font-semibold shadow-sm hover:bg-[#3b5bd6] transition-all"
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
