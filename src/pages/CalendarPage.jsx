import React, { useState } from 'react';
import { INITIAL_CALENDAR_EVENTS } from '../data/mockData';

export default function CalendarPage() {
  const [events, setEvents] = useState(INITIAL_CALENDAR_EVENTS);
  const [activeView, setActiveView] = useState('Week');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('10:00 AM - 11:00 AM');
  const [newEventClient, setNewEventClient] = useState('');

  const daysOfWeek = [
    { name: 'Mon', date: '14' },
    { name: 'Tue', date: '15' },
    { name: 'Wed', date: '16' },
    { name: 'Thu', date: '17', isToday: true },
    { name: 'Fri', date: '18' },
    { name: 'Sat', date: '19' },
    { name: 'Sun', date: '20' }
  ];

  const hours = [
    '08:00 AM',
    '09:00 AM',
    '10:00 AM',
    '11:00 AM',
    '12:00 PM',
    '01:00 PM',
    '02:00 PM',
    '03:00 PM',
    '04:00 PM',
    '05:00 PM',
    '06:00 PM'
  ];

  const handleAddEventSubmit = (e) => {
    e.preventDefault();
    if (!newEventTitle) return;
    const newEv = {
      id: `ev-${Date.now()}`,
      title: newEventTitle,
      time: newEventTime,
      startTime: '10:00',
      endTime: '11:00',
      dayIndex: 3, // today (Thu)
      topOffset: 128,
      height: 64,
      client: newEventClient || 'Internal',
      type: 'Customer Appointment',
      location: 'Online Call',
      status: 'Confirmed',
      statusColor: 'emerald'
    };
    setEvents([...events, newEv]);
    setNewEventTitle('');
    setNewEventClient('');
    setIsAddEventOpen(false);
  };

  return (
    <div className="flex w-full h-[calc(100vh-5.5rem)] overflow-hidden rounded-2xl bg-white shadow-sm border border-teams-border select-none">
      {/* Mini Calendar Navigation Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-teams-grayBg border-r border-teams-border flex flex-col h-full z-20">
        <div className="h-[52px] flex items-center px-4 border-b border-transparent">
          <h1 className="font-semibold text-[15px] text-[#242424] tracking-tight">Calendar</h1>
        </div>

        {/* Mini Calendar Grid */}
        <div className="px-3.5 py-1">
          <div className="flex items-center justify-between mb-2">
            <button className="flex items-center space-x-1 text-xs font-semibold text-gray-800 hover:text-teams-brand focus:outline-none">
              <span>September 2026</span>
              <span className="material-symbols-outlined text-sm text-gray-500">expand_more</span>
            </button>
            <div className="flex items-center space-x-1 text-gray-400">
              <button className="p-1 hover:text-gray-700 hover:bg-gray-200 rounded">
                <span className="material-symbols-outlined text-xs">chevron_left</span>
              </button>
              <button className="p-1 hover:text-gray-700 hover:bg-gray-200 rounded">
                <span className="material-symbols-outlined text-xs">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-gray-500 mb-1">
            <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] font-normal leading-6 gap-y-0.5 relative">
            <span className="text-gray-400">31</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">1</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">2</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">3</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">4</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">5</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">6</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">7</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">8</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">9</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">10</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">11</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">12</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer">13</span>
            {/* Week 3 (Active) */}
            <span className="text-teams-brand font-medium cursor-pointer">14</span>
            <span className="text-teams-brand font-medium cursor-pointer">15</span>
            <span className="text-teams-brand font-medium cursor-pointer">16</span>
            <span className="flex items-center justify-center font-semibold text-white cursor-pointer">
              <span className="w-5 h-5 rounded-full bg-teams-brand flex items-center justify-center shadow-xs">17</span>
            </span>
            <span className="text-teams-brand font-medium cursor-pointer">18</span>
            <span className="text-teams-brand font-medium cursor-pointer">19</span>
            <span className="text-teams-brand font-medium cursor-pointer">20</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer mt-1">21</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer mt-1">22</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer mt-1">23</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer mt-1">24</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer mt-1">25</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer mt-1">26</span>
            <span className="hover:bg-gray-200 rounded-full cursor-pointer mt-1">27</span>
          </div>
        </div>

        {/* Action Items & Calendars List */}
        <div className="mt-4 pt-3 border-t border-teams-border flex-1 px-3 space-y-3">
          <button
            type="button"
            onClick={() => setIsAddEventOpen(true)}
            className="flex items-center space-x-2 text-xs font-medium text-teams-brand hover:text-teams-brandDark w-full px-1 py-1 rounded transition-colors"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Add appointment</span>
          </button>
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 px-1 py-0.5">
              <span>My calendars</span>
            </div>
            <label className="flex items-center space-x-2 px-1 py-1 rounded hover:bg-gray-200/60 cursor-pointer text-xs text-gray-700">
              <input defaultChecked className="w-3.5 h-3.5 text-teams-brand rounded border-gray-300" type="checkbox" />
              <span className="text-[13px] text-gray-800">Perfox Store Appointments</span>
            </label>
            <label className="flex items-center space-x-2 px-1 py-1 rounded hover:bg-gray-200/60 cursor-pointer text-xs text-gray-700">
              <input defaultChecked className="w-3.5 h-3.5 text-teams-brand rounded border-gray-300" type="checkbox" />
              <span className="text-[13px] text-gray-800">Site Measurement Visits</span>
            </label>
          </div>
        </div>
      </aside>

      {/* Main Calendar Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        {/* TopBar Header */}
        <header className="h-[52px] bg-white border-b border-teams-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center space-x-3">
            <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs font-semibold rounded text-gray-700 transition-colors">
              Today
            </button>
            <div className="flex items-center space-x-1 text-gray-600">
              <button className="p-1 hover:bg-gray-100 rounded">
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <button className="p-1 hover:bg-gray-100 rounded">
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
            <span className="text-sm font-semibold text-gray-800">September 14 – 20, 2026</span>
          </div>

          <div className="flex items-center space-x-2">
            {/* View switcher */}
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs">
              {['Day', 'Week', 'Month'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setActiveView(v)}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeView === v
                      ? 'bg-white text-teams-brand font-semibold shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsAddEventOpen(true)}
              className="px-3 py-1.5 bg-teams-brand hover:bg-teams-brandDark text-white text-xs font-semibold rounded-lg flex items-center space-x-1 shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>New event</span>
            </button>
          </div>
        </header>

        {/* Calendar Day Columns Header */}
        <div className="grid grid-cols-8 border-b border-teams-border bg-gray-50/70 shrink-0">
          <div className="w-16 border-r border-teams-border py-2 text-center text-xs text-gray-400 font-mono">
            GMT+5:30
          </div>
          {daysOfWeek.map((d, idx) => (
            <div
              key={idx}
              className={`py-2 text-center border-r border-teams-border last:border-r-0 ${
                d.isToday ? 'bg-teams-brandLight/40' : ''
              }`}
            >
              <span className="text-xs text-gray-500 font-medium block">{d.name}</span>
              <span
                className={`text-sm font-semibold inline-block ${
                  d.isToday
                    ? 'w-6 h-6 rounded-full bg-teams-brand text-white leading-6'
                    : 'text-gray-800'
                }`}
              >
                {d.date}
              </span>
            </div>
          ))}
        </div>

        {/* Time Grid Scroll Area */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="grid grid-cols-8 relative min-h-[700px]">
            {/* Time labels column */}
            <div className="w-16 border-r border-teams-border">
              {hours.map((h, i) => (
                <div key={i} className="time-slot-height hour-line pr-2 text-right text-[11px] text-gray-400 -mt-2">
                  {h}
                </div>
              ))}
            </div>

            {/* 7 Days Columns */}
            {daysOfWeek.map((day, colIdx) => (
              <div
                key={colIdx}
                className={`relative border-r border-teams-border last:border-r-0 ${
                  day.isToday ? 'bg-teams-brandLight/10' : ''
                }`}
              >
                {hours.map((_, hrIdx) => (
                  <div key={hrIdx} className="time-slot-height hour-line" />
                ))}

                {/* Render events for this column */}
                {events
                  .filter((e) => e.dayIndex === colIdx)
                  .map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      style={{ top: `${ev.topOffset}px`, height: `${ev.height}px` }}
                      className="absolute inset-x-1 rounded-lg bg-[#e8eafb] border-l-4 border-teams-brand p-2 shadow-xs cursor-pointer hover:shadow-md transition-all overflow-hidden z-10"
                    >
                      <span className="font-semibold text-xs text-teams-textPrimary block truncate">
                        {ev.title}
                      </span>
                      <span className="text-[10px] text-teams-textSecondary block">
                        {ev.time} • {ev.client}
                      </span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Add Event Modal */}
      {isAddEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-200 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h2 className="font-semibold text-lg text-gray-900">Schedule New Appointment</h2>
              <button onClick={() => setIsAddEventOpen(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddEventSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700">Appointment Title *</label>
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="e.g. Perfox Kitchen Design Consultation"
                  className="w-full h-9 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-teams-brand mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Client / Contact Name</label>
                <input
                  type="text"
                  value={newEventClient}
                  onChange={(e) => setNewEventClient(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full h-9 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-teams-brand mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Time Range</label>
                <input
                  type="text"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-teams-brand mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddEventOpen(false)}
                  className="px-4 py-2 text-xs rounded-lg text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs rounded-lg bg-teams-brand text-white font-semibold shadow-xs hover:bg-teams-brandDark"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-200 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                {selectedEvent.status}
              </span>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <h3 className="font-bold text-lg text-gray-900">{selectedEvent.title}</h3>
            <p className="text-xs text-gray-600">
              <strong>Time:</strong> {selectedEvent.time}
            </p>
            <p className="text-xs text-gray-600">
              <strong>Client:</strong> {selectedEvent.client}
            </p>
            <p className="text-xs text-gray-600">
              <strong>Type:</strong> {selectedEvent.type}
            </p>
            <p className="text-xs text-gray-600">
              <strong>Location:</strong> {selectedEvent.location}
            </p>
            <button
              onClick={() => setSelectedEvent(null)}
              className="mt-2 w-full py-2 bg-teams-brand text-white text-xs font-semibold rounded-lg hover:bg-teams-brandDark"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
