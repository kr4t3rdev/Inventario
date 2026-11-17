import { z } from 'zod';

/**
 * @description Normaliza un importe decimal validado sin convertirlo a punto flotante.
 * @param value - Importe no negativo expresado como texto decimal.
 * @returns Importe canónico sin ceros redundantes.
 */
function normalizeAmount(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  const normalizedFraction = fraction.replace(/0+$/, '');
  return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
}

const requiredText = z.string().trim().min(1).max(200);
const amountPattern = /^\d{1,30}(?:\.\d{1,2})?$/;
const amount = z.string().regex(amountPattern).refine((value) => {
  if (!amountPattern.test(value)) return false;
  const [whole, fraction = ''] = value.split('.');
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER);
}, 'El importe excede el límite seguro de centavos')
  .refine((value) => !amountPattern.test(value) ||
    normalizeAmount(Number(value).toFixed(2)) === normalizeAmount(value),
  'El importe no puede almacenarse sin perder centavos')
  .transform(normalizeAmount);
const origin = z.object({
  tipo: z.enum(['CAPITAL_SOCIAL', 'PRESTAMO', 'ANTICIPO']),
  tercero: requiredText,
  tasaCambio: z.string().regex(/^\d+(?:\.\d{1,8})?$/)
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, 'La tasa debe ser mayor que cero')
    .optional(),
  tipoPagoId: requiredText.optional(),
}).strict().superRefine((value, context) => {
  if (value.tipo === 'ANTICIPO' && !value.tipoPagoId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['tipoPagoId'], message: 'Indique el tipo de pago del anticipo' });
  }
  if (value.tipo !== 'ANTICIPO' && value.tipoPagoId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['tipoPagoId'], message: 'El tipo de pago solo aplica a anticipos' });
  }
});

const account = z.object({
  nombreCuenta: requiredText,
  nombreBanco: requiredText,
  numeroCuenta: requiredText,
  tipoCuenta: requiredText,
  moneda: z.string().trim().transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3,8}$/)),
  saldoInicial: amount,
  origen: origin.optional(),
  origenNoDocumentado: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  const tieneOrigen = value.origen !== undefined;
  const origenNoDocumentado = value.origenNoDocumentado === true;
  if (value.saldoInicial !== '0' && tieneOrigen === origenNoDocumentado) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['origenNoDocumentado'],
      message: 'Indique el origen conocido o marque que no está documentado',
    });
  }
  if (value.saldoInicial === '0' && (tieneOrigen || origenNoDocumentado)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['origenNoDocumentado'],
      message: 'Una cuenta sin saldo no tiene origen inicial',
    });
  }
});

/** Contrato de entrada puro; la ejecución debe validar permisos, persistencia e idempotencia. */
export const initializationContract = z.object({
  idempotencyKey: z.string().trim().min(1).max(64),
  cuentas: z.array(account).min(1).max(100),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  value.cuentas.forEach((item, index) => {
    // Debe reflejar @@unique([tenantId, numeroCuenta]): PostgreSQL compara
    // los valores de texto exactamente, incluyendo mayúsculas y espacios internos.
    const key = item.numeroCuenta;
    if (seen.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['cuentas', index, 'numeroCuenta'], message: 'La cuenta bancaria está repetida' });
    }
    seen.add(key);
  });
});

export type InitializationInput = z.input<typeof initializationContract>;
export type InitializationData = z.output<typeof initializationContract>;
