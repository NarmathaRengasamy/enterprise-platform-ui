import React from 'react';
import { Button } from '../common';
import { callBlockedReason, useOperatorStatus } from '../../context/OperatorContext';
import { useDialOut } from './useDialOut';

/**
 * The Call button in the new-conversation dialog's phone tab.
 *
 * Dials a number typed from scratch, with no conversation and no agent behind
 * it — the operator is the one who speaks, and Perfox opens the conversation
 * for the call itself. Which is why this tab asks for a number and nothing
 * else.
 *
 * Same two-part shape as `CallButton`: `useOperator()` only exists inside the
 * SDK provider, so the outer half checks `ready` first.
 */

interface PhoneDialButtonProps {
  phone: string;
  /** Called once the dial is away, so the dialog can close itself. */
  onPlaced: () => void;
}

const LiveDialButton = ({ phone, onPlaced }: PhoneDialButtonProps) => {
  const { dial, dialling, error, clearError, onACall } = useDialOut();

  const reason = !phone.trim()
    ? 'Enter a phone number'
    : onACall
      ? 'You are already on a call'
      : '';

  const handleClick = async () => {
    const placed = await dial(phone);
    /* Only on success: a failed dial keeps the dialog open with the reason,
       rather than closing and leaving nothing to explain it. */
    if (placed) onPlaced();
  };

  return (
    <>
      {error && (
        <div className="mr-auto flex items-start gap-2 rounded-lg bg-error/10 px-3 py-2">
          <span className="font-body-sm text-[11px] text-error">{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="material-symbols-outlined text-[14px] text-error/70 hover:text-error leading-none"
            aria-label="Dismiss"
          >
            close
          </button>
        </div>
      )}
      <Button
        variant="primary"
        size="sm"
        type="button"
        endIcon="call"
        loading={dialling}
        disabled={Boolean(reason) || dialling}
        onClick={handleClick}
        title={reason || `Call ${phone}`}
      >
        Call
      </Button>
    </>
  );
};

export default function PhoneDialButton(props: PhoneDialButtonProps): JSX.Element {
  const status = useOperatorStatus();

  if (!status.ready) {
    return (
      <Button
        variant="primary"
        size="sm"
        type="button"
        endIcon="call"
        disabled
        title={callBlockedReason(status, Boolean(props.phone.trim()))}
      >
        Call
      </Button>
    );
  }

  return <LiveDialButton {...props} />;
}
