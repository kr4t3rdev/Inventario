import { z } from 'zod';

const text = z.string().trim().min(1).max(200);
const amountPattern = /^\d{1,30}(?:\.\d{1,2})?$/;

/** @description Normaliza un decimal sin convertirlo a punto flotante. */
function normalizeAmount(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  const integer = whole.replace(/^0+(?=\d)/, '');
  const decimals = fraction.replace(/0+$/, '');
  return decimals ? `${integer}.${decimals}` : integer;
}

const amount = z.string().regex(amountPattern).refine((value) => {
  if (!amountPattern.test(value)) return false;
  const [whole, fraction = ''] = value.split('.');
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER)
    && normalizeAmount(Number(value).toFixed(2)) === normalizeAmount(value);
}, 'El saldo no puede almacenarse con precisión de centavos').transform(normalizeAmount);

const account = z.object({
  nombreCuenta: text,
  nombreBanco: text,
  numeroCuenta: text,
  tipoCuenta: z.enum(['CORRIENTE', 'AHORROS', 'EFECTIVO']),
  moneda: z.string().trim().transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3,8}$/)),
  saldo: amount,
  cuentaContableId: text,
}).strict();

/** @description Valida saldos bancarios declarados para una apertura, sin inferir su origen. */
export const initialBankDraftSchema = z.object({
  cuentas: z.array(account).min(1).max(100),
}).strict().superRefine(({ cuentas }, context) => {
  const seen = new Set<string>();
  cuentas.forEach((item, index) => {
    const key = item.numeroCuenta.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase();
    if (seen.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['cuentas', index, 'numeroCuenta'], message: 'La cuenta bancaria está repetida' });
    }
    seen.add(key);
  });
});

export type InitialBankDraft = z.output<typeof initialBankDraftSchema>;
