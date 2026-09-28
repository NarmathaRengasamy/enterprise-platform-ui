import React, { useEffect } from 'react';
import { Badge, Button, Icon } from '../common';
import {
  AttributeValue,
  AvailabilityState,
  CatalogProduct,
  CommerceConfig,
  FieldDefinition,
  ItemPrice,
  PricingModel,
} from '../../types/catalog.types';

/**
 * Small pieces shared across the catalogue screens.
 *
 * They exist mainly to make one rule impossible to get wrong: a missing price
 * or a missing stock level is **not** a zero. v1 rendered both as "₹0" and
 * "Out of stock", which is why an unpriced dealership vehicle looked sold out.
 */

/* ---------------------------------------------------------------- money */

export const formatMoney = (amount: number | null | undefined, currency = 'INR'): string => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
};

/**
 * What a product's price reads as in a list.
 *
 * The four cases are genuinely different and must not collapse into one:
 * a range, a single price, an explicit "on request", and simply not priced yet.
 */
export const PriceRange: React.FC<{
  product: CatalogProduct;
  className?: string;
}> = ({ product, className = '' }) => {
  const { priceFrom, priceTo, currency = 'INR', commerce } = product;
  const model = commerce?.pricing.model;

  if (model === 'free') {
    return <span className={`font-semibold text-secondary ${className}`}>Free</span>;
  }

  if (typeof priceFrom !== 'number') {
    /* An `on_request` product is deliberately unpriced; anything else is
       simply incomplete. Saying which tells the user whether to act. */
    const isDeliberate = model === 'on_request';
    return (
      <span
        className={`font-medium ${isDeliberate ? 'text-on-surface' : 'text-on-surface-variant italic'} ${className}`}
      >
        {isDeliberate ? commerce?.pricing.label || 'Price on request' : 'Not priced'}
      </span>
    );
  }

  const suffix = commerce?.pricing.unit ? ` / ${commerce.pricing.unit}` : '';

  if (typeof priceTo === 'number' && priceTo !== priceFrom) {
    return (
      <span className={`font-semibold text-on-surface ${className}`}>
        {formatMoney(priceFrom, currency)} – {formatMoney(priceTo, currency)}
        <span className="text-on-surface-variant font-normal">{suffix}</span>
      </span>
    );
  }

  return (
    <span className={`font-semibold text-on-surface ${className}`}>
      {formatMoney(priceFrom, currency)}
      <span className="text-on-surface-variant font-normal">{suffix}</span>
    </span>
  );
};

export const ItemPriceLabel: React.FC<{ price?: ItemPrice | null; unit?: string }> = ({ price, unit }) => {
  if (!price) return <span className="text-on-surface-variant italic text-xs">Not priced</span>;
  return (
    <span className="font-semibold text-on-surface">
      {formatMoney(price.amount, price.currency)}
      {unit && <span className="text-on-surface-variant font-normal"> / {unit}</span>}
      {price.priceListId !== 'default' && (
        <Badge variant="outline" size="sm" className="ml-1.5">
          {price.priceListId}
        </Badge>
      )}
    </span>
  );
};

/* --------------------------------------------------------- availability */

/**
 * The availability pill.
 *
 * "Availability not tracked" is deliberately neutral, not a warning — no row
 * configured means nobody has said anything about stock, which is different
 * from having said there is none.
 */
export const AvailabilityPill: React.FC<{ state?: AvailabilityState; className?: string }> = ({
  state,
  className = '',
}) => {
  if (!state) return <span className={`text-on-surface-variant text-xs ${className}`}>—</span>;

  const untracked = state.label === 'Availability not tracked' || state.strategy === 'none';
  const variant = untracked ? 'outline' : state.available ? 'secondary' : 'error';

  return (
    <Badge variant={variant} size="sm" dot={!untracked} className={className}>
      {state.label}
    </Badge>
  );
};

