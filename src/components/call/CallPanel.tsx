import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOperator } from '@perfox/operator-react';
import { useOperatorStatus } from '../../context/OperatorContext';

/**
 * The operator's call surface: going on duty, an incoming call to answer, and
 * the call in progress.
 *
 * Docked by the app layout rather than by a page, because the session lives
 * above the router — a call has to keep running, and stay on screen, while the
 * operator moves around the app.
 *
 * The availability toggle is here and not hidden behind a setting because
 * `autoAvailable: false` is deliberate: going available starts a 2.5s ring
 * poll and makes this user a target for inbound calls. That is a decision
 * somebody takes, not a side effect of opening the app — but without a control
 * for it an inbound call could never arrive at all.
 *
 * ROUNDING: this project's Tailwind config defines `full` as a 12px radius
 * (`borderRadius: { full: "0.75rem", pill: "9999px" }`), so anything circular
 * uses `rounded-pill`. `rounded-full` renders a rounded square at these sizes.
 */

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  dialing: 'Dialling…',
  ringing: 'Ringing…',
  live: 'Connected',
  ended: 'Call ended',
};

const mmss = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Counts up while a call is live. Keyed by the call, so a second one restarts. */
const useCallTimer = (isLive: boolean, callId: string): number => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isLive) {
      setSeconds(0);
      return undefined;
    }
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [isLive, callId]);

  return seconds;
};

