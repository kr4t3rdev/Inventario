import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { z } from 'zod';
import { buildFunctionalValuation } from '@/features/contabilidad-formal/lib/functional-valuation';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { initialReceivablesContract } from './initial-receivables-contract';
import { parseCutoffDate } from './initialization-coordinator';

const requestSchema = z.object({
  tenantId: z.string().trim().min(1).max(200),
  inicializacionId: z.string().trim().min(1).max(200),
  fechaCorte: z.string().optional(),
  tasas: z.record(z.string()).optional(),
  cuentas: z.unknown(),
}).strict();

const EVIDENCE_SOURCE = 'INICIALIZACION_CONTABLE';

export type ValuedInitialReceivable = {
  referenciaFila: string;
  moneda: string;
  montoOriginal: string;
  tasaCambio: string | null;
  montoFuncional: string;
  fxEvidenceFingerprint: string | null;
};

/**
 * @description Persiste CxC iniciales en la transacción de la apertura, sin generar ventas ni cobros.
 * @remarks La frontera llamadora debe autenticar, autorizar, conciliar y confirmar el asiento.
 * Solo admite moneda funcional: la divisa extranjera requiere evidencia FX aún no implementada.
 * El llamador debe permitir que cualquier error revierta la transacción completa.
 * @param tx - Transacción abierta por el coordinador de inicialización.
 * @param input - Empresa, inicialización en progreso y cuentas externas declaradas.
 * @returns Número de cuentas persistidas; no implica que la apertura esté completa.
 */
export async function persistInitialReceivables(
  tx: Prisma.TransactionClient,
  input: unknown,
): Promise<{ count: number; totalFuncional: string; filas: ValuedInitialReceivable[] }> {
  const request = requestSchema.parse(input);
  const { cuentas } = initialReceivablesContract.parse({ cuentas: request.cuentas });
  const { tenantId, inicializacionId } = request;
  await acquireAccountingTenantLock(tx, tenantId);

  const initialization = await tx.inicializacionContable.findFirst({
    where: { inicializacionId, tenantId, estado: 'EN_PROGRESO' },
    select: { inicializacionId: true },
  });
  if (!initialization) throw new ActionError('Inicialización no encontrada o no disponible', 'INITIALIZATION_INCOMPLETE');
  const policy = await tx.tenantAccountingPolicy.findUnique({
    where: { tenantId }, select: { functionalCurrencyCode: true },
  });
  if (!policy) throw new ActionError('Falta la política contable de la empresa', 'ACCOUNTING_POLICY_REQUIRED');
  const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3,8}$/.test(functionalCurrency)) {
    throw new ActionError('La moneda funcional no es válida', 'ACCOUNTING_POLICY_REQUIRED');
  }
  const needsFx = cuentas.some((account) => account.moneda !== functionalCurrency);
  const fechaOperacion = request.fechaCorte ? parseCutoffDate(request.fechaCorte) : null;
  if (needsFx && (!fechaOperacion || Number.isNaN(fechaOperacion.getTime()))) {
    throw new ActionError('La CxC en divisa requiere valoración FX verificable', 'INITIALIZATION_FX_REQUIRED');
  }
  const valued = cuentas.map((account) => {
    const rate = account.tasaCambio ?? request.tasas?.[account.moneda];
    const valuation = buildFunctionalValuation({
      monto: Number(account.saldo),
      moneda: account.moneda,
      functionalCurrency,
      tasaCambio: rate === undefined ? null : Number(rate),
      fechaOperacion: fechaOperacion ?? new Date(0),
      source: EVIDENCE_SOURCE,
    });
    if (!valuation.sameCurrency && valuation.montoConvertido === null) {
      throw new ActionError('La CxC en divisa requiere valoración FX verificable', 'INITIALIZATION_FX_REQUIRED');
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
  const activeCurrency = await tx.moneda.findMany({
    where: { codigo: { in: [functionalCurrency] }, isActive: true }, select: { codigo: true },
  });
  if (activeCurrency.length !== 1 || activeCurrency[0].codigo !== functionalCurrency) {
    throw new ActionError('La moneda funcional no está activa', 'INITIALIZATION_CURRENCY_INVALID');
  }
  const clientIds = [...new Set(cuentas.map((account) => account.clienteId))];
  const clients = await tx.cliente.findMany({
    where: { tenantId, clienteId: { in: clientIds } }, select: { clienteId: true },
  });
  const validClients = new Set(clients.map((client) => client.clienteId));
  if (clientIds.some((clientId) => !validClients.has(clientId))) {
    throw new ActionError('Uno o más clientes no pertenecen a la empresa', 'INITIALIZATION_CLIENT_INVALID');
  }
  const created = await tx.cuentaPorCobrar.createMany({
    data: valued.map(({ account, montoFuncional, tasaCambio, rateEffectiveAt, fxProvenanceKind, fxEvidenceJson, fxEvidenceFingerprint }) => ({
      tenantId, inicializacionId, referenciaInicial: account.referenciaFila,
      referenciaExternaInicial: account.referenciaExterna ?? null,
      clienteId: account.clienteId, tipoCuenta: 'APERTURA_EXTERNA',
      facturaId: null, ventaServicioId: null, montoDeuda: account.saldo, montoOriginal: account.saldo,
      montoDeudaFuncional: montoFuncional, montoPagado: '0', montoPagadoFuncional: '0',
      monedaOriginal: account.moneda, monedaFuncional: functionalCurrency,
      tasaCambio, rateEffectiveAt, fxProvenanceKind,
      fxProvenanceSource: fxProvenanceKind === null ? null : EVIDENCE_SOURCE,
      fxEvidenceJson, fxEvidenceFingerprint, fxEvidenceVersion: fxEvidenceFingerprint === null ? null : 1,
      fechaVencimiento: account.fechaVencimiento ? new Date(`${account.fechaVencimiento}T00:00:00.000Z`) : null,
      estado: 'PENDIENTE',
    })),
  });
  if (created.count !== cuentas.length) {
    throw new ActionError('No se pudieron registrar todas las CxC', 'INITIALIZATION_INCOMPLETE');
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
