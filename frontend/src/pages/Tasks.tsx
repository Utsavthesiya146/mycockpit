import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, Clock, User, CheckCircle2, Circle } from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import type { Task } from '../types';

export const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');

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

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'completed') return t.status === 'completed';
    return t.status !== 'completed';
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#20242C] tracking-tight">Task Operations & Execution</h2>
          <p className="text-sm text-[#667085] mt-0.5">
            Organize action items, manage team accountability, and monitor deadline velocity
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="cockpit-btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Create Task</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-[#E9EAEE] shadow-2xs w-fit">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-[#D62839] text-white shadow-xs font-bold'
              : 'text-[#667085] hover:text-[#20242C] hover:bg-[#FFF1F2]'
          }`}
        >
          All Tasks ({tasks.length})
        </button>
        <button
          onClick={() => setFilterStatus('pending')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            filterStatus === 'pending'
              ? 'bg-[#D62839] text-white shadow-xs font-bold'
              : 'text-[#667085] hover:text-[#20242C] hover:bg-[#FFF1F2]'
          }`}
        >
          Pending ({tasks.filter(t => t.status !== 'completed').length})
        </button>
        <button
          onClick={() => setFilterStatus('completed')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            filterStatus === 'completed'
              ? 'bg-[#D62839] text-white shadow-xs font-bold'
              : 'text-[#667085] hover:text-[#20242C] hover:bg-[#FFF1F2]'
          }`}
        >
          Completed ({tasks.filter(t => t.status === 'completed').length})
        </button>
      </div>

      {/* Task List */}
      <div className="rounded-2xl bg-white border border-[#E9EAEE] shadow-xs divide-y divide-[#E9EAEE] overflow-hidden">
        {filteredTasks.map((task) => {
          const isDone = task.status === 'completed';
          return (
            <div 
              key={task.id}
              className={`p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 transition-colors ${
                isDone ? 'bg-[#F8F9FB]/60' : 'hover:bg-[#FFF1F2]/25'
              }`}
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <button
                  onClick={() => handleToggleStatus(task)}
                  className="mt-0.5 text-[#94A3B8] hover:text-[#D62839] transition-colors shrink-0 cursor-pointer"
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-[#059669]" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <h4 className={`text-sm font-semibold tracking-tight ${isDone ? 'line-through text-[#94A3B8]' : 'text-[#20242C]'}`}>
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="text-xs text-[#667085] mt-1 line-clamp-1">{task.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#667085]">
                    {task.due_date && (
                      <span className="flex items-center gap-1 font-medium text-[#20242C]">
                        <Clock className="w-3.5 h-3.5 text-[#D62839]" />
                        Due: {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                    {task.assigned_user_name && (
                      <span className="flex items-center gap-1 font-medium">
                        <User className="w-3.5 h-3.5 text-[#667085]" />
                        {task.assigned_user_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <Badge status={task.priority} />
                <Badge status={task.status} />
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="p-16 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3] flex items-center justify-center mb-3">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-[#20242C]">No tasks found</h4>
            <p className="text-sm text-[#667085] mt-1 max-w-sm mx-auto">
              {tasks.length === 0
                ? 'Create a new task to organize deliverables and ensure zero slipped commitments.'
                : 'No tasks matching your active filter criteria.'}
            </p>
          </div>
        )}
      </div>

      {/* CREATE TASK MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Action Item / Task"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E9EAEE]">
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
