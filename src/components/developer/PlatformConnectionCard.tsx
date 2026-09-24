import React, { useState } from 'react';
import { developerApi, ApiError } from '../../api';
import type { PlatformConnectionState, PlatformVerification } from '../../api';
import { Button, ErrorBanner } from '../common';

interface PlatformConnectionCardProps {
  connection: PlatformConnectionState | null;
  /* Called after a successful save, test or disconnect so the page can re-read
     the connection and, once it exists, load agents and endpoints. */
  onChanged: () => void;
}

const STATUS_STYLES: Record<string, { chip: string; dot: string; label: string }> = {
  Connected: {
    chip: 'bg-emerald-500/15 text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Connected',
  },
  Unverified: {
    chip: 'bg-amber-500/15 text-amber-700',
    dot: 'bg-amber-500',
    label: 'Not yet verified',
  },
  Error: {
    chip: 'bg-red-500/15 text-red-700',
    dot: 'bg-red-500',
    label: 'Connection failed',
  },
};

const formatTimestamp = (iso?: string): string => {
  if (!iso) return 'never';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'never' : date.toLocaleString();
};

/**
 * The gate on the Developer Hub: the Perfox API URL and token must be configured
 * before agents or webhook endpoints are shown, because both only mean anything
 * against a real workspace.
 */