/** Rendered only inside the SDK provider, so the hook is always legal here. */
function LiveCallPanel(): JSX.Element {
  const op = useOperator();
  const [busy, setBusy] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [actionError, setActionError] = useState('');

  const activeCall = op.activeCall;
  const incomingCall = op.incomingCall;
  const isLive = activeCall?.status === 'live';
  const seconds = useCallTimer(Boolean(isLive), activeCall?.conversationId ?? '');

  /* One call is one key, so "already handled" and "already dismissed" survive
     the SDK handing back a fresh `activeCall` object on every tick. */
  const callKey = activeCall ? activeCall.sessionId || activeCall.conversationId : '';
  const [dismissedKey, setDismissedKey] = useState('');
  const droppedForKey = useRef('');

  /**
   * A finished call takes the operator off duty.
   *
   * Going available starts a 2.5s ring poll and makes this user a target for
   * inbound calls. Staying available after hanging up means the next one
   * arrives while nobody is expecting it — going on duty was a decision, so
   * coming back to it should be one too.
   *
   * Guarded by the call key: `activeCall` is a new object on every tick of a
   * live call, so without it this would re-fire for as long as the ended card
   * is on screen.
   */
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'ended') return;
    if (droppedForKey.current === callKey) return;
    droppedForKey.current = callKey;

    if (op.availability === 'available') {
      /* Best effort: failing to go off duty is not worth an error banner over
         a call that already ended. The pill still shows the true state. */
      void Promise.resolve(op.setAvailability('away')).catch(() => {});
    }
    /* Primitives only: `op` and `activeCall` are new objects every render, and
       depending on them would re-run this on each tick for nothing.
       eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [activeCall?.status, callKey, op.availability]);

  /* The SDK streams partial entries while a phrase is still being spoken. */
  const lines = useMemo(
    () => (op.transcript ?? []).filter((entry) => String(entry.text ?? '').trim()),
    [op.transcript]
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError('');
    try {
      await action();
    } catch (error: any) {
      setActionError(error?.message || 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  const available = op.availability === 'available';
  const inCall = Boolean(activeCall && activeCall.status !== 'ended');
  /* The SDK reports its own failures here; ours come from the action above. */
  const error = actionError || op.error || '';

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[22rem] max-w-[calc(100vw-2rem)] flex flex-col gap-2 items-end">
      {error && (
        <div className="w-full rounded-xl bg-error/10 border border-error/30 px-3 py-2 flex items-start gap-2 shadow-lg">
          <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
          <span className="flex-1 font-body-sm text-body-sm text-error">{error}</span>
          {actionError && (
            <button
              type="button"
              onClick={() => setActionError('')}
              className="material-symbols-outlined text-[18px] text-error/70 hover:text-error"
              aria-label="Dismiss"
            >
              close
            </button>
          )}
        </div>
      )}

      {/* INCOMING — only ever arrives while availability is `available`. */}
      {incomingCall && (
        <div className="w-full rounded-2xl bg-surface-container-lowest border border-emerald-300 shadow-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-pill bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 animate-pulse">
              <span className="material-symbols-outlined">ring_volume</span>
            </span>
            <div className="min-w-0">
              <p className="font-label-lg text-label-lg font-semibold text-on-surface">
                Incoming call
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {incomingCall.caller || incomingCall.calledNumber || 'Unknown caller'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => op.answer(incomingCall.conversationId))}
              className="flex-1 h-10 rounded-xl bg-emerald-600 text-white font-label-lg text-label-lg font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-700 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
              Answer
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => op.decline())}
              className="flex-1 h-10 rounded-xl bg-error/10 text-error font-label-lg text-label-lg font-semibold flex items-center justify-center gap-1.5 hover:bg-error/20 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">call_end</span>
              Decline
            </button>
          </div>
        </div>
      )}

      {/* IN PROGRESS — and the ended card, until it is dismissed. It is not
          cleared automatically: when the CUSTOMER hangs up, this is the only
          thing that says so, and the transcript is still worth reading. */}
      {activeCall && activeCall.status !== 'idle' && dismissedKey !== callKey && (
        <div className="w-full rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xl overflow-hidden">
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`w-2.5 h-2.5 rounded-pill shrink-0 ${
                  isLive
                    ? 'bg-emerald-500'
                    : activeCall.status === 'ended'
                      ? 'bg-gray-400'
                      : 'bg-amber-500 animate-pulse'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="font-label-lg text-label-lg font-semibold text-on-surface">
                  {STATUS_LABEL[activeCall.status] ?? activeCall.status}
                  {activeCall.onHold && ' · On hold'}
                </p>
                <p className="font-body-sm text-[11px] text-on-surface-variant">
                  {activeCall.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                  {isLive && ` · ${mmss(seconds)}`}
                </p>
              </div>
              {lines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTranscript((v) => !v)}
                  className="text-on-surface-variant hover:text-on-surface"
                  title={showTranscript ? 'Hide transcript' : 'Show transcript'}
                  aria-label={showTranscript ? 'Hide transcript' : 'Show transcript'}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showTranscript ? 'expand_more' : 'expand_less'}
                  </span>
                </button>
              )}

              {/* Only once it is over — dismissing a live call would hide the
                  hang-up button while the line is still open. */}
              {activeCall.status === 'ended' && (
                <button
                  type="button"
                  onClick={() => {
                    setDismissedKey(callKey);
                    setShowTranscript(false);
                  }}
                  className="text-on-surface-variant hover:text-on-surface"
                  title="Dismiss"
                  aria-label="Dismiss"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              )}
            </div>

            {activeCall.status !== 'ended' && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => op.setMicEnabled(!op.micEnabled))}
                  title={op.micEnabled ? 'Mute' : 'Unmute'}
                  aria-label={op.micEnabled ? 'Mute' : 'Unmute'}
                  className={`w-11 h-11 rounded-pill flex items-center justify-center disabled:opacity-60 ${
                    op.micEnabled
                      ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                      : 'bg-error/15 text-error hover:bg-error/25'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {op.micEnabled ? 'mic' : 'mic_off'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={busy || !isLive}
                  onClick={() => run(() => op.hold(!activeCall.onHold))}
                  title={activeCall.onHold ? 'Resume' : 'Hold'}
                  aria-label={activeCall.onHold ? 'Resume' : 'Hold'}
                  className={`w-11 h-11 rounded-pill flex items-center justify-center disabled:opacity-40 ${
                    activeCall.onHold
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {activeCall.onHold ? 'play_arrow' : 'pause'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => op.hangup())}
                  title="Hang up"
                  aria-label="Hang up"
                  className="w-11 h-11 rounded-pill bg-error text-white flex items-center justify-center hover:bg-error/90 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[20px]">call_end</span>
                </button>
              </div>
            )}
          </div>

          {/* The diarized transcript. `speaker` is 'agent' | 'customer'. */}
          {showTranscript && lines.length > 0 && (
            <div className="max-h-56 overflow-y-auto border-t border-surface-container bg-surface-container-low px-4 py-3 space-y-2">
              {lines.map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className="flex flex-col">
                  <span className="font-label-sm text-[10px] uppercase tracking-wide text-on-surface-variant">
                    {entry.speaker === 'agent' ? 'You' : 'Customer'}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface">{entry.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ON DUTY — hidden during a call, where it would only be a way to
          break the thing in progress. */}
      {!inCall && !incomingCall && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => op.setAvailability(available ? 'away' : 'available'))}
          title={
            available
              ? 'You are taking calls. Click to go off duty.'
              : 'Go on duty to receive calls'
          }
          className={`rounded-pill shadow-lg border px-3.5 h-10 flex items-center gap-2 font-label-lg text-label-lg font-semibold disabled:opacity-60 ${
            available
              ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
              : 'bg-surface-container-lowest text-on-surface-variant border-surface-container hover:bg-surface-container'
          }`}
        >
          <span className={`w-2 h-2 rounded-pill ${available ? 'bg-white' : 'bg-gray-400'}`} />
          {available ? 'Taking calls' : 'Off duty'}
        </button>
      )}
    </div>
  );
}

export default function CallPanel(): JSX.Element | null {
  const status = useOperatorStatus();
  /* No session, nothing to dock — and `useOperator()` would have no provider
     to read, which is why the hook lives in the inner component. */
  if (!status.ready) return null;
  return <LiveCallPanel />;
}
