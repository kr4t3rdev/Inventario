import { z } from 'zod';

const requiredText = z.string().trim().min(1).max(200);
const monetaryValue = /^\d{1,16}(?:\.\d{1,4})?$/;

/**
 * @description Normaliza el importe decimal sin convertirlo a punto flotante.
 * @param value - Importe positivo validado.
 * @returns Importe en representación decimal canónica.
 */
function normalizeAmount(value: string): string {
  const [integer, fraction = ''] = value.split('.');
  const whole = integer.replace(/^0+(?=\d)/, '');
  const decimals = fraction.replace(/0+$/, '');
  return decimals ? `${whole}.${decimals}` : whole;
}

/**
 * @description Comprueba una fecha civil sin convertirla a fecha local.
 * @param value - Fecha en formato AAAA-MM-DD.
 * @returns Si corresponde a un día existente.
 */
function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const initialPayableRow = z.object({
  referenciaFila: z.string().trim().min(1).max(64),
  proveedorId: requiredText,
  referenciaExterna: requiredText.optional(),
  moneda: z.string().trim().transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3,8}$/)),
  saldo: z.string().regex(monetaryValue)
    .refine((value) => /[1-9]/.test(value), 'El saldo debe ser mayor que cero')
    .transform(normalizeAmount),
  fechaVencimiento: z.string().refine(isCivilDate, 'Indique una fecha válida').optional(),
  tasaCambio: z.string().regex(/^\d+(?:\.\d{1,8})?$/)
    .refine((value) => Number(value) > 0, 'La tasa debe ser mayor que cero')
    .optional(),
}).strict();

/**
 * @description Valida obligaciones externas sin requerir una compra o factura interna.
 * @remarks El servidor debe comprobar proveedor, permisos, valoración y persistencia.
 */
export const initialPayablesContract = z.object({
  cuentas: z.array(initialPayableRow).min(1).max(1000),
}).strict().superRefine(({ cuentas }, context) => {
  const references = new Set<string>();
  cuentas.forEach((account, index) => {
    if (references.has(account.referenciaFila)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cuentas', index, 'referenciaFila'],
        message: 'La referencia de fila está repetida',
      });
    }
    references.add(account.referenciaFila);
  });
});

export type InitialPayablesInput = z.input<typeof initialPayablesContract>;
export type InitialPayablesData = z.output<typeof initialPayablesContract>;
