import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { OperatorProvider, useOperator, type OperatorConfig } from '@perfox/operator-react';
import { operatorApi } from '../../api';

/**
 * Wires the Perfox operator SDK into the app and exposes calling to any page.
 *
 * Mounted once, around everything, for two reasons: an INCOMING call has to be
 * able to ring wherever the user happens to be, and a call must survive moving
 * between pages — unmounting the provider would drop the WebRTC session.
 *
 * The SDK is only mounted once the server has signed this user. Until then
 * there is no session and `canCall` is false, which is what the Call buttons
 * gate on.
 */

interface CallContextValue {
  /**
   * True once this user has been signed and the session exists — i.e. a call
   * CAN be placed.
   *
   * Deliberately not the SDK's `connected`, which reports the copilot
   * WebSocket, and that only opens during a call. Gating the Call button on it
   * deadlocks: no call means no socket, no socket means no call.
   */
  ready: boolean;
  /** True while a call's live stream is up. For call UI, not for gating. */
  streaming: boolean;
  /** Why calling is unavailable, for a tooltip. Empty when it is available. */
  unavailableReason: string;
  /** The same reason in two or three words, for an inline label. */
  unavailableShort: string;
  /**
   * Places a call.
   *
   * `agentId` is the Perfox agent (workflow) that should handle it. Without one
   * the call is placed against the site default, which is why a call can
   * connect and then behave as though no agent is registered.
   */
  dial: (phone: string, options?: { label?: string; agentId?: string }) => Promise<void>;
  /** Who we are calling, for the overlay — the SDK only knows the number. */
  dialingLabel: string;
}

const CallContext = createContext<CallContextValue>({
  ready: false,
  streaming: false,
  unavailableReason: 'Calling is not configured',
  unavailableShort: 'unavailable',
  dial: async () => {},
  dialingLabel: '',
});

export const useCalls = () => useContext(CallContext);

/* The SDK's own hook, re-exported so call UI does not import the package
   directly and can be rendered without a provider in tests. */
export const useOperatorSafe = useOperator;

/** Inside the provider: turns `dialOut` into something the rest of the app can call. */
function CallBridge({
  children,
  dialingLabel,
  setDialingLabel,
}: {
  children: React.ReactNode;
  dialingLabel: string;
  setDialingLabel: (label: string) => void;
}) {
  const { dialOut, setAvailability, availability, connected, session } = useOperator();

  const dial = useCallback(
    async (phone: string, options?: { label?: string; agentId?: string }) => {
      setDialingLabel(options?.label || phone);

      /*
       * The agent is provider-level configuration in this SDK: `dialOut` reads
       * `cfg.workflowId`, and `OperatorProvider` builds its session ONCE and
       * ignores later config changes. So the only way to dial as a particular
       * agent, without tearing down the session and losing presence and any
       * incoming call with it, is through the documented escape hatch.
       *
       * `cfg` is marked private in the typings, hence the cast — it is a plain
       * field at runtime.
       */
      if (options?.agentId) {
        const engine = session as unknown as { cfg?: { workflowId?: string } };
        if (engine?.cfg) engine.cfg.workflowId = options.agentId;
      }

      /* Perfox will not route a call to an operator who is not available, and
         nobody thinks to flip a switch before pressing Call. */
      if (availability !== 'available') await setAvailability('available');
      await dialOut(phone);
    },
    [dialOut, setAvailability, availability, setDialingLabel, session]
  );

  /* Inside the provider the session exists, so calling is possible — whatever
     the WebSocket is doing. */
  const value = useMemo<CallContextValue>(
    () => ({
      ready: true,
      streaming: connected,
      unavailableReason: '',
      unavailableShort: '',
      dial,
      dialingLabel,
    }),
    [connected, dial, dialingLabel]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export default function CallProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<OperatorConfig | null>(null);
  const [reason, setReason] = useState('Connecting to the call service…');
  /* Kept beside the long reason rather than derived from it: an inline label
     has no room for a sentence, and guessing one from the other by matching on
     words is how a wrong message ends up next to a right one. */
  const [shortReason, setShortReason] = useState('connecting…');
  const [dialingLabel, setDialingLabel] = useState('');

  useEffect(() => {
    let cancelled = false;

    operatorApi
      .sign()
      .then((signed) => {
        if (cancelled) return;
        setConfig({
          apiHost: signed.apiHost,
          siteId: signed.siteId,
          ...(signed.workflowId ? { workflowId: signed.workflowId } : {}),
          operator: {
            externalId: signed.externalId,
            name: signed.name,
            userHash: signed.userHash,
          },
          mode: 'live_tap',
          /* Not auto-available: going online starts a 2.5s ring poll and makes
             this user a target for incoming calls. That is a decision, not a
             side effect of opening the app. Dialling out flips it. */
          autoAvailable: false,
        });
      })
      .catch((err: any) => {
        if (cancelled) return;
        /* A 409 is the ordinary "not set up yet" case, not a failure worth
           shouting about — the Developer hub is where it gets fixed. */
        const notConfigured = err?.status === 409 || /not configured/i.test(err?.message ?? '');
        if (notConfigured) {
          setReason('Calling needs the Perfox operator site — configure it in the Developer hub');
          setShortReason('operator site not configured');
          return;
        }
        /* Anything else is the service being unreachable — say that, rather
           than blaming configuration that may be perfectly fine. */
        setReason(err?.message || 'The call service could not be reached');
        setShortReason('call service unreachable');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* No session: render the app with calling reported unavailable, rather than
     blocking every page behind a feature most of them do not use. */
  if (!config) {
    return (
      <CallContext.Provider
        value={{
          ready: false,
          streaming: false,
          unavailableReason: reason,
          unavailableShort: shortReason,
          dial: async () => {},
          dialingLabel: '',
        }}
      >
        {children}
      </CallContext.Provider>
    );
  }

  return (
    <OperatorProvider config={config}>
      <CallBridge dialingLabel={dialingLabel} setDialingLabel={setDialingLabel}>
        {children}
      </CallBridge>
    </OperatorProvider>
  );
}
