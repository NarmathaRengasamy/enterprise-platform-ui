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

/**
 * Settings → Business & Products (Phase 1).
 *
 * The business category decides which product fields the tenant starts with:
 * choosing one pre-loads the product type; the admin then only adds extra
 * attributes (design §1). Saved on its own — the page's Save button belongs to
 * the workspace settings.
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
    } catch (e: any) {
      setLoadError(e.message || 'Could not load the business settings');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const dirty =
    !!saved &&
    (category !== (saved.business_category ?? '') ||
      timezone !== saved.timezone ||
      currency !== saved.default_currency ||
      languages.join() !== saved.languages.join());

  const changingCategory = !!saved?.business_category && category !== saved.business_category;

  const blockedReason = !isAdmin
    ? 'Only an Admin can change these'
    : !category
      ? 'Choose a business category'
      : !dirty
        ? 'No changes yet'
        : null;

  const selected = useMemo(() => templates.find((t) => t.code === category), [templates, category]);

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
    try {
      const { data, notice } = await businessService.save({
        business_category: category,
        timezone,
        default_currency: currency,
        languages,
        create_starter_categories: starterCategories,
      });
      setSaved(data.settings);
      setProductType(data.product_type);
      const text =
        notice ??
        (data.outcome === 'created' || data.outcome === 'replaced'
          ? `Your product fields are ready — ${data.product_type.fields.length} attributes loaded.`
          : 'Business settings saved.');
      setResult(text);
      onMessage(text, 'success');
    } catch (e: any) {
      onMessage(e.message || 'Could not save the business settings', 'error');
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
      <section className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-on-surface">Business category</h2>
            <p className="text-sm text-outline mt-0.5">
              Decides which product fields you start with. You can add your own attributes afterwards.
            </p>
          </div>
          {productType && (
            <Button variant="outline" size="sm" onClick={() => navigate('/attributes')}>
              Open Attributes
            </Button>
          )}
        </div>

        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-4" role="radiogroup" aria-label="Business category">
          {templates.map((t) => {
            const on = category === t.code;
            return (
              <button
                key={t.code}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!isAdmin}
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
                    <span className="text-[10px] font-semibold uppercase text-primary">Current</span>
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
      </section>

      <section className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-on-surface">Region & languages</h2>
        </div>
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
            Create the starter categories for this business (set up with Categories)
          </label>
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
