import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Clock, 
  User, 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  Flame, 
  TrendingUp, 
  Search, 
  Kanban, 
  ListFilter,
  Calendar,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { Cockpit3DLoader } from '../components/common/Cockpit3DLoader';
import type { Task } from '../types';

export const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'urgent'>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [dueDate, setDueDate] = useState('');

  const fetchTasks = async () => {
    try {
      const data: any = await api.get('/tasks');
      setTasks(data || []);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tasks', {
        title,
        description,
        priority,
        due_date: dueDate || null
      });
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Error creating task');
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await api.post(`/tasks/${task.id}/status`, { status: nextStatus });
      fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    }
  };

  // Telemetry KPIs
  const kpis = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const urgentTasks = tasks.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed');
    const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.due_date && t.due_date < today);
    const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

    return {
      total: tasks.length,
      pending: pendingTasks.length,
      completed: completedTasks.length,
      urgent: urgentTasks.length,
      overdue: overdueTasks.length,
      completionRate
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = (t.title || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }

      // Filter Status
      if (filterStatus === 'all') return true;
      if (filterStatus === 'completed') return t.status === 'completed';
      if (filterStatus === 'pending') return t.status !== 'completed';
      if (filterStatus === 'urgent') return (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed';
      return true;
    });
  }, [tasks, search, filterStatus]);

  const getPriorityBadge = (p?: Task['priority']) => {
    switch (p) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Urgent
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
            High
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Low
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Cockpit3DLoader 
          variant="module"
          size="lg"
          text="Loading Action Items & Sprint Matrix..."
          subtitle="Organizing tasks, velocity metrics, and priority queues"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Telemetry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active In-Flight */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-slate-300 dark:hover:border-white/[0.15] transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Queue</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-600 dark:text-slate-300">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
            {kpis.pending}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Tasks currently requiring completion</span>
          </div>
        </div>

        {/* Card 2: Urgent / High Priority */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Urgent Focus</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-tight">
            {kpis.urgent}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>High-impact or mission-critical action items</span>
          </div>
        </div>

        {/* Card 3: Overdue Deadlines */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Past Due</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 tracking-tight">
            {kpis.overdue}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Tasks that slipped past committed deadline</span>
          </div>
        </div>

        {/* Card 4: Completion Velocity */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Velocity</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
            {kpis.completed}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              {kpis.completionRate}%
            </span>
            <span>overall closure rate</span>
          </div>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Task Operations & Execution</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Organize action items, manage team accountability, and monitor deadline velocity
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-white dark:bg-[#0D111A] rounded-xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="List View"
            >
              <ListFilter className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Kanban Board View"
            >
              <Kanban className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="cockpit-btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Tasks', count: tasks.length },
            { id: 'pending', label: 'Active Queue', count: kpis.pending },
            { id: 'urgent', label: 'Urgent / High', count: kpis.urgent, badgeColor: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300' },
            { id: 'completed', label: 'Completed', count: kpis.completed, badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' }
          ].map((tab) => {
            const isActive = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all duration-180 flex items-center gap-1.5 cursor-pointer text-xs ${
                  isActive
                    ? 'bg-[#D62839] text-white border-[#D62839] font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                  tab.badgeColor || (isActive ? 'bg-white/20 text-white border-white/30' : 'bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400 border-transparent')
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="cockpit-input pl-9 pr-3 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* VIEW: LIST MODE */}
      {viewMode === 'list' && (
        <div className="rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs divide-y divide-slate-200/80 dark:divide-white/[0.06] overflow-hidden">
          {filteredTasks.map((task) => {
            const isDone = task.status === 'completed';
            const today = new Date().toISOString().split('T')[0];
            const isOverdue = !isDone && task.due_date && task.due_date < today;

            return (
              <div 
                key={task.id}
                className={`p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 transition-colors ${
                  isDone 
                    ? 'bg-slate-50/50 dark:bg-slate-900/30' 
                    : isOverdue 
                      ? 'bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-50/50 dark:hover:bg-rose-950/20' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleStatus(task)}
                    className="mt-0.5 text-slate-400 hover:text-[#D62839] transition-colors shrink-0 cursor-pointer"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-sm font-bold tracking-tight ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {task.due_date && (
                        <span className={`flex items-center gap-1 font-mono font-medium ${isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                          <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-[#D62839] dark:text-rose-400'}`} />
                          {isOverdue && 'Overdue: '}
                          Due {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                      {task.assigned_user_name && (
                        <span className="flex items-center gap-1 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {task.assigned_user_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                  {getPriorityBadge(task.priority)}
                  <Badge status={task.status} />
                </div>
              </div>
            );
          })}

          {filteredTasks.length === 0 && (
            <div className="py-6">
              <EmptyState
                icon={CheckSquare}
                title="No tasks match the active filters"
                description={tasks.length === 0 
                  ? "Create your first task to start organizing deliverables, assigning deadlines, and ensuring team velocity."
                  : "Try clearing your search query or switching to 'All' status to see existing tasks."
                }
                primaryAction={{
                  label: "Create Operational Task",
                  onClick: () => setIsModalOpen(true),
                  icon: Plus
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* VIEW: KANBAN MODE */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Column 1: Pending / Backlog */}
          <div className="rounded-2xl bg-slate-50/60 dark:bg-[#0D111A]/60 border border-slate-200/90 dark:border-white/[0.08] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/90 dark:border-white/[0.08]">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">To Do</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white dark:bg-white/[0.08] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08]">
                {filteredTasks.filter(t => t.status === 'pending').length}
              </span>
            </div>
            <div className="space-y-3">
              {filteredTasks.filter(t => t.status === 'pending').map(task => (
                <div key={task.id} className="p-4 rounded-xl bg-white dark:bg-[#121722] border border-slate-200/90 dark:border-white/[0.08] shadow-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">{task.title}</h5>
                    {getPriorityBadge(task.priority)}
                  </div>
                  {task.description && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{task.description}</p>}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/[0.04] text-[11px] text-slate-500">
                    <span className="font-mono">{task.due_date || 'No due date'}</span>
                    <button
                      onClick={() => handleToggleStatus(task)}
                      className="text-xs font-semibold text-[#D62839] hover:underline cursor-pointer"
                    >
                      Mark Done →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="rounded-2xl bg-slate-50/60 dark:bg-[#0D111A]/60 border border-slate-200/90 dark:border-white/[0.08] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/90 dark:border-white/[0.08]">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">In Progress</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white dark:bg-white/[0.08] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                {filteredTasks.filter(t => t.status === 'in_progress').length}
              </span>
            </div>
            <div className="space-y-3">
              {filteredTasks.filter(t => t.status === 'in_progress').map(task => (
                <div key={task.id} className="p-4 rounded-xl bg-white dark:bg-[#121722] border border-slate-200/90 dark:border-white/[0.08] shadow-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">{task.title}</h5>
                    {getPriorityBadge(task.priority)}
                  </div>
                  {task.description && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{task.description}</p>}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/[0.04] text-[11px] text-slate-500">
                    <span className="font-mono">{task.due_date || 'No due date'}</span>
                    <button
                      onClick={() => handleToggleStatus(task)}
                      className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
                    >
                      Mark Done →
                    </button>
                  </div>
                </div>
              ))}
              {filteredTasks.filter(t => t.status === 'in_progress').length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No tasks in progress</p>
              )}
            </div>
          </div>

          {/* Column 3: Completed */}
          <div className="rounded-2xl bg-slate-50/60 dark:bg-[#0D111A]/60 border border-slate-200/90 dark:border-white/[0.08] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/90 dark:border-white/[0.08]">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white dark:bg-white/[0.08] text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                {filteredTasks.filter(t => t.status === 'completed').length}
              </span>
            </div>
            <div className="space-y-3">
              {filteredTasks.filter(t => t.status === 'completed').map(task => (
                <div key={task.id} className="p-4 rounded-xl bg-white/70 dark:bg-[#121722]/50 border border-slate-200/90 dark:border-white/[0.08] shadow-xs space-y-2 opacity-80">
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="text-xs font-bold line-through text-slate-400 dark:text-slate-500">{task.title}</h5>
                    <Badge status="completed" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/[0.04] text-[11px] text-slate-400">
                    <span>Resolved</span>
                    <button
                      onClick={() => handleToggleStatus(task)}
                      className="text-xs font-semibold text-slate-500 hover:underline cursor-pointer"
                    >
                      Reopen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Action Item / Task"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Task Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Audit cloud backup configuration"
              className="cockpit-input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="cockpit-input"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="cockpit-input font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed guidelines, scope, or checklist"
              className="cockpit-input"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/90 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="cockpit-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              Save Task
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default Tasks;
