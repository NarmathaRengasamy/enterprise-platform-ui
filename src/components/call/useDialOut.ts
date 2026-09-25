import { useCallback, useState } from 'react';
import { useOperator } from '@perfox/operator-react';
import { useOperatorStatus } from '../../context/OperatorContext';

/**
 * Placing a call, in one place.
 *
 * **May only be called inside the SDK provider**, so every component using it
 * is the inner half of a pair whose outer half checks `ready` first.
 *
 * ON THE AGENT: `workflowId` here is the **copilot** — the assistant that
 * listens and whispers to the operator. It is not someone who answers the
 * customer; the operator does the talking. So a conversation with no agent is
 * still perfectly callable, and a number typed into the new-call dialog needs
 * no agent at all. When a thread does have one, it simply picks the copilot
 * that assists on that call.
 *
 * (The guide's trap 3 — "omitted, the wrong agent answers" — is about the
 * other kind of call, `POST /conversations/outbound` with `channel: phone`,
 * where an AI agent really does do the talking. Applying it here blocked calls
 * that had nothing wrong with them.)
 */
export const useDialOut = () => {
  const op = useOperator();
  const { signature } = useOperatorStatus();

  const [dialling, setDialling] = useState(false);
  const [error, setError] = useState('');

  const dial = useCallback(
    async (phone: string, copilotAgentId?: string): Promise<boolean> => {
      const number = String(phone ?? '').trim();
      if (!number) {
        setError('Enter a phone number to call.');
        return false;
      }

      setDialling(true);
      setError('');

      try {
        /* Perfox will not route to an operator who is not available. The SDK's
           vocabulary is available | busy | away — there is no 'unavailable'. */
        if (op.availability !== 'available') {
          await op.setAvailability('available');
        }

        /* The provider read its config once, on mount, and will not take a new
           one — remounting with a fresh `key` would destroy the session and
           any call with it. So the copilot goes onto the LIVE session, here.
           `cfg` is private in the SDK's typings (checked in 0.1.0), hence the
           cast; re-check on any SDK upgrade.

           Assigned every time, not only when we have an agent: leaving it
           alone would carry the previous call's copilot into this one. With no
           agent it falls back to the site default, or to nothing. */
        const session = op.session as any;
        if (session?.cfg) {
          session.cfg.workflowId = copilotAgentId || signature?.workflowId || undefined;
        } else {
          console.warn('[operator] session.cfg is unavailable — the SDK may have moved it.');
        }

        await op.dialOut(number);
        return true;
      } catch (err: any) {
        setError(err?.message || 'The call could not be placed.');
        return false;
      } finally {
        setDialling(false);
      }
    },
    [op, signature]
  );

  return {
    dial,
    dialling,
    error,
    clearError: useCallback(() => setError(''), []),
    /* A second call would drop the one in progress. */
    onACall: Boolean(op.activeCall && op.activeCall.status !== 'ended'),
  };
};
