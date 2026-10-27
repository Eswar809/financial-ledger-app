import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a canonical 4-decimal money string with commas and clean currency styling.
 * Uses pure string manipulation — zero floats, zero parseFloat, zero Number precision loss.
 */
export function formatMoneyDisplay(raw: string | undefined | null): string {
  if (!raw) return '0.0000';

  const isNeg = raw.startsWith('-');
  const clean = isNeg ? raw.slice(1) : raw;

  const [intPart = '0', fracPart = '0000'] = clean.split('.');
  const paddedFrac = (fracPart + '0000').slice(0, 4);

  // Add commas to whole numbers
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = isNeg ? '-' : '';

  return `${sign}$${formattedInt}.${paddedFrac}`;
}
