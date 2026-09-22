/* Display formatting for conversation timestamps.
   Everything takes the ISO string the API returns, never a pre-formatted one,
   so "how long ago" can actually be worked out. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const parse = (iso?: string): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Midnight-to-midnight difference, so 11pm → 1am counts as "yesterday". */
const calendarDaysAgo = (then: Date, now: Date): number => {
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / DAY);
};

/** "06:02 pm" */
export const clockTime = (iso?: string): string => {
  const d = parse(iso);
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Compact label for a conversation row: "now", "8m", "3h", "Yesterday", "4d",
 * "Sep 9", "Sep 9, 2025". Time alone is useless in a list that spans weeks —
 * this is what tells you whether something is minutes or months old.
 */
export const relativeLabel = (iso?: string): string => {
  const d = parse(iso);
  if (!d) return '';

  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 0) return clockTime(iso);
  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;

  const days = calendarDaysAgo(d, now);
  if (days === 0) return `${Math.max(1, Math.floor(diff / HOUR))}h`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;

  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' })
  });
};

/**
 * Separator heading inside a thread: "Today", "Yesterday", a weekday within the
 * last week, then a full date.
 */
export const dayLabel = (iso?: string): string => {
  const d = parse(iso);
  if (!d) return '';

  const days = calendarDaysAgo(d, new Date());
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return d.toLocaleDateString([], { weekday: 'long' });

  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' })
  });
};

/** Stable per-day key for grouping, in local time. */
export const dayKey = (iso?: string): string => {
  const d = parse(iso);
  if (!d) return 'unknown';
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** Full date and time, for a tooltip on any of the short labels above. */
export const fullTimestamp = (iso?: string): string => {
  const d = parse(iso);
  if (!d) return '';
  return d.toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
