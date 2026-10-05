import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Icon } from '../common';
import { businessService, productTypeService } from '../../services/productType.service';
import {
  BusinessSettings,
  BusinessTemplateSummary,
  FIELD_TYPE_LABELS,
  Language,
  LANGUAGE_LABELS,
  ProductType,
} from '../../types/productType.types';
import type { CategoryMode } from '../../types/catalogCategory.types';

/**
 * Settings → Business & Products (Phase 1).
 *
 * The business category decides which product fields the tenant starts with:
 * choosing one pre-loads the product type; the admin then only adds extra
 * attributes (design §1). Saved on its own — the page's Save button belongs to
 * the workspace settings.
 *
 * Phase 2 adds "Use category tree": categories are a flat list by default; the
 * tree can be switched on at any time, but the server refuses switching it off
 * while any category still has a parent.
 */

const TIME_ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'];
const CURRENCIES = ['INR', 'USD', 'AED', 'SGD', 'GBP', 'EUR'];
const ALL_LANGUAGES: Language[] = ['en', 'ta', 'hi'];

const inputClass =
  'w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-sm text-on-surface ' +
  'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 ' +
  'disabled:bg-slate-50 disabled:text-outline disabled:cursor-not-allowed';

interface Props {
  isAdmin: boolean;
  onMessage: (text: string, type: 'success' | 'error') => void;
}

