import { z } from 'zod';
import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { buildFunctionalValuation } from '@/features/contabilidad-formal/lib/functional-valuation';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { initialPayablesContract } from './initial-payables-contract';
import { parseCutoffDate } from './initialization-coordinator';

const requestSchema = z.object({
  tenantId: z.string().trim().min(1).max(200),
  inicializacionId: z.string().trim().min(1).max(200),
  fechaCorte: z.string().optional(),
  tasas: z.record(z.string()).optional(),
  cuentas: z.unknown(),
}).strict();

const EVIDENCE_SOURCE = 'INICIALIZACION_CONTABLE';

export type ValuedInitialPayable = {
  referenciaFila: string;
  moneda: string;
  montoOriginal: string;
  tasaCambio: string | null;
  montoFuncional: string;
  fxEvidenceFingerprint: string | null;
};

/**
 * @description Persiste CxP en la transacción de apertura sin crear compra o pago.
 * @remarks El coordinador debe autorizar, conciliar y confirmar el asiento en esta
 * transacción. Solo admite moneda funcional; las divisas requieren evidencia FX.
 * Cualquier error debe abortar la transacción completa.
 * @param tx - Transacción de la inicialización.
 * @param input - Tenant, inicialización y obligaciones declaradas.
 * @returns Número de obligaciones persistidas, sin confirmar la apertura.
 */
export async function persistInitialPayables(
  tx: Prisma.TransactionClient,
  input: unknown,
): Promise<{ count: number; totalFuncional: string; filas: ValuedInitialPayable[] }> {
  const request = requestSchema.parse(input);
  const { cuentas } = initialPayablesContract.parse({ cuentas: request.cuentas });
  const { tenantId, inicializacionId } = request;
  await acquireAccountingTenantLock(tx, tenantId);
  const initialization = await tx.inicializacionContable.findFirst({
    where: { inicializacionId, tenantId, estado: 'EN_PROGRESO' },
    select: { inicializacionId: true },
  });
  if (!initialization) throw new ActionError('Inicialización no disponible', 'INITIALIZATION_INCOMPLETE');
  const policy = await tx.tenantAccountingPolicy.findUnique({
    where: { tenantId }, select: { functionalCurrencyCode: true },
  });
  const currency = policy?.functionalCurrencyCode.trim().toUpperCase();
  if (!currency || !/^[A-Z]{3,8}$/.test(currency)) {
    throw new ActionError('Falta una política contable válida', 'ACCOUNTING_POLICY_REQUIRED');
  }
  const needsFx = cuentas.some((account) => account.moneda !== currency);
  const fechaOperacion = request.fechaCorte ? parseCutoffDate(request.fechaCorte) : null;
  if (needsFx && (!fechaOperacion || Number.isNaN(fechaOperacion.getTime()))) {
    throw new ActionError('La CxP en divisa requiere valoración FX verificable', 'INITIALIZATION_FX_REQUIRED');
  }
  const valued = cuentas.map((account) => {
    const rate = account.tasaCambio ?? request.tasas?.[account.moneda];
    const valuation = buildFunctionalValuation({
      monto: Number(account.saldo),
      moneda: account.moneda,
      functionalCurrency: currency,
      tasaCambio: rate === undefined ? null : Number(rate),
      fechaOperacion: fechaOperacion ?? new Date(0),
      source: EVIDENCE_SOURCE,
    });
    if (!valuation.sameCurrency && valuation.montoConvertido === null) {
      throw new ActionError('La CxP en divisa requiere valoración FX verificable', 'INITIALIZATION_FX_REQUIRED');
    }
    const montoFuncional = valuation.sameCurrency
      ? account.saldo
      : new Prisma.Decimal(valuation.montoConvertido as number).toString();
    return {
      account,
      montoFuncional,
      tasaCambio: valuation.tasaCambio === null ? null : new Prisma.Decimal(valuation.tasaCambio).toString(),
      rateEffectiveAt: valuation.sameCurrency ? null : fechaOperacion,
      fxProvenanceKind: valuation.fxEvidence?.fxProvenanceKind ?? null,
      fxEvidenceJson: valuation.fxEvidence === null ? Prisma.JsonNull : { ...valuation.fxEvidence },
      fxEvidenceFingerprint: valuation.fxEvidenceFingerprint,
    };
  });
  const totalFuncional = valued.reduce(
    (total, row) => total.add(new Prisma.Decimal(row.montoFuncional)),
    new Prisma.Decimal(0),
  ).toString();
  const active = await tx.moneda.findMany({
    where: { codigo: { in: [currency] }, isActive: true }, select: { codigo: true },
  });
  if (active.length !== 1 || active[0].codigo !== currency) {
    throw new ActionError('La moneda funcional no está activa', 'INITIALIZATION_CURRENCY_INVALID');
  }
  const vendorIds = [...new Set(cuentas.map((account) => account.proveedorId))];
  const vendors = await tx.vendor.findMany({
    where: { tenantId, vendorId: { in: vendorIds } }, select: { vendorId: true },
  });
  const validVendors = new Set(vendors.map((vendor) => vendor.vendorId));
  if (vendorIds.some((vendorId) => !validVendors.has(vendorId))) {
    throw new ActionError('Uno o más proveedores no pertenecen a la empresa', 'INITIALIZATION_VENDOR_INVALID');
  }
  const created = await tx.cuentaPorPagar.createMany({
    data: valued.map(({ account, montoFuncional, tasaCambio, rateEffectiveAt, fxProvenanceKind, fxEvidenceJson, fxEvidenceFingerprint }) => ({
      tenantId, inicializacionId, referenciaInicial: account.referenciaFila,
      referenciaExternaInicial: account.referenciaExterna ?? null,
      proveedorId: account.proveedorId, tipo: 'inicial_externa', numeroFactura: null,
      gastoCompraId: null, gastosDEId: null, fechaEmision: null,
      montoDeuda: account.saldo, saldoPendiente: account.saldo, montoDeudaFuncional: montoFuncional,
      montoPagado: '0', montoPagadoFuncional: '0', moneda: account.moneda,
      monedaOriginal: account.moneda, monedaFuncional: currency,
      tasaCambio, rateEffectiveAt, fxProvenanceKind,
      fxProvenanceSource: fxProvenanceKind === null ? null : EVIDENCE_SOURCE,
      fxEvidenceJson, fxEvidenceFingerprint, fxEvidenceVersion: fxEvidenceFingerprint === null ? null : 1,
      fechaVencimiento: account.fechaVencimiento ? new Date(`${account.fechaVencimiento}T00:00:00.000Z`) : null,
      estado: 'PENDIENTE',
    })),
  });
  if (created.count !== cuentas.length) {
    throw new ActionError('No se pudieron registrar todas las CxP', 'INITIALIZATION_INCOMPLETE');
  }
  return {
    count: created.count,
    totalFuncional,
    filas: valued.map(({ account, montoFuncional, tasaCambio, fxEvidenceFingerprint }) => ({
      referenciaFila: account.referenciaFila,
      moneda: account.moneda,
      montoOriginal: account.saldo,
      tasaCambio,
      montoFuncional,
      fxEvidenceFingerprint,
    })),
  };
}
