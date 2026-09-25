import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { OperatorProvider } from '@perfox/operator-react';
import type { OperatorConfig } from '@perfox/operator-react';
import { useAuth } from '../hooks/useAuth';
import { isOperatorNotConfigured, operatorService } from '../services/operator.service';
import type { OperatorBlockReason, OperatorSignature } from '../types/operator.types';

/**
 * Signs this user as an operator and mounts the Perfox SDK around the app.
 *
 * Mounted around every route rather than around the Conversations page, for
 * two reasons the SDK gives us no way around:
 *
 *   - an incoming call has to ring wherever the operator happens to be;
 *   - a live call must survive navigation, because the WebRTC session dies
 *     with its provider — unmounting it would hang up the call.
 *
 * This context carries only the STATUS of the session: whether it exists and
 * why not. Everything a call actually does comes from the SDK's own
 * `useOperator()`, in components rendered inside the provider.
 */

interface OperatorStatusValue {
  /** True once this user is signed and the SDK provider is mounted. This is
      what a Call button gates on — never the SDK's `connected`, which reports
      the copilot socket and only opens DURING a call. */
  ready: boolean;
  blockReason: OperatorBlockReason;
  /** The server's own wording, when it is worth showing. */
  blockMessage: string;
  signature: OperatorSignature | null;
  /** Re-sign — after an Admin has configured the site, say. */
  retry: () => void;
}

const OperatorStatusContext = createContext<OperatorStatusValue | undefined>(undefined);

export const OperatorSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [signature, setSignature] = useState<OperatorSignature | null>(null);
  const [blockReason, setBlockReason] = useState<OperatorBlockReason>('loading');
  const [blockMessage, setBlockMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  /* Whether the FIRST sign attempt has finished, either way.

     The tree below this provider must have its final shape on the first render
     that shows it. Wrapping children in <OperatorProvider> only once the
     signature lands would change the element type at that position, and React
     would unmount and remount the whole app — every page refetching and every
     form clearing a moment after load. So children wait for the first attempt
     to settle, and after that the shape never changes again: a later re-sign
     leaves `signature` non-null throughout, and losing it entirely means
     logging out, which remounts everything anyway. */
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setSignature(null);
      setBlockReason('loading');
      setBlockMessage('');
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;

    setBlockReason('loading');
    setBlockMessage('');

    operatorService
      .sign({ signal: controller.signal })
      .then((signed) => {
        if (cancelled) return;
        setSignature(signed);
        setBlockReason('');
        setBlockMessage('');
        setSettled(true);
      })
      .catch((error: any) => {
        if (cancelled || error?.name === 'AbortError') return;
        /* Settled is set even on failure: the app must render whether or not
           calling is available. */
        setSettled(true);
        setSignature(null);
        /* A 409 is "no Admin has configured the site yet" — a prompt, not a
           failure, and it reads very differently to an operator. */
        if (isOperatorNotConfigured(error)) {
          setBlockReason('not-configured');
          setBlockMessage(error?.message ?? '');
        } else {
          setBlockReason('sign-failed');
          setBlockMessage(error?.message ?? 'Could not reach the call service.');
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAuthenticated, attempt]);

  /**
   * The SDK reads this ONCE, on mount.
   *
   * Changing the prop later does nothing, and the documented alternative —
   * remounting with a new `key` — destroys the session and any call with it.
   * So it is memoised on the signature alone and never rebuilt; the agent for
   * a particular call goes onto the live session instead, immediately before
   * `dialOut`. See `useCallControls`.
   */
  const config = useMemo<OperatorConfig | null>(() => {
    if (!signature) return null;
    return {
      apiHost: signature.apiHost,
      siteId: signature.siteId,
      ...(signature.workflowId ? { workflowId: signature.workflowId } : {}),
      operator: {
        externalId: signature.externalId,
        name: signature.name,
        userHash: signature.userHash,
      },
      /* The phone bridge — the mode calls run on. */
      mode: 'live_tap',
      /* Going available starts a 2.5s ring poll and makes this user a target
         for incoming calls. That is a decision somebody makes, not a side
         effect of opening the app. Dialling out flips it automatically. */
      autoAvailable: false,
    };
  }, [signature]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo<OperatorStatusValue>(
    () => ({ ready: Boolean(config), blockReason, blockMessage, signature, retry }),
    [config, blockReason, blockMessage, signature, retry]
  );

  /* Hold the first paint until the sign attempt has settled — see `settled`.
     Only while authenticated: the login screen has no operator to sign and
     must never wait on one. */
  if (isAuthenticated && !settled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <span className="w-2.5 h-2.5 rounded-pill bg-primary animate-ping" />
      </div>
    );
  }

  /* Unsigned: the app renders exactly as it does without calling, and the
     context reports why. The SDK provider is not mounted, so nothing may call
     `useOperator()` — which is why the components that do are gated on
     `ready` by a wrapper that renders them only when it is true. */
  if (!config) {
    return (
      <OperatorStatusContext.Provider value={value}>{children}</OperatorStatusContext.Provider>
    );
  }

  return (
    <OperatorStatusContext.Provider value={value}>
      <OperatorProvider config={config}>{children}</OperatorProvider>
    </OperatorStatusContext.Provider>
  );
};

export const useOperatorStatus = (): OperatorStatusValue => {
  const context = useContext(OperatorStatusContext);
  if (!context) {
    throw new Error('useOperatorStatus must be used inside an OperatorSessionProvider');
  }
  return context;
};

/**
 * Why calling cannot be used, in words worth showing. '' means it can.
 *
 * Two independent conditions, per §7.8.11: a number to dial, and a session.
 * The button stays visible and disabled with this in the tooltip — a missing
 * button reads as a bug, a greyed one explains itself.
 */
export const callBlockedReason = (
  status: OperatorStatusValue,
  hasPhoneNumber: boolean
): string => {
  if (!hasPhoneNumber) return 'This customer has no phone number on file';
  switch (status.blockReason) {
    case 'loading':
      return 'Connecting to the call service…';
    case 'not-configured':
      return status.blockMessage || 'The Perfox operator site is not configured yet';
    case 'sign-failed':
      return status.blockMessage || 'The call service could not be reached';
    default:
      return status.ready ? '' : 'Calling is not available';
  }
};
