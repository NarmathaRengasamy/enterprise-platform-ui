import { client, ApiError } from './client';
import {
  AgentListResult,
  CreateEndpointPayload,
  DeveloperAgent,
  DisconnectPlatformResult,
  PingResult,
  PlatformConnection,
  PlatformVerification,
  SavePlatformPayload,
  SavePlatformResult,
  UpdateEndpointPayload,
  WebhookEndpoint,
} from '../types/developer.types';

/**
 * True when the server refused because no Perfox connection is configured.
 *
 * The agent and endpoint routes sit behind `requirePlatformConnection`, which
 * answers 409 — a state the page renders as "connect Perfox first", not as an
 * error. Anything else really did fail.
 */
export const isPlatformNotConfigured = (error: unknown): boolean =>
  (error as ApiError)?.status === 409;

/** True when the signed-in user is not an Admin. The whole module is Admin-only. */
export const isForbidden = (error: unknown): boolean => (error as ApiError)?.status === 403;

/**
 * True when Perfox itself refused or timed out — 502 or 504.
 *
 * `perfoxFetch` raises these for an unreachable host, a timeout, a rejected API
 * token or an upstream error. Retrying the same request will not help and the
 * user's input was not at fault, so this is worth saying differently from a
 * validation failure. The message is already phrased for display.
 */
export const isUpstreamFailure = (error: unknown): boolean => {
  const status = (error as ApiError)?.status;
  return status === 502 || status === 504;
};

/** The per-field validation failures on a 400, if the server sent any. */
export const fieldErrorsOf = (error: unknown): Record<string, string> =>
  (error as ApiError)?.fieldErrors ?? {};

export const developerService = {
  /* ── Platform connection ────────────────────────────────────────────────
     These four are not gated: they are how a developer creates the connection
     in the first place, so they answer even when nothing is configured. */

  /** The connection in force, from the Developer Hub or the environment. */
  async getPlatform(options?: { signal?: AbortSignal }): Promise<PlatformConnection> {
    const response = await client.get<PlatformConnection>('/developer/platform', options);
    if (!response.data) {
      throw new Error(response.message || 'Could not read the platform connection');
    }
    return response.data;
  },

  /**
   * Saves the credentials and verifies them in one call.
   *
   * A failed verification still saves — the result comes back with
   * `status: 'Error'` and `verification.message` explaining what Perfox said,
   * so the form shows the reason instead of discarding what was typed.
   * Leave `apiToken` empty to keep the stored one.
   */
  async savePlatform(payload: SavePlatformPayload): Promise<SavePlatformResult> {
    const body: SavePlatformPayload = { apiUrl: payload.apiUrl };
    if (payload.apiToken) body.apiToken = payload.apiToken;

    const response = await client.put<SavePlatformResult>('/developer/platform', body);
    if (!response.data) {
      throw new Error(response.message || 'Could not save the platform connection');
    }
    return response.data;
  },

  /** Re-verifies what is already configured, without changing it. */
  async testPlatform(): Promise<PlatformVerification> {
    const response = await client.post<PlatformVerification>('/developer/platform/test');
    if (!response.data) {
      throw new Error(response.message || 'Could not test the platform connection');
    }
    return response.data;
  },

  /** Disconnects. An environment-provided connection reappears afterwards —
      `fellBackToEnvironment` says so. */
  async disconnectPlatform(): Promise<DisconnectPlatformResult> {
    const response = await client.delete<DisconnectPlatformResult>('/developer/platform');
    if (!response.data) {
      throw new Error(response.message || 'Could not disconnect the platform');
    }
    return response.data;
  },

  /* ── Agents ─────────────────────────────────────────────────────────────
     Read-only: agents are created and edited in the Perfox workspace. */

  /**
   * Lists the cached workspace agents.
   *
   * The server calls Perfox only when its cache is empty or `refresh` is asked
   * for, so an ordinary load never hits the platform — which is why the page
   * needs an explicit Refresh control.
   */
  async getAgents(refresh = false, options?: { signal?: AbortSignal }): Promise<AgentListResult> {
    const response = await client.get<AgentListResult>('/developer/agents', {
      ...options,
      params: refresh ? { refresh: 'true' } : undefined,
    });
    if (!response.data) {
      throw new Error(response.message || 'Could not load the agents');
    }
    return response.data;
  },

  async getAgent(id: string): Promise<DeveloperAgent> {
    const response = await client.get<DeveloperAgent>(
      `/developer/agents/${encodeURIComponent(id)}`
    );
    if (!response.data) {
      throw new Error(response.message || 'Agent not found');
    }
    return response.data;
  },

  /**
   * Publishes or pauses the agent in Perfox, then returns the re-synced row.
   *
   * A `draft` agent is rejected with 409 — there is nothing to toggle between
   * until it has been published in Perfox once.
   */
  async setAgentStatus(id: string, status: 'published' | 'paused'): Promise<DeveloperAgent> {
    const response = await client.patch<DeveloperAgent>(
      `/developer/agents/${encodeURIComponent(id)}/status`,
      { status }
    );
    if (!response.data) {
      throw new Error(response.message || 'Could not change the agent status');
    }
    return response.data;
  },

  /* ── Webhook endpoints ──────────────────────────────────────────────────── */

  /** Registered endpoints, with `authConfig` masked. */
  async getEndpoints(options?: { signal?: AbortSignal }): Promise<WebhookEndpoint[]> {
    const response = await client.get<WebhookEndpoint[]>('/developer/endpoints', options);
    return response.data || [];
  },

  async getEndpoint(id: string): Promise<WebhookEndpoint> {
    const response = await client.get<WebhookEndpoint>(
      `/developer/endpoints/${encodeURIComponent(id)}`
    );
    if (!response.data) {
      throw new Error(response.message || 'Endpoint not found');
    }
    return response.data;
  },

  /** Registers an endpoint. The server refuses loopback and internal targets. */
  async createEndpoint(payload: CreateEndpointPayload): Promise<WebhookEndpoint> {
    const response = await client.post<WebhookEndpoint>('/developer/endpoints', payload);
    if (!response.data) {
      throw new Error(response.message || 'Could not register the endpoint');
    }
    return response.data;
  },

  /**
   * Updates an endpoint. Fields are merged, so omitting `authConfig` keeps the
   * stored credentials — which is what the edit form does when the secret is
   * left blank. Never send back a masked value read from a list.
   */
  async updateEndpoint(id: string, payload: UpdateEndpointPayload): Promise<WebhookEndpoint> {
    const response = await client.put<WebhookEndpoint>(
      `/developer/endpoints/${encodeURIComponent(id)}`,
      payload
    );
    if (!response.data) {
      throw new Error(response.message || 'Could not update the endpoint');
    }
    return response.data;
  },

  async deleteEndpoint(id: string): Promise<void> {
    await client.delete(`/developer/endpoints/${encodeURIComponent(id)}`);
  },

  /** Performs a real request against the endpoint and reports what happened. */
  async pingEndpoint(id: string): Promise<PingResult> {
    const response = await client.post<PingResult>(
      `/developer/endpoints/${encodeURIComponent(id)}/ping`
    );
    if (!response.data) {
      throw new Error(response.message || 'Could not ping the endpoint');
    }
    return response.data;
  },
};
