import { describe, expect, it } from 'vitest';
import { formatMoneyDisplay } from './utils.ts';

describe('formatMoneyDisplay', () => {
  it('formats standard decimal money strings with dollar signs and commas', () => {
    expect(formatMoneyDisplay('100.0000')).toBe('$100.0000');
    expect(formatMoneyDisplay('1234567.8901')).toBe('$1,234,567.8901');
    expect(formatMoneyDisplay('0.5000')).toBe('$0.5000');
  });

  it('pads missing decimal places to 4 decimals', () => {
    expect(formatMoneyDisplay('100')).toBe('$100.0000');
    expect(formatMoneyDisplay('100.5')).toBe('$100.5000');
  });

  it('handles zero gracefully', () => {
    expect(formatMoneyDisplay('0')).toBe('$0.0000');
    expect(formatMoneyDisplay('0.0000')).toBe('$0.0000');
  });

  it('handles negative values if provided', () => {
    expect(formatMoneyDisplay('-50.2500')).toBe('-$50.2500');
  });

  it('handles undefined or null', () => {
    expect(formatMoneyDisplay(undefined)).toBe('0.0000');
    expect(formatMoneyDisplay(null)).toBe('0.0000');
  });
});
