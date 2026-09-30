/**
 * Money on the client.
 *
 * The API stores and returns whole minor units (paise) plus a currency — never
 * a decimal. These helpers are the only place rupees and paise are converted, so
 * no screen hard-codes `₹` or does its own arithmetic on prices.
 */

/** Rupees as typed by a person → paise. Returns `null` for an empty or unusable input. */
export const toMinor = (major: number | string | null | undefined): number | null => {
  if (major === null || major === undefined) return null;
  const text = typeof major === 'string' ? major.trim().replace(/,/g, '') : major;
  if (text === '') return null;
  const value = typeof text === 'number' ? text : Number(text);
  if (!Number.isFinite(value)) return null;
  /* Round the product, nudged by an epsilon so 1.005 becomes 101 paise, not 100. */
  return Math.round((value + Number.EPSILON * Math.sign(value)) * 100);
};

/** Paise → rupees, e.g. for pre-filling an input. `null` stays `null`. */
export const fromMinor = (minor: number | null | undefined): number | null =>
  typeof minor === 'number' && Number.isFinite(minor) ? minor / 100 : null;

/**
 * Paise → display string, e.g. `149900` → `₹1,499`, `12550` → `₹125.50`.
 *
 * `null` means "not priced" and is shown as such — never as ₹0 (design R27).
 */
export const formatMoney = (
  minor: number | null | undefined,
  currency = 'INR',
  notPricedLabel = 'Not priced'
): string => {
  if (typeof minor !== 'number' || !Number.isFinite(minor)) return notPricedLabel;
  const major = minor / 100;
  const hasPaise = minor % 100 !== 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: hasPaise ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    /* An unknown currency code must not take the page down. */
    return `${currency} ${major.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
};
