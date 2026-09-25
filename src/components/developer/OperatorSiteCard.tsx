import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../common';
import { operatorService } from '../../services/operator.service';
import {
  fieldErrorsOf,
  isForbidden,
  isPlatformNotConfigured,
} from '../../services/developer.service';
import { useOperatorStatus } from '../../context/OperatorContext';
import type { PlatformConnection } from '../../types/developer.types';
import { fullTimestamp, relativeLabel } from '../../utils/datetime';

/**
 * The Perfox operator site — the credential a HUMAN operator signs in against
 * to take calls in the browser.
 *
 * Separate from the workspace connection above it, and dependent on it: the
 * server answers 409 until that exists. Four fields, read from Perfox Studio
 * -> Sites, saved by an Admin.
 */

interface OperatorSiteCardProps {
  platform: PlatformConnection | null;
  /** The saved connection comes back whole, so the page replaces its copy. */
  onSaved: (platform: PlatformConnection) => void;
  canEdit: boolean;
}

export default function OperatorSiteCard({
  platform,
  onSaved,
  canEdit,
}: OperatorSiteCardProps): JSX.Element {
  const site = platform?.operatorSite;
  const configured = Boolean(platform?.operatorConfigured);

  /* A signed session proves the whole chain works — saved, signing, SDK
     mounted. Worth showing here, the only place anyone can act on it. */
  const status = useOperatorStatus();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState('');

  /* Three fields, and only three. The API also takes a `workflowId` — a
     DEFAULT COPILOT for calls — but it is deliberately not offered here: the
     copilot is the assistant that whispers to the operator, every call already
     passes the agent from its own conversation, and a call with none works
     fine. One less credential to explain. */
  const [apiHost, setApiHost] = useState('');
  const [siteId, setSiteId] = useState('');
  /* Never prefilled — the secret is write-only and only the mask comes back. */
  const [siteSecret, setSiteSecret] = useState('');

  /* Start from what is stored, so correcting the host does not mean retyping
     everything else. */
  useEffect(() => {
    if (!editing) return;
    setApiHost(site?.apiHost ?? '');
    setSiteId(site?.siteId ?? '');
    setSiteSecret('');
    setError('');
    setFieldErrors({});
  }, [editing, site?.apiHost, site?.siteId]);

  /* A first save must carry the secret; an edit may leave it blank to keep
     the stored one. */
  const secretRequired = !configured;

  const canSubmit = useMemo(
    () => Boolean(apiHost.trim() && siteId.trim() && (!secretRequired || siteSecret.trim())),
    [apiHost, siteId, siteSecret, secretRequired]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || saving) return;

    setSaving(true);
    setError('');
    setFieldErrors({});
    setSaved('');

    try {
      const updated = await operatorService.saveSite({
        apiHost,
        siteId,
        /* Sent only when typed. Empty means keep the stored secret — and the
           masked hint must never go back, or the real secret is replaced with
           asterisks. */
        ...(siteSecret.trim() ? { siteSecret } : {}),
        /* `workflowId` is deliberately not sent. The server treats an absent
           one as empty, so saving from this card clears any default copilot —
           which is the intended state: calls carry their own agent. */
      });

      onSaved(updated);
      setEditing(false);
      setSaved('Operator site saved.');
      /* Any existing signature was minted from the old site, or refused
         because there was none — either way it is stale now. */
      status.retry();
    } catch (err: any) {
      const fields = fieldErrorsOf(err);
      if (Object.keys(fields).length > 0) setFieldErrors(fields);

      if (isPlatformNotConfigured(err)) {
        /* Not a failure — an order of operations. */
        setError(err?.message || 'Configure the Perfox workspace connection first.');
      } else if (isForbidden(err)) {
        setError('Only an Admin can configure the operator site.');
      } else {
        /* The server names which rule the host broke. Echo it: both mistakes
           otherwise surface in the browser as an unexplained CORS error. */
        setError(err?.message || 'Could not save the operator site.');
      }
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (name: string) =>
    `w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:bg-surface-container transition-colors ${
      fieldErrors[name] ? 'ring-1 ring-error' : ''
    }`;

  return (
    <section className="rounded-2xl bg-surface-container-lowest border border-surface-container p-space-md">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="font-title-md text-title-md font-semibold text-on-surface">
            Operator calling
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            The Perfox Site a person signs in against to take calls in the browser. Read
            these from Perfox Studio &rarr; Sites.
          </p>
        </div>
        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-pill shrink-0 ${
            configured
              ? 'bg-emerald-500/15 text-emerald-700'
              : 'bg-surface-container text-on-surface-variant'
          }`}
        >
          {configured ? 'Configured' : 'Not configured'}
        </span>
      </div>

      {/* Saved is not the same as working: the signature still has to mint. */}
      {configured && !status.ready && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 font-body-sm text-body-sm text-amber-900">
          Saved, but calling is not available in this browser:{' '}
          {status.blockMessage || 'the call service could not be reached'}.
        </div>
      )}

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-error/10 font-body-sm text-body-sm text-error">
          {error}
        </div>
      )}

      {saved && !editing && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 font-body-sm text-body-sm text-emerald-800">
          {saved}
        </div>
      )}

      {!editing ? (
        <div className="space-y-3">
          {configured ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5 min-w-0">
                <dt className="font-label-sm text-[11px] text-on-surface-variant">API host</dt>
                <dd className="font-mono text-xs text-on-surface truncate" title={site?.apiHost}>
                  {site?.apiHost || '—'}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <dt className="font-label-sm text-[11px] text-on-surface-variant">Site ID</dt>
                <dd className="font-mono text-xs text-on-surface truncate">{site?.siteId || '—'}</dd>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <dt className="font-label-sm text-[11px] text-on-surface-variant">Site secret</dt>
                <dd className="font-mono text-xs text-on-surface">{site?.siteSecretMasked || '—'}</dd>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <dt className="font-label-sm text-[11px] text-on-surface-variant">Configured</dt>
                <dd
                  className="font-body-sm text-body-sm text-on-surface"
                  title={fullTimestamp(site?.configuredAt ?? '')}
                >
                  {site?.configuredAt ? relativeLabel(site.configuredAt) : 'Never'}
                  {site?.configuredBy ? ` by ${site.configuredBy}` : ''}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              No operator site yet. Until one is saved, the Call button on a conversation
              stays disabled and says so.
            </p>
          )}

          <Button
            variant="soft"
            size="sm"
            startIcon={configured ? 'edit' : 'add'}
            disabled={!canEdit}
            onClick={() => setEditing(true)}
            title={canEdit ? undefined : 'Only an Admin can configure the operator site'}
          >
            {configured ? 'Edit site' : 'Add operator site'}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="font-label-sm text-[11px] text-on-surface-variant block mb-1">
              API host
            </label>
            <input
              type="text"
              value={apiHost}
              onChange={(e) => setApiHost(e.target.value)}
              placeholder="https://acme-api.perfox.ai"
              className={fieldClass('apiHost')}
            />
            <p className="mt-1 font-body-sm text-[11px] text-on-surface-variant">
              {fieldErrors.apiHost ||
                'The -api host, not the Studio host, and with no /api/v1 path. The Studio host answers without CORS headers, which shows up as an unexplained CORS error.'}
            </p>
          </div>

          <div>
            <label className="font-label-sm text-[11px] text-on-surface-variant block mb-1">
              Site ID
            </label>
            <input
              type="text"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              placeholder="sa_site_live_…"
              className={fieldClass('siteId')}
            />
            {fieldErrors.siteId && (
              <p className="mt-1 font-body-sm text-[11px] text-error">{fieldErrors.siteId}</p>
            )}
          </div>

          <div>
            <label className="font-label-sm text-[11px] text-on-surface-variant block mb-1">
              Site secret {secretRequired ? '' : '(leave blank to keep the stored one)'}
            </label>
            <input
              type="password"
              value={siteSecret}
              onChange={(e) => setSiteSecret(e.target.value)}
              placeholder={site?.siteSecretMasked || 'sa_secret_live_…'}
              autoComplete="new-password"
              className={fieldClass('siteSecret')}
            />
            <p className="mt-1 font-body-sm text-[11px] text-on-surface-variant">
              {fieldErrors.siteSecret ||
                'Write-only — it is never read back, so the field starts empty every time.'}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button variant="primary" size="sm" type="submit" loading={saving} disabled={!canSubmit}>
              Save site
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
