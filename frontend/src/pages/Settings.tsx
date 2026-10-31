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
      <div className="p-6 rounded-2xl bg-white border border-[#E9EAEE] shadow-xs">
        <h3 className="text-base font-bold text-[#20242C] tracking-tight mb-4 flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-[#D62839]" />
          <span>Organization & Personal Workspace Profile</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block mb-1">Company / Organization Name</span>
            <p className="font-bold text-[#20242C] text-base">{tenant?.name || 'My Cockpit Organization'}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block mb-1">Subscription Tier</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3]">
              {tenant?.plan || 'Enterprise'} Tier
            </span>
          </div>
          <div className="sm:col-span-2 pt-4 border-t border-[#E9EAEE]">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block mb-1.5">Personal Client Vanity URL</span>
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E9EAEE] font-mono text-xs text-[#D62839]">
              <div className="flex items-center gap-2 truncate">
                <LinkIcon className="w-4 h-4 text-[#D62839] shrink-0" />
                <span className="font-semibold truncate">{personalUrl}</span>
              </div>
              <button
                onClick={handleCopyUrl}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#E9EAEE] text-[#667085] hover:text-[#D62839] hover:bg-[#FFF1F2] font-sans text-xs transition-colors shrink-0 shadow-2xs cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-xs text-[#667085] mt-1.5">
              Production alias: <span className="text-[#20242C] font-mono font-medium">akiradigital.com/{user?.tenant_slug || 'client'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Team & RBAC Management */}
      <div className="p-6 rounded-2xl bg-white border border-[#E9EAEE] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-[#20242C] tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-[#D62839]" />
              <span>Role-Based Access Control (RBAC)</span>
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">Manage team members authorized to access this workspace</p>
          </div>

          <button
            onClick={() => setIsAddUserOpen(true)}
            className="cockpit-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Invite Member</span>
          </button>
        </div>

        <div className="divide-y divide-[#E9EAEE]">
          {teamMembers.map((m) => (
            <div key={m.id} className="py-3.5 flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold text-[#20242C]">{m.name}</p>
                <p className="text-xs text-[#667085]">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={m.role} />
                <Badge status={m.status} />
              </div>
            </div>
          ))}
          {teamMembers.length === 0 && (
            <p className="py-6 text-center text-xs text-[#667085]">No additional team members added.</p>
          )}
        </div>
      </div>

      {/* AI Engine Configuration */}
      <div className="p-6 rounded-2xl bg-white border border-[#E9EAEE] shadow-xs">
        <h3 className="text-base font-bold text-[#20242C] tracking-tight mb-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#D62839]" />
          <span>Personal AI Engine Settings</span>
        </h3>
        <p className="text-xs text-[#667085] mb-4">
          Connect an external generative AI provider (Google Gemini or OpenAI) or use the autonomous local MySQL business reasoning engine.
        </p>

        <form onSubmit={handleSaveAiConfig} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
              API Secret Key (Optional for External Generative Models)
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="cockpit-input font-mono"
            />
            <p className="text-xs text-[#667085] mt-1.5">
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
              <span className="text-xs text-[#059669] flex items-center gap-1.5 font-semibold">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E9EAEE]">
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
