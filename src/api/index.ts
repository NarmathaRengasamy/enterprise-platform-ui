/* Typed wrappers around the backend routes, grouped the way the pages consume them.
   Paths mirror src/routes/*.ts in enterprise-platform-backend. */

import {
  apiGet,
  apiGetList,
  apiGetRaw,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  apiUpload,
  toQuery,
  setToken,
  getToken,
  ListResult
} from './client';

export * from './client';

/* ------------------------------------------------------------------ auth */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  department: string;
  status: string;
  avatar?: string;
}

export const authApi = {
  login: async (email: string, password: string, rememberMe = true) => {
    const data = await apiPost<{ token: string; user: AuthUser }>('/auth/login', {
      email,
      password,
      rememberMe
    });
    if (data?.token) setToken(data.token);
    return data;
  },
  me: () => apiGet<AuthUser>('/auth/me'),
  /* No /auth/logout on the backend yet — clearing the token is the whole client-side session */
  logout: () => setToken(null),
  isAuthenticated: () => Boolean(getToken())
};

/* ------------------------------------------------------------- dashboard */

export interface DashboardMetrics {
  totalProducts: number;
  productsInStock: number;
  productsLowStock: number;
  totalConversations: number;
  unreadConversations: number;
  totalAppointments: number;
  upcomingAppointments: number;
  activeAgents: number;
  totalApiCalls?: string;
  systemHealth?: string;
}

export interface DashboardOverview {
  metrics: DashboardMetrics;
  recentProducts: any[];
  recentAppointments: any[];
  recentConversations: any[];
}

export const dashboardApi = {
  overview: () => apiGet<DashboardOverview>('/dashboard/overview'),
  metrics: () => apiGet<DashboardMetrics>('/dashboard/metrics')
};

/* -------------------------------------------------------------- products */

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Preferred: the category's id, as created on the Categories tab. */
  categoryId?: string;
  /** Legacy: the category's display name. */
  category?: string;
  status?: string;
}

export const productsApi = {
  list: (params: ProductQuery = {}): Promise<ListResult<any>> =>
    apiGetList<any>(`/products${toQuery(params as Record<string, unknown>)}`),
  get: (id: string) => apiGet<any>(`/products/${encodeURIComponent(id)}`),
  create: (body: unknown) => apiPost<any>('/products', body),
  update: (id: string, body: unknown) => apiPut<any>(`/products/${encodeURIComponent(id)}`, body),
  remove: (id: string) => apiDelete(`/products/${encodeURIComponent(id)}`)
};

/* ------------------------------------------------------------ categories */

export const categoriesApi = {
  list: (search?: string): Promise<ListResult<any>> =>
    apiGetList<any>(`/categories${toQuery({ search })}`),
  get: (id: string) => apiGet<any>(`/categories/${encodeURIComponent(id)}`),
  create: (body: unknown) => apiPost<any>('/categories', body),
  update: (id: string, body: unknown) => apiPut<any>(`/categories/${encodeURIComponent(id)}`, body),
  remove: (id: string) => apiDelete(`/categories/${encodeURIComponent(id)}`)
};

/* --------------------------------------------------------- conversations */

export interface ConversationAgentOption {
  id: string;
  /** Empty when the agent has since been deleted in Perfox. */
  name: string;
  /** Threads this agent handled, under the channel and search in force. */
  count: number;
}

export interface ConversationListResult {
  total: number;
  /** Only the agents that actually handled one of these threads. */
  agents: ConversationAgentOption[];
  /** 'perfox' — live from the workspace; 'local' — the mirrored copy. */
  source: 'perfox' | 'local';
  /** Why the live read failed, when source is 'local'. */
  sourceError: string;
  data: any[];
}

