import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/common';
import OperatorSiteCard from '../components/developer/OperatorSiteCard';
import { useAuth } from '../hooks/useAuth';
import {
  developerService,
  fieldErrorsOf,
  isForbidden,
  isPlatformNotConfigured,
  isUpstreamFailure
} from '../services/developer.service';
import { DeveloperAgent, PlatformConnection } from '../types/developer.types';
import { fullTimestamp, relativeLabel } from '../utils/datetime';

/* The Developer Hub is two screens, not one.

   Until a Perfox workspace is connected there is nothing to show and nothing
   worth asking the server for, so the page is the configure form and only that.
   Agents are fetched once the connection exists.

   Agents themselves are a read-only mirror of the workspace: no site key, no
   secret key, no widget styling and no endpoint bindings, because the backend
   stores none of those. The one write is publish/pause, forwarded to Perfox. */

const agentStatusClass = (status: string): string => {
  if (status === 'published') return 'bg-emerald-500/15 text-emerald-700';
  if (status === 'paused') return 'bg-amber-500/15 text-amber-700';
  return 'bg-surface-container text-on-surface-variant';
};

const platformStatusClass = (status: string): string => {
  if (status === 'Connected') return 'bg-emerald-500/15 text-emerald-700';
  if (status === 'Error') return 'bg-error/15 text-error';
  return 'bg-amber-500/15 text-amber-700';
};

/**
 * Sorts a failure into the one bucket it belongs in.
 *
 * A 502/504 means Perfox refused or timed out: retrying changes nothing and the
 * form was never at fault, so it gets its own banner rather than sitting in a
 * red box beside the fields. A 400 carries per-field reasons, which belong on
 * the inputs — "Validation failed" on its own tells nobody anything.
 */
const classify = (error: unknown, fallback: string) => ({
  upstream: isUpstreamFailure(error),
  fields: fieldErrorsOf(error),
  message: (error as Error)?.message || fallback
});

/** Red ring plus the reason under any input the server rejected. */
const fieldClass = (fieldErrors: Record<string, string>, field: string): string =>
  fieldErrors[field] ? 'border-error ring-1 ring-error/40' : 'border-surface-container-high';

const FieldError = ({ error }: { error?: string }) =>
  error ? <span className="text-[11px] text-error">{error}</span> : null;

/* Outcomes are reported in a dialog rather than a banner above the connection
   details: a strip that appears and shifts the page is easy to miss and easy to
   leave stale, and it put a failed agent toggle nowhere near the agent. A
   dialog interrupts once, says what happened, and is dismissed deliberately. */
type DialogTone = 'success' | 'error' | 'warning';

interface DialogState {
  tone: DialogTone;
  title: string;
  message: string;
  /* Second line for context the message itself should not carry. */
  detail?: string;
  /* Present only on a confirmation; its absence makes this a plain alert. */
  confirmLabel?: string;
  onConfirm?: () => void;
  danger?: boolean;
}

const toneStyle: Record<DialogTone, { icon: string; className: string }> = {
  success: { icon: 'check_circle', className: 'bg-emerald-500/10 text-emerald-700' },
  error: { icon: 'error', className: 'bg-error/10 text-error' },
  warning: { icon: 'cloud_off', className: 'bg-amber-500/10 text-amber-700' }
};

