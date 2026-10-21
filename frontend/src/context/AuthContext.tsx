import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Tenant } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (payload: any) => Promise<void>;
  logout: () => void;
  switchDemoAccount: (target: 'admin' | 'clientA' | 'clientB') => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('mycockpit_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    if (!token) {
      setUser(null);
      setTenant(null);
      setIsLoading(false);
      return;
    }

    try {
      const res: any = await api.get('/auth/me');
      if (res.user) {
        setUser(res.user);
        if (res.user.tenant_slug) {
          // fetch tenant info
          try {
            const tData: any = await api.get(`/tenants/lookup/${res.user.tenant_slug}`);
            setTenant(tData);
          } catch (e) {
            console.warn('Failed to load tenant details', e);
          }
        }
      }
    } catch (err) {
      console.warn('Session expired or invalid', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, [token]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res: any = await api.post('/auth/login', { email, password: pass });
      localStorage.setItem('mycockpit_token', res.token);
      setToken(res.token);
      setUser(res.user);
      if (res.user.tenant_slug) {
        try {
          const tData: any = await api.get(`/tenants/lookup/${res.user.tenant_slug}`);
          setTenant(tData);
        } catch {}
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: any) => {
    setIsLoading(true);
    try {
      const res: any = await api.post('/auth/register', payload);
      localStorage.setItem('mycockpit_token', res.token);
      setToken(res.token);
      setUser(res.user);
      if (res.user.tenant_slug) {
        try {
          const tData: any = await api.get(`/tenants/lookup/${res.user.tenant_slug}`);
          setTenant(tData);
        } catch {}
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('mycockpit_token');
    setToken(null);
    setUser(null);
    setTenant(null);
  };

  const switchDemoAccount = async (target: 'admin' | 'clientA' | 'clientB') => {
    const creds = {
      admin: { email: 'admin@mycockpit.ai', pass: 'AdminPassword123!' },
      clientA: { email: 'utsav@acme.com', pass: 'Password123!' },
      clientB: { email: 'rahul@nexus.com', pass: 'Password123!' },
    };

    const targetCreds = creds[target];
    await login(targetCreds.email, targetCreds.pass);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
        switchDemoAccount,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
