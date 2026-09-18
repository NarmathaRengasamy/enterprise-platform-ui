import React, { useState } from 'react';

export default function DeveloperPage() {
  const [showSiteKey, setShowSiteKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [siteKeyCopied, setSiteKeyCopied] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('https://api.perfox.com/v1/omniflow-webhook');
  const [testPingStatus, setTestPingStatus] = useState(null);
  const [widgetAccentColor, setWidgetAccentColor] = useState('#2563eb');
  const [widgetPosition, setWidgetPosition] = useState('bottom-right');

  const siteKey = 'pk_live_8f93a0d7e4b94c1a8e99bc1209e5';
  const secretKey = 'sk_live_948f10b299e4431a8bc430e719bf9a';

  const embedSnippet = `<!-- OmniFlow Perfox Assistant Widget -->
<script
  src="https://cdn.omniflow.io/widget/v2/bundle.js"
  data-site-key="${siteKey}"
  data-workflow-id="wf_flow_ecom_prod_9024a"
  data-accent-color="${widgetAccentColor}"
  data-position="${widgetPosition}"
  async>
</script>`;

  const copyToClipboard = (text, setCopiedState) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  const handleTestPing = () => {
    setTestPingStatus('pinging');
    setTimeout(() => {
      setTestPingStatus('success');
      setTimeout(() => setTestPingStatus(null), 3000);
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-space-lg w-full pt-space-xs">
      {/* Breadcrumb & Top Command Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-caption text-caption text-outline">
            <span>OmniFlow</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-primary font-semibold">Developer Settings</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Developer Settings &amp; API Integration
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
            Manage your embeddable client widget credentials, environment configuration, and Perfox API engine connection keys.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center flex-wrap gap-space-xs self-start md:self-auto">
          <a
            className="flex items-center gap-1.5 px-space-sm py-2 rounded-xl bg-surface-container-high text-primary hover:bg-primary-fixed transition-colors font-label-md text-label-md font-medium shadow-sm cursor-pointer"
            href="#docs"
            onClick={(e) => { e.preventDefault(); alert("Opening developer API documentation..."); }}
          >
            <span className="material-symbols-outlined text-base">description</span>
            <span>Documentation</span>
            <span className="material-symbols-outlined text-xs">open_in_new</span>
          </a>
        </div>
      </div>

      {/* Telemetry Strip Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-space-sm">
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center gap-space-sm">
          <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-xl">speed</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">
              Gateway Latency
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">18 ms</span>
            <span className="font-caption text-caption text-secondary flex items-center gap-0.5">
              <span className="material-symbols-outlined text-xs">trending_flat</span> Nominal baseline
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center gap-space-sm">
          <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-xl">verified</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">
              API Uptime (30d)
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">99.98%</span>
            <span className="font-caption text-caption text-secondary">0 degraded hours</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center gap-space-sm">
          <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container">
            <span className="material-symbols-outlined text-xl">insights</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">
              Hourly Calls
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">41,290</span>
            <span className="font-caption text-caption text-outline">Quota: 250k / hr</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center gap-space-sm">
          <div className="w-10 h-10 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-xl">security</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">
              Key Health
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">Secure</span>
            <span className="font-caption text-caption text-outline">Rotated 8 days ago</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: Embedded Web Widget Configuration */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-surface-container-high">
        {/* Section Header */}
        <div className="p-space-lg bg-gradient-to-r from-surface-container-low via-surface-container-lowest to-surface-container-lowest flex flex-col md:flex-row md:items-center justify-between gap-space-xs border-b border-surface-container">
          <div className="flex items-start gap-space-sm">
            <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-xl">widgets</span>
            </div>
            <div className="flex flex-col">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Embedded Web Widget Configuration
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Configure and embed the AI assistant and booking widget onto your customer-facing web storefront or portal.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label-sm text-label-sm bg-secondary-fixed text-on-secondary-fixed self-start md:self-auto font-medium">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            Widget Engine v2.4 Active
          </span>
        </div>

        <div className="p-space-lg grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
          {/* Configuration Fields (Left 7 Cols) */}
          <div className="xl:col-span-7 flex flex-col gap-space-md">
            {/* API Host */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-title-sm text-title-sm text-on-surface flex items-center gap-1">
                  API Host URL
                </label>
                <span className="font-caption text-caption text-secondary flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  200 OK — 18ms latency
                </span>
              </div>
              <div className="flex items-center bg-surface-container-low px-space-sm py-2 rounded-xl text-on-surface shadow-inner">
                <span className="font-body-sm text-body-sm flex-1 select-all">
                  https://widget-api.omniflow.io/v2
                </span>
                <button
                  type="button"
                  onClick={() => alert("Copied API Host URL")}
                  className="flex items-center gap-1 text-primary hover:text-on-primary-fixed-variant px-2 py-1 rounded-lg hover:bg-surface-container transition-all"
                >
                  <span className="material-symbols-outlined text-base">content_copy</span>
                  <span className="font-label-sm text-label-sm">Copy</span>
                </button>
              </div>
            </div>

            {/* Site Key */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-title-sm text-title-sm text-on-surface">Site Key / Public Token</label>
                <span className="font-caption text-caption text-outline">Safe for client-side inclusion</span>
              </div>
              <div className="flex items-center bg-surface-container-low px-space-sm py-2 rounded-xl text-on-surface shadow-inner">
                <span className="font-body-sm text-body-sm flex-1">
                  {showSiteKey ? siteKey : 'pk_live_••••••••••••••••••••••••••••09e5'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowSiteKey(!showSiteKey)}
                    className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container transition-all"
                    title="Toggle visibility"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showSiteKey ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(siteKey, setSiteKeyCopied)}
                    className="flex items-center gap-1 text-primary hover:text-on-primary-fixed-variant px-2 py-1 rounded-lg hover:bg-surface-container transition-all"
                  >
                    <span className="material-symbols-outlined text-base">
                      {siteKeyCopied ? 'check' : 'content_copy'}
                    </span>
                    <span className="font-label-sm text-label-sm">
                      {siteKeyCopied ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Styling options */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-on-surface block mb-1">Accent Theme Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={widgetAccentColor}
                    onChange={(e) => setWidgetAccentColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-surface-container-high cursor-pointer"
                  />
                  <span className="font-mono text-xs">{widgetAccentColor}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface block mb-1">Widget Screen Position</label>
                <select
                  value={widgetPosition}
                  onChange={(e) => setWidgetPosition(e.target.value)}
                  className="h-9 w-full px-2 rounded-lg bg-surface-container-low text-xs border border-surface-container-high"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>
              </div>
            </div>
          </div>

          {/* Embed Code Snippet (Right 5 Cols) */}
          <div className="xl:col-span-5 flex flex-col gap-2 bg-[#0B132B] p-4 rounded-xl text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300">HTML Script Embed Snippet</span>
              <button
                type="button"
                onClick={() => copyToClipboard(embedSnippet, setSnippetCopied)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <span className="material-symbols-outlined text-sm">
                  {snippetCopied ? 'check' : 'content_copy'}
                </span>
                <span>{snippetCopied ? 'Copied Snippet' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="font-mono text-xs text-blue-200 overflow-x-auto p-2 bg-black/30 rounded-lg">
              {embedSnippet}
            </pre>
          </div>
        </div>
      </div>

      {/* SECTION 2: Perfox Backend API Configuration */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-surface-container-high p-space-lg flex flex-col gap-space-md">
        <div className="flex items-center gap-2 pb-2 border-b border-surface-container-low">
          <span className="material-symbols-outlined text-primary text-xl">vpn_key</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Perfox Backend API &amp; Webhooks
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
          {/* Secret API Key */}
          <div className="flex flex-col gap-1.5">
            <label className="font-title-sm text-title-sm text-on-surface">Secret Backend API Key</label>
            <div className="flex items-center bg-surface-container-low px-3 py-2 rounded-xl text-on-surface shadow-inner">
              <span className="font-body-sm text-body-sm flex-1">
                {showSecretKey ? secretKey : 'sk_live_••••••••••••••••••••••••9a'}
              </span>
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-base">
                  {showSecretKey ? 'visibility_off' : 'visibility'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(secretKey, setSecretCopied)}
                className="p-1 rounded-lg text-primary hover:bg-surface-container ml-1"
                title="Copy Key"
              >
                <span className="material-symbols-outlined text-base">
                  {secretCopied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
          </div>

          {/* Webhook Endpoint */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-title-sm text-title-sm text-on-surface">Webhook Endpoint URL</label>
              {testPingStatus === 'success' && (
                <span className="text-xs font-semibold text-secondary flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span> 200 OK Response
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="flex-1 h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleTestPing}
                className="px-3 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">
                  {testPingStatus === 'pinging' ? 'sync' : 'network_ping'}
                </span>
                <span>{testPingStatus === 'pinging' ? 'Pinging...' : 'Test Ping'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
