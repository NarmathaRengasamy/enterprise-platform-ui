import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSiteSettings } from '../context/SiteSettingsContext';
import {
  BUSINESS_TYPES,
  DEFAULT_LABELS,
  MODULE_KEYS,
  ModuleKey,
  ModuleLabel,
  SiteSettingsPatch,
  guessSingular,
  isDefaultLabel,
} from '../services/settings.service';
import { Button, Combobox, Icon, Toast, ToastMessage } from '../components/common';
import { BusinessSettingsTab } from '../components/settings/BusinessSettingsTab';

/**
 * Workspace settings.
 *
 * Two columns rather than one long stack: the groups here are short and
 * unrelated to each other, so stacking them buried Business under a scroll for
 * no reason. Panels sit side by side and reflow to one column on a narrow
 * screen.
 *
 * Everything here is **workspace-wide**, not per user. A non-Admin can read it
 * but not save — shown as a disabled form with a reason rather than a hidden
 * page, so staff can see how the workspace is set up without being able to
 * change it for everyone.
 */

const TABS = [
  { key: 'workspace', label: 'Workspace Details', icon: 'apartment' },
  { key: 'navigation', label: 'Navigation Labels', icon: 'list' },
  { key: 'business', label: 'Business & Products', icon: 'storefront' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/** The sidebar icon and one line of context for each renameable section. */
/**
 * `singular` is offered only where the app actually reads one.
 *
 * Some of these name a screen, not a thing: there is no "one All Products"
 * and no "one Dashboard". Offering a singular for them was worse than
 * useless — it read as the place to name one item, so a singular typed there
 * silently did nothing while the buttons and columns kept using the parent's.
 */
const MODULE_META: Record<
  ModuleKey,
  { icon: string; description: string; nested?: boolean; singular?: boolean }
> = {
  dashboard: { icon: 'dashboard', description: 'The landing screen.' },
  conversations: {
    icon: 'chat',
    description: 'Chats and calls with customers.',
    singular: true,
  },
  products: {
    icon: 'inventory_2',
    /* The parent menu entry only. One of the things lives under All
       Products, which is the row that carries the singular. */
    description: 'The menu group.',
  },
  allProducts: {
    icon: 'list_alt',
    description: 'The list itself, and one entry in it.',
    nested: true,
    singular: true,
  },
  categories: {
    icon: 'category',
    description: 'How the catalogue is grouped.',
    nested: true,
    singular: true,
  },
  schedule: {
    icon: 'calendar_month',
    description: 'Appointments and the calendar.',
    singular: true,
  },
  teams: { icon: 'groups', description: 'The people who work here.', singular: true },
  knowledgeBase: {
    icon: 'menu_book',
    description: 'Help content and resources.',
    singular: true,
  },
  developer: { icon: 'terminal', description: 'Developer tools and integrations.' },
};

const inputClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-sm text-on-surface ' +
  'placeholder:text-outline/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 ' +
  'transition-shadow disabled:bg-slate-50 disabled:text-outline disabled:cursor-not-allowed';

/** 512 KB, matching the server. Checked here so the user hears it instantly. */
const MAX_IMAGE_BYTES = 512 * 1024;

/* The hard caps the server enforces. */
const MAX_SITE_NAME = 60;
const MAX_TAGLINE = 60;

/**
 * Roughly what fits in the sidebar before it is cut short.
 *
 * Not a limit — a long name is still allowed and stored in full, it is simply
 * shortened with an ellipsis where it is shown.
 */
const SIDEBAR_FITS_NAME = 20;
const SIDEBAR_FITS_TAGLINE = 26;

/* ---------------------------------------------------------- building blocks */

/**
 * Makes a disabled button explain itself on hover.
 *
 * `Button` carries `disabled:pointer-events-none`, so a disabled one receives
 * no hover at all — no cursor change, no tooltip, nothing. It reads as a dead
 * control rather than one waiting for something. The wrapper still takes
 * pointer events, so it can carry both.
 */
const DisabledHint: React.FC<{ reason: string | null; children: React.ReactNode }> = ({
  reason,
  children,
}) => {
  if (!reason) return <>{children}</>;
  return (
    <span className="inline-flex cursor-not-allowed" title={reason}>
      {children}
    </span>
  );
};

/** Only appears once the value is close to the cap — silent until it matters. */
const CharCount: React.FC<{ value: string; max: number }> = ({ value, max }) => {
  if (value.length < max * 0.75) return null;
  return (
    <span
      className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums ${
        value.length >= max ? 'text-error font-semibold' : 'text-outline'
      }`}
    >
      {value.length}/{max}
    </span>
  );
};

/** A titled card. */
const Card: React.FC<{
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
    <div className="px-6 py-4 border-b border-slate-100">
      <h2 className="text-base font-semibold text-on-surface">{title}</h2>
      <p className="text-sm text-outline mt-0.5">{description}</p>
    </div>
    <div className="px-6 py-5">{children}</div>
  </section>
);

/** A labelled input with its hint underneath. */
const Field: React.FC<{
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}> = ({ label, hint, required, htmlFor, children }) => (
  <div className="min-w-0">
    <label htmlFor={htmlFor} className="block text-sm font-medium text-on-surface mb-1.5">
      {label}
      {required && <span className="text-error ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-outline mt-1.5 leading-snug">{hint}</p>}
  </div>
);

/**
 * One brand asset: preview, what it is used for, and the two actions.
 *
 * Files become data URLs rather than uploads: this service has no file store,
 * and a logo is small enough that inlining it is honest rather than a
 * shortcut. The size cap is what keeps that true.
 */
const AssetCard: React.FC<{
  title: string;
  description: string;
  formats: string;
  actionLabel: string;
  value: string;
  onChange: (next: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  fallbackIcon: string;
}> = ({
  title,
  description,
  formats,
  actionLabel,
  value,
  onChange,
  onError,
  disabled,
  fallbackIcon,
}) => {
  const input = useRef<HTMLInputElement>(null);

  const read = (file?: File) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      onError(
        `That image is ${Math.round(file.size / 1024)} KB. The limit is ${Math.round(
          MAX_IMAGE_BYTES / 1024
        )} KB — it is stored inline, so it has to stay small.`
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.onerror = () => onError('That file could not be read.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border border-slate-200">
      <div className="shrink-0 w-[4.5rem] h-[4.5rem] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
        {value ? (
          <img src={value} alt="" className="w-full h-full object-contain" />
        ) : (
          <Icon name={fallbackIcon} size="lg" color="outline" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="text-xs text-outline mt-0.5 leading-snug">{description}</p>
        <p className="text-xs text-outline mt-1">{formats}</p>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            startIcon="upload"
            onClick={() => input.current?.click()}
          >
            {value ? actionLabel : 'Upload'}
          </Button>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              startIcon="delete"
              className="bg-error/10 text-error hover:bg-error/[0.18]"
              onClick={() => onChange('')}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
        hidden
        onChange={(e) => {
          read(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
};

/**
 * One navigation label.
 *
 * Only the display name is asked for. The singular — "New interaction" — is
 * derived from it and stored alongside, rather than being a second box: the
 * rule handles ordinary plurals including "Enquiries" to "Enquiry", and the
 * handful it gets wrong read slightly off rather than breaking anything.
 *
 * Both words are still stored, so restoring an override later is a change to
 * this component alone.
 */
const LabelRow: React.FC<{
  moduleKey: ModuleKey;
  value: ModuleLabel;
  onChange: (next: ModuleLabel) => void;
  disabled?: boolean;
}> = ({ moduleKey, value, onChange, disabled }) => {
  const fallback = DEFAULT_LABELS[moduleKey];
  const meta = MODULE_META[moduleKey];
  const customised = !isDefaultLabel(moduleKey, value);

  /* The singular follows the plural only while it still matches the guess.
     Once it has been typed over, editing the plural must leave it alone —
     otherwise a deliberate choice would be quietly undone from the next
     column. */
  const derived = guessSingular(value.plural);
  const follows = value.singular === derived;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,12rem)_minmax(0,12rem)_auto] gap-x-5 gap-y-2 items-center py-2.5 border-b border-slate-100 last:border-b-0">
      {/* The system name, not the current one: it stays put however the row
          is renamed, so you can always tell which section you are editing. */}
      <div className={`flex items-center gap-2.5 min-w-0 ${meta.nested ? 'sm:pl-5' : ''}`}>
        <Icon name={meta.icon} size="sm" color="outline" className="shrink-0" />
        <span className="text-sm text-on-surface truncate">{fallback.plural}</span>
      </div>

      <span className="text-sm text-outline hidden sm:block">{meta.description}</span>

      <input
        className={inputClass}
        disabled={disabled}
        maxLength={40}
        value={value.plural}
        onChange={(e) => {
          const plural = e.target.value;
          onChange({ plural, singular: follows ? guessSingular(plural) : value.singular });
        }}
        placeholder={fallback.plural}
        aria-label={`Plural display name for ${fallback.plural}`}
      />

      {/* Products names the menu group and Developer names a screen, so
          nothing in the app reads a singular for either. An editable box that
          changes nothing is worse than no box — that is how a value typed in
          the wrong row went unnoticed before. */}
      {meta.singular ? (
        <input
          className={inputClass}
          disabled={disabled}
          maxLength={40}
          value={value.singular}
          onChange={(e) => onChange({ ...value, singular: e.target.value })}
          placeholder={derived}
          aria-label={`Singular display name for ${fallback.plural}`}
        />
      ) : (
        <span
          className="text-sm text-outline/60 sm:pl-3"
          title={`${fallback.plural} names a section, not a thing you can have one of.`}
        >
          &mdash;
        </span>
      )}

      <DisabledHint reason={customised ? null : 'Already the default'}>
        <button
          type="button"
          disabled={disabled || !customised}
          onClick={() => onChange({ ...fallback })}
          className="text-sm text-primary font-medium hover:underline disabled:text-outline/50
            disabled:no-underline disabled:cursor-not-allowed cursor-pointer px-1"
        >
          Reset
        </button>
      </DisabledHint>
    </div>
  );
};

/* ---------------------------------------------------------------- the page */

export default function SettingsPage() {
  const { user } = useAuth();
  const { settings, loaded, available, loadError, reload, save } = useSiteSettings();
  const isAdmin = user?.role === 'Admin';

  const [tab, setTab] = useState<TabKey>('workspace');
  const [draft, setDraft] = useState<SiteSettingsPatch>({});
  const [saving, setSaving] = useState(false);
  /* Saved / failed are events, so they go to the toast. A load failure is a
     state that is still true and still blocking, so it stays as a banner. */
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fromSettings = (): SiteSettingsPatch => ({
    siteName: settings.siteName,
    legalName: settings.legalName,
    tagline: settings.tagline,
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
    businessType: settings.businessType,
    labels: settings.labels,
  });

  /* The form is seeded from the loaded settings and then owns its own state,
     so a background reload cannot overwrite what is being typed. */
  useEffect(() => {
    /* Only seed from settings that were actually read. Seeding from the
       fallback defaults would let a save write them over the real ones. */
    if (!loaded || !available) return;
    setDraft(fromSettings());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, available, settings]);

  const set = (patch: SiteSettingsPatch) => setDraft((current) => ({ ...current, ...patch }));

  /* `labels` is an object, so a plain `!==` would report a change on every
     render — the seeded copy is never the same reference as the stored one.
     Comparing it by value is what keeps "No changes yet" honest. */
  const dirty = Object.entries(draft).some(([key, value]) => {
    const current = (settings as unknown as Record<string, unknown>)[key];
    if (key === 'labels') return JSON.stringify(value) !== JSON.stringify(current);
    return value !== current;
  });

  /**
   * Why the save is unavailable, or null when it is ready.
   *
   * Ordered by what the user should deal with first: no connection beats no
   * permission beats an invalid field beats nothing to save.
   */
  const blockedReason =
    loaded && !available
      ? 'Settings could not be loaded'
      : !isAdmin
        ? 'Only an Admin can change these'
        : !draft.siteName?.trim()
          ? 'A workspace name is required'
          : !dirty
            ? 'No changes yet'
            : null;

  const submit = async () => {
    setSaving(true);
    try {
      /* Trim on the way out, not on every keystroke — trimming as you type
         makes it impossible to put a space between two words. */
      await save({
        ...draft,
        siteName: draft.siteName?.trim(),
        legalName: draft.legalName?.trim(),
        tagline: draft.tagline?.trim(),
        businessType: draft.businessType?.trim(),
        labels: draft.labels
          ? (Object.fromEntries(
              MODULE_KEYS.map((key) => {
                const label = draft.labels![key] ?? DEFAULT_LABELS[key];
                return [
                  key,
                  {
                    plural: label.plural.trim() || DEFAULT_LABELS[key].plural,
                    singular: label.singular.trim() || DEFAULT_LABELS[key].singular,
                  },
                ];
              })
            ) as typeof draft.labels)
          : undefined,
      });
      setToast({ text: 'Settings saved.', type: 'success' });
    } catch (e: any) {
      setToast({ text: e.message || 'Could not save the settings.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const fail = (message: string) => setToast({ text: message, type: 'error' });

  const nameOverflows = (draft.siteName ?? '').trim().length > SIDEBAR_FITS_NAME;
  const taglineOverflows = (draft.tagline ?? '').trim().length > SIDEBAR_FITS_TAGLINE;

  return (
    <div className="max-w-6xl mx-auto w-full">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      {/* The actions sit here rather than at the foot of the form: bottom-right
          belongs to the call panel, which is fixed to the viewport on every
          screen. Sticking under the app header keeps Save reachable the whole
          way down. `top-16` is the height of that header. */}
      <header className="sticky top-16 z-30 bg-background pt-1">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Settings</h1>
            <p className="text-sm text-outline mt-0.5">
              Manage your workspace configuration and appearance.
            </p>
          </div>

          {/* The Business tab saves on its own; these buttons belong to the
              workspace settings on the other two tabs. */}
          <div className={`flex items-center gap-3 shrink-0 ${tab === 'business' ? 'hidden' : ''}`}>
            {blockedReason && <span className="text-sm text-outline">{blockedReason}</span>}
            <DisabledHint reason={!dirty && !saving ? 'Nothing to discard' : null}>
              <Button
                variant="outline"
                disabled={!dirty || saving}
                onClick={() => setDraft(fromSettings())}
              >
                Discard
              </Button>
            </DisabledHint>
            <DisabledHint reason={blockedReason}>
              <Button
                variant="primary"
                loading={saving}
                disabled={Boolean(blockedReason) || saving}
                onClick={submit}
              >
                Save changes
              </Button>
            </DisabledHint>
          </div>
        </div>

        <nav className="flex items-center gap-1 mt-5 border-b border-slate-200">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors cursor-pointer ${
                tab === entry.key
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-outline hover:text-on-surface hover:bg-slate-50'
              }`}
            >
              <Icon name={entry.icon} size="sm" />
              {entry.label}
            </button>
          ))}
        </nav>
      </header>

      {loaded && !available && (
        <div className="mt-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
          <Icon name="cloud_off" size="sm" color="error" className="mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-error">Settings could not be loaded</p>
            <p className="text-xs text-on-surface mt-0.5">
              Saving is blocked so nothing already stored is overwritten with defaults.
              {loadError ? ` The server said: ${loadError}` : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      )}

      {!isAdmin && (
        <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
          <Icon name="lock" size="sm" className="shrink-0 text-amber-700" />
          <p className="text-sm text-on-surface">
            Read-only — these are workspace-wide, so only an Admin can change them.
          </p>
        </div>
      )}

      {tab === 'workspace' && (
        <div className="space-y-5 mt-5 pb-8">
          <Card
            title="Workspace Identity"
            description="Define the information displayed throughout your workspace."
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">
              <Field
                label="Workspace Name"
                required
                htmlFor="siteName"
                hint={
                  nameOverflows
                    ? 'Longer than the sidebar shows — stored in full, shortened there.'
                    : 'This name appears in the sidebar and browser tab.'
                }
              >
                <div className="relative">
                  <input
                    id="siteName"
                    className={`${inputClass} pr-14`}
                    disabled={!isAdmin}
                    maxLength={MAX_SITE_NAME}
                    value={draft.siteName ?? ''}
                    onChange={(e) => set({ siteName: e.target.value })}
                    placeholder="OmniFlow"
                  />
                  <CharCount value={draft.siteName ?? ''} max={MAX_SITE_NAME} />
                </div>
              </Field>

              <Field
                label="Tagline"
                htmlFor="tagline"
                hint={
                  taglineOverflows
                    ? 'Longer than the sidebar shows — stored in full, shortened there.'
                    : 'A short tagline displayed beneath your workspace name.'
                }
              >
                <div className="relative">
                  <input
                    id="tagline"
                    className={`${inputClass} pr-14`}
                    disabled={!isAdmin}
                    maxLength={MAX_TAGLINE}
                    value={draft.tagline ?? ''}
                    onChange={(e) => set({ tagline: e.target.value })}
                    placeholder="Perfox Assistant"
                  />
                  <CharCount value={draft.tagline ?? ''} max={MAX_TAGLINE} />
                </div>
              </Field>

              <Field
                label="Legal Business Name"
                htmlFor="legalName"
                hint="Use the official legal name of your business."
              >
                <input
                  id="legalName"
                  className={inputClass}
                  disabled={!isAdmin}
                  maxLength={120}
                  value={draft.legalName ?? ''}
                  onChange={(e) => set({ legalName: e.target.value })}
                  placeholder="Skillmine Technology Consulting Pvt Ltd"
                />
              </Field>

              <Field
                label="Business Category"
                hint="Choose the category that best describes your business."
              >
                <Combobox
                  disabled={!isAdmin}
                  options={BUSINESS_TYPES}
                  value={draft.businessType ?? ''}
                  onChange={(businessType) => set({ businessType })}
                  placeholder="Select or type…"
                />
              </Field>
            </div>
          </Card>

          <Card
            title="Brand Identity"
            description="Manage the visual assets used across your workspace."
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <AssetCard
                title="Workspace Logo"
                description="Displayed in the application header and workspace navigation."
                formats="PNG or SVG • Max 512 KB"
                actionLabel="Replace Logo"
                fallbackIcon="image"
                disabled={!isAdmin}
                value={draft.logoUrl ?? ''}
                onChange={(logoUrl) => set({ logoUrl })}
                onError={fail}
              />
              <AssetCard
                title="Favicon"
                description="Displayed in browser tabs and bookmarks."
                formats="PNG or ICO • Max 512 KB"
                actionLabel="Replace Favicon"
                fallbackIcon="tab"
                disabled={!isAdmin}
                value={draft.faviconUrl ?? ''}
                onChange={(faviconUrl) => set({ faviconUrl })}
                onError={fail}
              />
            </div>
          </Card>

          <p className="text-xs text-outline">
            {settings.updatedAt
              ? `Last changed ${new Date(settings.updatedAt).toLocaleString()}${
                  settings.updatedBy ? ` by ${settings.updatedBy}` : ''
                }`
              : 'Never changed — these are the defaults.'}
          </p>
        </div>
      )}

      {tab === 'business' && (
        <BusinessSettingsTab isAdmin={isAdmin} onMessage={(text, type) => setToast({ text, type })} />
      )}

      {tab === 'navigation' && (
        <div className="space-y-5 mt-5 pb-8">
          <Card
            title="Navigation Labels"
            description="Customize the names shown in the main menu and sub menu. These labels are used across the application."
          >
            <div className="hidden sm:grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,12rem)_minmax(0,12rem)_auto] gap-x-5 pb-2 border-b border-slate-200">
              <span className="text-xs font-medium text-outline">Menu / Section</span>
              <span className="text-xs font-medium text-outline">Description</span>
              <span className="text-xs font-medium text-outline">Display name (Plural)</span>
              <span className="text-xs font-medium text-outline">Display name (Singular)</span>
              <span />
            </div>

            {MODULE_KEYS.map((key) => (
              <LabelRow
                key={key}
                moduleKey={key}
                disabled={!isAdmin}
                value={draft.labels?.[key] ?? DEFAULT_LABELS[key]}
                onChange={(next) =>
                  set({ labels: { ...(draft.labels ?? DEFAULT_LABELS), [key]: next } })
                }
              />
            ))}
          </Card>

          <p className="text-xs text-outline flex items-start gap-1.5">
            <Icon name="info" size="xs" className="mt-0.5 shrink-0" />
            <span>
              A renamed section is used across the app — the menu, page headings, buttons, form
              fields, table columns and messages. Rows that name a <em>thing</em> also carry a{' '}
              <strong>singular</strong> form, worked out from the name you type and used wherever
              one of them is meant (“New …”, “Save …”, “… Name”); change it if the guess reads
              badly. Rows that name a <em>screen</em> have no singular, because there is no one of
              those. Web addresses and stored data are unaffected, so a link someone saved keeps
              working.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
