import { client, ApiError } from './client';
import type { OperatorSignature, SaveOperatorSitePayload } from '../types/operator.types';
import type { PlatformConnection } from '../types/developer.types';

/**
 * True when the server refused because the operator site is not configured.
 *
 * `POST /operator/sign` answers 409 until an Admin has saved the site in the
 * Developer hub. That is a prompt — "set this up" — not a failure, and the
 * Call button should say so rather than reporting an error.
 */
export const isOperatorNotConfigured = (error: unknown): boolean =>
  (error as ApiError)?.status === 409;

export const operatorService = {
  /**
   * Signs the CURRENT user as an operator.
   *
   * Any authenticated role, deliberately: configuring the site is an
   * administrative act, taking a call is not — which is why this route sits
   * outside the Admin-only `/developer` hub.
   *
   * Answers 409 until the site is configured.
   */
  async sign(options?: { signal?: AbortSignal }): Promise<OperatorSignature> {
    const response = await client.post<OperatorSignature>('/operator/sign', undefined, options);
    if (!response.data) {
      throw new Error(response.message || 'Could not sign in as an operator');
    }
    return response.data;
  },

  /**
   * Saves the operator site. Admin only.
   *
   * `siteSecret` is sent only when the user typed one — empty means "keep the
   * stored secret", which is what lets the host be corrected without retyping
   * it. Never send `siteSecretMasked` back.
   *
   * Answers 409 until the workspace connection exists, and 400 with a named
   * reason when `apiHost` is the Studio host or carries an `/api/v1` path.
   */
  async saveSite(payload: SaveOperatorSitePayload): Promise<PlatformConnection> {
    const body: SaveOperatorSitePayload = {
      apiHost: payload.apiHost.trim(),
      siteId: payload.siteId.trim(),
    };
    if (payload.siteSecret?.trim()) body.siteSecret = payload.siteSecret.trim();
    if (payload.workflowId !== undefined) body.workflowId = payload.workflowId.trim();

    const response = await client.put<PlatformConnection>('/developer/platform/operator', body);
    if (!response.data) {
      throw new Error(response.message || 'Could not save the operator site');
    }
    return response.data;
  },
};