export const conversationsApi = {
  /* Not apiGetList: this response carries `source`, and a list served from the
     local mirror should be able to say so rather than pass as live. */
  list: (params: { channel?: string; search?: string; agentId?: string } = {}) =>
    apiGetRaw<ConversationListResult>(`/conversations${toQuery(params as Record<string, unknown>)}`),
  get: (id: string) => apiGet<any>(`/conversations/${encodeURIComponent(id)}`),
  create: (body: unknown) => apiPost<any>('/conversations', body),
  sendMessage: (id: string, body: { text: string; sender?: string; channel?: string; attachment?: unknown }) =>
    apiPost<any>(`/conversations/${encodeURIComponent(id)}/messages`, body),
  markRead: (id: string) => apiPatch<any>(`/conversations/${encodeURIComponent(id)}/read`),
  /* Fills the channel and agent dropdowns for starting a conversation. Served
     from our own agent cache, so it costs no Perfox calls. */
  outboundOptions: () => apiGet<{ channels: OutboundChannelOption[] }>('/conversations/outbound/options'),
  /** Starts a NEW conversation. `send` replies on an existing one. */
  startConversation: (body: {
    agentId: string;
    channel: string;
    to: string;
    /* Optional: a phone call has nothing to open with, and Perfox marks
       `opening_message` optional. Required on the text channels, where the
       server rejects it missing. Max 2000 characters upstream. */
    message?: string;
    customerId?: string;
  }) =>
    apiPost<{
      conversationId: string;
      executionId: string;
      status: string;
      channel: string;
      /** False means Perfox accepted it but nothing went out. */
      sendAuthorized: boolean;
      to: string;
    }>('/conversations/outbound', body),

  /* Sends for real, through Perfox. `sendMessage` only records one locally. */
  send: (id: string, body: { channel: 'whatsapp' | 'sms' | 'email'; text: string }) =>
    apiPost<{
      conversationId: string;
      executionId: string;
      status: string;
      channel: string;
      /** False when Perfox accepted the call but the agent cannot actually send. */
      sendAuthorized: boolean;
      to: string;
    }>(`/conversations/${encodeURIComponent(id)}/send`, body),
  events: (id: string) => apiGetList<any>(`/conversations/${encodeURIComponent(id)}/events`)
};

/* -------------------------------------------------------------- schedule */

export interface ScheduleQuery {
  dateKey?: string;
  participantType?: string;
  status?: string;
}

export const scheduleApi = {
  list: (params: ScheduleQuery = {}): Promise<ListResult<any>> =>
    apiGetList<any>(`/schedule${toQuery(params as Record<string, unknown>)}`),
  get: (id: string) => apiGet<any>(`/schedule/${encodeURIComponent(id)}`),
  create: (body: unknown) => apiPost<any>('/schedule', body),
  update: (id: string, body: unknown) => apiPut<any>(`/schedule/${encodeURIComponent(id)}`, body),
  setStatus: (id: string, status: string) =>
    apiPatch<any>(`/schedule/${encodeURIComponent(id)}/status`, { status }),
  remove: (id: string) => apiDelete(`/schedule/${encodeURIComponent(id)}`)
};

/* ------------------------------------------------------------------ team */

export const teamApi = {
  list: (params: { search?: string; role?: string; status?: string } = {}): Promise<ListResult<any>> =>
    apiGetList<any>(`/team/members${toQuery(params as Record<string, unknown>)}`),
  create: (body: unknown) => apiPost<any>('/team/members', body),
  update: (id: string, body: unknown) => apiPut<any>(`/team/members/${encodeURIComponent(id)}`, body),
  remove: (id: string) => apiDelete(`/team/members/${encodeURIComponent(id)}`)
};


/** A channel a conversation can be started on, with the agents that trigger on it. */
export interface OutboundChannelOption {
  key: string;
  label: string;
  /** What the recipient field must hold: a phone number or an email address. */
  contact: 'phone' | 'email';
  /** True when at least one published agent triggers on this channel. */
  available: boolean;
  agents: {
    id: string;
    name: string;
    status: string;
    /** Only a published agent may start a conversation. */
    available: boolean;
  }[];
}

/* ------------------------------------------------------------- knowledge */

/* A file in the selected Perfox knowledge-base folder. */
export interface KbFile {
  id: string;
  name: string;
  /** e.g. `text/markdown`. */
  mimeType: string;
  sizeBytes: number;
  /**
   * Perfox's ingestion state. `active` is indexed and searchable; anything else
   * means the file is stored but currently answers nothing.
   */
  status: string;
  chunkCount: number;
  folderId: string;
  /** The folder it lives in, or 'Root level'. */
  folderName: string;
  uploadedAt: string;
  updatedAt: string;
}

export interface KbFileListResult {
  /** Rows in THIS page, not the size of the folder. */
  total: number;
  /** Empty at the root level. */
  folderId: string;
  /** The level being listed, e.g. 'Root level'. */
  folderName: string;
  /**
   * Pass back as `cursor` for the next page. Empty when there are no more.
   *
   * Cursor-based, so pages can only be walked forward — there is no page
   * number to jump to.
   */
  nextCursor: string;
  files: KbFile[];
}

