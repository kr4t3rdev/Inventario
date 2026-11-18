import { z } from 'zod';

const requiredText = z.string().trim().min(1).max(200);
const currency = z.string().trim().transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{3,8}$/));
const decimalPattern = /^\d{1,24}(?:\.\d{1,4})?$/;
const integerPattern = /^\d{1,12}$/;

function normalizeDecimal(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  const normalizedFraction = fraction.replace(/0+$/, '');
  return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day;
  }, 'La fecha no es válida');

const quantity = z.string().regex(integerPattern, 'La cantidad debe ser un entero positivo')
  .refine((value) => !integerPattern.test(value) || BigInt(value) > 0n, 'La cantidad debe ser mayor que cero');

const cost = z.string().regex(decimalPattern, 'El costo unitario no es válido')
  .transform(normalizeDecimal);

const row = z.object({
  referenciaFila: requiredText,
  productoId: requiredText,
  almacenId: requiredText,
  ubicacionId: requiredText.optional(),
  loteCodigo: requiredText,
  cantidad: quantity,
  costoUnitario: cost,
  moneda: currency,
  fechaCorte: date.optional(),
  fechaVencimiento: date.optional(),
  tasaCambio: z.string().regex(/^\d+(?:\.\d{1,8})?$/)
    .refine((value) => Number(value) > 0, 'La tasa debe ser mayor que cero')
    .optional(),
}).strict();

/**
 * @description Contrato de existencias iniciales sin compras ni recepciones
 * sintéticas. Todas las filas comparten la fecha de corte de la carga.
 */
export const initialInventoryContract = z.object({
  fechaCorte: date,
  monedaFuncional: currency,
  inventario: z.array(row).max(10000),
}).strict().superRefine((value, context) => {
  const keys = new Set<string>();
  value.inventario.forEach((item, index) => {
    if (item.fechaCorte !== undefined && item.fechaCorte !== value.fechaCorte) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inventario', index, 'fechaCorte'],
        message: 'La existencia debe usar la fecha de corte común',
      });
    }
    const key = JSON.stringify([
      item.productoId,
      item.almacenId,
      item.ubicacionId ?? null,
      item.loteCodigo,
    ]);
    if (keys.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inventario', index, 'loteCodigo'],
        message: 'La existencia de producto, ubicación y lote está repetida',
      });
    }
    keys.add(key);
  });
});

export type InitialInventoryInput = z.input<typeof initialInventoryContract>;
export type InitialInventoryData = z.output<typeof initialInventoryContract>;
export type InitialInventoryRow = InitialInventoryData['inventario'][number];
