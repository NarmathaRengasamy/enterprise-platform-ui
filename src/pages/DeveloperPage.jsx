import React, { useState } from 'react';
import { INITIAL_DEVELOPER_AGENTS, INITIAL_DEVELOPER_ENDPOINTS } from '../data/mockData';

export default function DeveloperPage() {
  const [agents, setAgents] = useState(INITIAL_DEVELOPER_AGENTS);
  const [endpoints, setEndpoints] = useState(INITIAL_DEVELOPER_ENDPOINTS);
  const [selectedAgentId, setSelectedAgentId] = useState(INITIAL_DEVELOPER_AGENTS[0].id);

  // Visibility & Copy states for active agent keys
  const [showSiteKey, setShowSiteKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedKeyType, setCopiedKeyType] = useState(null); // 'siteKey' | 'secretKey' | 'endpointUrl' | 'secretToken'

  // Testing ping per endpoint state: { [endpointId]: 'idle' | 'pinging' | 'success' | 'error' }
  const [pingStatuses, setPingStatuses] = useState({});

  // Modals
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [isAddEndpointModalOpen, setIsAddEndpointModalOpen] = useState(false);

  // New Agent Form State
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentWorkflowId, setNewAgentWorkflowId] = useState('');
  const [newAgentChannel, setNewAgentChannel] = useState('Web Storefront Widget');
  const [newAgentModel, setNewAgentModel] = useState('Perfox-Omni 2.5');
  const [newAgentAccentColor, setNewAgentAccentColor] = useState('#2563eb');
  const [newAgentPosition, setNewAgentPosition] = useState('bottom-right');
  const [newAgentDescription, setNewAgentDescription] = useState('');

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

  // Currently selected active agent
  const activeAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyType(type);
    setTimeout(() => setCopiedKeyType(null), 2000);
  };

  const handleTestPingEndpoint = (endpointId) => {
    setPingStatuses((prev) => ({ ...prev, [endpointId]: 'pinging' }));
    setTimeout(() => {
      setPingStatuses((prev) => ({ ...prev, [endpointId]: 'success' }));
      setTimeout(() => {
        setPingStatuses((prev) => ({ ...prev, [endpointId]: null }));
      }, 3500);
    }, 900);
  };

  const handleToggleAgentStatus = (agentId) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id === agentId) {
          const newStatus = a.status === 'Active' ? 'Paused' : 'Active';
          return {
            ...a,
            status: newStatus,
            statusColor: newStatus === 'Active' ? 'emerald' : 'amber'
          };
        }
        return a;
      })
    );
  };

  const handleUpdateActiveAgentColor = (color) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === activeAgent.id ? { ...a, accentColor: color } : a))
    );
  };

  const handleUpdateActiveAgentPosition = (pos) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === activeAgent.id ? { ...a, position: pos } : a))
    );
  };

  const handleToggleAgentEndpointAssignment = (endpointId) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id === activeAgent.id) {
          const exists = a.assignedEndpoints.includes(endpointId);
          const updated = exists
            ? a.assignedEndpoints.filter((id) => id !== endpointId)
            : [...a.assignedEndpoints, endpointId];
          return { ...a, assignedEndpoints: updated };
        }
        return a;
      })
    );
  };

  const handleRotateKey = () => {
    const newSecret = `sk_mock_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setAgents((prev) =>
      prev.map((a) => (a.id === activeAgent.id ? { ...a, secretKey: newSecret } : a))
    );
    alert(`Rotated secret API key for "${activeAgent.name}". Ensure your backend environments are updated.`);
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

  // Submit New Agent
  const handleAddAgentSubmit = (e) => {
    e.preventDefault();
    if (!newAgentName) return;

    const id = `agt-00${agents.length + 1}`;
    const wfId =
      newAgentWorkflowId ||
      `wf_flow_${newAgentName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).substring(2, 7)}`;
    const randomHex1 = Math.random().toString(36).substring(2, 14);
    const randomHex2 = Math.random().toString(36).substring(2, 14);

    const newAgt = {
      id,
      name: newAgentName,
      workflowId: wfId,
      channel: newAgentChannel,
      model: newAgentModel,
      siteKey: `pk_mock_${randomHex1}${randomHex2}`,
      secretKey: `sk_mock_${randomHex2}${randomHex1}`,
      accentColor: newAgentAccentColor,
      position: newAgentPosition,
      status: 'Active',
      statusColor: 'emerald',
      totalCalls: '0',
      avgLatency: '18 ms',
      assignedEndpoints: ['ep-1'],
      description: newAgentDescription || 'Multi-agent connection configured for autonomous workflow execution.'
    };

    setAgents((prev) => [...prev, newAgt]);
    setSelectedAgentId(id);
    setIsAddAgentModalOpen(false);

    // Reset form
    setNewAgentName('');
    setNewAgentWorkflowId('');
    setNewAgentDescription('');
  };

  // Submit New Endpoint with Method, URL, Auth, Toggles
  const handleAddEndpointSubmit = (e) => {
    e.preventDefault();
    if (!newEndpointName || !newEndpointUrl) return;

    const id = `ep-${endpoints.length + 1}`;

    // Construct authConfig based on chosen authType
    const authConfig = {};
    if (newEndpointAuthType === 'bearer') {
      authConfig.bearerToken = newEndpointBearerToken;
    } else if (newEndpointAuthType === 'apiKey') {
      authConfig.headerName = newEndpointApiKeyHeader || 'X-API-Key';
      authConfig.apiKeyValue = newEndpointApiKeyValue;
    } else if (newEndpointAuthType === 'basic') {
      authConfig.basicAuth = newEndpointBasicAuth;
    }

    const newEp = {
      id,
      name: newEndpointName,
      url: newEndpointUrl,
      method: newEndpointMethod,
      transport: newEndpointTransport,
      authType: newEndpointAuthType,
      authConfig,
      sendQueryParams,
      queryParams: sendQueryParams ? queryParams.filter((p) => p.key) : [],
      sendHeaders,
      headers: sendHeaders ? headersList.filter((h) => h.key) : [],
      sendBody,
      bodyFormat: sendBody ? bodyFormat : null,
      bodyContent: sendBody ? bodyContent : '',
      status: 'Healthy',
      statusColor: 'emerald',
      latency: '18 ms',
      connectedAgentsCount: 1,
      lastPingStatus: '200 OK',
      lastPingTime: 'Just now'
    };

    setEndpoints((prev) => [...prev, newEp]);
    // Assign to active agent by default
    setAgents((prev) =>
      prev.map((a) =>
        a.id === activeAgent.id
          ? { ...a, assignedEndpoints: [...a.assignedEndpoints, id] }
          : a
      )
    );
    setIsAddEndpointModalOpen(false);

    // Reset form
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

  return (
    <div className="flex flex-col gap-space-lg w-full pt-space-xs pb-10">
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

        {/* Action CTAs */}
        <div className="flex items-center flex-wrap gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setIsAddEndpointModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface font-label-md text-label-md font-semibold border border-surface-container transition-all cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-base text-primary">add_link</span>
            <span>Add Endpoint</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddAgentModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold transition-all cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-base">smart_toy</span>
            <span>Connect New Agent</span>
          </button>
        </div>
      </div>

      {/* Global Telemetry Metrics */}
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
              {agents.length} Active
            </span>
            <span className="font-caption text-caption text-purple-700 font-semibold flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
              All instances routed
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">hub</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-medium">
              Live Endpoints
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              {endpoints.length} Registered
            </span>
            <span className="font-caption text-caption text-blue-600 font-semibold">
              Event stream active
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">speed</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-medium">
              Avg Gateway Latency
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              18 ms
            </span>
            <span className="font-caption text-caption text-emerald-600 font-semibold flex items-center gap-0.5">
              <span className="material-symbols-outlined text-xs">trending_down</span> Nominal SLA
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-secondary-container/20 text-secondary flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">verified_user</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-medium">
              Uptime &amp; Security
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              99.98%
            </span>
            <span className="font-caption text-caption text-outline">
              Keys encrypted (AES-256)
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
                Connected AI Agents ({agents.length})
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Select an agent below to configure its unique keys, widget appearance, and endpoint bindings.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddAgentModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-label-md text-label-md font-semibold rounded-xl transition-all cursor-pointer self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Connect Another Agent</span>
          </button>
        </div>

        {/* Multi-Agent Cards Grid */}
        <div className="p-5 border-b border-surface-container bg-surface-container-low/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {agents.map((agt) => {
              const isSelected = agt.id === activeAgent.id;
              return (
                <div
                  key={agt.id}
                  onClick={() => setSelectedAgentId(agt.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                    isSelected
                      ? 'bg-surface-container-lowest border-primary shadow-md ring-2 ring-primary/20'
                      : 'bg-surface-container-low/70 border-surface-container hover:bg-surface-container hover:border-surface-container-high'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        style={{ backgroundColor: agt.accentColor }}
                        className="w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs"
                      >
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

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        agt.status === 'Active'
                          ? 'bg-emerald-500/15 text-emerald-700'
                          : 'bg-amber-500/15 text-amber-700'
                      }`}
                    >
                      {agt.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-on-surface-variant pt-1 border-t border-surface-container-low">
                    <div className="flex items-center justify-between">
                      <span className="text-outline">Model:</span>
                      <span className="font-semibold text-on-surface">{agt.model}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-outline">Channel:</span>
                      <span className="font-medium text-on-surface truncate max-w-[130px]">{agt.channel}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-outline">Assigned Endpoints:</span>
                      <span className="font-bold text-primary">{agt.assignedEndpoints.length} Active</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-full text-center py-1 bg-primary/10 text-primary font-bold text-[11px] rounded-lg">
                      Currently Selected
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Agent Detailed Configuration Panel */}
        <div className="p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Credentials & Model Info */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold text-outline">
                  Agent Credentials:
                </span>
                <span className="font-title-md text-title-md font-bold text-primary">
                  {activeAgent.name}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${
                  activeAgent.status === 'Active' ? 'text-emerald-700' : 'text-on-surface-variant'
                }`}>
                  {activeAgent.status === 'Active' ? 'Active' : 'Paused'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={activeAgent.status === 'Active'}
                  onClick={() => handleToggleAgentStatus(activeAgent.id)}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer focus:outline-none ${
                    activeAgent.status === 'Active' ? 'bg-emerald-600' : 'bg-surface-container-high'
                  }`}
                  title={activeAgent.status === 'Active' ? 'Click to Pause Agent' : 'Click to Activate Agent'}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform absolute top-0.5 ${
                      activeAgent.status === 'Active' ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Workflow ID & Channel Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface-variant">Workflow Identifier</label>
                <input
                  type="text"
                  readOnly
                  value={activeAgent.workflowId}
                  className="h-9 px-3 rounded-xl bg-surface-container-low font-mono text-xs text-on-surface border border-surface-container focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface-variant">Model Engine</label>
                <input
                  type="text"
                  readOnly
                  value={activeAgent.model}
                  className="h-9 px-3 rounded-xl bg-surface-container-low font-semibold text-xs text-on-surface border border-surface-container focus:outline-none"
                />
              </div>
            </div>

            {/* Public Site Key */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-on-surface flex items-center gap-1">
                  <span>Public Site Key</span>
                  <span className="text-[10px] text-outline font-normal">(Safe for frontend inclusion)</span>
                </label>
                <span className="text-[11px] text-emerald-700 font-medium">Valid</span>
              </div>
              <div className="flex items-center bg-surface-container-low px-3 py-1.5 rounded-xl border border-surface-container shadow-inner">
                <span className="font-mono text-xs text-on-surface flex-1 truncate">
                  {showSiteKey ? activeAgent.siteKey : `${activeAgent.siteKey.slice(0, 10)}••••••••••••••••••••${activeAgent.siteKey.slice(-4)}`}
                </span>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    onClick={() => setShowSiteKey(!showSiteKey)}
                    className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container cursor-pointer"
                    title="Toggle site key visibility"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showSiteKey ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(activeAgent.siteKey, 'siteKey')}
                    className="flex items-center gap-1 text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-all cursor-pointer font-semibold text-xs"
                  >
                    <span className="material-symbols-outlined text-base">
                      {copiedKeyType === 'siteKey' ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedKeyType === 'siteKey' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Secret Backend API Key */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-on-surface flex items-center gap-1">
                  <span>Secret Backend API Key</span>
                  <span className="text-[10px] text-error font-semibold">(Keep private)</span>
                </label>
                <button
                  type="button"
                  onClick={handleRotateKey}
                  className="text-[11px] text-primary hover:underline font-semibold cursor-pointer flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-xs">restart_alt</span>
                  <span>Rotate Key</span>
                </button>
              </div>
              <div className="flex items-center bg-surface-container-low px-3 py-1.5 rounded-xl border border-surface-container shadow-inner">
                <span className="font-mono text-xs text-on-surface flex-1 truncate">
                  {showSecretKey ? activeAgent.secretKey : `${activeAgent.secretKey.slice(0, 10)}••••••••••••••••••••${activeAgent.secretKey.slice(-4)}`}
                </span>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container cursor-pointer"
                    title="Toggle secret key visibility"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showSecretKey ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(activeAgent.secretKey, 'secretKey')}
                    className="flex items-center gap-1 text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-all cursor-pointer font-semibold text-xs"
                  >
                    <span className="material-symbols-outlined text-base">
                      {copiedKeyType === 'secretKey' ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedKeyType === 'secretKey' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Widget Styling & Endpoint Bindings */}
          <div className="flex flex-col gap-4">
            {/* Widget Styling Customization */}
            <div className="p-4 rounded-2xl bg-surface-container-low/60 border border-surface-container space-y-3">
              <span className="text-xs font-bold text-on-surface block uppercase tracking-wider">
                Storefront Widget Appearance
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Theme Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeAgent.accentColor}
                      onChange={(e) => handleUpdateActiveAgentColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-surface-container-high cursor-pointer"
                    />
                    <span className="font-mono text-xs font-bold text-on-surface">{activeAgent.accentColor}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Display Position</label>
                  <select
                    value={activeAgent.position}
                    onChange={(e) => handleUpdateActiveAgentPosition(e.target.value)}
                    className="h-9 w-full px-2.5 rounded-lg bg-surface-container-lowest text-xs border border-surface-container text-on-surface cursor-pointer"
                  >
                    <option value="bottom-right">Bottom Right Floating</option>
                    <option value="bottom-left">Bottom Left Floating</option>
                    <option value="embed-inline">Inline Embed Frame</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Assigned Endpoints for this Agent */}
            <div className="p-4 rounded-2xl bg-surface-container-low/60 border border-surface-container space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Connected Webhook Endpoints
                </span>
                <span className="text-[11px] text-outline">
                  {activeAgent.assignedEndpoints.length} of {endpoints.length} connected
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {endpoints.map((ep) => {
                  const isChecked = activeAgent.assignedEndpoints.includes(ep.id);
                  return (
                    <label
                      key={ep.id}
                      onClick={() => handleToggleAgentEndpointAssignment(ep.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-primary/10 border-primary/40 text-on-surface font-semibold'
                          : 'bg-surface-container-lowest border-surface-container text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-primary focus:ring-0 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <span className="block truncate font-medium">{ep.name}</span>
                        <span className="text-[10px] text-outline font-mono block truncate">{ep.url}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
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

          <button
            type="button"
            onClick={() => setIsAddEndpointModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 font-label-md text-label-md font-semibold rounded-xl transition-all cursor-pointer self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Register New Endpoint</span>
          </button>
        </div>

        {/* Endpoints List */}
        <div className="p-5 space-y-3">
          {endpoints.map((ep) => {
            const isPinging = pingStatuses[ep.id] === 'pinging';
            const isSuccess = pingStatuses[ep.id] === 'success';

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

                    <span className="text-[11px] text-emerald-700 bg-emerald-500/15 px-2 py-0.2 rounded-full font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      {ep.status} ({ep.latency})
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
                  {isSuccess && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-500/15 px-3 py-1.5 rounded-xl flex items-center gap-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-base">verified</span>
                      <span>200 OK (16ms)</span>
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={isPinging}
                    onClick={() => handleTestPingEndpoint(ep.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      isPinging
                        ? 'bg-primary/20 text-primary border-primary/40'
                        : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-surface-container-high'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-base ${isPinging ? 'animate-spin' : ''}`}>
                      {isPinging ? 'sync' : 'network_ping'}
                    </span>
                    <span>{isPinging ? 'Pinging Gateway...' : 'Test Ping'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CONNECT NEW AGENT */}
      {/* ========================================================================= */}
      {isAddAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg border border-surface-container-high flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh]">
            <div className="px-5 py-3.5 bg-surface-container-low/70 border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-lg">smart_toy</span>
                </div>
                <div>
                  <h2 className="font-title-md text-title-md text-on-surface font-bold">
                    Connect New AI Agent
                  </h2>
                  <p className="text-[11px] text-on-surface-variant">Register a new multi-agent worker and generate API credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAgentModalOpen(false)}
                className="w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleAddAgentSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Agent Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. Luxury Villa Concierge Bot"
                  className="w-full h-10 px-3 font-title-sm text-title-sm rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Deployment Channel
                  </label>
                  <select
                    value={newAgentChannel}
                    onChange={(e) => setNewAgentChannel(e.target.value)}
                    className="h-10 px-3 text-xs rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high cursor-pointer"
                  >
                    <option value="Web Storefront Widget">Web Storefront Widget</option>
                    <option value="Booking Portal & WhatsApp">Booking Portal &amp; WhatsApp</option>
                    <option value="Customer Help Desk & Email">Customer Help Desk &amp; Email</option>
                    <option value="Telephony Voice SIP Trunk">Telephony Voice SIP Trunk</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Model Engine
                  </label>
                  <select
                    value={newAgentModel}
                    onChange={(e) => setNewAgentModel(e.target.value)}
                    className="h-10 px-3 text-xs rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high cursor-pointer"
                  >
                    <option value="Perfox-Omni 2.5">Perfox-Omni 2.5 (Fast)</option>
                    <option value="Perfox-Omni 2.5 Pro">Perfox-Omni 2.5 Pro (Advanced)</option>
                    <option value="Claude 3.7 Sonnet (Hybrid)">Claude 3.7 Sonnet (Hybrid)</option>
                    <option value="Perfox Realtime Voice v2">Perfox Realtime Voice v2</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newAgentAccentColor}
                      onChange={(e) => setNewAgentAccentColor(e.target.value)}
                      className="w-10 h-10 rounded-xl border border-surface-container-high cursor-pointer"
                    />
                    <span className="font-mono text-xs font-bold text-on-surface">{newAgentAccentColor}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Widget Position
                  </label>
                  <select
                    value={newAgentPosition}
                    onChange={(e) => setNewAgentPosition(e.target.value)}
                    className="h-10 px-2 text-xs rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high cursor-pointer"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="embed-inline">Inline Frame</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Description / Purpose
                </label>
                <textarea
                  rows={2}
                  value={newAgentDescription}
                  onChange={(e) => setNewAgentDescription(e.target.value)}
                  placeholder="Describe what this AI agent handles..."
                  className="w-full p-2.5 font-body-sm text-body-sm rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-container mt-1">
                <button
                  type="button"
                  onClick={() => setIsAddAgentModalOpen(false)}
                  className="px-4 py-2 font-label-md text-label-md font-semibold rounded-xl text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-label-md text-label-md font-semibold rounded-xl bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  <span>Create &amp; Connect Agent</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <button
                type="button"
                onClick={() => setIsAddEndpointModalOpen(false)}
                className="w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
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
                            placeholder="e.g. key_mock_99a80b1c..."
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
                <button
                  type="button"
                  onClick={() => setIsAddEndpointModalOpen(false)}
                  className="px-4 py-2 font-label-md text-label-md font-semibold rounded-xl text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-label-md text-label-md font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">add_link</span>
                  <span>Register Endpoint</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
