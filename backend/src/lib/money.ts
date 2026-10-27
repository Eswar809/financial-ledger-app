import { Decimal } from 'decimal.js';

// Configure Decimal for financial calculations
Decimal.set({
  precision: 36,
  rounding: Decimal.ROUND_HALF_UP,
  toExpPos: 40,
  toExpNeg: -40,
});

export const MONEY_REGEX = /^(0|[1-9]\d{0,14})(\.\d{1,4})?$/;
export const MAX_MONEY = new Decimal('999999999999999.9999'); // 15 whole digits, 4 decimals

/**
 * Validates and normalizes money input into a canonical 4-decimal-places string.
 * Rejects scientific notation, whitespace, leading zeros (except "0"), >4 decimals, and negatives.
 */
export function parseMoney(value: unknown): string {
  if (value === null || value === undefined) {
    throw new Error('Amount is required');
  }

  let str: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error('Amount must be a finite number');
    }
    if (Math.abs(value) >= 1e15) {
      throw new Error('Amount exceeds maximum supported precision');
    }
    str = value.toString();
  } else if (typeof value === 'string') {
    str = value;
  } else {
    throw new Error('Amount must be a string or number');
  }

  if (!MONEY_REGEX.test(str)) {
    throw new Error(
      'Amount must be a valid non-negative decimal string (e.g. "100.00" or "0.5000", max 4 decimal places, no scientific notation)',
    );
  }

  const dec = new Decimal(str);
  if (dec.isNegative()) {
    throw new Error('Amount must not be negative');
  }
  if (dec.decimalPlaces() > 4) {
    throw new Error('Amount exceeds maximum 4 decimal places');
  }
  if (dec.greaterThan(MAX_MONEY)) {
    throw new Error('Amount exceeds maximum allowed limit');
  }

  return dec.toFixed(4);
}

/**
 * Formats a money string or Decimal to canonical 4 decimal places.
 */
export function formatMoney(value: string | Decimal): string {
  const dec = value instanceof Decimal ? value : new Decimal(value);
  return dec.toFixed(4);
}

/**
 * Compares two money values: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareMoney(a: string, b: string): number {
  const decA = new Decimal(a);
  const decB = new Decimal(b);
  return decA.comparedTo(decB);
}

/**
 * Adds two money values.
 */
export function addMoney(a: string, b: string): string {
  return new Decimal(a).plus(new Decimal(b)).toFixed(4);
}

/**
 * Subtracts b from a.
 */
export function subMoney(a: string, b: string): string {
  return new Decimal(a).minus(new Decimal(b)).toFixed(4);
}

export { Decimal };
