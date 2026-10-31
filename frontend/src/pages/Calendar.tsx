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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#20242C] tracking-tight">Calendar & Appointments</h2>
          <p className="text-sm text-[#667085] mt-0.5">
            Synchronized schedule of meetings, client check-ins, and key project milestones
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="cockpit-btn-primary"
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
            className="p-5 rounded-2xl bg-white border border-[#E9EAEE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#FECDD3] hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3] shrink-0 mt-0.5">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-bold text-[#20242C] tracking-tight">{evt.title}</h3>
                  <Badge status={evt.event_type} />
                </div>
                {evt.description && <p className="text-xs text-[#667085] mt-1 line-clamp-2">{evt.description}</p>}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-[#667085]">
                  <span className="flex items-center gap-1.5 font-medium text-[#20242C]">
                    <Clock className="w-3.5 h-3.5 text-[#D62839]" />
                    {new Date(evt.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(evt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {evt.location_or_url && (
                    <span className="flex items-center gap-1.5 text-[#D62839] font-medium truncate max-w-xs">
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
          <div className="p-16 text-center rounded-2xl bg-white border border-[#E9EAEE] shadow-xs">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3] flex items-center justify-center mb-3">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-[#20242C]">No scheduled events</h4>
            <p className="text-sm text-[#667085] mt-1 max-w-sm mx-auto">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
              Schedule Event
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default CalendarPage;
