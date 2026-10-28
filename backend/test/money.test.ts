import { describe, expect, it } from 'vitest';
import { addMoney, compareMoney, parseMoney, subMoney } from '../src/lib/money.js';

describe('Money utility functions', () => {
  describe('parseMoney', () => {
    it('parses valid integer strings to 4 decimals', () => {
      expect(parseMoney('100')).toBe('100.0000');
      expect(parseMoney('0')).toBe('0.0000');
      expect(parseMoney('1')).toBe('1.0000');
    });

    it('parses decimal strings accurately up to 4 places', () => {
      expect(parseMoney('100.5')).toBe('100.5000');
      expect(parseMoney('0.1')).toBe('0.1000');
      expect(parseMoney('123.4567')).toBe('123.4567');
      expect(parseMoney('0.0001')).toBe('0.0001');
    });

    it('parses safe finite numbers accurately', () => {
      expect(parseMoney(100)).toBe('100.0000');
      expect(parseMoney(100.5)).toBe('100.5000');
      expect(parseMoney(0.1)).toBe('0.1000');
    });

    it('rejects numbers exceeding 4 decimal places', () => {
      expect(() => parseMoney('0.00005')).toThrow();
      expect(() => parseMoney('10.12345')).toThrow();
      expect(() => parseMoney(0.30000000000000004)).toThrow(); // floating point artifact rejected
    });

    it('rejects negative numbers and negative zero', () => {
      expect(() => parseMoney('-1')).toThrow();
      expect(() => parseMoney('-0.01')).toThrow();
    });

    it('rejects scientific notation', () => {
      expect(() => parseMoney('1e3')).toThrow();
      expect(() => parseMoney('1E-4')).toThrow();
    });

    it('rejects whitespace and invalid formatting', () => {
      expect(() => parseMoney(' 100 ')).toThrow();
      expect(() => parseMoney('')).toThrow();
      expect(() => parseMoney('abc')).toThrow();
      expect(() => parseMoney('007')).toThrow(); // leading zeroes
      expect(() => parseMoney('01.50')).toThrow();
    });

    it('rejects null, undefined, NaN, Infinity', () => {
      expect(() => parseMoney(null)).toThrow();
      expect(() => parseMoney(undefined)).toThrow();
      expect(() => parseMoney(NaN)).toThrow();
      expect(() => parseMoney(Infinity)).toThrow();
    });
  });

  describe('arithmetic', () => {
    it('adds money precisely without float errors', () => {
      // 0.1 + 0.2 is famously 0.30000000000000004 in IEEE-754
      expect(addMoney('0.1000', '0.2000')).toBe('0.3000');
      expect(addMoney('99.9999', '0.0001')).toBe('100.0000');
    });

    it('subtracts money precisely', () => {
      expect(subMoney('100.0000', '30.0000')).toBe('70.0000');
      expect(subMoney('1.0000', '0.0001')).toBe('0.9999');
    });

    it('compares money correctly', () => {
      expect(compareMoney('100.0000', '50.0000')).toBe(1);
      expect(compareMoney('50.0000', '100.0000')).toBe(-1);
      expect(compareMoney('50.0000', '50.0000')).toBe(0);
    });
  });
});
