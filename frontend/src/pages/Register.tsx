import React, { useState } from 'react';
import { Layers, ArrowRight, Lock, Mail, Building, User, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RegisterProps {
  onSwitchToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCompanyChange = (val: string) => {
    setCompanyName(val);
    if (!slug || slug === companyName.toLowerCase().replace(/[^a-z0-9]/g, '')) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register({
        name,
        company_name: companyName,
        slug,
        email,
        password
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 relative overflow-hidden">
      {/* Warm ambient accents */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#FFF1F2] rounded-full blur-3xl pointer-events-none opacity-80" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#FFF1F2] rounded-full blur-3xl pointer-events-none opacity-60" />

      <div className="w-full max-w-md space-y-6 z-10">
        <div className="text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-[#D62839] items-center justify-center shadow-lg shadow-[#D62839]/25 mb-4 text-white">
            <Layers className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#20242C] tracking-tight">
            Register Organization
          </h1>
          <p className="mt-2 text-sm text-[#667085] font-medium">
            Launch your multi-tenant cockpit with personal AI
          </p>
        </div>

        <div className="bg-white border border-[#E9EAEE] rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/40">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[#FEF2F2] border border-[#FECDD3] flex items-center gap-3 text-sm text-[#DC2626]">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                Full Name
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vikram Malhotra"
                  className="cockpit-input has-icon"
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                Company / Business Name
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                  <Building className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  placeholder="e.g. Acme Innovations"
                  className="cockpit-input has-icon"
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                Personal Client URL Slug
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="acme"
                  className="cockpit-input has-icon font-mono"
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>
              <p className="mt-1 text-[11px] text-[#667085] font-mono">
                Your vanity URL: <span className="text-[#D62839] font-bold">mycockpit.ai/{slug || 'yourname'}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                Work Email Address
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@company.com"
                  className="cockpit-input has-icon"
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="cockpit-input has-icon"
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-[#D62839] hover:bg-[#B91C2C] text-white font-semibold text-sm shadow-md shadow-[#D62839]/25 flex items-center justify-center gap-2 transition-all duration-180 disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Creating Workspace...' : 'Initialize Cockpit'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-[#667085]">
            Already have an organization?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-[#D62839] hover:text-[#B91C2C] font-semibold underline underline-offset-4 cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
