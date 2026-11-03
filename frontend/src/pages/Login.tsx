import React, { useState } from 'react';
import { Layers, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
  onSwitchToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Warm ambient tints */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#FFF1F2] rounded-full blur-3xl pointer-events-none opacity-80" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#FFF1F2] rounded-full blur-3xl pointer-events-none opacity-60" />

      <div className="w-full max-w-md space-y-6 z-10 py-8">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-[#D62839] items-center justify-center shadow-lg shadow-[#D62839]/25 mb-4 text-white">
            <Layers className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#20242C] tracking-tight">
            MY COCKPIT <span className="text-[#D62839]">AI</span>
          </h1>
          <p className="mt-2 text-sm text-[#667085] font-medium">
            One Dashboard. Every Business. Your Personal AI.
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white border border-[#E9EAEE] rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/40">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[#FEF2F2] border border-[#FECDD3] flex items-center gap-3 text-sm text-[#DC2626]">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
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
                  placeholder="name@company.com"
                  className="cockpit-input has-icon"
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
                Password
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="cockpit-input has-icon"
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#D62839] hover:bg-[#B91C2C] text-white font-semibold text-sm shadow-md shadow-[#D62839]/25 flex items-center justify-center gap-2 transition-all duration-180 disabled:opacity-50 cursor-pointer mt-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Cockpit'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Registration link */}
          <div className="mt-6 text-center text-xs text-[#667085]">
            Need an enterprise organization workspace?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-[#D62839] hover:text-[#B91C2C] font-semibold underline underline-offset-4 cursor-pointer"
            >
              Register New Organization
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
