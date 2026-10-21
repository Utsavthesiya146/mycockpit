import React, { useState } from 'react';
import { Layers, ShieldCheck, Building, Rocket, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
  onSwitchToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const { login, switchDemoAccount } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDevMode = import.meta.env.DEV || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.includes('onrender.com') || 
    window.location.hostname.includes('railway.app');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoClick = async (target: 'admin' | 'clientA' | 'clientB') => {
    setError('');
    setLoading(true);
    try {
      await switchDemoAccount(target);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate demo account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Gentle ambient tints */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#EEF2FF] rounded-full blur-3xl pointer-events-none opacity-70" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#E8F8F5] rounded-full blur-3xl pointer-events-none opacity-60" />

      <div className="w-full max-w-md space-y-6 z-10 py-8">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-[#4667E8] items-center justify-center shadow-lg shadow-[#4667E8]/25 mb-4">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#172033] tracking-tight">
            MY COCKPIT <span className="text-[#4667E8]">AI</span>
          </h1>
          <p className="mt-2 text-sm text-[#64748B] font-medium">
            One Dashboard. Every Business. Your Personal AI.
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white border border-[#E5EAF1] rounded-3xl p-8 shadow-xl shadow-slate-200/50">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[#FFF1ED] border border-[#FECDD3] flex items-center gap-3 text-sm text-[#E11D48]">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="cockpit-input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="cockpit-input pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#4667E8] hover:bg-[#3855D4] text-white font-semibold text-sm shadow-md shadow-[#4667E8]/25 flex items-center justify-center gap-2 transition-all duration-180 disabled:opacity-50 cursor-pointer mt-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Cockpit'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Switcher Section (Gated for Local Development Verification) */}
          {isDevMode && (
            <div className="mt-8 pt-6 border-t border-[#E5EAF1]">
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  Local Dev Demo Accounts
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDemoClick('admin')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#FDE68A] text-[#D97706] text-xs font-semibold transition-all duration-180 group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Super Admin Portal</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#B45309]">admin@mycockpit.ai</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoClick('clientA')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#C7D2FE] text-[#4667E8] text-xs font-semibold transition-all duration-180 group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Building className="w-4 h-4" />
                    <span>Client A: Acme Innovations</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#3855D4]">utsav@acme.com</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoClick('clientB')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#E8F8F5] hover:bg-[#CCFBF1] border border-[#B2EBE4] text-[#0F9D92] text-xs font-semibold transition-all duration-180 group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Rocket className="w-4 h-4" />
                    <span>Client B: Nexus Digital</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#0B7A71]">rahul@nexus.com</span>
                </button>
              </div>
            </div>
          )}

          {/* Registration link */}
          <div className="mt-6 text-center text-xs text-[#64748B]">
            Need an enterprise organization workspace?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-[#4667E8] hover:text-[#3855D4] font-semibold underline underline-offset-4 cursor-pointer"
            >
              Register New Organization
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
