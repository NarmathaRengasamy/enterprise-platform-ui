import React, { useState } from 'react';

/**
 * Renders a Perfox conversation as a transcript.
 *
 * The stream is not a flat list of chat messages — roughly half the events are
 * the agent's machinery: tool calls, grounding decisions, guardrails. Rendering
 * those as chat bubbles buried the actual conversation, so only what a person
 * said or the agent replied is a bubble. Everything else sits between them as a
 * thinner line that can be opened when someone wants the detail.
 */

interface TranscriptMessage {
  id: string;
  sender: 'me' | 'them' | 'system';
  actor?: string;
  eventType?: string;
  text: string;
  time: string;
  channel?: string;
  toolName?: string;
  /** Transport outcome only — the business result is in `toolOutput`. */
  toolStatus?: string;
  toolLatencyMs?: number;
  toolErrorDetail?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  attachment?: {
    fileName?: string;
    fileUrl?: string;
    mimeType?: string;
    fileSize?: number;
    title?: string;
    image?: string;
    sku?: string;
    status?: string;
  };
}

interface ConversationTranscriptProps {
  messages: TranscriptMessage[];
}

/* Events that are the agent working rather than anyone speaking. */
const TOOL_EVENTS = new Set(['tool_call', 'tool_result']);
const META_EVENTS = new Set([
  'grounding_decision',
  'guardrail_triggered',
  'identity_resolved',
  'status_change',
]);

const META_ICONS: Record<string, string> = {
  grounding_decision: 'menu_book',
  guardrail_triggered: 'shield',
  identity_resolved: 'badge',
  status_change: 'flag',
};

const formatSize = (bytes?: number): string => {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const fileIcon = (mime?: string): string => {
  if (!mime) return 'draft';
  if (mime.includes('pdf')) return 'picture_as_pdf';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return 'table';
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('word') || mime.includes('document')) return 'description';
  return 'draft';
};

/** A tool call and its result, folded into one entry. */
interface ToolStep {
  kind: 'tool';
  id: string;
  name: string;
  status?: string;
  latencyMs?: number;
  errorDetail?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  time: string;
}

type Step =
  | { kind: 'message'; message: TranscriptMessage }
  | { kind: 'meta'; message: TranscriptMessage }
  | ToolStep;

/**
 * Perfox emits a `tool_call` and a matching `tool_result` as separate events.
 * Shown separately they read as two entries for one action, so the pair is
 * folded together — the call supplies the input, the result the outcome.
 */
const buildSteps = (messages: TranscriptMessage[]): Step[] => {
  const steps: Step[] = [];
  const openTools = new Map<string, ToolStep>();

  messages.forEach((message) => {
    const type = message.eventType ?? '';

    if (TOOL_EVENTS.has(type)) {
      const name = message.toolName || 'Tool';

      if (type === 'tool_call') {
        const step: ToolStep = {
          kind: 'tool',
          id: message.id,
          name,
          input: message.toolInput,
          time: message.time,
        };
        openTools.set(name, step);
        steps.push(step);
        return;
      }

      /* A result without its call still deserves a row rather than vanishing. */
      const pending = openTools.get(name);
      const target =
        pending ??
        (() => {
          const step: ToolStep = { kind: 'tool', id: message.id, name, time: message.time };
          steps.push(step);
          return step;
        })();

      target.status = message.toolStatus ?? target.status;
      target.latencyMs = message.toolLatencyMs ?? target.latencyMs;
      target.errorDetail = message.toolErrorDetail ?? target.errorDetail;
      target.output = message.toolOutput ?? target.output;
      openTools.delete(name);
      return;
    }

    steps.push({ kind: META_EVENTS.has(type) ? 'meta' : 'message', message });
  });

  return steps;
};

/* ------------------------------------------------------------------ tool */

