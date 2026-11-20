import { z } from 'zod';

const requiredText = z.string().trim().min(1).max(200);
const currency = z.string().trim().transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{3,8}$/));
const rate = z.string().regex(/^\d+(?:\.\d{1,8})?$/)
  .refine((value) => Number(value) > 0, 'La tasa debe ser mayor que cero');
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
  .refine((value) => !integerPattern.test(value) || BigInt(value) > BigInt(0), 'La cantidad debe ser mayor que cero')
  // Igual que el costo: "04" se normaliza a "4" para que la evidencia FIFO
  // coincida con String(cantidad) de la columna entera.
  .transform(normalizeDecimal);

const cost = z.string().regex(decimalPattern, 'El costo unitario no es válido')
  .transform(normalizeDecimal);

export const initialInventoryRowContract = z.object({
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
  tasas: z.record(z.string(), rate).optional(),
  inventario: z.array(initialInventoryRowContract).max(10000),
}).strict().superRefine((value, context) => {
  const keys = new Set<string>();
  const references = new Set<string>();
  value.inventario.forEach((item, index) => {
    if (item.fechaCorte !== undefined && item.fechaCorte !== value.fechaCorte) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inventario', index, 'fechaCorte'],
        message: 'La existencia debe usar la fecha de corte común',
      });
    }
    const hasValue = item.costoUnitario !== '0';
    if (hasValue && item.moneda !== value.monedaFuncional &&
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
    if (keys.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inventario', index, 'loteCodigo'],
        message: 'La existencia de producto, ubicación y lote está repetida',
      });
    }
    keys.add(key);
    if (references.has(item.referenciaFila)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inventario', index, 'referenciaFila'],
        message: 'La referencia de fila está repetida',
      });
    }
    references.add(item.referenciaFila);
  });
});

export type InitialInventoryInput = z.input<typeof initialInventoryContract>;
export type InitialInventoryData = z.output<typeof initialInventoryContract>;
export type InitialInventoryRow = InitialInventoryData['inventario'][number];
