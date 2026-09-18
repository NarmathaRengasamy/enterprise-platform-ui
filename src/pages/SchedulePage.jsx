import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_SCHEDULE_EVENTS } from '../data/mockData';

// Convert 12h parts to total minutes from midnight (0 - 1439)
const toMinutesFrom12h = (hour, minute, period) => {
  let h = parseInt(hour, 10) || 12;
  const m = parseInt(minute, 10) || 0;
  if (h > 12) h = 12;
  if (h < 1) h = 1;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

// Convert total minutes from midnight to 12h parts { hour, minute, period }
const fromMinutesTo12h = (totalMins) => {
  const norm = Math.max(0, Math.min(1439, totalMins));
  let h = Math.floor(norm / 60);
  const m = norm % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return {
    hour: String(h).padStart(2, '0'),
    minute: String(m).padStart(2, '0'),
    period
  };
};

// Format to 12-hour display string (e.g. "10:30 AM")
const format12hString = (hour, minute, period) => {
  const h = String(parseInt(hour, 10) || 12).padStart(2, '0');
  const m = String(parseInt(minute, 10) || 0).padStart(2, '0');
  return `${h}:${m} ${period}`;
};

// Format duration minutes to human readable string
const formatDuration = (mins) => {
  if (mins < 60) return `${mins} mins`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} ${h === 1 ? 'hr' : 'hrs'}` : `${h} hr ${m} mins`;
};

export default function SchedulePage() {
  const [events, setEvents] = useState(INITIAL_SCHEDULE_EVENTS);
  const [activeView, setActiveView] = useState('Week');
  const [participantFilter, setParticipantFilter] = useState('all'); // 'all', 'human', 'agent', 'customer'
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);

  // New Event Form State with typable numbers and selectable AM/PM
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDayIndex, setNewEventDayIndex] = useState(3); // default Thu

  // Start Time parts (Typable Hour, Typable Minute, Selectable AM/PM)
  const [startHour, setStartHour] = useState('10');
  const [startMinute, setStartMinute] = useState('00');
  const [startPeriod, setStartPeriod] = useState('AM'); // 'AM' | 'PM'

  // End Time parts (Typable Hour, Typable Minute, Selectable AM/PM)
  const [endHour, setEndHour] = useState('11');
  const [endMinute, setEndMinute] = useState('00');
  const [endPeriod, setEndPeriod] = useState('AM'); // 'AM' | 'PM'

  // Participant & Contact Information
  const [newEventClient, setNewEventClient] = useState('');
  const [newEventEmail, setNewEventEmail] = useState('');
  const [newEventPhone, setNewEventPhone] = useState('');
  const [newEventParticipantType, setNewEventParticipantType] = useState('agent');
  const [newEventAttendee, setNewEventAttendee] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('Microsoft Teams Meeting');
  const [newEventNotes, setNewEventNotes] = useState('');

  const gridScrollRef = useRef(null);

  // Auto-scroll to 8:00 AM on mount for best viewport positioning
  useEffect(() => {
    if (gridScrollRef.current) {
      gridScrollRef.current.scrollTop = 8 * 64; // 8:00 AM offset
    }
  }, []);

  const daysOfWeek = [
    { name: 'Mon', date: '14', fullDay: 'Monday, Sep 14' },
    { name: 'Tue', date: '15', fullDay: 'Tuesday, Sep 15' },
    { name: 'Wed', date: '16', fullDay: 'Wednesday, Sep 16' },
    { name: 'Thu', date: '17', fullDay: 'Thursday, Sep 17', isToday: true },
    { name: 'Fri', date: '18', fullDay: 'Friday, Sep 18' },
    { name: 'Sat', date: '19', fullDay: 'Saturday, Sep 19' },
    { name: 'Sun', date: '20', fullDay: 'Sunday, Sep 20' }
  ];

  // Full 24 Hours (12:00 AM to 11:00 PM)
  const hours = [
    '12:00 AM',
    '01:00 AM',
    '02:00 AM',
    '03:00 AM',
    '04:00 AM',
    '05:00 AM',
    '06:00 AM',
    '07:00 AM',
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
    '06:00 PM',
    '07:00 PM',
    '08:00 PM',
    '09:00 PM',
    '10:00 PM',
    '11:00 PM'
  ];

  const filteredEvents = events.filter((e) => {
    if (participantFilter === 'all') return true;
    return (e.participantType || 'human') === participantFilter;
  });

  const getParticipantCount = (type) => {
    if (type === 'all') return events.length;
    return events.filter((e) => (e.participantType || 'human') === type).length;
  };

  // Helper to handle and format hour inputs
  const handleHourChange = (val, setter) => {
    const clean = val.replace(/\D/g, '').slice(0, 2);
    setter(clean);
  };

  const handleHourBlur = (val, setter) => {
    let num = parseInt(val, 10);
    if (isNaN(num) || num < 1) num = 12;
    if (num > 12) num = 12;
    setter(String(num).padStart(2, '0'));
  };

  // Helper to handle and format minute inputs
  const handleMinuteChange = (val, setter) => {
    const clean = val.replace(/\D/g, '').slice(0, 2);
    setter(clean);
  };

  const handleMinuteBlur = (val, setter) => {
    let num = parseInt(val, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > 59) num = 59;
    setter(String(num).padStart(2, '0'));
  };

  // Triggered on double clicking any time slot in the 24h grid
  const handleSlotDoubleClick = (colIdx, hrIdx) => {
    const startObj = fromMinutesTo12h(hrIdx * 60);
    const endObj = fromMinutesTo12h(((hrIdx + 1) % 24) * 60);

    setNewEventDayIndex(colIdx);
    setStartHour(startObj.hour);
    setStartMinute(startObj.minute);
    setStartPeriod(startObj.period);

    setEndHour(endObj.hour);
    setEndMinute(endObj.minute);
    setEndPeriod(endObj.period);

    setNewEventTitle('');
    setNewEventClient('');
    setNewEventEmail('');
    setNewEventPhone('');
    setNewEventAttendee(
      participantFilter === 'agent'
        ? 'OmniFlow AI Agent'
        : participantFilter === 'customer'
        ? 'Customer Lead'
        : 'Staff Member'
    );
    setNewEventParticipantType(
      participantFilter !== 'all' ? participantFilter : 'agent'
    );
    setNewEventLocation('Microsoft Teams Meeting');
    setNewEventNotes('');
    setIsAddEventOpen(true);
  };

  const handleOpenAddModal = () => {
    setNewEventDayIndex(3); // Thu
    setStartHour('10');
    setStartMinute('00');
    setStartPeriod('AM');

    setEndHour('11');
    setEndMinute('00');
    setEndPeriod('AM');

    setNewEventTitle('');
    setNewEventClient('');
    setNewEventEmail('');
    setNewEventPhone('');
    setNewEventAttendee('OmniFlow AI Agent');
    setNewEventParticipantType(participantFilter !== 'all' ? participantFilter : 'agent');
    setNewEventLocation('Microsoft Teams Meeting');
    setNewEventNotes('');
    setIsAddEventOpen(true);
  };

  // Quick preset duration adder (e.g. +30 mins, +45 mins, +60 mins)
  const handleApplyDurationPreset = (durationMinutes) => {
    const startMins = toMinutesFrom12h(startHour, startMinute, startPeriod);
    const endMins = (startMins + durationMinutes) % 1440;
    const endObj = fromMinutesTo12h(endMins);
    setEndHour(endObj.hour);
    setEndMinute(endObj.minute);
    setEndPeriod(endObj.period);
  };

  const calculateEventDurationMinutes = () => {
    const startMins = toMinutesFrom12h(startHour, startMinute, startPeriod);
    let endMins = toMinutesFrom12h(endHour, endMinute, endPeriod);
    if (endMins <= startMins) {
      endMins = startMins + 60; // default 1 hour if wrap-around
    }
    return endMins - startMins;
  };

  const handleAddEventSubmit = (e) => {
    e.preventDefault();
    if (!newEventTitle) return;

    const startMins = toMinutesFrom12h(startHour, startMinute, startPeriod);
    let endMins = toMinutesFrom12h(endHour, endMinute, endPeriod);
    if (endMins <= startMins) {
      endMins = startMins + 60;
    }

    const durationMins = endMins - startMins;
    const topOffset = (startMins / 60) * 64;
    const height = Math.max(36, (durationMins / 60) * 64);
    const formattedTimeRange = `${format12hString(startHour, startMinute, startPeriod)} - ${format12hString(endHour, endMinute, endPeriod)}`;

    const newEv = {
      id: `ev-${Date.now()}`,
      title: newEventTitle,
      time: formattedTimeRange,
      startTime: format12hString(startHour, startMinute, startPeriod),
      endTime: format12hString(endHour, endMinute, endPeriod),
      dayIndex: newEventDayIndex,
      topOffset: Math.round(topOffset),
      height: Math.round(height),
      client: newEventClient || 'Enterprise Client',
      email: newEventEmail || 'Not specified',
      phone: newEventPhone || 'Not specified',
      attendee: newEventAttendee || (newEventParticipantType === 'human' ? 'Staff Member' : newEventParticipantType === 'agent' ? 'OmniFlow AI Agent' : 'Customer'),
      participantType: newEventParticipantType,
      type: newEventParticipantType === 'agent' ? 'AI Bot Scheduled' : newEventParticipantType === 'customer' ? 'Customer Self-Booked' : 'Staff Consultation',
      location: newEventLocation || 'Microsoft Teams Meeting',
      notes: newEventNotes,
      status: 'Confirmed',
      statusColor: newEventParticipantType === 'agent' ? 'purple' : newEventParticipantType === 'customer' ? 'emerald' : 'blue'
    };

    setEvents((prev) => [...prev, newEv]);
    setIsAddEventOpen(false);
  };

  const handleDeleteEvent = (id) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
    setSelectedEvent(null);
  };

  return (
    <div className="flex w-full h-[calc(100vh-5.5rem)] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm border border-surface-container select-none">
      {/* Mini Schedule Navigation Sidebar */}
      <aside className="w-[245px] flex-shrink-0 bg-surface-container-lowest border-r border-surface-container flex flex-col h-full z-20">
        <div className="h-14 flex items-center px-4 border-b border-surface-container">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">calendar_month</span>
            </div>
            <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Schedule</h1>
          </div>
        </div>

        {/* Mini Schedule Grid */}
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

        {/* Sidebar Filters & Actions */}
        <div className="mt-2 pt-3 border-t border-surface-container flex-1 px-3 space-y-3 overflow-y-auto">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center justify-center space-x-1.5 font-label-md text-label-md font-semibold text-primary bg-primary-container/15 hover:bg-primary-container/30 w-full px-3 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            <span>New Schedule</span>
          </button>

          {/* Participant Type Filters in Sidebar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant px-1">
              <span>Filter by Participant</span>
            </div>

            {/* All Filter */}
            <button
              type="button"
              onClick={() => setParticipantFilter('all')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-body-sm text-body-sm transition-colors text-left cursor-pointer ${
                participantFilter === 'all'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">select_all</span>
                <span>All Participants</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-md font-caption text-[11px] bg-surface-container text-on-surface-variant">
                {getParticipantCount('all')}
              </span>
            </button>

            {/* Human Filter */}
            <button
              type="button"
              onClick={() => setParticipantFilter('human')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-body-sm text-body-sm transition-colors text-left cursor-pointer ${
                participantFilter === 'human'
                  ? 'bg-blue-500/15 text-blue-600 font-semibold'
                  : 'text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xs">person</span>
                </div>
                <span>Human Staff</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-md font-caption text-[11px] bg-surface-container text-on-surface-variant">
                {getParticipantCount('human')}
              </span>
            </button>

            {/* Agent Filter */}
            <button
              type="button"
              onClick={() => setParticipantFilter('agent')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-body-sm text-body-sm transition-colors text-left cursor-pointer ${
                participantFilter === 'agent'
                  ? 'bg-purple-500/15 text-purple-600 font-semibold'
                  : 'text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xs">smart_toy</span>
                </div>
                <span>AI Agent</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-md font-caption text-[11px] bg-surface-container text-on-surface-variant">
                {getParticipantCount('agent')}
              </span>
            </button>

            {/* Customer Filter */}
            <button
              type="button"
              onClick={() => setParticipantFilter('customer')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-body-sm text-body-sm transition-colors text-left cursor-pointer ${
                participantFilter === 'customer'
                  ? 'bg-emerald-500/15 text-emerald-600 font-semibold'
                  : 'text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xs">group</span>
                </div>
                <span>Customer</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-md font-caption text-[11px] bg-surface-container text-on-surface-variant">
                {getParticipantCount('customer')}
              </span>
            </button>
          </div>

          {/* Quick Info & Hint */}
          <div className="pt-3 border-t border-surface-container">
            <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container text-on-surface-variant text-[11px] space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-on-surface">
                <span className="material-symbols-outlined text-sm text-primary">touch_app</span>
                <span>24-Hour Scheduling</span>
              </div>
              <p className="leading-relaxed opacity-85">
                Double-click any 24-hour time slot to book an event with typable numbers, selectable AM/PM, and client contact info.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Schedule Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface-container-lowest overflow-hidden">
        {/* Simplified & Clean Calendar TopBar Header */}
        <header className="h-14 bg-surface-container-lowest border-b border-surface-container flex items-center justify-between px-5 shrink-0">
          {/* Left: Navigation & Date Range */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md font-semibold rounded-lg border border-surface-container transition-colors cursor-pointer"
            >
              Today
            </button>
            <div className="flex items-center border border-surface-container rounded-lg overflow-hidden bg-surface-container-low">
              <button
                type="button"
                className="p-1.5 hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Previous week"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <div className="w-[1px] h-4 bg-surface-container" />
              <button
                type="button"
                className="p-1.5 hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Next week"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
            <h2 className="font-title-md text-title-md text-on-surface font-bold tracking-tight">
              September 2026
              <span className="text-on-surface-variant font-normal text-body-sm ml-2">
                (Sep 14 – 20)
              </span>
            </h2>
          </div>

          {/* Right: Active Filter Badge (when filtered) + View Switcher + Action CTA */}
          <div className="flex items-center gap-2.5">
            {participantFilter !== 'all' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low border border-surface-container text-xs text-on-surface">
                <span className="text-on-surface-variant">Filter:</span>
                <span className="font-semibold capitalize text-primary">{participantFilter}</span>
                <button
                  type="button"
                  onClick={() => setParticipantFilter('all')}
                  className="text-outline hover:text-on-surface ml-0.5 cursor-pointer flex items-center"
                  title="Clear filter"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            )}

            {/* View switcher */}
            <div className="inline-flex rounded-lg bg-surface-container-low p-0.5 border border-surface-container font-label-sm text-label-sm">
              {['Day', 'Week', 'Month'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setActiveView(v)}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeView === v
                      ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Action CTA */}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3.5 py-1.5 bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold rounded-lg flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>New Schedule</span>
            </button>
          </div>
        </header>

        {/* Schedule Day Columns Header */}
        <div className="grid grid-cols-8 border-b border-surface-container bg-surface-container-low/70 shrink-0">
          <div className="w-18 border-r border-surface-container py-2.5 text-center font-caption text-caption text-outline font-semibold">
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

        {/* Full 24-Hour Time Grid Scroll Area with Double-Click Slots */}
        <div ref={gridScrollRef} className="flex-1 overflow-y-auto relative">
          <div className="grid grid-cols-8 relative min-h-[1536px]">
            {/* 24-Hour Time labels column */}
            <div className="w-18 border-r border-surface-container select-none">
              {hours.map((h, i) => (
                <div key={i} className="time-slot-height pr-2 text-right font-caption text-[11px] text-outline font-medium -mt-2 border-t border-surface-container-low">
                  {h}
                </div>
              ))}
            </div>

            {/* 7 Days Columns */}
            {daysOfWeek.map((day, colIdx) => {
              const dayEvents = filteredEvents.filter((e) => e.dayIndex === colIdx);
              return (
                <div
                  key={colIdx}
                  className={`relative border-r border-surface-container last:border-r-0 ${
                    day.isToday ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* Interactive Double-Click Time Slots for all 24 hours */}
                  {hours.map((h, hrIdx) => (
                    <div
                      key={hrIdx}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleSlotDoubleClick(colIdx, hrIdx);
                      }}
                      title={`Double-click to schedule on ${day.name} ${day.date} at ${h}`}
                      className="time-slot-height border-t border-surface-container-low/80 relative group cursor-pointer hover:bg-primary/5 transition-colors"
                    >
                      {/* Subtle hover slot indicator */}
                      <div className="absolute inset-x-1 inset-y-1 rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all pointer-events-none z-0">
                        <span className="text-[11px] font-medium text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">add</span>
                          <span>Double-click to schedule ({h})</span>
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Render events for this column with participant type indicators */}
                  {dayEvents.map((ev) => {
                    const pType = ev.participantType || 'human';
                    const cardStyle =
                      pType === 'agent'
                        ? 'bg-purple-500/10 border-l-4 border-purple-600 text-purple-950 hover:bg-purple-500/20'
                        : pType === 'customer'
                        ? 'bg-emerald-500/10 border-l-4 border-emerald-600 text-emerald-950 hover:bg-emerald-500/20'
                        : 'bg-blue-500/10 border-l-4 border-blue-600 text-blue-950 hover:bg-blue-500/20';

                    const badgeStyle =
                      pType === 'agent'
                        ? 'bg-purple-500/20 text-purple-700'
                        : pType === 'customer'
                        ? 'bg-emerald-500/20 text-emerald-700'
                        : 'bg-blue-500/20 text-blue-700';

                    const iconName =
                      pType === 'agent' ? 'smart_toy' : pType === 'customer' ? 'group' : 'person';

                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                        }}
                        style={{ top: `${ev.topOffset}px`, height: `${ev.height}px` }}
                        className={`absolute inset-x-1 rounded-xl p-2.5 shadow-xs cursor-pointer hover:shadow-md transition-all overflow-hidden z-10 flex flex-col justify-between ${cardStyle}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-title-sm text-title-sm font-bold block truncate leading-tight">
                            {ev.title}
                          </span>
                          <span
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md font-caption text-[10px] font-semibold uppercase tracking-wider shrink-0 ${badgeStyle}`}
                          >
                            <span className="material-symbols-outlined text-[11px]">{iconName}</span>
                            <span>{pType}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-body-sm text-[11px] opacity-90 truncate mt-1">
                          <span className="truncate">{ev.time} • {ev.client}</span>
                          {ev.location && (
                            <span className="text-[10px] text-outline font-medium truncate ml-1">
                              {ev.location.includes('Teams') ? 'Teams' : ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Teams-Style Add Event / Schedule Modal with Typable Numbers & Contact Details */}
      {isAddEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg border border-surface-container-high flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-surface-container-low/70 border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-lg">videocam</span>
                </div>
                <div>
                  <h2 className="font-title-md text-title-md text-on-surface font-bold leading-tight">
                    New Meeting &amp; Schedule
                  </h2>
                  <p className="text-[11px] text-on-surface-variant">Custom time &amp; client contact booking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEventOpen(false)}
                className="w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleAddEventSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
              {/* Selected Slot Banner with Live Duration */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/15 text-primary">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">calendar_clock</span>
                  <span className="font-label-md text-label-md font-semibold">
                    {daysOfWeek[newEventDayIndex]?.fullDay || 'Today'} • {format12hString(startHour, startMinute, startPeriod)} – {format12hString(endHour, endMinute, endPeriod)}
                  </span>
                </div>
                <span className="text-[11px] font-medium bg-primary/10 px-2 py-0.5 rounded-md">
                  {formatDuration(calculateEventDurationMinutes())}
                </span>
              </div>

              {/* Title Input */}
              <div className="flex flex-col gap-1">
                <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant">
                  Meeting / Event Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Add title (e.g. 2:30 Client Review, Homestay Inspection)"
                  className="w-full h-10 px-3 font-title-sm text-title-sm rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                />
              </div>

              {/* Participant Type Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant">
                  Participant &amp; Booking Mode *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewEventParticipantType('agent');
                      if (!newEventAttendee) setNewEventAttendee('OmniFlow AI Agent');
                    }}
                    className={`py-2 px-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition-all cursor-pointer ${
                      newEventParticipantType === 'agent'
                        ? 'bg-purple-500/15 border-purple-500 text-purple-700 font-bold shadow-xs'
                        : 'bg-surface-container-low border-surface-container text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">smart_toy</span>
                    <span className="font-label-sm text-label-sm">AI Agent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewEventParticipantType('human');
                      if (!newEventAttendee) setNewEventAttendee('Staff Specialist');
                    }}
                    className={`py-2 px-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition-all cursor-pointer ${
                      newEventParticipantType === 'human'
                        ? 'bg-blue-500/15 border-blue-500 text-blue-700 font-bold shadow-xs'
                        : 'bg-surface-container-low border-surface-container text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">person</span>
                    <span className="font-label-sm text-label-sm">Human Staff</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewEventParticipantType('customer');
                      if (!newEventAttendee) setNewEventAttendee('Customer Direct');
                    }}
                    className={`py-2 px-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition-all cursor-pointer ${
                      newEventParticipantType === 'customer'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 font-bold shadow-xs'
                        : 'bg-surface-container-low border-surface-container text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">group</span>
                    <span className="font-label-sm text-label-sm">Customer</span>
                  </button>
                </div>
              </div>

              {/* Day Selection */}
              <div className="flex flex-col gap-1">
                <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant">
                  Day of Week
                </label>
                <select
                  value={newEventDayIndex}
                  onChange={(e) => setNewEventDayIndex(Number(e.target.value))}
                  className="h-10 px-3 font-body-sm text-body-sm rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner cursor-pointer"
                >
                  {daysOfWeek.map((d, i) => (
                    <option key={i} value={i}>
                      {d.name} {d.date} ({d.fullDay})
                    </option>
                  ))}
                </select>
              </div>

              {/* Typable Time Section (Direct Input Hours, Minutes & Selectable AM/PM) */}
              <div className="p-3.5 rounded-xl bg-surface-container-low/90 border border-surface-container space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant">
                    Time Range (Typable Numbers • Selectable AM/PM)
                  </span>
                  <span className="text-[11px] text-primary font-bold bg-primary/10 px-2.5 py-0.5 rounded-md">
                    {format12hString(startHour, startMinute, startPeriod)} to {format12hString(endHour, endMinute, endPeriod)}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {/* Start Time Typable Row */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container gap-3">
                    <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider min-w-[75px]">
                      Start Time
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Typable Hour & Minute Inputs */}
                      <div className="flex items-center bg-surface-container-low px-2.5 py-1 rounded-lg border border-surface-container focus-within:ring-1 focus-within:ring-primary">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          value={startHour}
                          onChange={(e) => handleHourChange(e.target.value, setStartHour)}
                          onBlur={(e) => handleHourBlur(e.target.value, setStartHour)}
                          placeholder="10"
                          title="Type Hour (1-12)"
                          className="w-8 text-center font-bold text-sm bg-transparent text-on-surface focus:outline-none"
                        />
                        <span className="font-bold text-on-surface-variant px-0.5">:</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          value={startMinute}
                          onChange={(e) => handleMinuteChange(e.target.value, setStartMinute)}
                          onBlur={(e) => handleMinuteBlur(e.target.value, setStartMinute)}
                          placeholder="00"
                          title="Type Minutes (00-59)"
                          className="w-8 text-center font-bold text-sm bg-transparent text-on-surface focus:outline-none"
                        />
                      </div>

                      {/* Selectable AM / PM Toggle Buttons */}
                      <div className="flex rounded-lg bg-surface-container-low p-0.5 border border-surface-container">
                        <button
                          type="button"
                          onClick={() => setStartPeriod('AM')}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            startPeriod === 'AM'
                              ? 'bg-primary text-on-primary shadow-xs'
                              : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          AM
                        </button>
                        <button
                          type="button"
                          onClick={() => setStartPeriod('PM')}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            startPeriod === 'PM'
                              ? 'bg-primary text-on-primary shadow-xs'
                              : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          PM
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* End Time Typable Row */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container gap-3">
                    <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider min-w-[75px]">
                      End Time
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Typable Hour & Minute Inputs */}
                      <div className="flex items-center bg-surface-container-low px-2.5 py-1 rounded-lg border border-surface-container focus-within:ring-1 focus-within:ring-primary">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          value={endHour}
                          onChange={(e) => handleHourChange(e.target.value, setEndHour)}
                          onBlur={(e) => handleHourBlur(e.target.value, setEndHour)}
                          placeholder="11"
                          title="Type Hour (1-12)"
                          className="w-8 text-center font-bold text-sm bg-transparent text-on-surface focus:outline-none"
                        />
                        <span className="font-bold text-on-surface-variant px-0.5">:</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          value={endMinute}
                          onChange={(e) => handleMinuteChange(e.target.value, setEndMinute)}
                          onBlur={(e) => handleMinuteBlur(e.target.value, setEndMinute)}
                          placeholder="00"
                          title="Type Minutes (00-59)"
                          className="w-8 text-center font-bold text-sm bg-transparent text-on-surface focus:outline-none"
                        />
                      </div>

                      {/* Selectable AM / PM Toggle Buttons */}
                      <div className="flex rounded-lg bg-surface-container-low p-0.5 border border-surface-container">
                        <button
                          type="button"
                          onClick={() => setEndPeriod('AM')}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            endPeriod === 'AM'
                              ? 'bg-primary text-on-primary shadow-xs'
                              : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          AM
                        </button>
                        <button
                          type="button"
                          onClick={() => setEndPeriod('PM')}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            endPeriod === 'PM'
                              ? 'bg-primary text-on-primary shadow-xs'
                              : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          PM
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Duration Preset Buttons */}
                <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-on-surface-variant mr-1">Quick Duration:</span>
                  {[
                    { label: '15m', mins: 15 },
                    { label: '30m', mins: 30 },
                    { label: '45m', mins: 45 },
                    { label: '1 hr', mins: 60 },
                    { label: '1.5 hrs', mins: 90 },
                    { label: '2 hrs', mins: 120 }
                  ].map((preset) => (
                    <button
                      key={preset.mins}
                      type="button"
                      onClick={() => handleApplyDurationPreset(preset.mins)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-container hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer text-on-surface"
                    >
                      +{preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Client & Attendee */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant">
                    Client / Account *
                  </label>
                  <input
                    type="text"
                    required
                    value={newEventClient}
                    onChange={(e) => setNewEventClient(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full h-10 px-3 font-body-sm text-body-sm rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant">
                    Attendee / Host
                  </label>
                  <input
                    type="text"
                    value={newEventAttendee}
                    onChange={(e) => setNewEventAttendee(e.target.value)}
                    placeholder="e.g. OmniFlow AI Agent"
                    className="w-full h-10 px-3 font-body-sm text-body-sm rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  />
                </div>
              </div>

              {/* Client Contact Info: Email Address & Phone Number */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-container-low/60 border border-surface-container">
                <div className="flex flex-col gap-1">
                  <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-primary">mail</span>
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={newEventEmail}
                    onChange={(e) => setNewEventEmail(e.target.value)}
                    placeholder="e.g. client@example.com"
                    className="w-full h-10 px-3 font-body-sm text-body-sm rounded-xl bg-surface-container-lowest text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-primary">call</span>
                    <span>Phone Number</span>
                  </label>
                  <input
                    type="tel"
                    value={newEventPhone}
                    onChange={(e) => setNewEventPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full h-10 px-3 font-body-sm text-body-sm rounded-xl bg-surface-container-lowest text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  />
                </div>
              </div>

              {/* Location / Channel */}
              <div className="flex flex-col gap-1">
                <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant">
                  Location / Channel
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Microsoft Teams Meeting', 'OmniFlow Voice Bot', 'In-Person Studio'].map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setNewEventLocation(loc)}
                      className={`px-2 py-2 rounded-xl border font-label-sm text-[12px] truncate transition-all cursor-pointer ${
                        newEventLocation === loc
                          ? 'bg-primary/10 border-primary text-primary font-semibold'
                          : 'bg-surface-container-low border-surface-container text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes / Agenda */}
              <div className="flex flex-col gap-1">
                <label className="font-caption text-caption uppercase tracking-wider font-semibold text-on-surface-variant">
                  Agenda / Notes
                </label>
                <textarea
                  rows={2}
                  value={newEventNotes}
                  onChange={(e) => setNewEventNotes(e.target.value)}
                  placeholder="Add meeting agenda or preparation notes..."
                  className="w-full p-2.5 font-body-sm text-body-sm rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner resize-none"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-surface-container mt-1">
                <button
                  type="button"
                  onClick={() => setIsAddEventOpen(false)}
                  className="px-4 py-2 font-label-md text-label-md font-semibold rounded-xl text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                >
                  Discard
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 font-label-md text-label-md font-semibold rounded-xl bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">send</span>
                    <span>Save &amp; Schedule</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Schedule Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg w-full max-w-md border border-surface-container-high flex flex-col gap-3.5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold uppercase tracking-wider ${
                    selectedEvent.participantType === 'agent'
                      ? 'bg-purple-500/20 text-purple-700'
                      : selectedEvent.participantType === 'customer'
                      ? 'bg-emerald-500/20 text-emerald-700'
                      : 'bg-blue-500/20 text-blue-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">
                    {selectedEvent.participantType === 'agent'
                      ? 'smart_toy'
                      : selectedEvent.participantType === 'customer'
                      ? 'group'
                      : 'person'}
                  </span>
                  <span>{selectedEvent.participantType || 'human'}</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold bg-secondary-fixed/50 text-on-secondary-fixed-variant flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  {selectedEvent.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold leading-tight">
                {selectedEvent.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-primary text-[12px] font-semibold">
                <span className="material-symbols-outlined text-sm">schedule</span>
                <span>{selectedEvent.time}</span>
              </div>
            </div>

            <div className="space-y-2 font-body-sm text-body-sm text-on-surface-variant pt-2 border-t border-surface-container-low">
              <p className="flex items-center justify-between">
                <span className="text-outline">Client / Account:</span>
                <strong className="text-on-surface">{selectedEvent.client}</strong>
              </p>
              {selectedEvent.email && (
                <p className="flex items-center justify-between">
                  <span className="text-outline flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">mail</span>
                    <span>Email:</span>
                  </span>
                  <a href={`mailto:${selectedEvent.email}`} className="text-primary hover:underline font-medium">
                    {selectedEvent.email}
                  </a>
                </p>
              )}
              {selectedEvent.phone && (
                <p className="flex items-center justify-between">
                  <span className="text-outline flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">call</span>
                    <span>Phone:</span>
                  </span>
                  <a href={`tel:${selectedEvent.phone}`} className="text-primary hover:underline font-medium">
                    {selectedEvent.phone}
                  </a>
                </p>
              )}
              <p className="flex items-center justify-between">
                <span className="text-outline">Host / Attendee:</span>
                <strong className="text-on-surface">{selectedEvent.attendee || selectedEvent.client}</strong>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-outline">Booking Mode:</span>
                <span className="font-medium text-on-surface">{selectedEvent.type}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-outline">Location / Channel:</span>
                <span className="font-medium text-on-surface">{selectedEvent.location || 'Microsoft Teams Meeting'}</span>
              </p>
              {selectedEvent.notes && (
                <div className="pt-2 border-t border-surface-container-low">
                  <span className="text-outline text-xs block mb-1">Notes:</span>
                  <p className="text-xs text-on-surface bg-surface-container-low p-2 rounded-lg">{selectedEvent.notes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => handleDeleteEvent(selectedEvent.id)}
                className="px-3 py-2 font-label-md text-label-md font-semibold text-error hover:bg-error/10 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span>Delete</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-5 py-2 bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
