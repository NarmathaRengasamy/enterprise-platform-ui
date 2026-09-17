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
      statusColor: 'secondary'
    };
    setEvents([...events, newEv]);
    setNewEventTitle('');
    setNewEventClient('');
    setIsAddEventOpen(false);
  };

  return (
    <div className="flex w-full h-[calc(100vh-5.5rem)] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm border border-surface-container select-none">
      {/* Mini Calendar Navigation Sidebar */}
      <aside className="w-[230px] flex-shrink-0 bg-surface-container-lowest border-r border-surface-container flex flex-col h-full z-20">
        <div className="h-14 flex items-center px-4 border-b border-surface-container">
          <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Calendar</h1>
        </div>

        {/* Mini Calendar Grid */}
        <div className="px-3.5 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <button className="flex items-center space-x-1 font-title-sm text-title-sm font-semibold text-on-surface hover:text-primary focus:outline-none transition-colors cursor-pointer">
              <span>September 2026</span>
              <span className="material-symbols-outlined text-sm text-outline">expand_more</span>
            </button>
            <div className="flex items-center space-x-0.5 text-outline">
              <button className="p-1 hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button className="p-1 hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center font-caption text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
            <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
          </div>

          <div className="grid grid-cols-7 text-center font-body-sm text-[12px] font-normal leading-6 gap-y-0.5 relative">
            <span className="text-outline/50">31</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">1</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">2</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">3</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">4</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">5</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">6</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">7</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">8</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">9</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">10</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">11</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">12</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer">13</span>
            {/* Week 3 (Active) */}
            <span className="text-primary font-semibold cursor-pointer">14</span>
            <span className="text-primary font-semibold cursor-pointer">15</span>
            <span className="text-primary font-semibold cursor-pointer">16</span>
            <span className="flex items-center justify-center font-bold text-on-primary cursor-pointer">
              <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">17</span>
            </span>
            <span className="text-primary font-semibold cursor-pointer">18</span>
            <span className="text-primary font-semibold cursor-pointer">19</span>
            <span className="text-primary font-semibold cursor-pointer">20</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer mt-1">21</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer mt-1">22</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer mt-1">23</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer mt-1">24</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer mt-1">25</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer mt-1">26</span>
            <span className="hover:bg-surface-container-low rounded-full cursor-pointer mt-1">27</span>
          </div>
        </div>

        {/* Action Items & Calendars List */}
        <div className="mt-2 pt-3 border-t border-surface-container flex-1 px-3 space-y-3">
          <button
            type="button"
            onClick={() => setIsAddEventOpen(true)}
            className="flex items-center justify-center space-x-1.5 font-label-md text-label-md font-semibold text-primary bg-primary-container/10 hover:bg-primary-container/20 w-full px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Add appointment</span>
          </button>
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant px-1">
              <span>My Calendars</span>
            </div>
            <label className="flex items-center space-x-2 px-2 py-1.5 rounded-xl hover:bg-surface-container-low cursor-pointer font-body-sm text-body-sm text-on-surface transition-colors">
              <input defaultChecked className="w-4 h-4 accent-primary rounded cursor-pointer" type="checkbox" />
              <span className="font-medium text-[13px]">Perfox Store Appointments</span>
            </label>
            <label className="flex items-center space-x-2 px-2 py-1.5 rounded-xl hover:bg-surface-container-low cursor-pointer font-body-sm text-body-sm text-on-surface transition-colors">
              <input defaultChecked className="w-4 h-4 accent-primary rounded cursor-pointer" type="checkbox" />
              <span className="font-medium text-[13px]">Site Measurement Visits</span>
            </label>
          </div>
        </div>
      </aside>

      {/* Main Calendar Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface-container-lowest overflow-hidden">
        {/* TopBar Header */}
        <header className="h-14 bg-surface-container-lowest border-b border-surface-container flex items-center justify-between px-space-lg shrink-0">
          <div className="flex items-center space-x-3">
            <button className="px-3.5 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md font-semibold rounded-xl transition-colors cursor-pointer shadow-inner">
              Today
            </button>
            <div className="flex items-center space-x-0.5 text-on-surface-variant">
              <button className="p-1 hover:bg-surface-container rounded-lg transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <button className="p-1 hover:bg-surface-container rounded-lg transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
            <span className="font-title-md text-title-md text-on-surface font-bold">
              September 14 – 20, 2026
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* View switcher */}
            <div className="inline-flex rounded-xl bg-surface-container-low p-1 font-label-sm text-label-sm shadow-inner">
              {['Day', 'Week', 'Month'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setActiveView(v)}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    activeView === v
                      ? 'bg-surface-container-lowest text-primary font-semibold shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsAddEventOpen(true)}
              className="px-4 py-2 bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold rounded-xl flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>New event</span>
            </button>
          </div>
        </header>

        {/* Calendar Day Columns Header */}
        <div className="grid grid-cols-8 border-b border-surface-container bg-surface-container-low/70 shrink-0">
          <div className="w-16 border-r border-surface-container py-2.5 text-center font-caption text-caption text-outline font-semibold">
            GMT+5:30
          </div>
          {daysOfWeek.map((d, idx) => (
            <div
              key={idx}
              className={`py-2 text-center border-r border-surface-container last:border-r-0 ${
                d.isToday ? 'bg-primary/5' : ''
              }`}
            >
              <span className="font-caption text-caption text-on-surface-variant font-semibold uppercase block">{d.name}</span>
              <span
                className={`font-title-sm text-title-sm inline-flex items-center justify-center mt-0.5 ${
                  d.isToday
                    ? 'w-7 h-7 rounded-full bg-primary text-on-primary font-bold shadow-sm'
                    : 'text-on-surface font-bold'
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
            <div className="w-16 border-r border-surface-container">
              {hours.map((h, i) => (
                <div key={i} className="time-slot-height pr-2 text-right font-caption text-[11px] text-outline font-medium -mt-2 border-t border-surface-container-low">
                  {h}
                </div>
              ))}
            </div>

            {/* 7 Days Columns */}
            {daysOfWeek.map((day, colIdx) => (
              <div
                key={colIdx}
                className={`relative border-r border-surface-container last:border-r-0 ${
                  day.isToday ? 'bg-primary/5' : ''
                }`}
              >
                {hours.map((_, hrIdx) => (
                  <div key={hrIdx} className="time-slot-height border-t border-surface-container-low/80" />
                ))}

                {/* Render events for this column */}
                {events
                  .filter((e) => e.dayIndex === colIdx)
                  .map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      style={{ top: `${ev.topOffset}px`, height: `${ev.height}px` }}
                      className="absolute inset-x-1 rounded-xl bg-primary-container/10 border-l-4 border-primary p-2 shadow-sm cursor-pointer hover:shadow-md hover:bg-primary-container/15 transition-all overflow-hidden z-10"
                    >
                      <span className="font-title-sm text-title-sm text-primary font-semibold block truncate">
                        {ev.title}
                      </span>
                      <span className="font-body-sm text-[11px] text-on-surface-variant block truncate">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/35 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg w-full max-w-md border border-surface-container-high flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Schedule New Appointment</h2>
              <button onClick={() => setIsAddEventOpen(false)} className="text-outline hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleAddEventSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant">
                  Appointment Title *
                </label>
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="e.g. Perfox Modular Wardrobe Demo"
                  className="w-full h-10 px-3 font-body-sm text-body-sm rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant">
                  Client / Contact Name
                </label>
                <input
                  type="text"
                  value={newEventClient}
                  onChange={(e) => setNewEventClient(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full h-10 px-3 font-body-sm text-body-sm rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant">
                  Time Range
                </label>
                <input
                  type="text"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                  className="w-full h-10 px-3 font-body-sm text-body-sm rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsAddEventOpen(false)}
                  className="px-4 py-2 font-label-md text-label-md font-semibold rounded-xl text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-label-md text-label-md font-semibold rounded-xl bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer transition-all"
                >
                  Save Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/35 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg w-full max-w-sm border border-surface-container-high flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold bg-secondary-fixed/50 text-on-secondary-fixed-variant flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                {selectedEvent.status}
              </span>
              <button onClick={() => setSelectedEvent(null)} className="text-outline hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{selectedEvent.title}</h3>
            <div className="space-y-1.5 font-body-sm text-body-sm text-on-surface-variant pt-1">
              <p>
                <strong className="text-on-surface">Time:</strong> {selectedEvent.time}
              </p>
              <p>
                <strong className="text-on-surface">Client:</strong> {selectedEvent.client}
              </p>
              <p>
                <strong className="text-on-surface">Type:</strong> {selectedEvent.type}
              </p>
              <p>
                <strong className="text-on-surface">Location:</strong> {selectedEvent.location}
              </p>
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="mt-2 w-full py-2.5 bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
