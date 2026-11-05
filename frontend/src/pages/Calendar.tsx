import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  MapPin, 
  Video, 
  Users, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  Layers,
  List,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { Cockpit3DLoader } from '../components/common/Cockpit3DLoader';
import type { CalendarEvent } from '../types';

export const CalendarPage: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');

  // Month navigation for Grid view
  const [currentDate, setCurrentDate] = useState(new Date());

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<CalendarEvent['event_type']>('meeting');
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [endTime, setEndTime] = useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  const [locationOrUrl, setLocationOrUrl] = useState('');

  const fetchEvents = async () => {
    try {
      const data: any = await api.get('/calendar/events');
      setEvents(data || []);
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/calendar/events', {
        title,
        description,
        event_type: eventType,
        start_time: startTime,
        end_time: endTime,
        location_or_url: locationOrUrl
      });
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setLocationOrUrl('');
      fetchEvents();
    } catch (err: any) {
      alert(err.message || 'Error scheduling event');
    }
  };

  // Telemetry KPIs
  const kpis = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayEvents = events.filter(e => new Date(e.start_time).toDateString() === todayStr);
    const meetings = events.filter(e => e.event_type === 'meeting');
    const virtualCalls = events.filter(e => e.location_or_url && (e.location_or_url.includes('meet.google') || e.location_or_url.includes('zoom.us') || e.location_or_url.startsWith('http')));
    const reminders = events.filter(e => e.event_type === 'reminder' || e.event_type === 'event');

    return {
      todayCount: todayEvents.length,
      meetingsCount: meetings.length,
      virtualCallsCount: virtualCalls.length,
      remindersCount: reminders.length,
      totalCount: events.length
    };
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (selectedTypeFilter === 'all') return true;
      return e.event_type === selectedTypeFilter;
    });
  }, [events, selectedTypeFilter]);

  // Calendar Grid generation
  const monthYearStr = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayIndex = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Cockpit3DLoader 
          variant="module"
          size="lg"
          text="Synchronizing Calendar Agenda..."
          subtitle="Loading scheduled meetings, consultations, and corporate milestones"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Telemetry Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Agenda */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-slate-300 dark:hover:border-white/[0.15] transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today's Agenda</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-600 dark:text-slate-300">
              <CalendarIcon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
            {kpis.todayCount}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Sessions scheduled for today</span>
          </div>
        </div>

        {/* Card 2: Client Meetings */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Client Syncs</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-tight">
            {kpis.meetingsCount}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Active client consultations & demos</span>
          </div>
        </div>

        {/* Card 3: Video Calls */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Virtual Calls</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Video className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 tracking-tight">
            {kpis.virtualCallsCount}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Google Meet & Zoom sessions</span>
          </div>
        </div>

        {/* Card 4: Milestones & Reminders */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Milestones</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
            {kpis.remindersCount}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Key deliverables & corporate events</span>
          </div>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Calendar & Appointments</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Synchronized schedule of meetings, client check-ins, and key project milestones
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-white dark:bg-[#0D111A] rounded-xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Timeline Agenda"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Month Grid"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="cockpit-btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Event</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-2 bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
        {[
          { id: 'all', label: 'All Events', count: events.length },
          { id: 'meeting', label: 'Client Meetings', count: kpis.meetingsCount },
          { id: 'appointment', label: 'Appointments', count: events.filter(e => e.event_type === 'appointment').length },
          { id: 'event', label: 'Corporate Events', count: events.filter(e => e.event_type === 'event').length },
          { id: 'reminder', label: 'Reminders', count: events.filter(e => e.event_type === 'reminder').length }
        ].map((tab) => {
          const isActive = selectedTypeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTypeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all duration-180 flex items-center gap-1.5 cursor-pointer text-xs ${
                isActive
                  ? 'bg-[#D62839] text-white border-[#D62839] font-bold shadow-xs'
                  : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                isActive ? 'bg-white/20 text-white border-white/30' : 'bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400 border-transparent'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* VIEW: TIMELINE MODE */}
      {viewMode === 'timeline' && (
        <div className="space-y-3.5">
          {filteredEvents.map((evt) => {
            const isToday = new Date(evt.start_time).toDateString() === new Date().toDateString();

            return (
              <div
                key={evt.id}
                className={`p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-white/[0.15] transition-all ${
                  isToday ? 'ring-1 ring-[#D62839]/30 dark:ring-rose-500/20' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 shrink-0 mt-0.5">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">{evt.title}</h3>
                      <Badge status={evt.event_type} />
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                          Today
                        </span>
                      )}
                    </div>
                    {evt.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{evt.description}</p>}
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5 font-mono font-medium text-slate-900 dark:text-white">
                        <Clock className="w-3.5 h-3.5 text-[#D62839] dark:text-rose-400" />
                        {new Date(evt.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(evt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {evt.location_or_url && (
                        <span className="flex items-center gap-1.5 text-[#D62839] dark:text-rose-400 font-medium truncate max-w-xs">
                          {evt.location_or_url.startsWith('http') ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                          <a href={evt.location_or_url} target="_blank" rel="noreferrer" className="hover:underline truncate flex items-center gap-1">
                            <span>{evt.location_or_url.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                  <Badge status={evt.status} />
                </div>
              </div>
            );
          })}

          {filteredEvents.length === 0 && (
            <div className="py-6">
              <EmptyState
                icon={CalendarIcon}
                title="No events scheduled on your calendar"
                description="Keep your team and clients synchronized. Schedule meetings, client demos, or project reviews."
                primaryAction={{
                  label: "Schedule Event",
                  onClick: () => setIsModalOpen(true),
                  icon: Plus
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* VIEW: MONTH GRID MODE */}
      {viewMode === 'grid' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/90 dark:border-white/[0.08]">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{monthYearStr}</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 dark:text-slate-400 pb-2">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-20 p-1.5 rounded-xl bg-slate-50/40 dark:bg-white/[0.02]" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum).toISOString().split('T')[0];
              const dayEvents = events.filter(e => e.start_time && e.start_time.startsWith(dateStr));
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`min-h-20 p-2 rounded-xl border flex flex-col justify-between transition-colors ${
                    isToday
                      ? 'border-[#D62839] bg-rose-50/30 dark:bg-rose-950/20'
                      : 'border-slate-200/70 dark:border-white/[0.05] bg-white dark:bg-[#121722]/50'
                  }`}
                >
                  <span className={`text-xs font-mono font-bold ${isToday ? 'text-[#D62839] dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {dayNum}
                  </span>
                  <div className="space-y-1 mt-1">
                    {dayEvents.slice(0, 2).map(e => (
                      <div
                        key={e.id}
                        className="text-[10px] font-semibold truncate px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-[#D62839] dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40"
                        title={e.title}
                      >
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] font-mono text-slate-500 block">+{dayEvents.length - 2} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Meeting or Event"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Event Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Strategy Sync with Client"
              className="cockpit-input"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Event Type
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as any)}
              className="cockpit-input"
            >
              <option value="meeting">Client Meeting</option>
              <option value="appointment">Appointment</option>
              <option value="event">Corporate Event</option>
              <option value="reminder">Operational Reminder</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Start Date & Time
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="cockpit-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="cockpit-input font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Location or Meeting Link
            </label>
            <input
              type="text"
              value={locationOrUrl}
              onChange={(e) => setLocationOrUrl(e.target.value)}
              placeholder="https://meet.google.com/abc-xyz or Main Boardroom"
              className="cockpit-input"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Description / Agenda
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting objectives, scope, or notes"
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
              Schedule Event
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default CalendarPage;
