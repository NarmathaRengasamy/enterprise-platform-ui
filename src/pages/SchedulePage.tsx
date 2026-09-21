import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_SCHEDULE_EVENTS } from '../data/mockData';
import { Button } from '../components/common';

// Format Date object to "YYYY-MM-DD"
const formatDateKey = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Check if two dates represent the same calendar day
const isSameDay = (d1, d2) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

// Generate 35 or 42 calendar grid cells for a given month and year
const generateMonthGrid = (year, month, todayDate, selectedDate) => {
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];

  // Previous month padding
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrevMonth - i);
    cells.push({
      dateObj: d,
      date: d.getDate(),
      month: MONTH_NAMES_SHORT[d.getMonth()],
      isCurrentMonth: false,
      isToday: isSameDay(d, todayDate),
      isSelected: selectedDate ? isSameDay(d, selectedDate) : false,
      dateKey: formatDateKey(d),
      dayIndex: (d.getDay() + 6) % 7
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    cells.push({
      dateObj: d,
      date: i,
      month: MONTH_NAMES_SHORT[month],
      isCurrentMonth: true,
      isToday: isSameDay(d, todayDate),
      isSelected: selectedDate ? isSameDay(d, selectedDate) : false,
      dateKey: formatDateKey(d),
      dayIndex: (d.getDay() + 6) % 7
    });
  }

  // Next month padding to reach full weeks (35 or 42 total cells)
  const totalCells = cells.length > 35 ? 42 : 35;
  const remaining = totalCells - cells.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    cells.push({
      dateObj: d,
      date: i,
      month: MONTH_NAMES_SHORT[d.getMonth()],
      isCurrentMonth: false,
      isToday: isSameDay(d, todayDate),
      isSelected: selectedDate ? isSameDay(d, selectedDate) : false,
      dateKey: formatDateKey(d),
      dayIndex: (d.getDay() + 6) % 7
    });
  }

  return cells;
};

interface SchedulePageProps {
  selectedEvent?: any;
  setSelectedEvent?: (event: any) => void;
}

