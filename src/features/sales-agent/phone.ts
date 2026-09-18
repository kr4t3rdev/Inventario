import { z } from 'zod';

const PHONE_INPUT_PATTERN = /^\+?[\d\s().-]+$/;

/**
 * @description Normaliza y valida un teléfono de Gestor de Ventas.
 * @param {string} value - Teléfono recibido desde cliente o servidor.
 * @returns {string} Teléfono normalizado con 7 a 20 dígitos y prefijo opcional.
 */
export function normalizeSalesAgentPhone(value: string): string {
  const input = value.trim();
  if (!PHONE_INPUT_PATTERN.test(input)) {
    throw new Error('El teléfono contiene caracteres inválidos');
  }

  const hasInternationalPrefix = input.startsWith('+');
  const digits = input.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 20) {
    throw new Error('El teléfono debe contener entre 7 y 20 dígitos');
  }

  return `${hasInternationalPrefix ? '+' : ''}${digits}`;
}

export const salesAgentPhoneSchema = z
  .string()
  .transform((value, context) => {
    try {
      return normalizeSalesAgentPhone(value);
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : 'Teléfono inválido',
      });
      return z.NEVER;
    }
  });