export const ProductAvailabilityPill: React.FC<{ product: CatalogProduct }> = ({ product }) => {
  const label = product.availabilityLabel || '—';
  const untracked = label === 'Availability not tracked' || label === 'No items configured';
  return (
    <Badge variant={untracked ? 'outline' : product.available ? 'secondary' : 'error'} size="sm" dot={!untracked}>
      {label}
    </Badge>
  );
};

/* ---------------------------------------------------------- commerce */

const PRICING_ICON: Record<PricingModel, string> = {
  fixed: 'sell',
  per_unit: 'scale',
  per_time: 'schedule',
  per_variant: 'tune',
  tiered: 'stacked_bar_chart',
  on_request: 'contact_support',
  free: 'volunteer_activism',
};

/** A compact read-only summary of how a category sells. */
export const CommerceSummary: React.FC<{ commerce?: CommerceConfig; inherited?: boolean }> = ({
  commerce,
  inherited,
}) => {
  if (!commerce) return <span className="text-on-surface-variant text-xs italic">Not configured</span>;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge variant="primary" size="sm" icon={PRICING_ICON[commerce.pricing.model] || 'sell'}>
        {commerce.pricing.label || commerce.pricing.model.replace(/_/g, ' ')}
      </Badge>
      <Badge variant="tertiary" size="sm" icon="inventory">
        {commerce.availability.label || commerce.availability.model.replace(/_/g, ' ')}
      </Badge>
      {inherited && (
        <span className="text-[11px] text-on-surface-variant inline-flex items-center gap-0.5">
          <Icon name="subdirectory_arrow_right" size="xs" />
          inherited
        </span>
      )}
    </div>
  );
};

/* -------------------------------------------------------- attributes */

export const AttributeChips: React.FC<{
  attributes?: AttributeValue[];
  fields?: FieldDefinition[];
  max?: number;
}> = ({ attributes, fields, max }) => {
  const rows = attributes ?? [];
  if (!rows.length) return <span className="text-on-surface-variant text-xs">—</span>;

  const labelFor = new Map((fields ?? []).map((f) => [f.key, f.label]));
  const shown = typeof max === 'number' ? rows.slice(0, max) : rows;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map((a) => (
        <span
          key={a.key}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container text-[11px] text-on-surface-variant border border-outline-variant/40"
        >
          <span className="opacity-70">{labelFor.get(a.key) ?? a.key}</span>
          <span className="font-semibold text-on-surface">{a.value}</span>
        </span>
      ))}
      {typeof max === 'number' && rows.length > max && (
        <span className="text-[11px] text-on-surface-variant">+{rows.length - max}</span>
      )}
    </div>
  );
};

/* ------------------------------------------------------------ states */

export const EmptyState: React.FC<{
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mb-4">
      <Icon name={icon} size="xl" color="outline" />
    </div>
    <h3 className="text-base font-semibold text-on-surface mb-1">{title}</h3>
    {description && <p className="text-sm text-on-surface-variant max-w-md mb-4">{description}</p>}
    {action}
  </div>
);

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2.5 py-16 text-on-surface-variant">
    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
    <span className="text-sm font-medium">{label}</span>
  </div>
);

/**
 * The error banner.
 *
 * Server messages in v2 are written to be shown to a user — a 422 names the
 * field and the allowed values — so it is displayed verbatim rather than
 * replaced with something generic.
 */
export const ErrorBanner: React.FC<{ message?: string | null; onDismiss?: () => void }> = ({
  message,
  onDismiss,
}) => {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-error-container text-on-error-container border border-error/20 mb-4">
      <Icon name="error" size="sm" className="mt-0.5 shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
          <Icon name="close" size="sm" />
        </button>
      )}
    </div>
  );
};

export const SuccessBanner: React.FC<{ message?: string | null; onDismiss?: () => void }> = ({
  message,
  onDismiss,
}) => {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-secondary-fixed/40 text-on-secondary-fixed border border-secondary/20 mb-4">
      <Icon name="check_circle" size="sm" className="mt-0.5 shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
          <Icon name="close" size="sm" />
        </button>
      )}
    </div>
  );
};

