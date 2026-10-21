import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Plus, 
  ExternalLink, 
  Pin, 
  Calendar, 
  Mail, 
  HardDrive, 
  Users, 
  Briefcase, 
  FileText, 
  BookOpen, 
  Globe, 
  Trash2,
  ShieldCheck,
  Search
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import type { ConnectedApp } from '../types';

export const ConnectedApps: React.FC = () => {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [category, setCategory] = useState<ConnectedApp['category']>('business');
  const [iconName, setIconName] = useState('Globe');
  const [connectionStatus, setConnectionStatus] = useState<ConnectedApp['connection_status']>('launcher_only');
  const [isPinned, setIsPinned] = useState(false);

  const fetchApps = async () => {
    try {
      const data: any = await api.get('/apps');
      setApps(data);
    } catch (err) {
      console.error('Failed to load connected apps', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/apps', {
        name,
        app_url: appUrl,
        category,
        icon_name: iconName,
        connection_status: connectionStatus,
        is_pinned: isPinned ? 1 : 0
      });
      setIsAddModalOpen(false);
      setName('');
      setAppUrl('');
      setIsPinned(false);
      fetchApps();
    } catch (err: any) {
      alert(err.message || 'Error adding application');
    }
  };

  const handleTogglePin = async (id: number) => {
    try {
      await api.post(`/apps/${id}/pin`);
      fetchApps();
    } catch (err: any) {
      alert(err.message || 'Error toggling pin');
    }
  };

  const handleDeleteApp = async (id: number) => {
    if (!confirm('Are you sure you want to remove this application shortcut?')) return;
    try {
      await api.delete(`/apps/${id}`);
      fetchApps();
    } catch (err: any) {
      alert(err.message || 'Error deleting app');
    }
  };

  const handleLaunch = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getIcon = (name: string) => {
    switch (name) {
      case 'Calendar': return Calendar;
      case 'Mail': return Mail;
      case 'HardDrive': return HardDrive;
      case 'Users': return Users;
      case 'Briefcase': return Briefcase;
      case 'FileText': return FileText;
      case 'BookOpen': return BookOpen;
      default: return Globe;
    }
  };

  const categories = [
    { id: 'all', label: 'All Applications' },
    { id: 'business', label: 'Business & CRM' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'communication', label: 'Communication' },
    { id: 'cloud', label: 'Cloud Storage' },
    { id: 'custom', label: 'Custom Portals' }
  ];

  const filtered = apps.filter((app) => {
    const matchesCat = activeCategory === 'all' || app.category === activeCategory;
    const matchesQuery = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || app.app_url.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#172033] tracking-tight">Connected Applications Hub</h2>
          <p className="text-sm text-[#64748B] mt-0.5">
            Single-click launchpad for Google Workspace, BNI Connect, KVV, Right Form, My iNotes and custom business portals
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="cockpit-btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#4667E8] text-white text-sm font-semibold shadow-sm hover:bg-[#3b5bd6] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Application Shortcut</span>
        </button>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E5EAF1] shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-semibold">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-[#4667E8] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-lg text-xs text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((app) => {
          const Icon = getIcon(app.icon_name);
          const isPinned = Number(app.is_pinned) === 1;

          return (
            <div 
              key={app.id}
              className="p-5 rounded-2xl bg-white border border-[#E5EAF1] shadow-sm hover:border-[#4667E8]/40 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between mb-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] text-[#4667E8] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePin(app.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isPinned ? 'text-amber-500 bg-amber-50' : 'text-[#94A3B8] hover:text-[#172033]'
                      }`}
                      title={isPinned ? 'Unpin Application' : 'Pin to Top'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteApp(app.id)}
                      className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F07865] transition-colors"
                      title="Delete Application"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-[#172033] tracking-tight">{app.name}</h3>
                <p className="text-xs text-[#64748B] font-mono truncate mt-0.5 max-w-[240px]">{app.app_url}</p>

                <div className="mt-3 flex items-center justify-between">
                  <Badge status={app.connection_status} />
                  <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{app.category}</span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#E5EAF1] flex items-center gap-2">
                <button
                  onClick={() => handleLaunch(app.app_url)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#EEF2FF] hover:bg-[#4667E8] text-[#4667E8] hover:text-white text-xs font-semibold transition-all shadow-sm"
                >
                  <span>Launch Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-16 text-center rounded-2xl bg-white border border-[#E5EAF1] shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#EEF2FF] text-[#4667E8] flex items-center justify-center mb-3">
            <Globe className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-[#172033]">No applications found</h4>
          <p className="text-sm text-[#64748B] mt-1 max-w-sm mx-auto">
            Add shortcuts to external SaaS services, partner networks, or internal enterprise URLs.
          </p>
        </div>
      )}

      {/* Security notice regarding external logins */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5EAF1] shadow-sm flex items-start gap-3 text-xs text-[#64748B]">
        <ShieldCheck className="w-5 h-5 text-[#0F9D92] shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[#172033]">Security & Authentication Isolation</p>
          <p className="mt-0.5 leading-relaxed text-[#64748B]">
            All integrated application portals launch in secure external windows with full origin sandboxing. Third-party passwords and authentication secrets are never retained without explicit OAuth authorization.
          </p>
        </div>
      </div>

      {/* ADD APPLICATION MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Application Shortcut"
      >
        <form onSubmit={handleCreateApp} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Application Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BNI Connect or Custom ERP"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Application URL
            </label>
            <input
              type="url"
              required
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="https://bniconnectglobal.com"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] font-mono focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
              >
                <option value="business">Business & CRM</option>
                <option value="productivity">Productivity</option>
                <option value="communication">Communication</option>
                <option value="cloud">Cloud Storage</option>
                <option value="custom">Custom Web Portal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                Icon Representation
              </label>
              <select
                value={iconName}
                onChange={(e) => setIconName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
              >
                <option value="Globe">Globe / Web</option>
                <option value="Calendar">Calendar</option>
                <option value="Mail">Email / Mail</option>
                <option value="HardDrive">Cloud Drive</option>
                <option value="Users">Networking / Users</option>
                <option value="Briefcase">Enterprise Briefcase</option>
                <option value="FileText">Forms & Docs</option>
                <option value="BookOpen">Notes & Knowledge</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Connection Status
            </label>
            <select
              value={connectionStatus}
              onChange={(e) => setConnectionStatus(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            >
              <option value="launcher_only">Launcher Only (Direct Link)</option>
              <option value="connected">Connected (OAuth / API)</option>
              <option value="config_required">Configuration Required</option>
              <option value="unsupported">Unsupported</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5EAF1]">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:text-[#172033] text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary px-5 py-2 rounded-xl bg-[#4667E8] text-white text-sm font-semibold shadow-sm hover:bg-[#3b5bd6] transition-all"
            >
              Save Application
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default ConnectedApps;
