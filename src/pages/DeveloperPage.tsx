import React, { useState } from 'react';
import { developerApi } from '../api';
import { useApi } from '../hooks/useApi';
import { Button, LoadingState, ErrorState, ErrorBanner } from '../components/common';
import PlatformConnectionCard from '../components/developer/PlatformConnectionCard';
import OperatorSiteCard from '../components/developer/OperatorSiteCard';

export default function DeveloperPage() {
  /* The Perfox connection is the gate for this whole page. Agents and webhook
     endpoints are bound to a workspace, so neither is fetched — the server
     refuses them with a 409 anyway — until the connection exists. */
  const platformState = useApi(() => developerApi.getPlatform(), []);
  const isPlatformConnected = Boolean(platformState.data?.configured);

  /* Agents are cached in our own collection. The server calls Perfox only when
     the cache is empty or when a refresh is asked for, so opening this tab does
     not hit the platform. */
  const [refreshNonce, setRefreshNonce] = useState(0);
  const agentsState = useApi(
    () => developerApi.listAgents(refreshNonce > 0),
    [refreshNonce],
    { enabled: isPlatformConnected }
  );
  const endpointsState = useApi(() => developerApi.listEndpoints(), [], {
    enabled: isPlatformConnected,
  });

  /* Re-reads the connection; the two hooks above follow it automatically. */
  const handlePlatformChanged = () => platformState.refetch();

  const agents = agentsState.data?.agents || [];
  const endpoints = endpointsState.data?.data || [];

  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  /* The agent whose status is mid-flight, so only its own toggle shows busy. */
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  // Visibility & Copy states for active agent keys
  const [copiedKeyType, setCopiedKeyType] = useState(null); // 'siteKey' | 'secretKey' | 'endpointUrl' | 'secretToken'

  // Testing ping per endpoint state: { [endpointId]: 'idle' | 'pinging' | 'success' | 'error' }
  const [pingStatuses, setPingStatuses] = useState({});

  // Modals
  const [isAddEndpointModalOpen, setIsAddEndpointModalOpen] = useState(false);

  // New Agent Form State

  // New Endpoint Form State
  const [newEndpointName, setNewEndpointName] = useState('');
  const [newEndpointUrl, setNewEndpointUrl] = useState('');
  const [newEndpointMethod, setNewEndpointMethod] = useState('GET');
  const [newEndpointTransport, setNewEndpointTransport] = useState('HTTP'); // 'HTTP' | 'SSE'
  const [newEndpointAuthType, setNewEndpointAuthType] = useState('none'); // 'none' | 'bearer' | 'apiKey' | 'basic'
  const [newEndpointBearerToken, setNewEndpointBearerToken] = useState('');
  const [newEndpointApiKeyHeader, setNewEndpointApiKeyHeader] = useState('X-API-Key');
  const [newEndpointApiKeyValue, setNewEndpointApiKeyValue] = useState('');
  const [newEndpointBasicAuth, setNewEndpointBasicAuth] = useState('');

  // Three Toggles: Send Query Parameters, Send Headers, Send Body
  const [sendQueryParams, setSendQueryParams] = useState(false);
  const [queryParams, setQueryParams] = useState([{ id: 1, key: '', value: '' }]);

  const [sendHeaders, setSendHeaders] = useState(false);
  const [headersList, setHeadersList] = useState([{ id: 1, key: 'Content-Type', value: 'application/json' }]);

  const [sendBody, setSendBody] = useState(false);
  const [bodyFormat, setBodyFormat] = useState('application/json');
  const [bodyContent, setBodyContent] = useState('{\n  "event": "webhook.trigger",\n  "timestamp": "2026-09-18T14:35:00Z"\n}');

  // Currently selected active agent (defaults to the first one the API returns)



  const publishedAgentCount = agents.filter((a: any) => a.status === 'published').length;
  const healthyEndpointCount = endpoints.filter((e: any) => e.status === 'Healthy').length;

  /* Averaged from the latency each endpoint actually reported on its last ping.
     Endpoints that have never been pinged carry no measurement and are left out
     rather than counted as zero. */
  const measuredLatencies = endpoints
    .map((e: any) => Number.parseFloat(String(e.latency ?? '')))
    .filter((ms: number) => Number.isFinite(ms) && ms > 0);
  const measuredLatencyCount = measuredLatencies.length;
  const averageLatency = measuredLatencyCount
    ? Math.round(measuredLatencies.reduce((sum: number, ms: number) => sum + ms, 0) / measuredLatencyCount)
    : null;


  const formatDate = (iso?: string): string => {
    if (!iso) return '—';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
  };

  // Query Params Handlers
  const handleAddQueryParam = () => {
    setQueryParams((prev) => [...prev, { id: Date.now(), key: '', value: '' }]);
  };

  const handleRemoveQueryParam = (id) => {
    setQueryParams((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : [{ id: 1, key: '', value: '' }]));
  };

  const handleUpdateQueryParam = (id, field, val) => {
    setQueryParams((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  // Headers Handlers
  const handleAddHeader = () => {
    setHeadersList((prev) => [...prev, { id: Date.now(), key: '', value: '' }]);
  };

  const handleRemoveHeader = (id) => {
    setHeadersList((prev) => (prev.length > 1 ? prev.filter((h) => h.id !== id) : [{ id: 1, key: '', value: '' }]));
  };

  const handleUpdateHeader = (id, field, val) => {
    setHeadersList((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: val } : h))
    );
  };

  const copyToClipboard = (text, type) => {
    if (!text) return;
    /* navigator.clipboard is undefined outside a secure context */
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKeyType(type);
    setTimeout(() => setCopiedKeyType(null), 2000);
  };

  /* Forces the server to call Perfox and re-sync the cache. */
  const handleRefreshAgents = () => setRefreshNonce((n) => n + 1);

  /**
   * Publishes or pauses an agent. The server decides which Perfox call that
   * means — publishing and pausing are different endpoints upstream.
   *
   * The row is patched in place from the response rather than refetching the
   * whole list, so flipping one toggle does not reload every card.
   */
  const handleToggleAgentStatus = async (agent) => {
    const next = agent.status === 'published' ? 'paused' : 'published';
    setSaveError('');
    setPendingStatusId(agent.id);
    try {
      const updated = await developerApi.setAgentStatus(agent.id, next);
      agentsState.setData((prev) =>
        prev
          ? { ...prev, agents: prev.agents.map((a) => (a.id === updated.id ? updated : a)) }
          : prev
      );
    } catch (err) {
      setSaveError(err?.message || `Could not ${next === 'published' ? 'publish' : 'pause'} the agent.`);
    } finally {
      setPendingStatusId(null);
    }
  };

  /* Keeps the real result of the last ping — the true status line and the
     measured latency — so the badge reports what happened rather than a fixed
     "200 OK". */
  const handleTestPingEndpoint = async (endpointId) => {
    setPingStatuses((prev) => ({ ...prev, [endpointId]: { state: 'pinging' } }));
    try {
      const result = await developerApi.pingEndpoint(endpointId);
      setPingStatuses((prev) => ({
        ...prev,
        [endpointId]: {
          state: result.healthy ? 'success' : 'error',
          status: result.status,
          latency: result.latency,
        },
      }));
      endpointsState.refetch();
    } catch (err) {
      setPingStatuses((prev) => ({
        ...prev,
        [endpointId]: { state: 'error', status: err?.message || 'Ping failed' },
      }));
      setSaveError(err?.message || 'Ping failed.');
    }
    setTimeout(() => {
      setPingStatuses((prev) => ({ ...prev, [endpointId]: null }));
    }, 6000);
  };

  /* Creates this platform's record for an agent that already exists in Perfox.
     `workflowId` carries the Perfox agent id — that is the link between the two,
     and the server generates the site key and secret. */
  const handleAddEndpointSubmit = async (e) => {
    e.preventDefault();
    if (!newEndpointName || !newEndpointUrl) return;

    // Construct authConfig based on chosen authType
    const authConfig: Record<string, any> = {};
    if (newEndpointAuthType === 'bearer') {
      authConfig.bearerToken = newEndpointBearerToken;
    } else if (newEndpointAuthType === 'apiKey') {
      authConfig.headerName = newEndpointApiKeyHeader || 'X-API-Key';
      authConfig.apiKeyValue = newEndpointApiKeyValue;
    } else if (newEndpointAuthType === 'basic') {
      authConfig.basicAuth = newEndpointBasicAuth;
    }

    setSaveError('');
    setIsSaving(true);
    try {
      const created = await developerApi.createEndpoint({
        name: newEndpointName,
        url: newEndpointUrl,
        method: newEndpointMethod,
        transport: newEndpointTransport,
        authType: newEndpointAuthType,
        authConfig,
        queryParams: sendQueryParams ? queryParams.filter((p) => p.key) : [],
        headers: sendHeaders ? headersList.filter((h) => h.key) : [],
        bodyFormat: sendBody ? bodyFormat : undefined,
        bodyContent: sendBody ? bodyContent : ''
      });

      setIsAddEndpointModalOpen(false);
      setNewEndpointName('');
      setNewEndpointUrl('');
      setNewEndpointMethod('GET');
      setNewEndpointTransport('HTTP');
      setNewEndpointAuthType('none');
      setNewEndpointBearerToken('');
      setNewEndpointApiKeyHeader('X-API-Key');
      setNewEndpointApiKeyValue('');
      setNewEndpointBasicAuth('');
      setSendQueryParams(false);
      setSendHeaders(false);
      setSendBody(false);

      endpointsState.refetch();
      agentsState.refetch();
    } catch (err) {
      setSaveError(err?.message || 'Could not register the endpoint.');
    } finally {
      setIsSaving(false);
    }
  };

  const getAuthBadge = (ep) => {
    if (ep.authType === 'bearer') {
      return (
        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">key</span>
          <span>Bearer Token</span>
        </span>
      );
    }
    if (ep.authType === 'apiKey') {
      return (
        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-blue-500/15 text-blue-700 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">vpn_key</span>
          <span>API Key ({ep.authConfig?.headerName || 'X-API-Key'})</span>
        </span>
      );
    }
    if (ep.authType === 'basic') {
      return (
        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-amber-500/15 text-amber-700 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">lock</span>
          <span>Basic Auth</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-surface-container text-on-surface-variant flex items-center gap-1">
        <span className="material-symbols-outlined text-xs">lock_open</span>
        <span>No Auth</span>
      </span>
    );
  };

  /* Rendered on every branch, so the title and the connection card stay put
     while agents load, fail, or turn out not to exist yet. */
  const pageChrome = (
    <>
      {/* Breadcrumb & Top Command Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-caption text-caption text-outline">
            <span>OmniFlow</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-primary font-semibold">Developer Hub</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Multi-Agent &amp; Multi-Endpoint Gateway
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
            Configure multi-agent integrations, manage public tokens &amp; secret keys, and route webhook event streams across multiple backend endpoints.
          </p>
        </div>

        {/* Action CTAs — nothing here can be created without a workspace. */}
        {isPlatformConnected && (
          <div className="flex items-center flex-wrap gap-space-xs self-start md:self-auto">
            <Button
              variant="secondary"
              size="md"
              startIcon="add_link"
              onClick={() => setIsAddEndpointModalOpen(true)}
            >
              Add Endpoint
            </Button>

          </div>
        )}
      </div>

      <PlatformConnectionCard
        connection={platformState.data}
        onChanged={handlePlatformChanged}
      />

      {/* Below the workspace connection: it belongs to the same tenant and is
          only meaningful once that one exists. */}
      <OperatorSiteCard
        connection={platformState.data}
        onChanged={handlePlatformChanged}
      />
    </>
  );

  const shell = (children: React.ReactNode) => (
    <div className="flex flex-col gap-space-lg w-full pt-space-xs pb-10">
      {pageChrome}
      {children}
    </div>
  );

  /* Step 1 — is the platform connected at all? */
  if (platformState.loading) {
    return <LoadingState label="Checking the Perfox platform connection…" />;
  }

  if (platformState.error) {
    return <ErrorState message={platformState.error} onRetry={platformState.refetch} />;
  }

  /* The connection card is the whole page until credentials exist. */
  if (!isPlatformConnected) {
    return shell(null);
  }

  /* Step 2 — the workspace is connected, so its agents and our endpoints load. */
  if ((agentsState.loading || endpointsState.loading) && agents.length === 0) {
    return shell(<LoadingState label="Loading agents…" />);
  }

  /* A failure here is usually upstream — Perfox refused or could not be reached
     — so the server's own message is shown rather than a generic one. */
  if (agentsState.error && agents.length === 0) {
    return shell(<ErrorState message={agentsState.error} onRetry={handleRefreshAgents} />);
  }

  if (agents.length === 0) {
    return shell(
      <ErrorState
        message={`No agents exist in the ${platformState.data?.workspace || 'connected'} Perfox workspace yet. Create one in Perfox, then refresh.`}
        onRetry={handleRefreshAgents}
      />
    );
  }

  return (
    <div className="flex flex-col gap-space-lg w-full pt-space-xs pb-10">
      {saveError && <ErrorBanner message={saveError} />}
      {endpointsState.error && <ErrorBanner message={endpointsState.error} />}

      {pageChrome}

      {/* Global Telemetry — every figure here is counted or averaged from the
          API response; nothing is a fixed literal. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm">
        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">smart_toy</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-medium">
              Connected Agents
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              {publishedAgentCount} Published
            </span>
            <span className="font-caption text-caption text-on-surface-variant font-semibold">
              {agents.length} registered
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">hub</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-medium">
              Registered Endpoints
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              {endpoints.length}
            </span>
            <span className="font-caption text-caption text-on-surface-variant font-semibold">
              {healthyEndpointCount} healthy · {endpoints.length - healthyEndpointCount} not
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">speed</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-medium">
              Avg Ping Latency
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              {averageLatency === null ? '—' : `${averageLatency} ms`}
            </span>
            <span className="font-caption text-caption text-on-surface-variant font-semibold">
              {averageLatency === null
                ? 'No endpoint pinged yet'
                : `Across ${measuredLatencyCount} pinged endpoint${measuredLatencyCount === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-secondary-container/20 text-secondary flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">verified_user</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-medium">
              Platform Connection
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
              {platformState.data?.status === 'Connected' ? 'Verified' : platformState.data?.status}
            </span>
            <span className="font-caption text-caption text-on-surface-variant font-semibold truncate">
              {platformState.data?.workspace || 'Perfox workspace'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: MULTI-AGENT CONNECTION MATRIX */}
      {/* ========================================================================= */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-surface-container-low/60 border-b border-surface-container flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-xl">smart_toy</span>
            </div>
            <div>
              <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                Workspace Agents ({agents.length})
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Live from the{' '}
                <span className="font-semibold">{platformState.data?.workspace || 'connected'}</span>{' '}
                Perfox workspace. Select one to configure its keys, widget appearance and endpoint
                bindings here.
              </p>
            </div>
          </div>

          <Button
            variant="soft"
            size="md"
            startIcon="refresh"
            loading={agentsState.loading}
            onClick={handleRefreshAgents}
          >
            Refresh from Perfox
          </Button>
        </div>

        {/* Agent cards. Every field is what Perfox reported at the last sync,
            including its own status vocabulary (published / paused / draft).
            The list is read-only here — agents are managed in Perfox. */}
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {agents.map((agt) => {
              const isStatusPending = pendingStatusId === agt.id;
              const statusChip =
                agt.status === 'published'
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : agt.status === 'paused'
                    ? 'bg-amber-500/15 text-amber-700'
                    : 'bg-surface-container text-on-surface-variant';
              return (
                <div
                  key={agt.id}
                  className="p-3.5 rounded-2xl border border-surface-container bg-surface-container-low/70 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-base">smart_toy</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-title-sm text-title-sm font-bold text-on-surface truncate">
                          {agt.name}
                        </h3>
                        <span className="text-[11px] text-outline font-mono block truncate">
                          {agt.id}
                        </span>
                      </div>
                    </div>

                    {/* A draft agent has no live/paused distinction, so it is
                        labelled rather than toggled. */}
                    {agt.status === 'draft' ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusChip}`}>
                        draft
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusChip}`}>
                          {agt.status}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={agt.status === 'published'}
                          aria-label={
                            agt.status === 'published'
                              ? `Pause ${agt.name}`
                              : `Publish ${agt.name}`
                          }
                          disabled={isStatusPending}
                          onClick={() => handleToggleAgentStatus(agt)}
                          title={agt.status === 'published' ? 'Pause this agent' : 'Publish this agent'}
                          className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-wait ${
                            isStatusPending
                              ? 'bg-surface-container-high'
                              : agt.status === 'published'
                                ? 'bg-emerald-600 cursor-pointer'
                                : 'bg-surface-container-high cursor-pointer'
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform absolute top-[3px] ${
                              agt.status === 'published' ? 'left-[21px]' : 'left-[3px]'
                            }`}
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {agt.description && (
                    <p className="text-[11px] text-on-surface-variant line-clamp-2">
                      {agt.description}
                    </p>
                  )}

                  <div className="space-y-1 text-[11px] text-on-surface-variant pt-1 border-t border-surface-container-low">
                    <div className="flex items-center justify-between">
                      <span className="text-outline">Channels</span>
                      <span className="font-medium text-on-surface truncate max-w-[140px]">
                        {agt.channels?.length ? agt.channels.join(', ') : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-outline">Active version</span>
                      <span className="font-semibold text-on-surface">v{agt.activeVersion}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-outline">Nodes</span>
                      <span className="font-semibold text-on-surface">{agt.nodeCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-outline">Updated in Perfox</span>
                      <span className="font-medium text-on-surface">
                        {formatDate(agt.perfoxUpdatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: MULTIPLE ENDPOINT & WEBHOOK GATEWAY HUB */}
      {/* ========================================================================= */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-surface-container-low/60 border-b border-surface-container flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-xl">hub</span>
            </div>
            <div>
              <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                Backend Endpoints &amp; Webhooks ({endpoints.length})
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Configure multiple live endpoints with custom transport protocols and authentication methods.
              </p>
            </div>
          </div>

          <Button
            variant="soft"
            size="md"
            startIcon="add"
            onClick={() => setIsAddEndpointModalOpen(true)}
          >
            Register New Endpoint
          </Button>
        </div>

        {/* Endpoints List */}
        <div className="p-5 space-y-3">
          {endpoints.map((ep) => {
            const ping = pingStatuses[ep.id];
            const isPinging = ping?.state === 'pinging';
            const hasPingResult = ping?.state === 'success' || ping?.state === 'error';

            return (
              <div
                key={ep.id}
                className="p-4 rounded-2xl border border-surface-container bg-surface-container-low/40 hover:bg-surface-container-low/80 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Endpoint Info */}
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-blue-500/20 text-blue-700">
                      {ep.method}
                    </span>

                    {/* Transport Protocol Badge */}
                    <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold flex items-center gap-1 ${
                      ep.transport === 'SSE'
                        ? 'bg-purple-500/15 text-purple-700'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      <span className="material-symbols-outlined text-xs">
                        {ep.transport === 'SSE' ? 'wifi_tethering' : 'http'}
                      </span>
                      <span>{ep.transport || 'HTTP'}</span>
                    </span>

                    {/* Authentication Type Badge */}
                    {getAuthBadge(ep)}

                    <h3 className="font-title-md text-title-md font-bold text-on-surface">
                      {ep.name}
                    </h3>

                    {/* Coloured from the status the API reports — this chip used to
                        be green even for an Offline endpoint. */}
                    <span
                      className={`text-[11px] px-2 py-0.2 rounded-full font-semibold flex items-center gap-1 ${
                        ep.status === 'Healthy'
                          ? 'text-emerald-700 bg-emerald-500/15'
                          : ep.status === 'Degraded'
                            ? 'text-amber-700 bg-amber-500/15'
                            : 'text-error bg-error/10'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          ep.status === 'Healthy'
                            ? 'bg-emerald-600'
                            : ep.status === 'Degraded'
                              ? 'bg-amber-600'
                              : 'bg-error'
                        }`}
                      ></span>
                      {ep.status}
                      {ep.latency ? ` (${ep.latency})` : ''}
                    </span>
                  </div>

                  {/* URL Bar */}
                  <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-xl border border-surface-container max-w-2xl">
                    <span className="font-mono text-xs text-on-surface flex-1 truncate">
                      {ep.url}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(ep.url, `ep-${ep.id}`)}
                      className="text-primary hover:underline text-xs font-semibold cursor-pointer shrink-0"
                    >
                      {copiedKeyType === `ep-${ep.id}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Actions & Test Ping */}
                <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
                  {/* The real status line and measured latency the server reported. */}
                  {hasPingResult && (
                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 animate-in fade-in ${
                        ping.state === 'success'
                          ? 'text-emerald-700 bg-emerald-500/15'
                          : 'text-error bg-error/10'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">
                        {ping.state === 'success' ? 'verified' : 'error'}
                      </span>
                      <span>
                        {ping.status}
                        {ping.latency ? ` (${ping.latency})` : ''}
                      </span>
                    </span>
                  )}

                  <Button
                    variant="hover"
                    size="sm"
                    startIcon={isPinging ? 'sync' : 'network_ping'}
                    loading={isPinging}
                    disabled={isPinging}
                    onClick={() => handleTestPingEndpoint(ep.id)}
                  >
                    {isPinging ? 'Pinging Gateway...' : 'Test Ping'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTER NEW ENDPOINT WITH METHOD, URL, AUTH & THREE TOGGLES */}
      {/* ========================================================================= */}
      {isAddEndpointModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg border border-surface-container-high flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-surface-container-low/70 border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-lg">hub</span>
                </div>
                <div>
                  <h2 className="font-title-md text-title-md text-on-surface font-bold">
                    Register New Webhook Endpoint
                  </h2>
                  <p className="text-[11px] text-on-surface-variant">Configure method, URL, authentication and request payload</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                onClick={() => setIsAddEndpointModalOpen(false)}
                aria-label="Close modal"
              />
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleAddEndpointSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
              {/* Endpoint Name & Transport */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Endpoint Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newEndpointName}
                    onChange={(e) => setNewEndpointName(e.target.value)}
                    placeholder="e.g. Booking Sync Webhook"
                    className="w-full h-10 px-3 font-title-sm text-title-sm rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Transport Protocol
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 h-10 p-1 bg-surface-container-low rounded-xl border border-surface-container-high">
                    <button
                      type="button"
                      onClick={() => setNewEndpointTransport('HTTP')}
                      className={`rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        newEndpointTransport === 'HTTP'
                          ? 'bg-surface-container-lowest text-primary shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">http</span>
                      <span>HTTP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEndpointTransport('SSE')}
                      className={`rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        newEndpointTransport === 'SSE'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">wifi_tethering</span>
                      <span>SSE</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 1. Method (Dropdown) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">
                  Method
                </label>
                <div className="relative">
                  <select
                    value={newEndpointMethod}
                    onChange={(e) => setNewEndpointMethod(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high font-semibold text-sm appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-inner pr-8"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                    <option value="HEAD">HEAD</option>
                    <option value="OPTIONS">OPTIONS</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-outline">
                    <span className="material-symbols-outlined text-lg">expand_more</span>
                  </div>
                </div>
              </div>

              {/* 2. URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">
                  URL
                </label>
                <input
                  type="url"
                  required
                  value={newEndpointUrl}
                  onChange={(e) => setNewEndpointUrl(e.target.value)}
                  placeholder="http://example.com/index.html"
                  className="w-full h-10 px-3 font-mono text-xs rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high placeholder:text-outline/60 focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                />
              </div>

              {/* 3. Authentication (Dropdown with conditional fields) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">
                  Authentication
                </label>
                <div className="relative">
                  <select
                    value={newEndpointAuthType}
                    onChange={(e) => setNewEndpointAuthType(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high font-semibold text-sm appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-inner pr-8"
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="apiKey">API Key</option>
                    <option value="basic">Basic Auth</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-outline">
                    <span className="material-symbols-outlined text-lg">expand_more</span>
                  </div>
                </div>

                {/* Conditional Auth Fields */}
                {newEndpointAuthType !== 'none' && (
                  <div className="p-3 rounded-xl bg-surface-container-low/60 border border-surface-container mt-1">
                    {/* Bearer Token */}
                    {newEndpointAuthType === 'bearer' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-on-surface flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-primary">key</span>
                          <span>Bearer Token *</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newEndpointBearerToken}
                          onChange={(e) => setNewEndpointBearerToken(e.target.value)}
                          placeholder="e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          className="w-full h-9 px-3 font-mono text-xs rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                        />
                      </div>
                    )}

                    {/* API Key */}
                    {newEndpointAuthType === 'apiKey' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-on-surface">Header Name *</label>
                          <input
                            type="text"
                            required
                            value={newEndpointApiKeyHeader}
                            onChange={(e) => setNewEndpointApiKeyHeader(e.target.value)}
                            placeholder="e.g. X-API-Key"
                            className="w-full h-9 px-3 font-mono text-xs rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-on-surface">API Key Value *</label>
                          <input
                            type="text"
                            required
                            value={newEndpointApiKeyValue}
                            onChange={(e) => setNewEndpointApiKeyValue(e.target.value)}
                            placeholder="e.g. key_99a80b1c..."
                            className="w-full h-9 px-3 font-mono text-xs rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                          />
                        </div>
                      </div>
                    )}

                    {/* Basic Auth */}
                    {newEndpointAuthType === 'basic' && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-on-surface flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-primary">lock</span>
                            <span>Basic Auth Credentials (username:password) *</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          required
                          value={newEndpointBasicAuth}
                          onChange={(e) => setNewEndpointBasicAuth(e.target.value)}
                          placeholder="username:password"
                          className="w-full h-9 px-3 font-mono text-xs rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ========================================================================= */}
              {/* THREE TOGGLES: Query Parameters, Headers, Body */}
              {/* ========================================================================= */}
              <div className="pt-2 border-t border-surface-container space-y-3">
                {/* Toggle 1: Send Query Parameters */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-on-surface">Send Query Parameters</span>
                    <button
                      type="button"
                      onClick={() => setSendQueryParams(!sendQueryParams)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        sendQueryParams ? 'bg-primary' : 'bg-surface-container-high'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform absolute top-0.5 ${
                          sendQueryParams ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Expandable Query Params Builder */}
                  {sendQueryParams && (
                    <div className="p-3 rounded-xl bg-surface-container-low/80 border border-surface-container space-y-2 animate-in fade-in duration-150">
                      <div className="space-y-1.5">
                        {queryParams.map((param, pIdx) => (
                          <div key={param.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={param.key}
                              onChange={(e) => handleUpdateQueryParam(param.id, 'key', e.target.value)}
                              placeholder="Key (e.g. format)"
                              className="flex-1 h-8 px-2.5 rounded-lg bg-surface-container-lowest text-xs font-mono border border-surface-container focus:outline-none"
                            />
                            <input
                              type="text"
                              value={param.value}
                              onChange={(e) => handleUpdateQueryParam(param.id, 'value', e.target.value)}
                              placeholder="Value (e.g. json)"
                              className="flex-1 h-8 px-2.5 rounded-lg bg-surface-container-lowest text-xs font-mono border border-surface-container focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveQueryParam(param.id)}
                              className="w-7 h-7 rounded-lg text-outline hover:text-error hover:bg-surface-container flex items-center justify-center cursor-pointer"
                              title="Remove parameter"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleAddQueryParam}
                        className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span>Add Parameter</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Toggle 2: Send Headers */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-on-surface">Send Headers</span>
                    <button
                      type="button"
                      onClick={() => setSendHeaders(!sendHeaders)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        sendHeaders ? 'bg-primary' : 'bg-surface-container-high'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform absolute top-0.5 ${
                          sendHeaders ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Expandable Headers Builder */}
                  {sendHeaders && (
                    <div className="p-3 rounded-xl bg-surface-container-low/80 border border-surface-container space-y-2 animate-in fade-in duration-150">
                      <div className="space-y-1.5">
                        {headersList.map((header) => (
                          <div key={header.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={header.key}
                              onChange={(e) => handleUpdateHeader(header.id, 'key', e.target.value)}
                              placeholder="Header Name"
                              className="flex-1 h-8 px-2.5 rounded-lg bg-surface-container-lowest text-xs font-mono border border-surface-container focus:outline-none"
                            />
                            <input
                              type="text"
                              value={header.value}
                              onChange={(e) => handleUpdateHeader(header.id, 'value', e.target.value)}
                              placeholder="Header Value"
                              className="flex-1 h-8 px-2.5 rounded-lg bg-surface-container-lowest text-xs font-mono border border-surface-container focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveHeader(header.id)}
                              className="w-7 h-7 rounded-lg text-outline hover:text-error hover:bg-surface-container flex items-center justify-center cursor-pointer"
                              title="Remove header"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleAddHeader}
                        className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span>Add Header</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Toggle 3: Send Body */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-on-surface">Send Body</span>
                    <button
                      type="button"
                      onClick={() => setSendBody(!sendBody)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        sendBody ? 'bg-primary' : 'bg-surface-container-high'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform absolute top-0.5 ${
                          sendBody ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Expandable Body Editor */}
                  {sendBody && (
                    <div className="p-3 rounded-xl bg-surface-container-low/80 border border-surface-container space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-on-surface-variant">Body Content-Type</label>
                        <select
                          value={bodyFormat}
                          onChange={(e) => setBodyFormat(e.target.value)}
                          className="h-7 px-2 rounded-lg bg-surface-container-lowest text-xs font-mono border border-surface-container text-on-surface cursor-pointer"
                        >
                          <option value="application/json">JSON (application/json)</option>
                          <option value="application/x-www-form-urlencoded">x-www-form-urlencoded</option>
                          <option value="text/plain">Raw Text (text/plain)</option>
                        </select>
                      </div>
                      <textarea
                        rows={4}
                        value={bodyContent}
                        onChange={(e) => setBodyContent(e.target.value)}
                        placeholder='{\n  "key": "value"\n}'
                        className="w-full p-2.5 font-mono text-xs rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary shadow-inner resize-none leading-relaxed"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-surface-container mt-1">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setIsAddEndpointModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  startIcon="add_link"
                >
                  Register Endpoint
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
