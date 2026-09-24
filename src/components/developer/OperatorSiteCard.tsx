import React, { useEffect, useState } from 'react';
import { developerApi, PlatformConnectionState } from '../../api';
import { Button, ErrorBanner, Icon } from '../common';

/**
 * The Perfox **Site** a human operator signs in against.
 *
 * Separate from the workspace connection above it: that one is how this service
 * talks to Perfox, this one is how a person in the browser takes and places
 * calls. Until it is stored, the Call button on a conversation cannot work —
 * there is nobody to sign.
 *
 * The site secret is write-only here. It is stored `select: false`, stripped
 * from every response and only ever shown masked, because anyone holding it can
 * sign as any operator on the site.
 */

interface OperatorSiteCardProps {
  connection: PlatformConnectionState | null;
  /** Re-read the connection after a save. */
  onChanged: () => void;
}

export default function OperatorSiteCard({ connection, onChanged }: OperatorSiteCardProps) {
  const site = connection?.operatorSite;
  const configured = Boolean(connection?.operatorConfigured);

  const [apiHost, setApiHost] = useState('');
  const [siteId, setSiteId] = useState('');
  const [siteSecret, setSiteSecret] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  /* Re-seeded whenever the stored site changes, so the fields show what is
     actually saved rather than a stale draft. */
  useEffect(() => {
    setApiHost(site?.apiHost ?? '');
    setSiteId(site?.siteId ?? '');
    setWorkflowId(site?.workflowId ?? '');
    setSiteSecret('');
  }, [site?.apiHost, site?.siteId, site?.workflowId]);

  const handleSave = async () => {
    setError('');
    setSaved('');
    setIsSaving(true);
    try {
      await developerApi.saveOperatorSite({
        apiHost: apiHost.trim(),
        siteId: siteId.trim(),
        /* Omitted rather than sent empty: the server reads that as "keep the
           stored secret", so the host can be corrected without retyping it. */
        ...(siteSecret.trim() ? { siteSecret: siteSecret.trim() } : {}),
        workflowId: workflowId.trim(),
      });
      setSiteSecret('');
      setSaved('Operator site saved.');
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Could not save the operator site.');
    } finally {
      setIsSaving(false);
    }
  };

  /* A first save must carry a secret; later ones may leave it blank. */
  const canSave =
    Boolean(apiHost.trim() && siteId.trim() && (configured || siteSecret.trim())) && !isSaving;

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container overflow-hidden">
      <div className="p-space-md border-b border-surface-container flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="font-title-lg text-title-lg text-on-surface font-bold">Operator site</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-2xl">
            The Perfox Site a person signs in against to take and place calls in the browser. Read
            these from Perfox Studio → Sites. Until this is set, the Call button on a conversation
            stays disabled.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill font-caption text-caption font-semibold shrink-0 ${
            configured ? 'bg-emerald-500/15 text-emerald-700' : 'bg-surface-container text-on-surface-variant'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-pill ${configured ? 'bg-emerald-500' : 'bg-outline'}`} />
          {configured ? 'Configured' : 'Not configured'}
        </span>
      </div>

      <div className="p-space-md flex flex-col gap-space-md">
        {error && <ErrorBanner message={error} />}

        {saved && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
            <Icon name="check_circle" size="sm" color="primary" />
            <span className="font-caption text-caption text-on-surface">{saved}</span>
          </div>
        )}

        {!connection?.configured && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container">
            <Icon name="info" size="sm" color="outline" />
            <span className="font-caption text-caption text-on-surface-variant">
              Configure the workspace connection above first — the operator site belongs to the
              same tenant.
            </span>
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="font-label-md text-label-md text-on-surface font-semibold">API host</span>
          <input
            value={apiHost}
            onChange={(e) => setApiHost(e.target.value)}
            disabled={isSaving}
            placeholder="https://acme-api.perfox.ai"
            className="h-10 px-3 rounded-xl bg-surface-container-low text-body-sm font-body-sm text-on-surface border border-surface-container focus:outline-none focus:border-primary"
          />
          <span className="font-caption text-caption text-outline">
            The <strong>-api</strong> host, with no <code>/api/v1</code> suffix. The Studio host
            answers 405 and the browser reports it as a CORS error.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-label-md text-label-md text-on-surface font-semibold">Site ID</span>
          <input
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            disabled={isSaving}
            placeholder="sa_site_live_…"
            className="h-10 px-3 rounded-xl bg-surface-container-low text-body-sm font-body-sm text-on-surface border border-surface-container focus:outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-label-md text-label-md text-on-surface font-semibold">
            Site secret
          </span>
          <input
            type="password"
            value={siteSecret}
            onChange={(e) => setSiteSecret(e.target.value)}
            disabled={isSaving}
            autoComplete="new-password"
            placeholder={configured ? `${site?.siteSecretMasked} — leave blank to keep` : 'sa_secret_live_…'}
            className="h-10 px-3 rounded-xl bg-surface-container-low text-body-sm font-body-sm text-on-surface border border-surface-container focus:outline-none focus:border-primary"
          />
          <span className="font-caption text-caption text-outline">
            Stored server-side and never sent to a browser. Anyone holding it can sign as any
            operator, so rotate it in Studio if it has been shared.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-label-md text-label-md text-on-surface font-semibold">
            Workflow ID <span className="text-outline font-normal">(optional)</span>
          </span>
          <input
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            disabled={isSaving}
            placeholder="01a0cd11-0ed2-…"
            className="h-10 px-3 rounded-xl bg-surface-container-low text-body-sm font-body-sm text-on-surface border border-surface-container focus:outline-none focus:border-primary"
          />
        </label>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="font-caption text-caption text-outline">
            {configured && site?.configuredAt
              ? `Last saved ${new Date(site.configuredAt).toLocaleString()}${
                  site.configuredBy ? ` by ${site.configuredBy}` : ''
                }`
              : 'Not saved yet'}
          </span>
          <Button
            variant="primary"
            size="md"
            startIcon="save"
            onClick={handleSave}
            disabled={!canSave}
          >
            {isSaving ? 'Saving…' : 'Save operator site'}
          </Button>
        </div>
      </div>
    </div>
  );
}
