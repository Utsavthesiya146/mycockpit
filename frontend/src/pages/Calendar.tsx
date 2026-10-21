import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, Clock, MapPin, Video } from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import type { CalendarEvent } from '../types';

export const CalendarPage: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      setEvents(data);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#172033] tracking-tight">Calendar & Appointments</h2>
          <p className="text-sm text-[#64748B] mt-0.5">
            Synchronized schedule of meetings, client check-ins, and key project milestones
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="cockpit-btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#4667E8] text-white text-sm font-semibold shadow-sm hover:bg-[#3b5bd6] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Event</span>
        </button>
      </div>

      {/* Events Timeline List */}
      <div className="space-y-3.5">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="p-5 rounded-2xl bg-white border border-[#E5EAF1] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#4667E8]/40 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[#EEF2FF] text-[#4667E8] border border-[#EEF2FF] shrink-0 mt-0.5">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-bold text-[#172033] tracking-tight">{evt.title}</h3>
                  <Badge status={evt.event_type} />
                </div>
                {evt.description && <p className="text-xs text-[#64748B] mt-1 line-clamp-2">{evt.description}</p>}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-[#64748B]">
                  <span className="flex items-center gap-1.5 font-medium text-[#172033]">
                    <Clock className="w-3.5 h-3.5 text-[#4667E8]" />
                    {new Date(evt.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(evt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {evt.location_or_url && (
                    <span className="flex items-center gap-1.5 text-[#4667E8] font-medium truncate max-w-xs">
                      {evt.location_or_url.startsWith('http') ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                      <a href={evt.location_or_url} target="_blank" rel="noreferrer" className="hover:underline truncate">
                        {evt.location_or_url}
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
        ))}

        {events.length === 0 && (
          <div className="p-16 text-center rounded-2xl bg-white border border-[#E5EAF1] shadow-sm">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#EEF2FF] text-[#4667E8] flex items-center justify-center mb-3">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-[#172033]">No scheduled events</h4>
            <p className="text-sm text-[#64748B] mt-1 max-w-sm mx-auto">
              Keep your team aligned by scheduling client check-ins, demos, or operational milestones.
            </p>
          </div>
        )}
      </div>

      {/* CREATE EVENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Meeting or Event"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Event Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Strategy Sync with TechCorp"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Event Type
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            >
              <option value="meeting">Client Meeting</option>
              <option value="appointment">Appointment</option>
              <option value="event">Corporate Event</option>
              <option value="reminder">Operational Reminder</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                Start Date & Time
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Location or Meeting Link
            </label>
            <input
              type="text"
              value={locationOrUrl}
              onChange={(e) => setLocationOrUrl(e.target.value)}
              placeholder="https://meet.google.com/abc-xyz or Main Boardroom"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Description / Agenda
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting objectives, scope, or notes"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5EAF1]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:text-[#172033] text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary px-5 py-2 rounded-xl bg-[#4667E8] text-white text-sm font-semibold shadow-sm hover:bg-[#3b5bd6] transition-all"
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