const Dialog = ({
  state,
  busy,
  onClose
}: {
  state: DialogState;
  busy?: boolean;
  onClose: () => void;
}) => {
  const tone = toneStyle[state.tone];
  const isConfirm = Boolean(state.confirmLabel && state.onConfirm);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => !busy && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={state.title}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md border border-surface-container-high overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div className="p-5 flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone.className}`}
          >
            <span className="material-symbols-outlined text-xl">{tone.icon}</span>
          </div>
          <div className="flex flex-col gap-1 min-w-0 pt-0.5">
            <h3 className="font-title-md text-title-md font-bold text-on-surface">{state.title}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant break-words">
              {state.message}
            </p>
            {state.detail && (
              <p className="font-body-sm text-[11px] text-outline break-words">{state.detail}</p>
            )}
          </div>
        </div>

        <div className="px-5 py-3.5 bg-surface-container-low/60 border-t border-surface-container flex items-center justify-end gap-2">
          <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>
            {isConfirm ? 'Cancel' : 'Close'}
          </Button>
          {isConfirm && (
            <Button
              variant={state.danger ? 'danger' : 'primary'}
              size="md"
              loading={busy}
              disabled={busy}
              onClick={state.onConfirm}
            >
              {state.confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function DeveloperPage() {
  const { user } = useAuth();

  /* ── Platform connection ────────────────────────────────────────────────── */
  const [platform, setPlatform] = useState<PlatformConnection | null>(null);
  const [platformLoading, setPlatformLoading] = useState(true);
  const [platformFieldErrors, setPlatformFieldErrors] = useState<Record<string, string>>({});
  /* Every outcome that is not attached to a specific input goes here. One
     dialog at a time, so a success can never sit under a stale failure. */
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [apiUrlInput, setApiUrlInput] = useState('');
  const [apiTokenInput, setApiTokenInput] = useState('');
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [testingPlatform, setTestingPlatform] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  /* Which of the two screens the page is on.
     Credentials that exist but have never verified are not a connection — an
     environment-provided pair arrives as `Unverified` and may be wrong, so it
     does not skip the configure screen. Once established it stays established
     for the session: a failed Test reports the failure where it happened
     instead of throwing the page back to a form and demanding the token
     again. */
  const [connectionEstablished, setConnectionEstablished] = useState(false);

  /* ── Agents ─────────────────────────────────────────────────────────────── */
  const [agents, setAgents] = useState<DeveloperAgent[]>([]);
  const [agentSource, setAgentSource] = useState<'cache' | 'perfox'>('cache');
  const [syncedAt, setSyncedAt] = useState('');
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [togglingAgentId, setTogglingAgentId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  /* The whole module is Admin-only; a 403 means there is nothing to show. */
  const [forbidden, setForbidden] = useState(false);

  /* A failure Perfox caused is worth naming as such — the user's input was not
     at fault and retrying the same call will not help. */
  const reportFailure = useCallback((error: unknown, fallback: string) => {
    const failure = classify(error, fallback);
    setDialog(
      failure.upstream
        ? {
            tone: 'warning',
            title: 'Perfox did not answer',
            message: failure.message,
            detail: 'The platform is unreachable or rejected the token. Anything on the page is the last state it reported.'
          }
        : { tone: 'error', title: fallback, message: failure.message }
    );
    return failure;
  }, []);

  /* ── Loading ────────────────────────────────────────────────────────────── */

  const loadAgents = useCallback(
    async (refresh = false) => {
      setAgentsLoading(true);
      try {
        const result = await developerService.getAgents(refresh);
        setAgents(result.agents || []);
        setAgentSource(result.source);
        setSyncedAt(result.syncedAt || '');
      } catch (error) {
        if (isForbidden(error)) {
          setForbidden(true);
        } else if (isPlatformNotConfigured(error)) {
          /* Not a failure — the server says the connection went away underneath
             us, so go back to the configure screen rather than complaining
             about agents that were never fetchable. */
          setConnectionEstablished(false);
          setAgents([]);
        } else {
          /* A refresh that fails leaves the cached rows on screen — they are
             still the last thing Perfox actually said. */
          reportFailure(error, 'Could not load the agents');
        }
      } finally {
        setAgentsLoading(false);
      }
    },
    [reportFailure]
  );

  useEffect(() => {
    let cancelled = false;

    /* Mirror the server's role check rather than calling and catching the 403 —
       a control that is going to be refused should never be offered. The 403
       branch below still stands: the token is the authority, not this claim. */
    if (user && user.role !== 'Admin') {
      setForbidden(true);
      setPlatformLoading(false);
      return;
    }

    (async () => {
      setPlatformLoading(true);
      try {
        const connection = await developerService.getPlatform();
        if (cancelled) return;
        setPlatform(connection);
        /* The configure form starts empty, so nothing is copied into the
           inputs — the credentials are typed in, not confirmed from a prefill. */
        const established = connection.configured && connection.status === 'Connected';
        setConnectionEstablished(established);
        /* Agents are asked for only once there is a verified workspace. */
        if (established) await loadAgents(false);
      } catch (error) {
        if (cancelled) return;
        if (isForbidden(error)) setForbidden(true);
        else reportFailure(error, 'Could not read the platform connection');
      } finally {
        if (!cancelled) setPlatformLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadAgents, user]);

  /* ── Platform actions ───────────────────────────────────────────────────── */

  const handleSavePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiUrlInput.trim()) return;

    setSavingPlatform(true);
    setPlatformFieldErrors({});
    setDialog(null);
    try {
      const result = await developerService.savePlatform({
        apiUrl: apiUrlInput.trim(),
        apiToken: apiTokenInput.trim()
      });
      setPlatform(result);
      /* The token is never held in the browser longer than the request. */
      setApiTokenInput('');

      if (result.verification?.ok) {
        setConnectionEstablished(true);
        setApiUrlInput('');
        setDialog({
          tone: 'success',
          title: 'Workspace connected',
          message: `Connected to ${result.workspace} in ${result.verification.latencyMs} ms.`
        });
        await loadAgents(true);
      } else {
        /* Saved anyway — say what Perfox answered rather than losing the input,
           and stay on the configure screen so it can be corrected. */
        setDialog({
          tone: 'error',
          title: 'Perfox rejected these credentials',
          message: result.verification?.message || 'Perfox could not be reached.',
          detail: 'They have been saved, so you can correct just the part that is wrong.'
        });
      }
    } catch (error) {
      const failure = classify(error, 'Could not save the platform connection');
      setPlatformFieldErrors(failure.fields);
      /* With the reasons already sitting on the fields, a dialog repeating them
         would just be something else to dismiss. */
      if (Object.keys(failure.fields).length === 0) {
        reportFailure(error, 'Could not save the platform connection');
      }
    } finally {
      setSavingPlatform(false);
    }
  };

  const handleTestPlatform = async () => {
    setTestingPlatform(true);
    setDialog(null);
    try {
      const result = await developerService.testPlatform();
      if (result.ok) {
        setPlatform((prev) =>
          prev
            ? { ...prev, status: 'Connected', lastError: '', lastVerifiedAt: new Date().toISOString() }
            : prev
        );
        setDialog({
          tone: 'success',
          title: 'Connection is live',
          message: `Perfox answered in ${result.latencyMs} ms.`
        });
      } else {
        setPlatform((prev) => (prev ? { ...prev, status: 'Error', lastError: result.message } : prev));
        setDialog({
          tone: 'warning',
          title: 'Perfox did not answer',
          message: result.message,
          detail: 'The stored credentials are unchanged — disconnect to enter different ones.'
        });
      }
    } catch (error) {
      reportFailure(error, 'Could not test the platform connection');
    } finally {
      setTestingPlatform(false);
    }
  };

  /* Disconnecting hides every agent until a workspace is connected again, so it
     asks first — in the page's own dialog, not a browser confirm box. */
  const askToDisconnect = () =>
    setDialog({
      tone: 'warning',
      title: 'Disconnect this workspace?',
      message: `The stored credentials for ${platform?.workspace || 'this workspace'} will be removed and the agents hidden until a workspace is connected again.`,
      detail: 'Nothing in Perfox itself is changed — no agent is paused, deleted or republished.',
      confirmLabel: 'Disconnect',
      danger: true,
      onConfirm: () => void handleDisconnect()
    });

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await developerService.disconnectPlatform();
      setPlatform(result.connection);
      setApiUrlInput('');
      setApiTokenInput('');
      setAgents([]);
      /* Even an environment fallback is unverified, so either way this returns
         to the configure screen rather than quietly using credentials the user
         has just said they do not want. */
      setConnectionEstablished(false);
      setDialog({
        tone: 'success',
        title: 'Workspace disconnected',
        message: result.fellBackToEnvironment
          ? 'The server environment still provides credentials, but they have not been verified.'
          : 'Enter credentials to connect a workspace again.'
      });
    } catch (error) {
      reportFailure(error, 'Could not disconnect the platform');
    } finally {
      setDisconnecting(false);
    }
  };

  /* ── Agent actions ──────────────────────────────────────────────────────── */

  const handleToggleAgent = async (agent: DeveloperAgent) => {
    if (agent.status === 'draft') return;
    const next = agent.status === 'published' ? 'paused' : 'published';

    setTogglingAgentId(agent.id);
    try {
      const updated = await developerService.setAgentStatus(agent.id, next);
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, ...updated } : a)));
    } catch (error) {
      /* Name the agent: a bare "could not change the status" beside the platform
         details gave no clue which of a dozen switches failed. */
      reportFailure(error, `Could not ${next === 'published' ? 'publish' : 'pause'} ${agent.name}`);
    } finally {
      setTogglingAgentId(null);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
  };

  const publishedCount = agents.filter((a) => a.status === 'published').length;
  const pausedCount = agents.filter((a) => a.status === 'paused').length;
  const draftCount = agents.filter((a) => a.status === 'draft').length;

  /* ── Whole-page states ──────────────────────────────────────────────────── */

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <span className="material-symbols-outlined text-5xl text-outline">lock</span>
        <h1 className="font-title-lg text-title-lg font-bold text-on-surface">
          The Developer Hub is Admin-only
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
          It exposes platform credentials and lets a user register URLs the server will call, so it
          is restricted to Admins. Your account is {user?.role || 'not an Admin'}.
        </p>
      </div>
    );
  }

  if (platformLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-on-surface-variant">
        <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
        <span className="font-body-sm text-body-sm">Loading the Developer Hub…</span>
      </div>
    );
  }

  /* ── Configure screen: everything else waits on this ─────────────────────── */
  if (!connectionEstablished) {
    return (
      /* Full page width, like every other screen in the hub. The form keeps its
         own readable measure inside the card; the column beside it carries the
         context, so the page does not read as one small box adrift in
         whitespace. */
      <div className="flex flex-col gap-space-lg w-full pt-space-xs pb-10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-caption text-caption text-outline">
            <span>OmniFlow</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-primary font-semibold">Developer Hub</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Connect your Perfox workspace
            </h1>
            {platform?.configured && (
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${platformStatusClass(platform.status)}`}
              >
                {platform.status}
              </span>
            )}
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
            The agents on this page mirror a Perfox workspace, so there is nothing to show until the
            platform credentials are in place.
          </p>
        </div>

        {/* Credentials that were saved and then rejected: the reason is the
            whole point of landing back on this screen, so it leads. */}
        {platform?.configured && platform.lastError && (
          <div className="flex items-start gap-3 rounded-2xl border border-error/30 bg-error/5 p-4">
            <span className="material-symbols-outlined text-xl text-error">error</span>
            <div className="flex flex-col gap-0.5">
              <span className="font-title-sm text-title-sm font-bold text-on-surface">
                Perfox rejected the saved credentials
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {platform.lastError}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-space-md items-start">
          <div className="lg:col-span-3 bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container overflow-hidden">
            <div className="p-5 bg-surface-container-low/60 border-b border-surface-container flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-xl">hub</span>
              </div>
              <div>
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                  Platform Credentials
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Stored on the server — the token never comes back to the browser.
                </p>
              </div>
            </div>

            <div className="p-5">
              <form onSubmit={handleSavePlatform} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    API Base URL *
                  </label>
                  <input
                    type="url"
                    required
                    autoFocus
                    value={apiUrlInput}
                    onChange={(e) => setApiUrlInput(e.target.value)}
                    placeholder="https://your-workspace-api.perfox.ai/api/v1"
                    className={`h-11 px-3 font-mono text-xs rounded-xl bg-surface-container-low text-on-surface border focus:outline-none focus:ring-1 focus:ring-primary shadow-inner ${fieldClass(platformFieldErrors, 'apiUrl')}`}
                  />
                  <FieldError error={platformFieldErrors.apiUrl} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    API Token *
                  </label>
                  <input
                    type="password"
                    required
                    value={apiTokenInput}
                    onChange={(e) => setApiTokenInput(e.target.value)}
                    placeholder="sk_…"
                    className={`h-11 px-3 font-mono text-xs rounded-xl bg-surface-container-low text-on-surface border focus:outline-none focus:ring-1 focus:ring-primary shadow-inner ${fieldClass(platformFieldErrors, 'apiToken')}`}
                  />
                  <FieldError error={platformFieldErrors.apiToken} />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-surface-container">
                  <p className="text-[11px] text-on-surface-variant sm:max-w-sm">
                    Rejected credentials are still saved, with the reason shown above, so nothing
                    you typed is lost.
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    type="submit"
                    startIcon="link"
                    loading={savingPlatform}
                    disabled={savingPlatform || !apiUrlInput.trim() || !apiTokenInput.trim()}
                  >
                    Connect Workspace
                  </Button>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-space-sm">
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container p-5 flex flex-col gap-4">
              <h3 className="font-title-sm text-title-sm text-on-surface font-bold">
                What happens when you connect
              </h3>
              <ol className="flex flex-col gap-3">
                {[
                  {
                    title: 'The pair is stored server-side',
                    body: 'The token is written to the backend and never returned to the browser — after this it only ever appears masked.'
                  },
                  {
                    title: 'Perfox verifies it',
                    body: `The credentials are checked with a live call to ${platform?.verifyPath || '/kb/folders'}.`
                  },
                  {
                    title: 'The workspace agents appear',
                    body: 'Agents are a read-only mirror of the workspace; activate and pausing is forwarded to Perfox.'
                  }
                ].map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3">
                    <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-primary/10 text-primary font-caption text-caption font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-body-sm text-body-sm text-on-surface font-semibold">
                        {step.title}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">{step.body}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-surface-container bg-surface-container-low/60 p-5 flex items-start gap-3">
              <span className="material-symbols-outlined text-xl text-outline">key</span>
              <div className="flex flex-col gap-0.5">
                <span className="font-body-sm text-body-sm text-on-surface font-semibold">
                  Changing the credentials later
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  There is no in-place edit: you disconnect the workspace and enter a new pair, so a
                  half-changed pair can never sit in front of a workspace it does not open.
                </span>
              </div>
            </div>
          </div>
        </div>

        {dialog && <Dialog state={dialog} busy={disconnecting} onClose={() => setDialog(null)} />}
      </div>
    );
  }

  /* ── Connected: the Developer Hub proper ─────────────────────────────────── */
  return (
    <div className="flex flex-col gap-space-lg w-full pt-space-xs pb-10">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 font-caption text-caption text-outline">
          <span>OmniFlow</span>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-primary font-semibold">Developer Hub</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
          Platform Connection &amp; Workspace Agents
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
          Review the Perfox workspace this service is connected to, activate and pause the agents
          it holds.
        </p>
      </div>

      {/* ===================================================================== */}
      {/* PLATFORM CONNECTION                                                    */}
      {/* ===================================================================== */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container overflow-hidden">
        <div className="p-5 bg-surface-container-low/60 border-b border-surface-container flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-xl">hub</span>
            </div>
            <div>
              <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                Perfox Platform Connection
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Agents stay hidden until this is configured.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${platformStatusClass(platform.status)}`}
            >
              {platform.status}
            </span>
            <Button
              variant="hover"
              size="sm"
              startIcon="network_ping"
              loading={testingPlatform}
              disabled={testingPlatform}
              onClick={handleTestPlatform}
            >
              Test
            </Button>
            {/* Changing the credentials means disconnecting and connecting
                again — there is no in-place edit, so a half-changed pair can
                never sit in front of a workspace it does not open. */}
            <Button
              variant="ghost"
              size="sm"
              startIcon="link_off"
              loading={disconnecting}
              disabled={disconnecting}
              onClick={askToDisconnect}
              title="Disconnect this workspace and enter different credentials"
            >
              Disconnect
            </Button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-outline">
                  Workspace
                </span>
                <span className="font-title-sm text-title-sm font-bold text-on-surface">
                  {platform.workspace || '—'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-outline">
                  API Base URL
                </span>
                <span className="font-mono text-xs text-on-surface truncate" title={platform.apiUrl}>
                  {platform.apiUrl}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-outline">
                  API Token
                </span>
                <span className="font-mono text-xs text-on-surface">{platform.apiTokenMasked}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-outline">
                  Last Verified
                </span>
                <span
                  className="font-body-sm text-body-sm text-on-surface"
                  title={fullTimestamp(platform.lastVerifiedAt)}
                >
                  {platform.lastVerifiedAt ? relativeLabel(platform.lastVerifiedAt) : 'Never'}
                </span>
              </div>

            {platform.source === 'env' && (
              <p className="sm:col-span-2 lg:col-span-4 text-[11px] text-on-surface-variant">
                These credentials come from the server environment, not the Developer Hub.
                Disconnecting and entering your own stores a workspace connection that takes
                precedence over them.
              </p>
            )}
            {platform.lastError && platform.status === 'Error' && (
              <p className="sm:col-span-2 lg:col-span-4 text-[11px] text-error">
                {platform.lastError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* OPERATOR CALLING                                                       */}
      {/* ===================================================================== */}
      {/* A second credential, and it depends on the one above: the server
          answers 409 until the workspace connection exists. */}
      <OperatorSiteCard
        platform={platform}
        onSaved={setPlatform}
        canEdit={user?.role === 'Admin'}
      />

      {/* Real counts only — nothing here is a placeholder figure. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">smart_toy</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-medium">
              Workspace Agents
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              {agents.length}
            </span>
            <span className="font-caption text-caption text-purple-700 font-semibold">
              {publishedCount} published · {pausedCount} paused
              {draftCount > 0 ? ` · ${draftCount} draft` : ''}
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">sync</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-medium">
              Agents Last Synced
            </span>
            <span
              className="font-headline-sm text-headline-sm text-on-surface font-bold"
              title={fullTimestamp(syncedAt)}
            >
              {syncedAt ? relativeLabel(syncedAt) : '—'}
            </span>
            <span className="font-caption text-caption text-outline">
              {agentSource === 'perfox' ? 'Fetched from Perfox' : 'Served from cache'}
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-secondary-container/20 text-secondary flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">verified_user</span>
          </div>
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-medium">
              Connection
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              {platform.status}
            </span>
            <span className="font-caption text-caption text-outline truncate">
              {platform.workspace || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* WORKSPACE AGENTS — read-only, toggled in place                         */}
      {/* ===================================================================== */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container overflow-hidden">
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
                Agents are created and edited in Perfox. Here you can activate or pause them.
              </p>
            </div>
          </div>

          {/* Perfox is only called when the cache is empty or a refresh is asked
              for, so this is the only way to re-sync. */}
          <Button
            variant="secondary"
            size="md"
            startIcon="sync"
            loading={agentsLoading}
            disabled={agentsLoading}
            onClick={() => loadAgents(true)}
            title="Re-sync the agent list from Perfox"
          >
            Refresh from Perfox
          </Button>
        </div>

        {agents.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-outline">smart_toy</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {agentsLoading
                ? 'Loading agents…'
                : 'This Perfox workspace has no agents yet. Create one in Perfox, then refresh.'}
            </p>
          </div>
        ) : (
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {agents.map((agent) => {
                const isDraft = agent.status === 'draft';
                const isPublished = agent.status === 'published';
                const isToggling = togglingAgentId === agent.id;

                return (
                  <div
                    key={agent.id}
                    className="p-3.5 rounded-2xl border border-surface-container bg-surface-container-low/70 hover:bg-surface-container hover:border-surface-container-high transition-all flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-base">smart_toy</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-title-sm text-title-sm font-bold text-on-surface truncate">
                            {agent.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(agent.id, agent.id)}
                            title={`Copy ${agent.id}`}
                            className="text-[11px] text-outline font-mono block truncate max-w-full hover:text-primary cursor-pointer text-left"
                          >
                            {copied === agent.id ? 'Copied' : agent.id}
                          </button>
                        </div>
                      </div>

                      {/* Status and its toggle sit together on the card — a draft
                          has no switch, because there is no second state to move
                          to until Perfox has published it once. */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${agentStatusClass(agent.status)}`}
                        >
                          {agent.status}
                        </span>
                        {!isDraft && (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isPublished}
                            aria-label={`${isPublished ? 'Pause' : 'Publish'} ${agent.name}`}
                            disabled={isToggling}
                            onClick={() => handleToggleAgent(agent)}
                            className={`w-9 h-[18px] rounded-full transition-colors relative focus:outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              isPublished ? 'bg-emerald-600' : 'bg-surface-container-high'
                            }`}
                            title={
                              isPublished
                                ? 'Pause this agent in Perfox'
                                : `Publish this agent in Perfox — this bumps it to v${agent.activeVersion + 1}`
                            }
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform absolute top-[2px] ${
                                isPublished ? 'left-[20px]' : 'left-[2px]'
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] text-on-surface-variant pt-1 border-t border-surface-container-low">
                      <div className="flex items-center justify-between">
                        <span className="text-outline">Version:</span>
                        <span className="font-semibold text-on-surface">v{agent.activeVersion}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-outline">Nodes:</span>
                        <span className="font-semibold text-on-surface">{agent.nodeCount}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-outline shrink-0">Channels:</span>
                        <span className="font-medium text-on-surface truncate">
                          {agent.channels?.length ? agent.channels.join(', ') : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-outline shrink-0">Updated:</span>
                        <span
                          className="font-medium text-on-surface truncate"
                          title={fullTimestamp(agent.perfoxUpdatedAt)}
                        >
                          {relativeLabel(agent.perfoxUpdatedAt) || '—'}
                        </span>
                      </div>
                    </div>

                    {isDraft && (
                      <p className="text-[10px] text-on-surface-variant leading-snug">
                        Publish it in Perfox before it can be toggled here.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>

      {dialog && <Dialog state={dialog} busy={disconnecting} onClose={() => setDialog(null)} />}
    </div>
  );
}
