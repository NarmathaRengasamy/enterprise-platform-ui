/* Shapes returned by the developer module of the backend API
   (`/developer/*`). Every route there is Admin-only, and everything below
   `/developer/agents` and `/developer/endpoints` additionally answers 409
   until a Perfox platform connection exists. */

/* ── Platform connection ──────────────────────────────────────────────────── */

export type PlatformStatus = 'Connected' | 'Unverified' | 'Error';

/** Where the credentials in force came from: the Developer Hub, the server's
    environment, or nowhere yet. */
export type PlatformSource = 'stored' | 'env' | 'none';

/** The connection as the UI sees it — the API token itself never comes back,
    only `apiTokenMasked`. */
export interface PlatformConnection {
  configured: boolean;
  apiUrl: string;
  apiTokenMasked: string;
  workspace: string;
  status: PlatformStatus;
  lastVerifiedAt: string;
  lastError: string;
  connectedBy: string;
  updatedAt: string;
  source: PlatformSource;
  /** The Perfox path the server calls to prove the credentials work. */
  verifyPath: string;
}

/** The result of actually calling Perfox. `reachable` false is a verdict to
    show the developer, not a failed request. */
export interface PlatformVerification {
  ok: boolean;
  reachable: boolean;
  httpStatus: number | null;
  message: string;
  latencyMs: number;
}

/** PUT /developer/platform saves and verifies in one step. */
export interface SavePlatformResult extends PlatformConnection {
  verification: PlatformVerification;
}

export interface SavePlatformPayload {
  apiUrl: string;
  /** Omit or leave empty to keep the token already stored. */
  apiToken?: string;
}

export interface DisconnectPlatformResult {
  disconnected: boolean;
  /** True when an environment-provided connection took over after the delete. */
  fellBackToEnvironment: boolean;
  connection: PlatformConnection;
}

/* ── Agents ───────────────────────────────────────────────────────────────── */

/** Perfox's own vocabulary, stored verbatim. A `draft` agent cannot be toggled
    from here — it has to be published in Perfox first. */
export type AgentStatus = 'published' | 'paused' | 'draft';

/** A read-only mirror of a Perfox workspace agent. There are no site keys,
    secret keys, widget styling or endpoint bindings — the backend holds none of
    those, and agents are created and edited in Perfox, not here. */
export interface DeveloperAgent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  /** How conversations with this agent START, as Perfox's agent *list* reports
      it. Incomplete on purpose upstream: the list does not name every trigger
      on the graph, so an agent can hold a WhatsApp trigger this never mentions. */
  channels: string[];
  /** What the agent can reach OUT on, read from the sender nodes on its graph
      during a sync (`whatsapp_sender`, `sms_sender`, …). Empty until the agents
      have been synced from Perfox at least once. */
  senderChannels?: string[];
  activeVersion: number;
  nodeCount: number;
  perfoxCreatedAt: string;
  perfoxUpdatedAt: string;
  /** When this row was last refreshed from Perfox. */
  syncedAt: string;
}

/** GET /developer/agents nests the array — unlike the endpoints list. */
export interface AgentListResult {
  /** `cache` unless the cache was empty or a refresh was asked for. */
  source: 'cache' | 'perfox';
  syncedAt: string;
  synced?: number;
  removed?: number;
  agents: DeveloperAgent[];
}

/* ── Webhook endpoints ────────────────────────────────────────────────────── */

export type EndpointMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type EndpointTransport = 'HTTP' | 'SSE' | 'WebSocket';
export type EndpointAuthType = 'none' | 'bearer' | 'apiKey' | 'basic';
export type EndpointHealth = 'Healthy' | 'Degraded' | 'Offline';

export interface EndpointAuthConfig {
  bearerToken?: string;
  headerName?: string;
  apiKeyValue?: string;
  basicAuth?: string;
}

/** Header and query-param rows. The `id` is the row key the create schema
    requires; it is a client-side number, not a server identity. */
export interface KeyValueRow {
  id: number;
  key: string;
  value: string;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  method: EndpointMethod;
  transport: EndpointTransport;
  authType: EndpointAuthType;
  /** Masked on list and create — `abc****wxyz`, never the real secret. Never
      send a value read from here back to the server. */
  authConfig: EndpointAuthConfig;
  headers?: KeyValueRow[];
  queryParams?: KeyValueRow[];
  bodyFormat?: string;
  bodyContent?: string;
  status: EndpointHealth;
  statusColor?: string;
  latency: string;
  connectedAgentsCount: number;
  /** `'Not pinged'` until the first ping, then the HTTP status or the failure. */
  lastPingStatus: string;
  /** A label the server writes, not a timestamp — `'Never'` or `'Just now'`. */
  lastPingTime: string;
}

export interface CreateEndpointPayload {
  name: string;
  url: string;
  method?: EndpointMethod;
  transport?: EndpointTransport;
  authType?: EndpointAuthType;
  authConfig?: EndpointAuthConfig;
  headers?: KeyValueRow[];
  queryParams?: KeyValueRow[];
  bodyFormat?: string;
  bodyContent?: string;
}

/** Every field optional: the server merges, so an omitted `authConfig` keeps
    the stored secrets rather than clearing them. */
export type UpdateEndpointPayload = Partial<CreateEndpointPayload>;

/** POST /developer/endpoints/:id/ping — a real request was made. */
export interface PingResult {
  endpointId: string;
  url: string;
  /** `'200 OK'`, or `'Failed: <reason>'` when the request never completed. */
  status: string;
  healthy: boolean;
  latency: string;
  timestamp: string;
  details: WebhookEndpoint;
}