export interface KbStats {
  totalFiles: number;
  indexedFiles: number;
  /** Stored but not searchable — the number worth acting on. */
  notIndexed: number;
  totalChunks: number;
  totalSizeBytes: number;
}

/* The knowledge base is the Perfox workspace: these read and write files in the
   folder configured in the Developer hub, never local rows. */
export const knowledgeApi = {
  /** Newest first. 409 until a folder is selected in the Developer hub. */
  /* Across the whole knowledge base, or one folder when narrowed. */
  listFiles: (folderId?: string, options?: { limit?: number; cursor?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (folderId) query.set('folderId', folderId);
    if (options?.limit) query.set('limit', String(options.limit));
    if (options?.cursor) query.set('cursor', options.cursor);
    if (options?.status) query.set('status', options.status);
    const suffix = query.toString() ? `?${query}` : '';
    return apiGet<KbFileListResult>(`/knowledge/files${suffix}`);
  },
  /** Destinations to choose from when uploading. */
  listFolders: () => apiGet<KbFolderListResult>('/knowledge/folders'),
  createFolder: (body: { name: string; parentId?: string }) =>
    apiPost<{ folder: KbFolder }>('/knowledge/folders', body),
  renameFolder: (id: string, name: string) =>
    apiPatch<{ folder: KbFolder }>(`/knowledge/folders/${encodeURIComponent(id)}`, { name }),
  /** Refused with 409 while the folder still holds files or subfolders. */
  deleteFolder: (id: string) =>
    apiDelete<{ id: string; deleted: boolean; affectedAgents: string[] }>(
      `/knowledge/folders/${encodeURIComponent(id)}`
    ),
  stats: () => apiGet<KbStats>('/knowledge/stats'),
  /* The server turns the markdown into a real .md file and uploads it — the
     browser only ever sends text. */
  /* Compiles the whole catalogue into one markdown document server-side and
     uploads it. The browser sends the options, never the content. */
  generateCatalog: (body: {
    folderId?: string;
    includeProducts?: boolean;
    includeCategories?: boolean;
    template?: 'qa' | 'reference';
    replaceExisting?: boolean;
  }) =>
    apiPost<{
      file: KbFile;
      productCount: number;
      categoryCount: number;
      replaced: number;
      sizeBytes: number;
    }>('/knowledge/catalog', body),

  /** `folderId` omitted means the root of the knowledge base. */
  createMarkdownFile: (body: { name: string; content: string; folderId?: string }) =>
    apiPost<{ file: KbFile }>('/knowledge/files', body),
  /* The bytes go up raw; the server rebuilds the multipart request and supplies
     the configured folder, so the browser cannot target a different one. */
  uploadFile: (file: File, folderId?: string, onProgress?: (percent: number) => void) =>
    apiUpload<{ file: KbFile }>(
      `/knowledge/files/upload${folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''}`,
      file,
      onProgress
    ),
  /** Removes it from Perfox. Already-deleted files succeed rather than erroring. */
  deleteFile: (id: string) =>
    apiDelete<{ id: string; deleted: boolean }>(`/knowledge/files/${encodeURIComponent(id)}`)
};

/* ------------------------------------------------------------- developer */

export interface PlatformConnectionState {
  configured: boolean;
  apiUrl: string;
  apiTokenMasked: string;
  workspace: string;
  status: 'Connected' | 'Unverified' | 'Error';
  lastVerifiedAt: string;
  lastError: string;
  connectedBy?: string;
  updatedAt?: string;
  /** 'stored' = saved from this UI, 'env' = provided by the deployment, 'none' = unconfigured. */
  source: 'stored' | 'env' | 'none';
  verifyPath: string;
  /**
   * True when a Perfox operator site is stored. Human calling depends on it:
   * without a site there is nobody to sign, so the Call button cannot work.
   */
  operatorConfigured: boolean;
  /** Never carries the secret — it is masked server-side. */
  operatorSite: {
    apiHost: string;
    siteId: string;
    siteSecretMasked: string;
    workflowId: string;
    configuredAt: string;
    configuredBy: string;
  };
}

/** The signed identity the Perfox operator SDK needs to go online. */
export interface SignedOperator {
  apiHost: string;
  siteId: string;
  workflowId: string | null;
  externalId: string;
  name: string;
  /** HMAC proving our server vouched for this operator. */
  userHash: string;
}

export interface PlatformVerification {
  ok: boolean;
  reachable: boolean;
  httpStatus: number | null;
  message: string;
  latencyMs: number;
}

/** What a real outbound ping reports back — no value here is synthesised. */
export interface PingResult {
  endpointId: string;
  url: string;
  /** The true status line, e.g. '200 OK' or 'Failed: Timeout'. */
  status: string;
  healthy: boolean;
  /** Measured round trip, e.g. '184 ms'. */
  latency: string;
  timestamp: string;
  details?: any;
}

/**
 * An agent, cached from the connected Perfox workspace.
 *
 * Every field mirrors something Perfox reports — this platform stores no
 * configuration of its own against an agent.
 */
export interface Agent {
  /** The Perfox agent id. */
  id: string;
  name: string;
  description: string;
  /** Perfox's own vocabulary: published | paused | draft. */
  status: string;
  channels: string[];
  activeVersion: number;
  nodeCount: number;
  perfoxCreatedAt: string;
  perfoxUpdatedAt: string;
  /** When this row was last refreshed from Perfox. */
  syncedAt: string;
}

/** A knowledge-base folder in the connected Perfox workspace. */
export interface KbFolder {
  id: string;
  name: string;
  parentId: string | null;
  /** Ancestry as ids. Use `displayPath` for anything shown to a person. */
  path: string;
  /** Depth in the tree, 0 at the root — indent a picker by this. */
  depth: number;
  /** Readable ancestry, e.g. 'Company Docs / Nested'. */
  displayPath: string;
  fileCount: number;
  /** Perfox's generated description of the folder's contents, when it has one. */
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface KbFolderListResult {
  /**
   * Every folder in the workspace, depth-first, parents before children.
   *
   * Walked server-side: Perfox's own listing returns only the root level, so a
   * nested folder never appears in it. Indent by `depth` rather than assuming
   * the list is flat.
   */
  folders: KbFolder[];
}

export interface AgentListResult {
  /** 'cache' — served locally; 'perfox' — the platform was called for this read. */
  source: 'cache' | 'perfox';
  syncedAt: string;
  synced?: number;
  removed?: number;
  agents: Agent[];
}

/* Outside developerApi on purpose: configuring the site is an Admin act,
   taking a call is not, so the sign route carries no role requirement. */
export const operatorApi = {
  sign: () => apiPost<SignedOperator>('/operator/sign'),
};

export const developerApi = {
  // Platform connection — agents and endpoints are gated behind this.
  getPlatform: () => apiGet<PlatformConnectionState>('/developer/platform'),
  savePlatform: (body: { apiUrl: string; apiToken?: string }) =>
    apiPut<PlatformConnectionState & { verification: PlatformVerification }>(
      '/developer/platform',
      body
    ),
  testPlatform: () => apiPost<PlatformVerification>('/developer/platform/test'),
  /* An empty siteSecret keeps the stored one, so the masked field does not have
     to be retyped to change the host. */
  saveOperatorSite: (body: {
    apiHost: string;
    siteId: string;
    siteSecret?: string;
    workflowId?: string;
  }) => apiPut<PlatformConnectionState>('/developer/platform/operator', body),
  disconnectPlatform: () =>
    apiDelete<{ disconnected: boolean; fellBackToEnvironment: boolean }>('/developer/platform'),

  /* Reads the cached agents. Pass refresh to make the server call Perfox and
     re-sync the cache; without it Perfox is only called when the cache is
     empty. */
  listAgents: (refresh = false) =>
    apiGet<AgentListResult>(`/developer/agents${refresh ? '?refresh=true' : ''}`),
  /* Publishes or pauses the agent in Perfox and returns the re-synced row.
     A draft agent is refused with 409 — there is nothing to toggle. */
  setAgentStatus: (id: string, status: 'published' | 'paused') =>
    apiPatch<Agent>(`/developer/agents/${encodeURIComponent(id)}/status`, { status }),
  getAgent: (id: string) => apiGet<any>(`/developer/agents/${encodeURIComponent(id)}`),
  listEndpoints: (): Promise<ListResult<any>> => apiGetList<any>('/developer/endpoints'),
  createEndpoint: (body: unknown) => apiPost<any>('/developer/endpoints', body),
  updateEndpoint: (id: string, body: unknown) =>
    apiPut<any>(`/developer/endpoints/${encodeURIComponent(id)}`, body),
  removeEndpoint: (id: string) => apiDelete(`/developer/endpoints/${encodeURIComponent(id)}`),
  pingEndpoint: (id: string) =>
    apiPost<PingResult>(`/developer/endpoints/${encodeURIComponent(id)}/ping`)
};