function ToolRow({ step }: { step: ToolStep }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(step.input || step.output || step.errorDetail);

  /* `tool_status` reports the transport, not the business result: a tool that
     returned { success: false } still says "success". So a failure is only
     claimed when the payload says so. */
  const reportedFailure =
    step.status === 'error' ||
    step.status === 'timeout' ||
    (step.output as any)?.success === false ||
    Boolean(step.errorDetail);

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-xl">
        <button
          type="button"
          onClick={() => hasDetail && setOpen((v) => !v)}
          disabled={!hasDetail}
          className={`w-full flex items-center gap-2 px-2.5 py-1 rounded-lg border text-left transition-colors ${
            reportedFailure
              ? 'bg-error/5 border-error/20'
              : 'bg-surface-container-low/60 border-surface-container'
          } ${hasDetail ? 'hover:bg-surface-container cursor-pointer' : 'cursor-default'}`}
        >
          <span
            className={`material-symbols-outlined text-base shrink-0 ${
              reportedFailure ? 'text-error' : 'text-on-surface-variant'
            }`}
          >
            {reportedFailure ? 'error' : 'build'}
          </span>

          <span className="font-mono text-[11px] font-semibold text-on-surface truncate">
            {step.name}
          </span>

          {step.status && (
            <span
              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold shrink-0 ${
                reportedFailure
                  ? 'bg-error/10 text-error'
                  : 'bg-emerald-500/15 text-emerald-700'
              }`}
              title="Transport outcome — not the business result"
            >
              {step.status}
            </span>
          )}

          {typeof step.latencyMs === 'number' && (
            <span className="font-mono text-[10px] text-outline shrink-0">{step.latencyMs} ms</span>
          )}

          <span className="ml-auto flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-[10px] text-outline">{step.time}</span>
            {hasDetail && (
              <span className="material-symbols-outlined text-sm text-on-surface-variant">
                {open ? 'expand_less' : 'expand_more'}
              </span>
            )}
          </span>
        </button>

        {open && (
          <div className="mt-1 rounded-xl border border-surface-container bg-surface-container-lowest overflow-hidden">
            {step.errorDetail && (
              <div className="px-3 py-2 bg-error/5 text-error font-caption text-caption border-b border-error/10">
                {step.errorDetail}
              </div>
            )}
            {step.input && (
              <div className="px-3 py-2 border-b border-surface-container">
                <span className="font-caption text-caption text-outline uppercase tracking-wider font-semibold">
                  Input
                </span>
                <pre className="mt-1 font-mono text-[10px] text-on-surface-variant whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                  {JSON.stringify(step.input, null, 2)}
                </pre>
              </div>
            )}
            {step.output && (
              <div className="px-3 py-2">
                <span className="font-caption text-caption text-outline uppercase tracking-wider font-semibold">
                  Output
                </span>
                <pre className="mt-1 font-mono text-[10px] text-on-surface-variant whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                  {JSON.stringify(step.output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ meta */

function MetaRow({ message }: { message: TranscriptMessage }) {
  return (
    <div className="flex justify-center">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-surface-container-low/60 text-on-surface-variant">
        <span className="material-symbols-outlined text-sm">
          {META_ICONS[message.eventType ?? ''] ?? 'info'}
        </span>
        <span className="font-caption text-caption">{message.text}</span>
        <span className="font-mono text-[10px] text-outline">{message.time}</span>
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- bubbles */

function FileCard({ attachment, onDark }: { attachment: NonNullable<TranscriptMessage['attachment']>; onDark: boolean }) {
  const name = attachment.fileName || attachment.title || 'Attachment';

  /* The signed URL expires, so it is followed on click and never stored. */
  const body = (
    <>
      <span className="material-symbols-outlined text-xl shrink-0">{fileIcon(attachment.mimeType)}</span>
      <span className="flex flex-col min-w-0">
        <span className="font-label-md text-label-md font-semibold truncate">{name}</span>
        {attachment.fileSize ? (
          <span className="font-caption text-[10px] opacity-80">{formatSize(attachment.fileSize)}</span>
        ) : null}
      </span>
      {attachment.fileUrl && (
        <span className="material-symbols-outlined text-base ml-auto shrink-0">download</span>
      )}
    </>
  );

  const className = `flex items-center gap-2 p-2 rounded-lg mb-1.5 ${
    onDark ? 'bg-white/15' : 'bg-surface-container'
  } ${attachment.fileUrl ? 'hover:opacity-90 cursor-pointer' : ''}`;

  return attachment.fileUrl ? (
    <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

function MessageBubble({ message }: { message: TranscriptMessage }) {
  const isAgent = message.sender === 'me';

  return (
    /* Customer on the right, AI agent on the left. `flex-row-reverse` puts the
       customer's icon on the outside of its own side rather than between the
       bubble and the middle of the thread. */
    <div
      className={`flex items-start gap-1.5 max-w-md ${isAgent ? '' : 'ml-auto flex-row-reverse'}`}
    >
      <span
        className={`w-6 h-6 rounded-pill flex items-center justify-center shrink-0 mt-[16px] ${
          isAgent
            ? 'bg-primary/10 text-primary'
            : 'bg-surface-container-high text-on-surface-variant'
        }`}
        title={isAgent ? 'AI agent' : 'Customer'}
      >
        <span className="material-symbols-outlined text-base">
          {isAgent ? 'smart_toy' : 'person'}
        </span>
      </span>

      <div className={`flex flex-col min-w-0 ${isAgent ? 'items-start' : 'items-end'}`}>
      <span className="font-caption text-[10px] text-outline px-1 mb-0.5">
        {isAgent ? 'AI agent' : 'Customer'}
      </span>
      <div
        className={`px-3 py-2 rounded-2xl shadow-sm ${
          isAgent
            ? 'bg-primary text-on-primary rounded-bl-sm'
            : 'bg-surface-container-lowest text-on-surface rounded-br-sm border border-surface-container'
        }`}
      >
        {message.attachment && <FileCard attachment={message.attachment} onDark={isAgent} />}

        {message.text && (
          <p className="font-body-sm text-body-sm leading-relaxed whitespace-pre-wrap">
            {message.text}
          </p>
        )}

        <div
          className={`flex items-center justify-end gap-1.5 font-mono text-[10px] mt-1 ${
            isAgent ? 'text-primary-fixed' : 'text-on-surface-variant'
          }`}
        >
          {message.channel && (
            <span className="uppercase text-[9px] font-semibold tracking-wider opacity-80">
              via {message.channel}
            </span>
          )}
          <span>{message.time}</span>
        </div>
      </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- export */

export default function ConversationTranscript({ messages }: ConversationTranscriptProps) {
  const steps = buildSteps(messages);

  return (
    <>
      {steps.map((step) =>
        step.kind === 'tool' ? (
          <ToolRow key={step.id} step={step} />
        ) : step.kind === 'meta' ? (
          <MetaRow key={step.message.id} message={step.message} />
        ) : (
          <MessageBubble key={step.message.id} message={step.message} />
        )
      )}
    </>
  );
}
