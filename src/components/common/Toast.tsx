import React, { useEffect } from 'react';
import Icon from './Icon';

/**
 * The transient bottom-right notice.
 *
 * Lifted verbatim from the copies living in Categories, Knowledge Base and
 * Teams so it looks identical to what is already on screen elsewhere — the
 * point of extracting it was to stop a fourth copy being written, not to
 * redesign it.
 *
 * Use it for things that **happened**: saved, exported, failed. Something that
 * is still true and still blocking belongs in a banner on the page, where it
 * stays put and can be acted on, rather than in a notice that vanishes after
 * four seconds.
 */

export type ToastType = 'success' | 'error' | 'warning';

export interface ToastMessage {
  text: string;
  type: ToastType;
}

const styles: Record<ToastType, { box: string; icon: string }> = {
  success: { box: 'bg-green-900/90 text-green-100 border-green-700/60', icon: 'check_circle' },
  warning: { box: 'bg-amber-900/90 text-amber-100 border-amber-700/60', icon: 'warning' },
  error: { box: 'bg-red-900/90 text-red-100 border-red-700/60', icon: 'error' },
};

export interface ToastProps {
  message: ToastMessage | null;
  onDismiss: () => void;
  /** Milliseconds before it disappears. 0 keeps it until dismissed. */
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, onDismiss, duration = 4000 }) => {
  /* Keyed on the text as well as the object so two identical-looking notices
     in a row still restart the clock rather than the second inheriting what
     is left of the first one's. */
  useEffect(() => {
    if (!message || duration <= 0) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, message?.text, duration, onDismiss]);

  if (!message) return null;

  const style = styles[message.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border
        text-sm font-medium animate-in fade-in slide-in-from-bottom-3 duration-200 ${style.box}`}
    >
      <Icon name={style.icon} size="md" />
      <span>{message.text}</span>
      <button
        onClick={onDismiss}
        className="ml-2 text-white/70 hover:text-white cursor-pointer"
        aria-label="Dismiss"
      >
        <Icon name="close" size="sm" />
      </button>
    </div>
  );
};

export default Toast;
