import { z } from 'zod';
import { initialInventoryRowContract } from './initial-inventory-contract';

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
const currencyCode = z.string().trim().transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{3,8}$/));
const positiveRate = z.string().regex(/^\d+(?:\.\d{1,8})?$/)
  .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, 'La tasa debe ser mayor que cero');
const fechaCorte = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de corte debe tener formato aaaa-mm-dd')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }, 'La fecha de corte no es una fecha válida')
  .refine((value) => value <= new Date().toISOString().slice(0, 10), 'La fecha de corte no puede ser futura');
const tasas = z.record(z.string(), positiveRate)
  .superRefine((value, context) => {
    const seen = new Map<string, string>();
    for (const key of Object.keys(value)) {
      const normalized = key.trim().toUpperCase();
      if (seen.has(normalized)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `La tasa ${normalized} está duplicada` });
      }
      seen.set(normalized, key);
    }
  })
  .transform((value) => Object.fromEntries(Object.entries(value).map(([key, rate]) => [key.trim().toUpperCase(), rate])))
  .superRefine((value, context) => {
    for (const key of Object.keys(value)) {
      if (!/^[A-Z]{3,8}$/.test(key)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'La moneda de la tasa no es válida' });
      }
    }
  });
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
  tasaCambio: positiveRate.optional(),
  tipoPagoId: requiredText.optional(),
}).strict().superRefine((value, context) => {
  if (value.tipo === 'ANTICIPO' && !value.tipoPagoId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['tipoPagoId'], message: 'Indique el tipo de pago del anticipo' });
  }
  if (value.tipo !== 'ANTICIPO' && value.tipoPagoId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['tipoPagoId'], message: 'El tipo de pago solo aplica a anticipos' });
  }
});

const accountBase = z.object({
  nombreCuenta: requiredText,
  nombreBanco: requiredText,
  numeroCuenta: requiredText,
  tipoCuenta: requiredText,
  moneda: currencyCode,
  saldoInicial: amount,
  origen: origin.optional(),
  origenNoDocumentado: z.boolean().optional(),
}).strict();

const account = accountBase.superRefine((value, context) => {
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
export const initializationContractBase = z.object({
  idempotencyKey: z.string().trim().min(1).max(64),
  fechaCorte,
  monedaFuncional: currencyCode,
  tasas: tasas.optional(),
  cuentas: z.array(account).min(1).max(100),
  inventario: z.array(initialInventoryRowContract).max(10000).optional(),
}).strict();

export const initializationContract = initializationContractBase.superRefine((value, context) => {
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
  value.cuentas.forEach((item) => {
    if (item.saldoInicial !== '0' && item.moneda !== value.monedaFuncional
      && value.tasas?.[item.moneda] === undefined && item.origen?.tasaCambio === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tasas', item.moneda],
        message: 'Falta la tasa de cambio para ' + item.moneda + ' respecto a ' + value.monedaFuncional,
      });
    }
  });
  const inventoryKeys = new Set<string>();
  value.inventario?.forEach((item, index) => {
    if (item.fechaCorte !== undefined && item.fechaCorte !== value.fechaCorte) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inventario', index, 'fechaCorte'],
        message: 'La existencia debe usar la fecha de corte común',
      });
    }
    if (item.costoUnitario !== '0' && item.moneda !== value.monedaFuncional &&
      item.tasaCambio === undefined && value.tasas?.[item.moneda] === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inventario', index, 'tasaCambio'],
        message: `Falta la tasa de cambio para ${item.moneda}`,
      });
    }
    const key = JSON.stringify([
      item.productoId,
      item.almacenId,
      item.ubicacionId ?? null,
      item.loteCodigo,
    ]);
    if (inventoryKeys.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inventario', index, 'loteCodigo'],
        message: 'La existencia de producto, ubicación y lote está repetida',
      });
    }
    inventoryKeys.add(key);
  });
});

export type InitializationInput = z.input<typeof initializationContract>;
export type InitializationData = z.output<typeof initializationContract>;

/**
 * @description Borrador parcial de inicialización: permite guardar y retomar
 * una carga incompleta. La confirmación exige el contrato completo.
 */
export const initializationDraftContract = z.object({
  idempotencyKey: z.string().trim().min(1).max(64),
  fechaCorte: fechaCorte.optional(),
  monedaFuncional: currencyCode.optional(),
  tasas: tasas.optional(),
  cuentas: z.array(accountBase.deepPartial().strict()).max(100).optional(),
  inventario: z.array(initialInventoryRowContract.deepPartial()).max(10000).optional(),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  value.cuentas?.forEach((item, index) => {
    const numero = item.numeroCuenta;
    if (numero === undefined) return;
    if (seen.has(numero)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['cuentas', index, 'numeroCuenta'], message: 'La cuenta bancaria está repetida' });
    }
    seen.add(numero);
  });
});

export type InitializationDraftData = z.output<typeof initializationDraftContract>;