export default function SchedulePage({
  selectedEvent: propSelectedEvent,
  setSelectedEvent: propSetSelectedEvent
}: SchedulePageProps = {}) {
  const [events, setEvents] = useState(INITIAL_SCHEDULE_EVENTS);
  const [activeView, setActiveView] = useState('Week'); // 'Day' | 'Week' | 'Month'

  // Dynamic Calendar Navigation Date States (default: Sep 17, 2026)
  const [todayDate] = useState(() => new Date(2026, 8, 17));
  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 8, 17));
  const [sidebarDate, setSidebarDate] = useState(() => new Date(2026, 8, 1));
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(2026);

  const [participantFilter, setParticipantFilter] = useState('all'); // 'all', 'human', 'agent', 'customer'
  const [internalSelectedEvent, setInternalSelectedEvent] = useState(null);

  const selectedEvent = propSelectedEvent !== undefined ? propSelectedEvent : internalSelectedEvent;
  const setSelectedEvent = (evt) => {
    if (propSetSelectedEvent) propSetSelectedEvent(evt);
    setInternalSelectedEvent(evt);
  };

  // When an event is selected from outside (e.g. Dashboard), navigate calendar to event date
  useEffect(() => {
    if (propSelectedEvent && propSelectedEvent.dateKey) {
      const parts = propSelectedEvent.dateKey.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const targetDate = new Date(year, month, day);
        setSelectedDate(targetDate);
        setSidebarDate(new Date(year, month, 1));
        setPickerYear(year);
      }
    }
  }, [propSelectedEvent]);

  const [isAddEventOpen, setIsAddEventOpen] = useState(false);

  // New Event Form State with typable numbers and selectable AM/PM
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDateObj, setNewEventDateObj] = useState(() => new Date(2026, 8, 17));

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
  const dayGridScrollRef = useRef(null);
  const monthPickerRef = useRef(null);

  // Close month picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target)) {
        setIsMonthPickerOpen(false);
      }
    };
    if (isMonthPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMonthPickerOpen]);

  // Auto-scroll to 8:00 AM on mount / view change
  useEffect(() => {
    if (gridScrollRef.current) {
      gridScrollRef.current.scrollTop = 8 * 64; // 8:00 AM offset
    }
    if (dayGridScrollRef.current) {
      dayGridScrollRef.current.scrollTop = 8 * 64;
    }
  }, [activeView]);

  // Compute 7 days of the currently selected week (Monday to Sunday)
  const currentWeekDays = React.useMemo(() => {
    const dayOfWeek = (selectedDate.getDay() + 6) % 7; // Mon = 0, Sun = 6
    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isCurToday = isSameDay(d, todayDate);
      const isCurSelected = isSameDay(d, selectedDate);
      return {
        dateObj: d,
        name: DAY_NAMES_SHORT[i],
        fullName: DAY_NAMES_FULL[i],
        date: String(d.getDate()).padStart(2, '0'),
        dateNum: d.getDate(),
        monthShort: MONTH_NAMES_SHORT[d.getMonth()],
        fullDay: `${DAY_NAMES_FULL[i]}, ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getDate()}`,
        dateKey: formatDateKey(d),
        isToday: isCurToday,
        isSelected: isCurSelected,
        dayIndex: i
      };
    });
  }, [selectedDate, todayDate]);

  // Compute Month Grid for Main View
  const mainMonthGrid = React.useMemo(() => {
    return generateMonthGrid(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      todayDate,
      selectedDate
    );
  }, [selectedDate, todayDate]);

  // Compute Month Grid for Sidebar Mini Calendar
  const sidebarMonthGrid = React.useMemo(() => {
    return generateMonthGrid(
      sidebarDate.getFullYear(),
      sidebarDate.getMonth(),
      todayDate,
      selectedDate
    );
  }, [sidebarDate, todayDate, selectedDate]);

  // Full 24 Hours list
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

  // Match events for a specific dateKey
  const getEventsForDateKey = (dateKey) => {
    return filteredEvents.filter((e) => {
      if (e.dateKey) return e.dateKey === dateKey;
      // Fallback matching if event is legacy
      return false;
    });
  };

  // Header Navigation: Previous Button (<)
  const handleNavPrev = () => {
    const newDate = new Date(selectedDate);
    if (activeView === 'Day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (activeView === 'Week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (activeView === 'Month') {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setSelectedDate(newDate);
    setSidebarDate(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
  };

  // Header Navigation: Next Button (>)
  const handleNavNext = () => {
    const newDate = new Date(selectedDate);
    if (activeView === 'Day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (activeView === 'Week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (activeView === 'Month') {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
    setSidebarDate(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
  };

  // Header Navigation: Today Button
  const handleNavToday = () => {
    const todayCopy = new Date(todayDate);
    setSelectedDate(todayCopy);
    setSidebarDate(new Date(todayCopy.getFullYear(), todayCopy.getMonth(), 1));
  };

  // Sidebar Mini Calendar Navigation
  const handleSidebarPrevMonth = () => {
    const newD = new Date(sidebarDate);
    newD.setMonth(newD.getMonth() - 1);
    setSidebarDate(newD);
  };

  const handleSidebarNextMonth = () => {
    const newD = new Date(sidebarDate);
    newD.setMonth(newD.getMonth() + 1);
    setSidebarDate(newD);
  };

  // Jump to specific month/year from popup picker
  const handleSelectMonthFromPicker = (monthIndex) => {
    const newD = new Date(pickerYear, monthIndex, Math.min(selectedDate.getDate(), 28));
    setSelectedDate(newD);
    setSidebarDate(new Date(pickerYear, monthIndex, 1));
    setIsMonthPickerOpen(false);
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

  // Triggered on double clicking any time slot in the grid
  const handleSlotDoubleClick = (targetDateObj, hrIdx) => {
    const startObj = fromMinutesTo12h(hrIdx * 60);
    const endObj = fromMinutesTo12h(((hrIdx + 1) % 24) * 60);

    setNewEventDateObj(targetDateObj);
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

  // Triggered when double clicking a month calendar cell
  const handleMonthCellDoubleClick = (cell) => {
    setNewEventDateObj(cell.dateObj);
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

  const handleOpenAddModal = () => {
    setNewEventDateObj(selectedDate);
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
      dateKey: formatDateKey(newEventDateObj),
      dayIndex: (newEventDateObj.getDay() + 6) % 7,
      dateNum: newEventDateObj.getDate(),
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

  // Header Title Formatting with Dynamic Single Unified Date Range
  const renderHeaderTitle = () => {
    if (activeView === 'Day') {
      const dayName = DAY_NAMES_SHORT[(selectedDate.getDay() + 6) % 7];
      const monthName = MONTH_NAMES_SHORT[selectedDate.getMonth()];
      const dayNum = selectedDate.getDate();
      const year = selectedDate.getFullYear();
      const isCurToday = isSameDay(selectedDate, todayDate);

      return (
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <button
            type="button"
            onClick={() => {
              setPickerYear(selectedDate.getFullYear());
              setIsMonthPickerOpen(!isMonthPickerOpen);
            }}
            className="flex items-center gap-1.5 hover:text-primary transition-colors text-left font-title-md text-title-md font-bold text-on-surface cursor-pointer"
            title="Click to jump to another month or year"
          >
            <span>{dayName}, {monthName} {dayNum}, {year}</span>
            <span className="material-symbols-outlined text-base text-outline">expand_more</span>
          </button>
          {isCurToday && (
            <span className="text-primary font-semibold text-[11px] bg-primary/10 px-2 py-0.5 rounded-md">
              Today
            </span>
          )}
        </div>
      );
    }

    if (activeView === 'Month') {
      const monthName = MONTH_NAMES[selectedDate.getMonth()];
      const year = selectedDate.getFullYear();

      return (
        <button
          type="button"
          onClick={() => {
            setPickerYear(selectedDate.getFullYear());
            setIsMonthPickerOpen(!isMonthPickerOpen);
          }}
          className="flex items-center gap-1.5 hover:text-primary transition-colors text-left font-title-md text-title-md font-bold text-on-surface cursor-pointer whitespace-nowrap shrink-0"
          title="Click to jump to another month or year"
        >
          <span>{monthName} {year}</span>
          <span className="material-symbols-outlined text-base text-outline">expand_more</span>
        </button>
      );
    }

    // Week View - Single unified date range with month picker toggle (no duplicate field)
    const firstDay = currentWeekDays[0]?.dateObj || selectedDate;
    const lastDay = currentWeekDays[6]?.dateObj || selectedDate;
    const startMonthShort = MONTH_NAMES_SHORT[firstDay.getMonth()];
    const endMonthShort = MONTH_NAMES_SHORT[lastDay.getMonth()];
    const startYear = firstDay.getFullYear();
    const endYear = lastDay.getFullYear();

    let formattedWeekTitle = '';
    if (firstDay.getMonth() === lastDay.getMonth()) {
      formattedWeekTitle = `${startMonthShort} ${firstDay.getDate()} – ${lastDay.getDate()}, ${startYear}`;
    } else if (startYear === endYear) {
      formattedWeekTitle = `${startMonthShort} ${firstDay.getDate()} – ${endMonthShort} ${lastDay.getDate()}, ${startYear}`;
    } else {
      formattedWeekTitle = `${startMonthShort} ${firstDay.getDate()}, ${startYear} – ${endMonthShort} ${lastDay.getDate()}, ${endYear}`;
    }

    return (
      <button
        type="button"
        onClick={() => {
          setPickerYear(selectedDate.getFullYear());
          setIsMonthPickerOpen(!isMonthPickerOpen);
        }}
        className="flex items-center gap-1.5 hover:text-primary transition-colors text-left font-title-md text-title-md font-bold text-on-surface cursor-pointer whitespace-nowrap shrink-0"
        title="Click to jump to another month or year"
      >
        <span>{formattedWeekTitle}</span>
        <span className="material-symbols-outlined text-base text-outline">expand_more</span>
      </button>
    );
  };

  return (
    <div className="flex w-full h-[calc(100vh-6.75rem)] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm border border-surface-container select-none">
      {/* Mini Schedule Navigation Sidebar */}
      <aside className="w-[260px] flex-shrink-0 bg-surface-container-lowest border-r border-surface-container flex flex-col h-full z-20 overflow-hidden">
        <div className="h-14 flex items-center px-4 border-b border-surface-container shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">calendar_month</span>
            </div>
            <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Schedule</h1>
          </div>
        </div>

        {/* Mini Dynamic Calendar */}
        <div className="px-3.5 pt-3 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => {
                setPickerYear(sidebarDate.getFullYear());
                setIsMonthPickerOpen(!isMonthPickerOpen);
              }}
              className="flex items-center space-x-1 font-title-sm text-title-sm font-semibold text-on-surface hover:text-primary focus:outline-none transition-colors cursor-pointer"
            >
              <span>{MONTH_NAMES[sidebarDate.getMonth()]} {sidebarDate.getFullYear()}</span>
              <span className="material-symbols-outlined text-sm text-outline">expand_more</span>
            </button>
            <div className="flex items-center space-x-0.5 text-outline">
              <button
                type="button"
                onClick={handleSidebarPrevMonth}
                title="Previous month"
                className="p-1 hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={handleSidebarNextMonth}
                title="Next month"
                className="p-1 hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center font-caption text-xs font-semibold text-on-surface-variant uppercase mb-1">
            <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
          </div>

          <div className="grid grid-cols-7 text-center font-body-sm text-xs font-normal gap-y-0.5 relative">
            {sidebarMonthGrid.map((c, i) => {
              const isSelected = isSameDay(c.dateObj, selectedDate);
              return (
                <span
                  key={i}
                  onClick={() => {
                    setSelectedDate(c.dateObj);
                  }}
                  className={`cursor-pointer transition-colors text-center rounded-full flex items-center justify-center w-7 h-7 mx-auto ${
                    !c.isCurrentMonth
                      ? 'text-outline/40 hover:bg-surface-container-low'
                      : c.isToday
                      ? 'font-bold text-on-primary'
                      : isSelected
                      ? 'bg-primary/20 text-primary font-bold'
                      : 'text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  {c.isToday ? (
                    <span className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-xs text-on-primary text-xs">
                      {c.date}
                    </span>
                  ) : (
                    c.date
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Sidebar Filters & Actions with Consistent Unified Spacing */}
        <div className="pt-3 border-t border-surface-container px-3.5 space-y-3 shrink-0">
          <Button
            variant="soft"
            size="md"
            fullWidth
            startIcon="add_circle"
            onClick={handleOpenAddModal}
          >
            New Schedule
          </Button>

          {/* Participant Type Filters (2x2 Grid) */}
          <div>
            <div className="flex items-center justify-between font-caption text-[11px] uppercase tracking-wider font-bold text-on-surface-variant px-1 mb-1.5">
              <span>Filter Participant</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {/* All */}
              <button
                type="button"
                onClick={() => setParticipantFilter('all')}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                  participantFilter === 'all'
                    ? 'bg-primary text-on-primary font-bold shadow-xs'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                <span>All</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                  participantFilter === 'all' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-on-surface-variant'
                }`}>
                  {getParticipantCount('all')}
                </span>
              </button>

              {/* Human / Staff */}
              <button
                type="button"
                onClick={() => setParticipantFilter('human')}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                  participantFilter === 'human'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${participantFilter === 'human' ? 'bg-white' : 'bg-blue-500'}`}></span>
                  <span>Staff</span>
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                  participantFilter === 'human' ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
                }`}>
                  {getParticipantCount('human')}
                </span>
              </button>

              {/* Agent */}
              <button
                type="button"
                onClick={() => setParticipantFilter('agent')}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                  participantFilter === 'agent'
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${participantFilter === 'agent' ? 'bg-white' : 'bg-purple-500'}`}></span>
                  <span>Agent</span>
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                  participantFilter === 'agent' ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
                }`}>
                  {getParticipantCount('agent')}
                </span>
              </button>

              {/* Customer / Client */}
              <button
                type="button"
                onClick={() => setParticipantFilter('customer')}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                  participantFilter === 'customer'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${participantFilter === 'customer' ? 'bg-white' : 'bg-emerald-500'}`}></span>
                  <span>Client</span>
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                  participantFilter === 'customer' ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
                }`}>
                  {getParticipantCount('customer')}
                </span>
              </button>
            </div>
          </div>

          {/* Schedule Summary & Activity Status */}
          <div className="p-3 rounded-xl bg-surface-container-low/70 border border-surface-container text-on-surface space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-outline uppercase tracking-wider text-[10px]">Upcoming Status</span>
              <span className="text-emerald-700 bg-emerald-500/15 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">
                {events.filter((e) => e.status === 'Confirmed').length} Active
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-on-surface-variant pt-0.5">
              <div className="flex items-center justify-between">
                <span>Total Scheduled:</span>
                <span className="font-bold text-on-surface">{events.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  <span>AI Agent Bookings:</span>
                </span>
                <span className="font-bold text-purple-700">{getParticipantCount('agent')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>Human Staff Consults:</span>
                </span>
                <span className="font-bold text-blue-700">{getParticipantCount('human')}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Schedule Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface-container-lowest overflow-hidden relative">
        {/* Teams-Style Month/Year Quick Jump Popover */}
        {isMonthPickerOpen && (
          <div
            ref={monthPickerRef}
            className="absolute top-14 left-5 z-40 bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high p-4 w-72 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Year selector header */}
            <div className="flex items-center justify-between pb-3 border-b border-surface-container mb-3">
              <span className="font-bold text-sm text-on-surface">Select Month &amp; Year</span>
              <div className="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded-lg border border-surface-container">
                <button
                  type="button"
                  onClick={() => setPickerYear((y) => y - 1)}
                  className="p-0.5 hover:text-primary text-outline transition-colors cursor-pointer"
                  title="Previous year"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <span className="text-xs font-bold text-primary px-1">{pickerYear}</span>
                <button
                  type="button"
                  onClick={() => setPickerYear((y) => y + 1)}
                  className="p-0.5 hover:text-primary text-outline transition-colors cursor-pointer"
                  title="Next year"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>

            {/* 12 Months Grid */}
            <div className="grid grid-cols-3 gap-2">
              {MONTH_NAMES_SHORT.map((mName, mIdx) => {
                const isCurrentMonth =
                  selectedDate.getMonth() === mIdx && selectedDate.getFullYear() === pickerYear;
                return (
                  <button
                    key={mName}
                    type="button"
                    onClick={() => handleSelectMonthFromPicker(mIdx)}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      isCurrentMonth
                        ? 'bg-primary text-on-primary border-primary shadow-xs font-bold'
                        : 'bg-surface-container-low border-surface-container text-on-surface hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    {mName}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 mt-3 border-t border-surface-container flex items-center justify-between">
              <button
                type="button"
                onClick={handleNavToday}
                className="text-xs text-primary hover:underline font-semibold cursor-pointer"
              >
                Go to Today
              </button>
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen(false)}
                className="text-xs text-on-surface-variant hover:text-on-surface px-2.5 py-1 rounded-lg hover:bg-surface-container cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Simplified & Clean Calendar TopBar Header with Dynamic Navigation */}
        <header className="h-14 bg-surface-container-lowest border-b border-surface-container flex items-center justify-between px-4 sm:px-5 shrink-0 z-10 gap-3">
          {/* Left: Unified Navigation (<, Today, >) & Single Dynamic Date Title */}
          <div className="flex items-center gap-3 min-w-0 flex-nowrap shrink-0">
            {/* Unified Navigation Button Group */}
            <div className="inline-flex items-center bg-surface-container-low rounded-xl border border-surface-container p-0.5 shadow-xs shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="chevron_left"
                onClick={handleNavPrev}
                title={`Previous ${activeView.toLowerCase()}`}
                aria-label={`Previous ${activeView.toLowerCase()}`}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNavToday}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="chevron_right"
                onClick={handleNavNext}
                title={`Next ${activeView.toLowerCase()}`}
                aria-label={`Next ${activeView.toLowerCase()}`}
              />
            </div>

            {renderHeaderTitle()}
          </div>

          {/* Right: Active Filter Badge (when filtered) + View Switcher + Action CTA */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-nowrap">
            {participantFilter !== 'all' && (
              <Button
                variant="soft"
                size="sm"
                endIcon="close"
                onClick={() => setParticipantFilter('all')}
                title="Click to clear filter"
              >
                <span>Filter: <span className="font-bold capitalize">{participantFilter === 'customer' ? 'Client' : participantFilter === 'human' ? 'Staff' : 'Agent'}</span></span>
              </Button>
            )}

            {/* View switcher: Day, Week, Month */}
            <div className="inline-flex rounded-xl bg-surface-container-low p-0.5 border border-surface-container font-label-sm text-label-sm shrink-0 shadow-xs">
              {['Day', 'Week', 'Month'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setActiveView(v)}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
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
            <Button
              variant="primary"
              size="md"
              startIcon="add"
              onClick={handleOpenAddModal}
            >
              New Schedule
            </Button>
          </div>
        </header>

        {/* -------------------------------------------------------------------------------- */}
        {/* VIEW 1: DAY VIEW */}
        {/* -------------------------------------------------------------------------------- */}
        {activeView === 'Day' && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Dynamic Day Selector Ribbon */}
            <div className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-low/70 border-b border-surface-container overflow-x-auto shrink-0">
              {currentWeekDays.map((d, idx) => {
                const dayEventCount = getEventsForDateKey(d.dateKey).length;
                const isSelected = isSameDay(d.dateObj, selectedDate);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDate(d.dateObj)}
                    className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                      isSelected
                        ? 'bg-primary text-on-primary border-primary shadow-sm font-semibold'
                        : d.isToday
                        ? 'bg-primary/10 border-primary/30 text-on-surface hover:bg-primary/15'
                        : 'bg-surface-container-lowest border-surface-container text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <span className={`text-[11px] uppercase tracking-wider ${isSelected ? 'text-on-primary/90' : 'text-on-surface-variant font-medium'}`}>
                      {d.name} {d.isToday && !isSelected && '• Today'}
                    </span>
                    <span className="text-base font-bold leading-tight">{d.date}</span>
                    {dayEventCount > 0 && (
                      <span className={`text-[10px] px-2 py-0.2 rounded-full font-semibold mt-0.5 ${
                        isSelected ? 'bg-on-primary/20 text-on-primary' : 'bg-primary/15 text-primary'
                      }`}>
                        {dayEventCount} {dayEventCount === 1 ? 'event' : 'events'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Single Day 24-Hour Timeline */}
            <div ref={dayGridScrollRef} className="flex-1 overflow-y-auto relative bg-surface-container-lowest">
              <div className="flex relative h-[1536px]">
                {/* Time Labels Column */}
                <div className="w-16 border-r border-surface-container select-none shrink-0 bg-surface-container-low/30">
                  {hours.map((h, i) => (
                    <div
                      key={i}
                      className="h-16 flex items-start justify-center pt-1.5 font-caption text-[11px] text-outline font-medium border-t border-surface-container-low"
                    >
                      {h}
                    </div>
                  ))}
                </div>

                {/* Day Single Column Canvas */}
                <div className="flex-1 relative border-r border-surface-container">
                  {/* Interactive Double-Click Time Slots */}
                  {hours.map((h, hrIdx) => (
                    <div
                      key={hrIdx}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleSlotDoubleClick(selectedDate, hrIdx);
                      }}
                      title={`Double-click to schedule on ${DAY_NAMES_FULL[(selectedDate.getDay() + 6) % 7]} at ${h}`}
                      className="h-16 border-t border-surface-container-low/80 relative group cursor-pointer hover:bg-primary/5 transition-colors"
                    >
                      <div className="absolute inset-x-2 inset-y-1 rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] opacity-0 group-hover:opacity-100 flex items-center justify-between px-3 transition-all pointer-events-none z-0">
                        <span className="text-[12px] font-medium text-primary flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[15px]">add_circle</span>
                          <span>Double-click to book meeting on {DAY_NAMES_SHORT[(selectedDate.getDay() + 6) % 7]} at {h}</span>
                        </span>
                        <span className="text-[11px] text-primary/70 font-semibold">
                          Click or double click to add
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Render Day Events with Full Width & Rich Details */}
                  {getEventsForDateKey(formatDateKey(selectedDate)).map((ev) => {
                    const pType = ev.participantType || 'human';
                    const cardStyle =
                      pType === 'agent'
                        ? 'bg-purple-500/10 border-l-4 border-purple-600 text-purple-950 hover:bg-purple-500/15'
                        : pType === 'customer'
                        ? 'bg-emerald-500/10 border-l-4 border-emerald-600 text-emerald-950 hover:bg-emerald-500/15'
                        : 'bg-blue-500/10 border-l-4 border-blue-600 text-blue-950 hover:bg-blue-500/15';

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
                        style={{ top: `${ev.topOffset}px`, height: `${Math.max(54, ev.height)}px` }}
                        className={`absolute inset-x-3 rounded-xl p-3 shadow-xs cursor-pointer hover:shadow-md transition-all overflow-hidden z-10 flex flex-col justify-between ${cardStyle}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-title-sm text-title-sm font-bold truncate">
                              {ev.title}
                            </span>
                            <span className="text-xs text-on-surface-variant font-medium bg-surface-container px-2 py-0.5 rounded-md shrink-0">
                              {ev.time}
                            </span>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-caption text-[11px] font-semibold uppercase tracking-wider shrink-0 ${badgeStyle}`}
                          >
                            <span className="material-symbols-outlined text-[13px]">{iconName}</span>
                            <span>{pType}</span>
                          </span>
                        </div>

                        {/* Extra Day View Details */}
                        <div className="flex items-center gap-4 text-xs font-medium text-on-surface-variant mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-on-surface font-semibold">
                            <span className="material-symbols-outlined text-xs text-primary">account_circle</span>
                            <span>{ev.client}</span>
                          </span>

                          {ev.email && (
                            <span className="flex items-center gap-1 text-primary">
                              <span className="material-symbols-outlined text-xs">mail</span>
                              <span>{ev.email}</span>
                            </span>
                          )}

                          {ev.phone && (
                            <span className="flex items-center gap-1 text-primary">
                              <span className="material-symbols-outlined text-xs">call</span>
                              <span>{ev.phone}</span>
                            </span>
                          )}

                          {ev.location && (
                            <span className="flex items-center gap-1 text-outline">
                              <span className="material-symbols-outlined text-xs">videocam</span>
                              <span>{ev.location}</span>
                            </span>
                          )}

                          <span className="ml-auto text-[11px] text-emerald-700 font-semibold bg-emerald-500/15 px-2 py-0.2 rounded-md">
                            {ev.status || 'Confirmed'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------------------------- */}
        {/* VIEW 2: WEEK VIEW */}
        {/* -------------------------------------------------------------------------------- */}
        {activeView === 'Week' && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Dynamic Week Day Columns Header */}
            <div className="flex border-b border-surface-container bg-surface-container-low/70 shrink-0">
              <div className="w-16 border-r border-surface-container py-2.5 flex items-center justify-center gap-1 font-caption text-caption text-outline font-semibold shrink-0">
                <span className="material-symbols-outlined text-[13px] text-outline">schedule</span>
                <span>Time</span>
              </div>
              <div className="flex-1 grid grid-cols-7">
                {currentWeekDays.map((d, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDate(d.dateObj);
                    }}
                    className={`py-2 text-center border-r border-surface-container last:border-r-0 cursor-pointer hover:bg-surface-container-low transition-colors ${
                      d.isToday ? 'bg-primary/5' : ''
                    }`}
                    title={`Click to select ${d.fullName}`}
                  >
                    <span className="font-caption text-caption text-on-surface-variant font-semibold uppercase block">
                      {d.name}
                    </span>
                    <span
                      className={`font-title-sm text-title-sm inline-flex items-center justify-center mt-0.5 ${
                        d.isToday
                          ? 'w-7 h-7 rounded-full bg-primary text-on-primary font-bold shadow-sm'
                          : isSameDay(d.dateObj, selectedDate)
                          ? 'w-7 h-7 rounded-full bg-primary/15 text-primary font-bold'
                          : 'text-on-surface font-bold'
                      }`}
                    >
                      {d.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Full 24-Hour Time Grid Scroll Area with Double-Click Slots */}
            <div ref={gridScrollRef} className="flex-1 overflow-y-auto relative">
              <div className="flex relative h-[1536px]">
                {/* 24-Hour Time labels column */}
                <div className="w-16 border-r border-surface-container select-none bg-surface-container-low/30 shrink-0">
                  {hours.map((h, i) => (
                    <div
                      key={i}
                      className="h-16 flex items-start justify-center pt-1.5 font-caption text-[11px] text-outline font-medium border-t border-surface-container-low"
                    >
                      {h}
                    </div>
                  ))}
                </div>

                {/* 7 Days Columns */}
                <div className="flex-1 grid grid-cols-7">
                  {currentWeekDays.map((day, colIdx) => {
                    const dayEvents = getEventsForDateKey(day.dateKey);
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
                              handleSlotDoubleClick(day.dateObj, hrIdx);
                            }}
                            title={`Double-click to schedule on ${day.name} ${day.date} at ${h}`}
                            className="h-16 border-t border-surface-container-low/80 relative group cursor-pointer hover:bg-primary/5 transition-colors"
                          >
                            {/* Subtle hover slot indicator */}
                            <div className="absolute inset-x-1 inset-y-1 rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all pointer-events-none z-0">
                              <span className="text-[11px] font-medium text-primary flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">add</span>
                                <span>Double-click ({h})</span>
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

                          const dotColor =
                            pType === 'agent'
                              ? 'bg-purple-600'
                              : pType === 'customer'
                              ? 'bg-emerald-600'
                              : 'bg-blue-600';

                          const badgeStyle =
                            pType === 'agent'
                              ? 'bg-purple-500/20 text-purple-700'
                              : pType === 'customer'
                              ? 'bg-emerald-500/20 text-emerald-700'
                              : 'bg-blue-500/20 text-blue-700';

                          const iconName =
                            pType === 'agent' ? 'smart_toy' : pType === 'customer' ? 'group' : 'person';

                          const isTall = ev.height >= 68;

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
                              style={{ top: `${ev.topOffset}px`, height: `${Math.max(46, ev.height)}px` }}
                              title={`${ev.title}\nTime: ${ev.time}\nClient: ${ev.client}\nType: ${ev.type || pType}\nLocation: ${ev.location}`}
                              className={`absolute inset-x-1 rounded-xl p-2 shadow-xs cursor-pointer hover:shadow-md transition-all overflow-hidden z-10 flex flex-col justify-between ${cardStyle}`}
                            >
                              <div className="w-full min-w-0">
                                <div className="flex items-center gap-1.5 w-full min-w-0">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}></span>
                                  <span className="font-title-sm text-xs font-bold text-on-surface truncate block min-w-0 flex-1 leading-tight">
                                    {ev.title}
                                  </span>
                                </div>
                                <div className="text-[10.5px] font-medium text-on-surface-variant truncate mt-0.5 block min-w-0 w-full">
                                  <span>{ev.startTime || ev.time?.split(' - ')[0]}</span>
                                  {ev.client && <span className="opacity-80"> • {ev.client}</span>}
                                </div>
                              </div>

                              {isTall && (
                                <div className="w-full min-w-0 flex items-center justify-between text-[10px] text-outline pt-1 mt-auto border-t border-black/5">
                                  <span className="truncate max-w-[70px]">{ev.location ? (ev.location.includes('Teams') ? 'Teams' : ev.location) : 'Online'}</span>
                                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-caption text-[9.5px] font-semibold uppercase tracking-wider shrink-0 ${badgeStyle}`}>
                                    <span className="material-symbols-outlined text-[10px]">{iconName}</span>
                                    <span>{pType}</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------------------------- */}
        {/* VIEW 3: MONTH VIEW */}
        {/* -------------------------------------------------------------------------------- */}
        {activeView === 'Month' && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Month Day Headers (Mon - Sun) */}
            <div className="grid grid-cols-7 border-b border-surface-container bg-surface-container-low/70 shrink-0">
              {DAY_NAMES_SHORT.map((dName, i) => (
                <div key={i} className="py-2.5 text-center font-caption text-caption text-on-surface-variant font-bold uppercase tracking-wider border-r border-surface-container last:border-r-0">
                  {dName}
                </div>
              ))}
            </div>

            {/* Dynamic Month Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto bg-surface-container-lowest divide-x divide-y divide-surface-container border-b border-surface-container">
              {mainMonthGrid.map((cell, idx) => {
                const cellEvents = getEventsForDateKey(cell.dateKey);
                return (
                  <div
                    key={idx}
                    onDoubleClick={() => handleMonthCellDoubleClick(cell)}
                    className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors relative group ${
                      !cell.isCurrentMonth
                        ? 'bg-surface-container-low/40 opacity-45'
                        : cell.isToday
                        ? 'bg-primary/5 hover:bg-primary/10 cursor-pointer'
                        : 'hover:bg-surface-container-low/70 cursor-pointer'
                    }`}
                  >
                    {/* Top Row: Date & Actions */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-title-sm text-title-sm inline-flex items-center justify-center font-bold ${
                            cell.isToday
                              ? 'w-6 h-6 rounded-full bg-primary text-on-primary shadow-sm text-xs'
                              : cell.isCurrentMonth
                              ? 'text-on-surface'
                              : 'text-outline'
                          }`}
                        >
                          {cell.date}
                        </span>
                        {cell.isToday && (
                          <span className="text-[10px] font-bold text-primary">Today</span>
                        )}
                      </div>

                      {/* Event count or quick action button */}
                      <div className="flex items-center gap-1">
                        {cellEvents.length > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-surface-container text-on-surface-variant">
                            {cellEvents.length} {cellEvents.length === 1 ? 'event' : 'events'}
                          </span>
                        )}
                        {cell.isCurrentMonth && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(cell.dateObj);
                              setActiveView('Day');
                            }}
                            className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary hover:text-on-primary rounded transition-all cursor-pointer"
                            title="Open Day View"
                          >
                            View Day
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Events List in Month Cell */}
                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                      {cellEvents.slice(0, 3).map((ev) => {
                        const pType = ev.participantType || 'human';
                        const pillBg =
                          pType === 'agent'
                            ? 'bg-purple-500/15 border-purple-400/40 text-purple-900 hover:bg-purple-500/25'
                            : pType === 'customer'
                            ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-900 hover:bg-emerald-500/25'
                            : 'bg-blue-500/15 border-blue-400/40 text-blue-900 hover:bg-blue-500/25';

                        const iconName =
                          pType === 'agent' ? 'smart_toy' : pType === 'customer' ? 'group' : 'person';

                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(ev);
                            }}
                            title={`${ev.title} (${ev.time}) - ${ev.client}`}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-medium w-full min-w-0 flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs ${pillBg}`}
                          >
                            <span className="material-symbols-outlined text-[12px] shrink-0 opacity-80">{iconName}</span>
                            <span className="font-bold shrink-0 text-[10.5px]">{ev.startTime || ev.time?.split('-')[0]}</span>
                            <span className="truncate min-w-0 flex-1 font-semibold text-on-surface">{ev.title}</span>
                          </div>
                        );
                      })}

                      {cellEvents.length > 3 && (
                        <span className="text-[10px] font-semibold text-on-surface-variant pl-1">
                          +{cellEvents.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Subtle double-click hint on empty cell */}
                    {cellEvents.length === 0 && cell.isCurrentMonth && (
                      <div className="opacity-0 group-hover:opacity-70 text-[10px] text-outline text-center py-1">
                        + Double-click to add
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                onClick={() => setIsAddEventOpen(false)}
                aria-label="Close modal"
              />
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleAddEventSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
              {/* Selected Slot Banner with Live Duration */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/15 text-primary">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">calendar_clock</span>
                  <span className="font-label-md text-label-md font-semibold">
                    {DAY_NAMES_FULL[(newEventDateObj.getDay() + 6) % 7]}, {MONTH_NAMES_SHORT[newEventDateObj.getMonth()]} {newEventDateObj.getDate()}, {newEventDateObj.getFullYear()} • {format12hString(startHour, startMinute, startPeriod)} – {format12hString(endHour, endMinute, endPeriod)}
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
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setIsAddEventOpen(false)}
                >
                  Discard
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    type="submit"
                    startIcon="send"
                  >
                    Save &amp; Schedule
                  </Button>
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
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close modal"
              />
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
              <Button
                variant="danger"
                size="md"
                startIcon="delete"
                onClick={() => handleDeleteEvent(selectedEvent.id)}
              >
                Delete
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => setSelectedEvent(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
