import React, { useEffect, useRef, useState } from 'react';
import { useOperator } from '@perfox/operator-react';
import { useCalls } from './CallProvider';

/**
 * The call UI: a compact popup, not a full-screen takeover.
 *
 * A call is a thing you do *while* working, so it sits over the page as a card
 * rather than replacing it. Two states:
 *
 *  - INCOMING — a ringing card in the corner, so it can appear over any page
 *    without stealing it;
 *  - ACTIVE — a centred popup with the live transcript and the controls.
 *
 * Note `rounded-pill`, not `rounded-full`: this theme redefines `full` as a
 * 12px radius, so `rounded-full` renders squares.
 *
 * Everything shown is SDK state. An empty field means Perfox sent no value,
 * never a placeholder standing in for one.
 */

const initialsOf = (label: string): string => {
  /* A phone number has no initials worth showing. */
  const cleaned = label.replace(/[+\d\s()-]/g, '').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};

/** mm:ss from when the call went live. */
function useCallDuration(isLive: boolean): string {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isLive) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [isLive]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function Avatar({ label, size }: { label: string; size: number }) {
  const initials = initialsOf(label);
  return (
    <span
      className="rounded-pill bg-white/10 text-white flex items-center justify-center shrink-0 font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials || <span className="material-symbols-outlined" style={{ fontSize: size * 0.45 }}>person</span>}
    </span>
  );
}

/** A circular control. `rounded-pill` because this theme's `full` is 12px. */
function CircleButton({
  icon,
  onClick,
  title,
  disabled,
  tone = 'default',
  size = 48,
}: {
  icon: string;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  tone?: 'default' | 'active' | 'danger';
  size?: number;
}) {
  const tones = {
    default: 'bg-white/10 text-white hover:bg-white/20',
    active: 'bg-white text-[#0b141a] hover:bg-white/90',
    danger: 'bg-[#ea4335] text-white hover:brightness-110',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{ width: size, height: size }}
      className={`rounded-pill flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${tones[tone]}`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: size * 0.45 }}>
        {icon}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------- incoming */

function IncomingCallCard() {
  const { incomingCall, answer, decline } = useOperator();
  const [busy, setBusy] = useState(false);

  if (!incomingCall) return null;
  const label = incomingCall.caller || incomingCall.calledNumber || 'Unknown number';

  return (
    <div className="fixed top-4 right-4 z-[100] w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-[#111b21] text-white shadow-2xl border border-white/10 overflow-hidden animate-in slide-in-from-top-4 duration-300">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <span className="relative shrink-0">
          <span className="absolute inset-0 rounded-pill bg-emerald-500/30 animate-ping" />
          <span className="relative block">
            <Avatar label={label} size={44} />
          </span>
        </span>
        <span className="flex flex-col min-w-0">
          <span className="font-label-lg text-label-lg font-semibold truncate">{label}</span>
          <span className="font-caption text-caption text-white/60">Incoming call · ringing</span>
        </span>
      </div>

      <div className="px-4 pb-4 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await decline();
            } finally {
              setBusy(false);
            }
          }}
          className="flex-1 h-10 rounded-xl bg-white/10 text-white font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-white/20 transition-colors disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-lg">call_end</span>
          Decline
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await answer(incomingCall.conversationId);
            } finally {
              setBusy(false);
            }
          }}
          className="flex-1 h-10 rounded-xl bg-emerald-600 text-white font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-lg">call</span>
          Answer
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- active */

const STATUS_LABEL: Record<string, string> = {
  idle: '',
  dialing: 'Calling…',
  ringing: 'Ringing…',
  live: 'Connected',
  ended: 'Call ended',
};

function ActiveCallPopup() {
  const { activeCall, micEnabled, setMicEnabled, hold, hangup, transcript } = useOperator();
  const { dialingLabel } = useCalls();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLive = activeCall?.status === 'live';
  const hasEnded = activeCall?.status === 'ended';
  const duration = useCallDuration(Boolean(isLive));

  /* Newest line in view without dragging the page around it. */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcript.length]);

  if (!activeCall || activeCall.status === 'idle') return null;
  /* An ended call is dismissed, not auto-hidden: the transcript is worth
     reading after hanging up. */
  if (dismissed && dismissed === activeCall.conversationId) return null;

  const label = dialingLabel || 'Call';
  const status = STATUS_LABEL[activeCall.status] ?? activeCall.status;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-[#111b21] text-white shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Who, and what is happening */}
        <div className="flex flex-col items-center gap-2 px-6 pt-7 pb-5">
          <Avatar label={label} size={72} />
          <h2 className="font-title-lg text-title-lg font-semibold text-center truncate max-w-full mt-1">
            {label}
          </h2>
          <span className="inline-flex items-center gap-1.5 font-caption text-caption text-white/70">
            {isLive && <span className="w-1.5 h-1.5 rounded-pill bg-emerald-400 animate-pulse" />}
            {isLive ? duration : status}
            {activeCall.onHold ? ' · on hold' : ''}
          </span>
        </div>

        {/* The live transcript — the thing a phone cannot do. Only once there
            is something in it, so an empty panel never reads as broken. */}
        {transcript.length > 0 && (
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 pb-3 flex flex-col gap-2 border-t border-white/10 pt-3"
          >
            {transcript.map((entry: any, index: number) => {
              const who = String(entry.speaker ?? entry.role ?? '').toLowerCase();
              const isCustomer = who.includes('customer') || who.includes('user');
              return (
                <div
                  key={entry.id ?? index}
                  className={`max-w-[85%] px-3 py-1.5 rounded-xl ${
                    isCustomer ? 'bg-white/10 self-start' : 'bg-emerald-600/25 self-end'
                  }`}
                >
                  <span className="block font-caption text-[10px] uppercase tracking-wider text-white/40">
                    {isCustomer ? 'Customer' : 'Agent'}
                  </span>
                  <span className="font-body-sm text-body-sm text-white/90">{entry.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Controls. An ended call keeps only the way out. */}
        <div className="flex items-center justify-center gap-3 px-6 py-5 border-t border-white/10">
          {hasEnded ? (
            <button
              type="button"
              onClick={() => setDismissed(activeCall.conversationId)}
              className="h-10 px-6 rounded-xl bg-white/10 text-white font-label-md text-label-md font-semibold hover:bg-white/20 transition-colors"
            >
              Close
            </button>
          ) : (
            <>
              <CircleButton
                icon={micEnabled ? 'mic' : 'mic_off'}
                title={micEnabled ? 'Mute' : 'Unmute'}
                tone={micEnabled ? 'default' : 'active'}
                onClick={() => setMicEnabled(!micEnabled)}
              />
              <CircleButton
                icon={activeCall.onHold ? 'play_arrow' : 'pause'}
                title={activeCall.onHold ? 'Resume' : 'Hold'}
                tone={activeCall.onHold ? 'active' : 'default'}
                disabled={!isLive || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await hold(!activeCall.onHold);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <CircleButton
                icon="call_end"
                title="End call"
                tone="danger"
                size={56}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await hangup();
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- export */

export default function CallOverlay() {
  const { ready } = useCalls();
  /* Without a session there is no SDK state to read, and calling the hook
     outside its provider would throw. */
  if (!ready) return null;

  return (
    <>
      <IncomingCallCard />
      <ActiveCallPopup />
    </>
  );
}