export default function PlatformConnectionCard({
  connection,
  onChanged,
}: PlatformConnectionCardProps) {
  const configured = Boolean(connection?.configured);

  const [isEditing, setIsEditing] = useState(false);
  const [apiUrl, setApiUrl] = useState(connection?.apiUrl ?? '');
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [formError, setFormError] = useState('');
  const [verification, setVerification] = useState<PlatformVerification | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const showForm = !configured || isEditing;
  const busy = isSaving || isTesting || isDisconnecting;

  const openEditor = () => {
    setApiUrl(connection?.apiUrl ?? '');
    /* Never prefilled — the server only ever returns a masked hint, and sending
       the mask back would overwrite the real token with asterisks. */
    setApiToken('');
    setFormError('');
    setVerification(null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setVerification(null);

    const trimmedUrl = apiUrl.trim();
    if (!trimmedUrl) {
      setFormError('Enter your Perfox API base URL.');
      return;
    }
    if (!configured && !apiToken.trim()) {
      setFormError('Enter your Perfox API token.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await developerApi.savePlatform({
        apiUrl: trimmedUrl,
        /* Blank on an edit means "keep the token already saved", so the URL can
           be corrected without re-typing the secret. */
        ...(apiToken.trim() ? { apiToken: apiToken.trim() } : {}),
      });
      setVerification(result.verification);
      setApiToken('');
      /* Stay on the form when Perfox rejected it, so the message sits next to
         the fields that need correcting. */
      if (result.verification?.ok) setIsEditing(false);
      onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save the connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setFormError('');
    setIsTesting(true);
    try {
      setVerification(await developerApi.testPlatform());
      onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not reach Perfox.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setFormError('');
    setIsDisconnecting(true);
    try {
      const result = await developerApi.disconnectPlatform();
      setConfirmDisconnect(false);
      setVerification(null);
      if (result.fellBackToEnvironment) {
        setFormError(
          'Disconnected, but this deployment still supplies PERFOX_API_URL and PERFOX_API_TOKEN from its environment, so the hub stays connected.'
        );
      }
      onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not disconnect.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  /* ------------------------------------------------------------------ form */
  if (showForm) {
    return (
      <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container overflow-hidden">
        <div className="px-space-md py-space-sm border-b border-surface-container bg-surface-container-low/50 flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">hub</span>
          </div>
          <div className="flex flex-col">
            <h2 className="font-title text-title text-on-surface font-bold">
              {configured ? 'Edit the Perfox platform connection' : 'Connect your Perfox workspace'}
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              AI agents and webhook endpoints are configured against your Perfox workspace, so this
              comes first.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-space-md flex flex-col gap-space-md">
          {formError && <ErrorBanner message={formError} />}

          {verification && !verification.ok && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700">
              <span className="material-symbols-outlined text-lg shrink-0">error</span>
              <div className="flex flex-col gap-0.5">
                <span className="font-body-sm text-body-sm font-semibold">
                  Saved, but Perfox could not be reached
                </span>
                <span className="font-caption text-caption">{verification.message}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="perfox-api-url" className="text-xs font-semibold text-on-surface-variant">
              Perfox API URL
            </label>
            <input
              id="perfox-api-url"
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://your-workspace-api.perfox.ai/api/v1"
              autoComplete="off"
              className="w-full h-10 px-3 font-mono text-xs rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high placeholder:text-outline/60 focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
            />
            <span className="font-caption text-caption text-on-surface-variant">
              The base URL of your workspace, including <code>/api/v1</code>.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="perfox-api-token" className="text-xs font-semibold text-on-surface-variant">
              Perfox API token
            </label>
            <div className="relative">
              <input
                id="perfox-api-token"
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={
                  configured
                    ? `Leave blank to keep ${connection?.apiTokenMasked || 'the saved token'}`
                    : 'sk_…'
                }
                autoComplete="off"
                className="w-full h-10 pl-3 pr-11 font-mono text-xs rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high placeholder:text-outline/60 focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? 'Hide the token' : 'Show the token'}
                className="absolute right-1 top-1 h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-lg">
                  {showToken ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <span className="font-caption text-caption text-on-surface-variant">
              Stored on the server and never sent back to the browser — the hub only ever shows a
              masked hint.
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-space-xs pt-1">
            <Button type="submit" variant="primary" size="md" startIcon="link" loading={isSaving}>
              {isSaving ? 'Verifying…' : 'Save & verify'}
            </Button>
            {configured && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={busy}
                onClick={() => {
                  setIsEditing(false);
                  setFormError('');
                  setVerification(null);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </section>
    );
  }

  /* ------------------------------------------------------- connected strip */
  const status = STATUS_STYLES[connection?.status ?? 'Unverified'] ?? STATUS_STYLES.Unverified;

  return (
    <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container p-space-md flex flex-col gap-space-sm">
      {formError && <ErrorBanner message={formError} />}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm min-w-0">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">hub</span>
          </div>
          <div className="flex flex-col min-w-0 gap-0.5">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-title text-title text-on-surface font-bold truncate">
                {connection?.workspace || 'Perfox workspace'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold flex items-center gap-1 ${status.chip}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              {connection?.source === 'env' && (
                <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-surface-container text-on-surface-variant">
                  from environment
                </span>
              )}
            </div>
            <span className="font-mono text-[11px] text-on-surface-variant truncate">
              {connection?.apiUrl} · token {connection?.apiTokenMasked || '••••'}
            </span>
            <span className="font-caption text-caption text-on-surface-variant">
              Last verified {formatTimestamp(connection?.lastVerifiedAt)}
              {connection?.connectedBy ? ` by ${connection.connectedBy}` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-space-xs shrink-0">
          <Button
            variant="outline"
            size="sm"
            startIcon="network_ping"
            loading={isTesting}
            disabled={busy}
            onClick={handleTest}
          >
            Test
          </Button>
          <Button variant="outline" size="sm" startIcon="edit" disabled={busy} onClick={openEditor}>
            Edit
          </Button>
          {connection?.source === 'stored' && (
            <Button
              variant="ghost"
              size="sm"
              startIcon="link_off"
              disabled={busy}
              onClick={() => setConfirmDisconnect(true)}
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {/* The last thing Perfox actually said, success or failure. */}
      {(verification || connection?.lastError) && (
        <div
          className={`flex items-start gap-2 p-3 rounded-xl border ${
            verification?.ok
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
              : 'bg-red-500/10 border-red-500/20 text-red-700'
          }`}
        >
          <span className="material-symbols-outlined text-lg shrink-0">
            {verification?.ok ? 'check_circle' : 'error'}
          </span>
          <span className="font-caption text-caption">
            {verification?.ok
              ? `Perfox answered in ${verification.latencyMs} ms.`
              : verification?.message || connection?.lastError}
          </span>
        </div>
      )}

      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container max-w-md w-full p-space-md flex flex-col gap-space-sm">
            <h3 className="font-title text-title text-on-surface font-bold">
              Disconnect the Perfox platform?
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              The saved API token is deleted and the Developer Hub hides AI agents and webhook
              endpoints until a connection is configured again. The agents and endpoints themselves
              are not deleted.
            </p>
            <div className="flex items-center justify-end gap-space-xs pt-1">
              <Button
                variant="ghost"
                size="md"
                disabled={isDisconnecting}
                onClick={() => setConfirmDisconnect(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                startIcon="link_off"
                loading={isDisconnecting}
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