/* ------------------------------------------------------------- inputs */

export const Field: React.FC<{
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, hint, required, children, className = '' }) => (
  <label className={`flex flex-col gap-1.5 ${className}`}>
    <span className="text-xs font-semibold text-on-surface-variant">
      {label}
      {required && <span className="text-error ml-0.5">*</span>}
    </span>
    {children}
    {hint && <span className="text-[11px] text-on-surface-variant/80">{hint}</span>}
  </label>
);

export const inputClass =
  'w-full px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-sm text-on-surface ' +
  'placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all';

export const selectClass = inputClass + ' cursor-pointer';

/**
 * A list of values built one at a time.
 *
 * Replaces a comma-separated box, which looked like a shortcut and was not: a
 * value containing a comma could not be typed at all, nothing showed you what
 * was already in the list, and removing the third of five meant editing a
 * string by hand. Here each value is a chip you can see and delete.
 *
 * Deduplication is case-insensitive and the **first** spelling wins, matching
 * what the server does when it stores an attribute — so the list cannot hold
 * `Blue` and `blue` side by side and then quietly merge them later.
 */
export const ValueListEditor: React.FC<{
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Offered as autocomplete — values already used elsewhere. */
  suggestions?: string[];
  autoFocus?: boolean;
  disabled?: boolean;
}> = ({ values, onChange, placeholder = 'Type a value and press Enter', suggestions, autoFocus, disabled }) => {
  const [draft, setDraft] = React.useState('');
  const listId = React.useId();

  const add = () => {
    const raw = draft.trim();
    if (!raw) return;
    if (!values.some((v) => v.toLowerCase() === raw.toLowerCase())) onChange([...values, raw]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className={inputClass}
          value={draft}
          list={suggestions?.length ? listId : undefined}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              /* Inside a form this would submit it. */
              e.preventDefault();
              add();
            }
            /* Backspace on an empty box takes the last chip back, which is
               what every tag input does and what a user will try. */
            if (e.key === 'Backspace' && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          placeholder={placeholder}
        />
        <Button variant="outline" onClick={add} disabled={disabled || !draft.trim()}>
          Add
        </Button>
      </div>

      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      ) : null}

      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-on-primary"
            >
              {value}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(values.filter((v) => v !== value))}
                className="w-4 h-4 rounded flex items-center justify-center hover:bg-on-primary/20"
                aria-label={`Remove ${value}`}
              >
                <Icon name="close" size="xs" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/** A confirm dialog. Used before anything destructive, however reversible. */
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, body, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/40">
          <h3 className="text-base font-semibold text-on-surface">{title}</h3>
        </div>
        <div className="px-5 py-4 text-sm text-on-surface-variant">{body}</div>
        <div className="px-5 py-3.5 bg-surface-container-low flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3.5 py-2 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
              danger ? 'bg-error text-on-error hover:bg-error/90' : 'bg-primary text-on-primary hover:bg-primary/90'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * The editor popup.
 *
 * Centred rather than a right-hand drawer: these are forms you fill in and
 * dismiss, so putting them in the middle keeps the fields under the cursor
 * instead of pinned to one edge of a wide screen, and it matches
 * `ConfirmDialog` so every interruption in the catalogue looks the same.
 *
 * The body scrolls on its own and the header and footer stay put, which keeps
 * the primary action visible on a long form.
 */
export const Modal: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}> = ({ open, title, subtitle, onClose, footer, children, width = 'max-w-lg' }) => {
  /* Escape closes it, and the page behind stops scrolling while it is open —
     without the lock, scrolling over the backdrop moves the list underneath. */
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${width} max-h-[85vh] bg-surface rounded-2xl shadow-2xl border border-outline-variant/40 flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-outline-variant/40 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-on-surface truncate">{title}</h3>
            {subtitle && <p className="text-xs text-on-surface-variant mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-8 h-8 rounded-lg hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="px-5 py-3.5 border-t border-outline-variant/40 bg-surface-container-low shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