export const BusinessSettingsTab: React.FC<Props> = ({ isAdmin, onMessage }) => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<BusinessTemplateSummary[]>([]);
  const [saved, setSaved] = useState<BusinessSettings | null>(null);
  const [productType, setProductType] = useState<ProductType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [category, setCategory] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currency, setCurrency] = useState('INR');
  const [languages, setLanguages] = useState<Language[]>(['en']);
  const [starterCategories, setStarterCategories] = useState(true);
  const [categoryMode, setCategoryMode] = useState<CategoryMode>('flat');
  /* The server's refusal to switch the tree off, shown beside the toggle. */
  const [modeError, setModeError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = async () => {
    setLoadError(null);
    try {
      const [t, s, p] = await Promise.all([businessService.templates(), businessService.get(), productTypeService.get()]);
      setTemplates(t);
      setSaved(s);
      setProductType(p);
      setCategory(s.business_category ?? '');
      setTimezone(s.timezone);
      setCurrency(s.default_currency);
      setLanguages(s.languages);
      setCategoryMode(s.category_mode ?? 'flat');
    } catch (e: any) {
      setLoadError(e.message || 'Could not load the business settings');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const savedMode: CategoryMode = saved?.category_mode ?? 'flat';

  const dirty =
    !!saved &&
    (category !== (saved.business_category ?? '') ||
      timezone !== saved.timezone ||
      currency !== saved.default_currency ||
      languages.join() !== saved.languages.join() ||
      categoryMode !== savedMode);

  const changingCategory = !!saved?.business_category && category !== saved.business_category;

  const blockedReason = !isAdmin
    ? 'Only an Admin can change these'
    : !category
      ? 'Choose a business category'
      : !dirty
        ? 'No changes yet'
        : null;

  const selected = useMemo(() => templates.find((t) => t.code === category), [templates, category]);
  /* Accordions (Oct 2026): closed by default, the header shows the current value.
     With no business category chosen yet, that one starts open. */
  const [bizOpen, setBizOpen] = useState<boolean | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  /* Region & languages: open on first set-up (it holds "Create the starter categories"). */
  const [regionOpen, setRegionOpen] = useState<boolean | null>(null);
  const regionIsOpen = regionOpen ?? !saved?.business_category;
  /* Business category starts open (Oct 2026); it can be closed. */
  const bizIsOpen = bizOpen ?? true;
  const savedTemplate = templates.find((t) => t.code === saved?.business_category);
  /* Once chosen, the business category is locked (Oct 2026; the server refuses a change, 409). */
  const categoryLocked = Boolean(saved?.business_category);

  const toggleLanguage = (lang: Language) => {
    if (lang === 'en') return;
    setLanguages((current) =>
      current.includes(lang) ? current.filter((l) => l !== lang) : ALL_LANGUAGES.filter((l) => [...current, lang].includes(l))
    );
  };

  const submit = async () => {
    if (changingCategory && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setSaving(true);
    setResult(null);
    setModeError(null);
    const modeChanged = categoryMode !== savedMode;
    try {
      const { data, notice } = await businessService.save({
        business_category: category,
        timezone,
        default_currency: currency,
        languages,
        /* Only with the first choice, where the checkbox is shown: sent on every
           save it would bring back starter categories the admin deleted. */
        ...(!saved?.business_category ? { create_starter_categories: starterCategories } : {}),
        ...(modeChanged ? { category_mode: categoryMode } : {}),
      });
      setSaved(data.settings);
      setProductType(data.product_type);
      setCategoryMode(data.settings.category_mode ?? 'flat');
      const created = data.starter_categories?.created.length ?? 0;
      const text =
        (notice ??
          (data.outcome === 'created' || data.outcome === 'replaced'
            ? `Your product fields are ready — ${data.product_type.fields.length} attributes loaded.`
            : 'Business settings saved.')) +
        (created ? ` ${created} starter categor${created === 1 ? 'y' : 'ies'} created.` : '');
      setResult(text);
      onMessage(text, 'success');
    } catch (e: any) {
      const message = e.message || 'Could not save the business settings';
      /* Tree → flat refused (sub-categories exist): nothing was saved, so the
         toggle goes back to what the server has and the reason stays visible. */
      if (modeChanged && e.status === 409) {
        setCategoryMode(savedMode);
        setModeError(message);
      }
      onMessage(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="mt-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200" role="alert">
        <Icon name="cloud_off" size="sm" color="error" className="mt-0.5 shrink-0" />
        <p className="flex-1 text-sm text-error">{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!saved) return <p className="mt-5 text-sm text-outline">Loading…</p>;

  return (
    <div className="space-y-5 mt-5 pb-8" data-testid="business-settings">
      <section className="bg-white rounded-xl border border-slate-200" aria-label="Business category">
        <div className={`px-6 py-4 flex items-center justify-between gap-4 ${bizIsOpen ? 'border-b border-slate-100' : ''}`}>
          <button
            type="button"
            aria-expanded={bizIsOpen}
            aria-controls="business-category-body"
            onClick={() => setBizOpen(!bizIsOpen)}
            className="flex items-center gap-2 text-left min-w-0 flex-1"
          >
            <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
              {bizIsOpen ? 'expand_more' : 'chevron_right'}
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-on-surface">
                Business category
                <span className="font-normal text-on-surface-variant"> · {savedTemplate?.name.en ?? 'Not chosen yet'}</span>
                {categoryLocked && (
                  <span className="material-symbols-outlined text-sm text-on-surface-variant align-middle ml-1" title="Locked" aria-label="Locked">
                    lock
                  </span>
                )}
                {category && category !== saved.business_category && (
                  <span className="ml-2 text-xs font-medium text-amber-700">changing to {selected?.name.en ?? category} — save to apply</span>
                )}
              </span>
              <span className="block text-sm text-outline mt-0.5">Decides which product fields you start with. You can add your own attributes afterwards.</span>
            </span>
          </button>
          {productType && (
            <Button variant="outline" size="sm" onClick={() => navigate('/attributes')}>
              Open Attributes
            </Button>
          )}
        </div>

        {bizIsOpen && (
        <div id="business-category-body">
        {categoryLocked && (
          <p className="mx-6 mt-5 flex items-center gap-2 text-sm text-on-surface-variant" data-testid="business-category-locked">
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              lock
            </span>
            The business category can't be changed once chosen. Add or retire fields in Attributes.
          </p>
        )}
        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-4" role="radiogroup" aria-label="Business category">
          {/* Locked: only the chosen one is shown. */}
          {templates.filter((t) => !categoryLocked || t.code === saved.business_category).map((t) => {
            const on = category === t.code;
            return (
              <button
                key={t.code}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!isAdmin || categoryLocked}
                onClick={() => {
                  setCategory(t.code);
                  setConfirming(false);
                }}
                className={`text-left rounded-xl border p-4 transition-colors disabled:cursor-not-allowed ${
                  on ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-on-surface">{t.name.en}</span>
                  {saved.business_category === t.code && (
                    <span className="text-[10px] font-semibold uppercase text-primary flex items-center gap-1">
                      {categoryLocked && (
                        <span className="material-symbols-outlined text-xs" aria-hidden="true">
                          lock
                        </span>
                      )}
                      {categoryLocked ? 'Locked' : 'Current'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-outline mt-1">{t.field_count} fields</p>
                <p className="text-xs text-on-surface-variant mt-2 line-clamp-3">
                  {t.fields.map((f) => f.label.en).join(' · ')}
                </p>
              </button>
            );
          })}
        </div>

        {selected && (
          <details className="px-6 pb-5">
            <summary className="text-sm text-primary cursor-pointer">Preview the {selected.field_count} fields</summary>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {selected.fields.map((f) => (
                <li key={f.key} className="flex justify-between gap-3 border-b border-slate-100 py-1">
                  <span>{f.label.en}</span>
                  <span className="text-outline text-xs">
                    {FIELD_TYPE_LABELS[f.type]}
                    {f.unit ? ` (${f.unit})` : ''}
                    {f.variant_forming ? ' · variant' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
        </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-slate-200" aria-label="Region & languages">
        <div className={`px-6 py-4 ${regionIsOpen ? 'border-b border-slate-100' : ''}`}>
          <button
            type="button"
            aria-expanded={regionIsOpen}
            aria-controls="region-body"
            onClick={() => setRegionOpen(!regionIsOpen)}
            className="flex items-center gap-2 text-left w-full"
          >
            <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
              {regionIsOpen ? 'expand_more' : 'chevron_right'}
            </span>
            <span className="text-base font-semibold text-on-surface">
              Region & languages
              <span className="font-normal text-on-surface-variant">
                {' '}
                · {saved.timezone} · {saved.default_currency} · {(saved.languages ?? ['en']).map((l: Language) => LANGUAGE_LABELS[l]).join(', ')}
              </span>
              {(timezone !== saved.timezone || currency !== saved.default_currency || [...languages].sort().join() !== [...(saved.languages ?? ['en'])].sort().join()) && (
                <span className="ml-2 text-xs font-medium text-amber-700">changed — save to apply</span>
              )}
            </span>
          </button>
        </div>
        {regionIsOpen && (
        <div id="region-body">
        <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <label className="block text-sm">
            <span className="block font-medium text-on-surface mb-1.5">Time zone</span>
            <select className={inputClass} disabled={!isAdmin} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {[...new Set([timezone, ...TIME_ZONES])].map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block font-medium text-on-surface mb-1.5">Currency</span>
            <select className={inputClass} disabled={!isAdmin} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {[...new Set([currency, ...CURRENCIES])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="text-sm">
            <legend className="font-medium text-on-surface mb-1.5">Languages</legend>
            <div className="flex gap-4 py-2">
              {ALL_LANGUAGES.map((lang) => (
                <label key={lang} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={languages.includes(lang)}
                    disabled={!isAdmin || lang === 'en'}
                    onChange={() => toggleLanguage(lang)}
                  />
                  {LANGUAGE_LABELS[lang]}
                </label>
              ))}
            </div>
            <p className="text-xs text-outline">English is always on.</p>
          </fieldset>
        </div>
        {!saved.business_category && (
          <label className="px-6 pb-5 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={starterCategories}
              disabled={!isAdmin}
              onChange={(e) => setStarterCategories(e.target.checked)}
            />
            Create the starter categories for this business (shown on the Category Tree)
          </label>
        )}
        </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-slate-200" aria-label="Categories">
        <div className={`px-6 py-4 flex items-center justify-between gap-4 ${catOpen || modeError ? 'border-b border-slate-100' : ''}`}>
          <button
            type="button"
            aria-expanded={catOpen || Boolean(modeError)}
            aria-controls="categories-body"
            onClick={() => setCatOpen((o) => !o)}
            className="flex items-center gap-2 text-left min-w-0 flex-1"
          >
            <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
              {catOpen || modeError ? 'expand_more' : 'chevron_right'}
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-on-surface">
                Categories
                <span className="font-normal text-on-surface-variant"> · {savedMode === 'tree' ? 'Tree' : 'Flat list'}</span>
                {categoryMode !== savedMode && (
                  <span className="ml-2 text-xs font-medium text-amber-700">changing to {categoryMode === 'tree' ? 'Tree' : 'Flat list'} — save to apply</span>
                )}
              </span>
              <span className="block text-sm text-outline mt-0.5">A flat list by default. Switch the tree on to nest sub-categories, up to 5 levels deep.</span>
            </span>
          </button>
          <Button variant="outline" size="sm" onClick={() => navigate('/category-tree')}>
            Open Category Tree
          </Button>
        </div>
        {/* A refusal (e.g. switching the tree off while sub-categories exist) keeps it open. */}
        {(catOpen || modeError) && (
        <div className="px-6 py-5" id="categories-body">
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={categoryMode === 'tree'}
              aria-label="Use category tree"
              disabled={!isAdmin}
              onClick={() => {
                setCategoryMode((m) => (m === 'tree' ? 'flat' : 'tree'));
                setModeError(null);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                categoryMode === 'tree' ? 'bg-primary' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  categoryMode === 'tree' ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-on-surface">Use category tree</span>
          </div>
          <p className="text-xs text-outline mt-2">
            {categoryMode === 'tree'
              ? 'Categories can have sub-categories, which inherit their visible fields.'
              : 'Every category is at the top level.'}
            {categoryMode !== savedMode && ' Save to apply.'}
          </p>
          {modeError && (
            <div className="mt-3 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200" role="alert">
              <Icon name="block" size="sm" color="error" className="mt-0.5 shrink-0" />
              <p className="flex-1 text-sm text-error">{modeError}</p>
            </div>
          )}
        </div>
        )}
      </section>

      {confirming && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200" role="alert">
          <Icon name="warning" size="sm" className="mt-0.5 shrink-0 text-amber-700" />
          <p className="flex-1 text-sm text-on-surface">
            Change the business category to <strong>{selected?.name.en}</strong>? If products already exist, its fields are
            added to your attributes and nothing is removed. Otherwise your product fields are replaced.
          </p>
          <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void submit()}>
            Yes, change it
          </Button>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {result && <span className="text-sm text-secondary" role="status">{result}</span>}
        {blockedReason && <span className="text-sm text-outline">{blockedReason}</span>}
        <Button
          variant="primary"
          loading={saving}
          disabled={Boolean(blockedReason) || saving || confirming}
          onClick={() => void submit()}
        >
          Save business settings
        </Button>
      </div>
    </div>
  );
};

export default BusinessSettingsTab;
