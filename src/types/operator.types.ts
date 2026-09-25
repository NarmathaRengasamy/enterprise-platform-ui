/* The operator calling flow — the Perfox Site a HUMAN operator signs in
   against, and the signature the SDK needs.

   Two different things are called "a call" in this product, and only one is
   here:

     - `POST /conversations/outbound` with `channel: 'phone'` — the AI AGENT
       places the call, Perfox does the audio server-side.
     - this module — a human operator speaks, over WebRTC, in this browser.

   The Call button next to a customer means "I want to talk to this person",
   so it is this one. */

/* Re-exported from the SDK rather than redeclared: these are its wire shapes,
   and a second copy would drift from them silently. */
export type {
  ActiveCall,
  CallStatus,
  IncomingCall,
  OperatorStatus,
  TranscriptEntry,
} from '@perfox/operator-react';

/* ── The operator site (Developer hub) ────────────────────────────────────── */

/** The site as the browser may see it — the secret is never returned. */
export interface OperatorSite {
  apiHost: string;
  siteId: string;
  /** A hint only, e.g. `sa_s…ME7`. Never send it back: it would overwrite the
      real secret with asterisks. */
  siteSecretMasked: string;
  workflowId: string;
  configuredAt: string;
  configuredBy: string;
}

export interface SaveOperatorSitePayload {
  /** Must start http(s)://, must contain `-api.`, must carry no `/api/v1`
      path. The server refuses anything else with a 400 naming the rule —
      both mistakes otherwise surface as an unexplained CORS error. */
  apiHost: string;
  siteId: string;
  /** Omit or leave empty to keep the stored secret, so the host can be
      corrected without retyping it. Required on a first save. */
  siteSecret?: string;
  workflowId?: string;
}

/* ── The signature (POST /operator/sign) ──────────────────────────────────── */

/**
 * What the SDK needs to prove who this operator is.
 *
 * `userHash` is an HMAC the server computes with the site secret over
 * `siteId + '.' + externalId`. `externalId` comes from the authenticated
 * session, never from anything the browser sends — otherwise a signed-in user
 * could ask the server to vouch for somebody else's operator identity.
 *
 * Only the signature travels; the secret stays on the server.
 */
export interface OperatorSignature {
  apiHost: string;
  siteId: string;
  /** The site's default agent, or `null`. Each call still passes its own —
      omitted, Perfox answers as the tenant default and the wrong agent is on
      the line. */
  workflowId: string | null;
  externalId: string;
  name: string;
  userHash: string;
}

/**
 * Why calling is unavailable, or '' when it is not.
 *
 * Kept as separate reasons because they are different problems with different
 * fixes: "no operator site" is something an Admin fixes in the Developer hub,
 * "could not reach the call service" is not. A label that guesses will
 * eventually contradict the panel next to it.
 */
export type OperatorBlockReason = '' | 'loading' | 'not-configured' | 'sign-failed';
