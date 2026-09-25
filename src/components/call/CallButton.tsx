import React from 'react';
import { Button } from '../common';
import { callBlockedReason, useOperatorStatus } from '../../context/OperatorContext';
import { useDialOut } from './useDialOut';

/**
 * "Call this person" — a HUMAN operator on the line, over WebRTC.
 *
 * Not `POST /conversations/outbound` with `channel: 'phone'`, which has an AI
 * AGENT place the call server-side. That route stays for agent-placed calls;
 * this button is the operator SDK.
 *
 * Split in two because `useOperator()` may only be called inside the SDK
 * provider, and the provider is only mounted once this user is signed. The
 * outer half reads our own status context — which always exists — and renders
 * the live half only when there is a session to talk to.
 */

interface CallButtonProps {
  /** The number to dial. Empty disables the button with a reason. */
  phone: string;
  /** The thread's agent, used as the COPILOT for this call. Optional: the
      operator does the talking, so a thread with no agent is still callable. */
  agentId?: string;
  /** For the tooltip. */
  customerName?: string;
  /** Nothing selected yet, so there is nobody to call. */
  disabled?: boolean;
}

/** The disabled shell, used whenever there is no session to dial with. */
const InertCallButton = ({ reason }: { reason: string }) => (
  <Button variant="soft" size="sm" startIcon="call" disabled title={reason}>
    <span className="hidden sm:inline">Call</span>
  </Button>
);

/** Rendered only inside the SDK provider, so the hook is always legal here. */
const LiveCallButton = ({ phone, agentId, customerName, disabled }: CallButtonProps) => {
  const { dial, dialling, error, clearError, onACall } = useDialOut();

  /* Note what is NOT here: a check that the thread has an agent. The operator
     speaks on this call, so there is nothing for an agent to answer. */
  const reason = disabled
    ? 'Select a conversation first'
    : !phone
      ? 'This customer has no phone number on file'
      : onACall
        ? 'You are already on a call'
        : '';

  return (
    <span className="relative inline-flex">
      <Button
        variant="soft"
        size="sm"
        startIcon="call"
        loading={dialling}
        disabled={Boolean(reason) || dialling}
        onClick={() => dial(phone, agentId)}
        title={reason || `Call ${customerName || 'this customer'} on ${phone}`}
      >
        <span className="hidden sm:inline">Call</span>
      </Button>

      {/* Self-contained so the header around it needs no layout changes. */}
      {error && (
        <span className="absolute top-full right-0 mt-1.5 z-30 w-64 rounded-xl bg-error/10 border border-error/30 px-3 py-2 flex items-start gap-2 shadow-lg">
          <span className="flex-1 font-body-sm text-[11px] text-error">{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="material-symbols-outlined text-[14px] text-error/70 hover:text-error leading-none"
            aria-label="Dismiss"
          >
            close
          </button>
        </span>
      )}
    </span>
  );
};

export default function CallButton(props: CallButtonProps): JSX.Element {
  const status = useOperatorStatus();

  /* No session: stay visible and disabled with the real reason. "Operator site
     not configured" and "call service unreachable" are different problems, and
     a label that guesses will eventually contradict the Developer hub. */
  if (!status.ready) {
    return <InertCallButton reason={callBlockedReason(status, Boolean(props.phone))} />;
  }

  return <LiveCallButton {...props} />;
}
