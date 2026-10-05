import { describe, expect, it } from 'vitest';
import { formatMoney, fromMinor, toMinor } from './money';

describe('toMinor', () => {
  it('converts whole and decimal rupees', () => {
    expect(toMinor(1499)).toBe(149900);
    expect(toMinor('125.50')).toBe(12550);
    expect(toMinor('1,54,999.50')).toBe(15499950);
  });
  it('absorbs floating-point drift', () => expect(toMinor(0.1 + 0.2)).toBe(30));
  it('rounds half a paisa up', () => expect(toMinor(1.005)).toBe(101));
  it('keeps zero distinct from empty', () => {
    expect(toMinor(0)).toBe(0);
    expect(toMinor('')).toBeNull();
    expect(toMinor('   ')).toBeNull();
    expect(toMinor(null)).toBeNull();
    expect(toMinor(undefined)).toBeNull();
  });
  it('returns null for garbage', () => {
    expect(toMinor('abc')).toBeNull();
    expect(toMinor(Number.NaN)).toBeNull();
    expect(toMinor(Infinity)).toBeNull();
  });
});

describe('fromMinor', () => {
  it('converts back', () => expect(fromMinor(12550)).toBe(125.5));
  it('keeps null as null', () => expect(fromMinor(null)).toBeNull());
});

describe('formatMoney', () => {
  it('formats whole rupees without paise', () => expect(formatMoney(149900)).toBe('₹1,499'));
  it('formats paise with two decimals (not "12.5.00")', () => expect(formatMoney(1250)).toBe('₹12.50'));
  it('uses Indian grouping', () => expect(formatMoney(15499950)).toBe('₹1,54,999.50'));
  it('shows zero as ₹0, not as unpriced', () => expect(formatMoney(0)).toBe('₹0'));
  it('shows null as "Not priced", never ₹0', () => {
    expect(formatMoney(null)).toBe('Not priced');
    expect(formatMoney(undefined, 'INR', 'Price on request')).toBe('Price on request');
  });
  it('supports other currencies', () => expect(formatMoney(1000, 'USD')).toContain('10'));
  it('survives an invalid currency code', () => expect(formatMoney(1000, 'XX')).toBe('XX 10'));
});
