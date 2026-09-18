import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
/**
 * @description Formatea un monto como moneda. Por defecto CUP (retrocompatible);
 * acepta un código de moneda opcional (USD, MLC, ...).
 * @param {number} amount - Monto a formatear.
 * @param {string} [currency='CUP'] - Código ISO 4217 o moneda del sistema.
 * @returns {string} Monto formateado en locale es.
 */
export function formatCurrency(amount: number, currency: string = 'CUP'): string {
  return new Intl.NumberFormat('es', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyUsd(amount: number): string {
  return new Intl.NumberFormat('es', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
