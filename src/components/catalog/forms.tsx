import React from 'react';
import { Icon } from '../common';
import { Field, inputClass, selectClass } from './primitives';
import {
  AttributeValue,
  AVAILABILITY_MODELS,
  CommerceConfig,
  DAY_KEYS,
  DAY_LABELS,
  FieldDefinition,
  PRICING_MODELS,
} from '../../types/catalog.types';

/**
 * Forms whose shape comes from configuration rather than from code.
 *
 * This is the point of v2 on the frontend: the product form is not written
 * per vertical, it is built from the `FieldDefinition[]` the tenant declared,
 * and the commerce form decides what the rest of the UI even shows.
 */

/* ------------------------------------------------- dynamic attributes */

export const AttributeInput: React.FC<{
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  /** Values other products already used, for an open choice field. */
  suggestions?: string[];
}> = ({ field, value, onChange, suggestions }) => {
  if (field.type === 'choice') {
    const options = field.options ?? [];

    /**
     * A choice field with no fixed list is an **open** one: the values are
     * decided per product rather than declared upfront. Rendering a `select`
     * for it produces a dropdown whose only entry is "Select…" — a control
     * that cannot be used and does not say why. It gets a text box instead,
     * with whatever other products have already typed offered as suggestions
     * so the same thing does not end up spelled three ways.
     */
    if (!options.length) {
      const listId = `vocab-${field.key}`;
      return (
        <>
          <input
            className={inputClass}
            list={suggestions?.length ? listId : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Type a ${field.label.toLowerCase()}`}
          />
          {suggestions?.length ? (
            <datalist id={listId}>
              {suggestions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          ) : null}
        </>
      );
    }

    return (
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'boolean') {
    return (
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  return (
    <input
      className={inputClass}
      type={field.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.type === 'number' ? '0' : `Enter ${field.label.toLowerCase()}`}
    />
  );
};

/**
 * The attribute block of a product form.
 *
 * Deprecated fields are hidden **unless the product already has a value** for
 * one — that value is real data and silently dropping the input would delete
 * it on the next save.
 */
export const AttributeFields: React.FC<{
  fields: FieldDefinition[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** 'product' shows the non variant-forming fields; 'item' shows the rest. */
  scope: 'product' | 'item';
  /** Per field key, values already in use elsewhere. Open choice fields only. */
  vocabulary?: Record<string, string[]>;
}> = ({ fields, values, onChange, scope, vocabulary }) => {
  const relevant = fields.filter((f) =>
    scope === 'item' ? f.variantForming : !f.variantForming
  );
  const visible = relevant.filter((f) => !f.deprecated || values[f.key]);

  if (!visible.length) {
    return (
      <p className="text-sm text-on-surface-variant italic py-2">
        {scope === 'item'
          ? 'This type has no variant-forming fields, so the product has a single item.'
          : 'This type declares no product-level fields.'}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      {visible.map((f) => (
        <Field
          key={f.key}
          label={f.label}
          required={f.required}
          hint={
            f.deprecated
              ? 'This field is retired — its value is kept but no longer offered'
              : f.type === 'choice' && !(f.options ?? []).length
                ? 'No fixed list — type any value. Spellings already used are reused automatically.'
                : undefined
          }
        >
          <AttributeInput
            field={f}
            value={values[f.key] ?? ''}
            onChange={(v) => onChange(f.key, v)}
            suggestions={vocabulary?.[f.key]}
          />
        </Field>
      ))}
    </div>
  );
};

/* ------------------------------------------------------ commerce form */

const EMPTY_COMMERCE: CommerceConfig = {
  pricing: { model: 'fixed', currency: 'INR' },
  availability: { model: 'quantity' },
};

/**
 * How a category sells.
 *
 * Only the fields the chosen strategy actually uses are rendered. Showing
 * `slotMinutes` next to a quantity model invites someone to fill it in and
 * wonder why nothing happens.
 */
export const CommerceConfigForm: React.FC<{
  value: CommerceConfig | null | undefined;
  onChange: (next: CommerceConfig | null) => void;
  /** What it would inherit if left unset — shown so "unset" is not a mystery. */
  inherited?: CommerceConfig;
}> = ({ value, onChange, inherited }) => {
  const enabled = Boolean(value);
  const cfg = value ?? inherited ?? EMPTY_COMMERCE;

  const patch = (next: Partial<CommerceConfig>) => onChange({ ...cfg, ...next } as CommerceConfig);

  const pricingMeta = PRICING_MODELS.find((m) => m.value === cfg.pricing.model);
  const availabilityMeta = AVAILABILITY_MODELS.find((m) => m.value === cfg.availability.model);

  const needsUnit = cfg.pricing.model === 'per_unit' || cfg.pricing.model === 'per_time';
  const needsSlot = cfg.availability.model === 'time_slot';
  const isBookable = needsSlot || cfg.availability.model === 'capacity_per_date';

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 accent-primary"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? { ...cfg } : null)}
        />
        <span className="flex-1">
          <span className="text-sm font-semibold text-on-surface block">Configure commerce here</span>
          <span className="text-xs text-on-surface-variant">
            {enabled
              ? 'This category and everything beneath it uses the settings below.'
              : inherited
                ? 'Off — this category inherits from its nearest configured ancestor.'
                : 'Off — nothing above declares commerce either, so defaults apply.'}
          </span>
        </span>
      </label>

      <fieldset disabled={!enabled} className={enabled ? '' : 'opacity-50 pointer-events-none'}>
        <div className="space-y-4">
          {/* ----------------------------------------------------- pricing */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide">Pricing</h4>

            <Field label="Model" hint={pricingMeta?.hint}>
              <select
                className={selectClass}
                value={cfg.pricing.model}
                onChange={(e) => patch({ pricing: { ...cfg.pricing, model: e.target.value as any } })}
              >
                {PRICING_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Label" hint='What the customer sees, e.g. "Ex-showroom"'>
                <input
                  className={inputClass}
                  value={cfg.pricing.label ?? ''}
                  onChange={(e) => patch({ pricing: { ...cfg.pricing, label: e.target.value } })}
                  placeholder={cfg.pricing.model === 'on_request' ? 'Price on request' : 'Price'}
                />
              </Field>

              <Field label="Currency">
                <input
                  className={inputClass}
                  value={cfg.pricing.currency ?? 'INR'}
                  onChange={(e) => patch({ pricing: { ...cfg.pricing, currency: e.target.value.toUpperCase() } })}
                  maxLength={3}
                />
              </Field>
            </div>

            {needsUnit && (
              <Field
                label="Unit"
                required
                hint='Required for this model — e.g. "night", "hour", "kg", "seat"'
              >
                <input
                  className={inputClass}
                  value={cfg.pricing.unit ?? ''}
                  onChange={(e) => patch({ pricing: { ...cfg.pricing, unit: e.target.value } })}
                  placeholder="night"
                />
              </Field>
            )}

            {cfg.pricing.model === 'on_request' && (
              <p className="text-xs text-on-surface-variant flex items-start gap-1.5 px-3 py-2 rounded-lg bg-surface-container">
                <Icon name="info" size="xs" className="mt-0.5 shrink-0" />
                Products here show an enquiry instead of a price. Any required charges are still
                listed and totalled separately.
              </p>
            )}
          </div>

          {/* ------------------------------------------------ availability */}
          <div className="space-y-3 pt-2 border-t border-outline-variant/40">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide">Availability</h4>

            <Field label="Model" hint={availabilityMeta?.hint}>
              <select
                className={selectClass}
                value={cfg.availability.model}
                onChange={(e) =>
                  patch({ availability: { ...cfg.availability, model: e.target.value as any } })
                }
              >
                {AVAILABILITY_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>

            {needsSlot && (
              <>
                <Field label="Slot length (minutes)" required hint="Required — a slot model with no length produces no bookable slots">
                  <input
                    className={inputClass}
                    type="number"
                    min={5}
                    step={5}
                    value={cfg.availability.slotMinutes ?? ''}
                    onChange={(e) =>
                      patch({
                        availability: {
                          ...cfg.availability,
                          slotMinutes: e.target.value ? Number(e.target.value) : undefined,
                        },
                      })
                    }
                    placeholder="60"
                  />
                </Field>

                <OpeningHoursEditor
                  value={cfg.availability.openingHours}
                  onChange={(openingHours) => patch({ availability: { ...cfg.availability, openingHours } })}
                />
              </>
            )}

            {isBookable && (
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-primary"
                  checked={Boolean(cfg.availability.requiresIncharge)}
                  onChange={(e) =>
                    patch({ availability: { ...cfg.availability, requiresIncharge: e.target.checked } })
                  }
                />
                <span className="flex-1">
                  <span className="text-sm font-medium text-on-surface block">Requires a named person</span>
                  <span className="text-xs text-on-surface-variant">
                    A booking must name a doctor, stylist or coach before it is accepted.
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>
      </fieldset>
    </div>
  );
};

/**
 * Opening hours, one row per day.
 *
 * A day with no entry is **closed**, not open all day — stated in the UI
 * because the opposite assumption would quietly offer Sunday appointments.
 */
export const OpeningHoursEditor: React.FC<{
  value?: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}> = ({ value, onChange }) => {
  const hours = value ?? {};

  const setDay = (day: string, open: string, close: string) => {
    const next = { ...hours };
    if (!open || !close) delete next[day];
    else next[day] = `${open}-${close}`;
    onChange(next);
  };

  const parse = (raw?: string): [string, string] => {
    if (!raw) return ['', ''];
    const [o, c] = raw.split('-').map((s) => s.trim());
    return [o ?? '', c ?? ''];
  };

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-on-surface-variant">Opening hours</span>
      <div className="rounded-xl border border-outline-variant/50 overflow-hidden divide-y divide-outline-variant/40">
        {DAY_KEYS.map((day) => {
          const [open, close] = parse(hours[day]);
          const isOpen = Boolean(open && close);
          return (
            <div key={day} className="flex items-center gap-2 px-3 py-2 bg-surface-container-lowest">
              <span className="w-24 text-xs font-medium text-on-surface shrink-0">{DAY_LABELS[day]}</span>
              <input
                type="time"
                className="flex-1 px-2 py-1.5 rounded-lg bg-surface-container text-xs border border-outline-variant/40 focus:outline-none focus:border-primary"
                value={open}
                onChange={(e) => setDay(day, e.target.value, close || '18:00')}
              />
              <span className="text-on-surface-variant text-xs">to</span>
              <input
                type="time"
                className="flex-1 px-2 py-1.5 rounded-lg bg-surface-container text-xs border border-outline-variant/40 focus:outline-none focus:border-primary"
                value={close}
                onChange={(e) => setDay(day, open || '09:00', e.target.value)}
              />
              <button
                type="button"
                onClick={() => setDay(day, '', '')}
                title="Closed"
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                  isOpen
                    ? 'text-on-surface-variant hover:bg-error-container hover:text-on-error-container'
                    : 'text-outline'
                }`}
              >
                <Icon name={isOpen ? 'close' : 'do_not_disturb_on'} size="xs" />
              </button>
            </div>
          );
        })}
      </div>
      <span className="text-[11px] text-on-surface-variant/80">
        A day left blank is closed — it produces no slots at all.
      </span>
    </div>
  );
};

/* ------------------------------------------------- attribute helpers */

export const attributesToMap = (attributes?: AttributeValue[]): Record<string, string> =>
  Object.fromEntries((attributes ?? []).map((a) => [a.key, a.value]));

/** Drops blanks: an empty value would be rejected by the server as invalid. */
export const mapToAttributes = (map: Record<string, string>): AttributeValue[] =>
  Object.entries(map)
    .filter(([, value]) => value !== '' && value !== undefined && value !== null)
    .map(([key, value]) => ({ key, value: String(value) }));
