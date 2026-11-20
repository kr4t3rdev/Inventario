import { z } from 'zod';
import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { buildFunctionalValuation } from '@/features/contabilidad-formal/lib/functional-valuation';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { parseCutoffDate, type InitialDebtDetail } from './initialization-coordinator';

const requestSchema = z.object({
  tenantId: z.string().trim().min(1).max(200),
  inicializacionId: z.string().trim().min(1).max(200),
  fechaCorte: z.string(),
  tasas: z.record(z.string()).optional(),
  monedaFuncional: z.string().trim().min(1).max(8),
  numeroCuenta: z.string().trim().min(1).max(200),
  moneda: z.string().trim().min(1).max(8),
  saldoInicial: z.string(),
  tercero: z.string().trim().min(1).max(200),
  tasaCambio: z.string().optional(),
  proveedorId: z.string().trim().min(1).max(200),
  tasaInteres: z.string(),
  tasaInteresMoratorio: z.string(),
  fechaVencimiento: z.string().optional(),
  cuentaBancariaId: z.string().trim().min(1).max(200),
  inyeccionId: z.string().trim().min(1).max(200),
  usuarioId: z.string().trim().min(1).max(200),
}).strict();

const EVIDENCE_SOURCE = 'INICIALIZACION_CONTABLE';

/**
 * @description Persiste la CxP y el wrapper DeudaCash de una deuda recibida
 * en la inicialización, sin crear recepción ni movimiento bancario: el
 * dinero ya entró antes del corte y la cuenta se crea con el saldo completo.
 * La política de interés queda completa (versión 1, devengo desde el corte)
 * para que el pago por Deudas cash pueda valorar el interés.
 * @remarks El coordinador debe autorizar, conciliar y confirmar el asiento
 * en esta transacción. Cualquier error debe abortar la transacción completa.
 * @param tx - Transacción de la inicialización.
 * @param input - Tenant, inicialización y deuda declarada en el origen PRESTAMO.
 * @returns El detalle de la deuda para anclarlo en la apertura y el replay.
 */
export async function persistInitialDebt(
  tx: Prisma.TransactionClient,
  input: unknown,
): Promise<InitialDebtDetail> {
  const request = requestSchema.parse(input);
  const { tenantId, inicializacionId } = request;
  await acquireAccountingTenantLock(tx, tenantId);
  const initialization = await tx.inicializacionContable.findFirst({
    where: { inicializacionId, tenantId, estado: 'EN_PROGRESO' },
    select: { inicializacionId: true },
  });
  if (!initialization) throw new ActionError('Inicialización no disponible', 'INITIALIZATION_INCOMPLETE');
  const currency = request.monedaFuncional.trim().toUpperCase();
  const fechaOperacion = parseCutoffDate(request.fechaCorte);
  if (Number.isNaN(fechaOperacion.getTime())) {
    throw new ActionError('La deuda en divisa requiere valoración FX verificable', 'INITIALIZATION_FX_REQUIRED');
  }
  const rate = request.tasaCambio ?? request.tasas?.[request.moneda];
  const valuation = buildFunctionalValuation({
    monto: Number(request.saldoInicial),
    moneda: request.moneda,
    functionalCurrency: currency,
    tasaCambio: rate === undefined ? null : Number(rate),
    fechaOperacion,
    source: EVIDENCE_SOURCE,
  });
  if (!valuation.sameCurrency && valuation.montoConvertido === null) {
    throw new ActionError('La deuda en divisa requiere valoración FX verificable', 'INITIALIZATION_FX_REQUIRED');
  }
  const montoFuncional = valuation.sameCurrency
    ? request.saldoInicial
    : new Prisma.Decimal(valuation.montoConvertido as number).toString();
  const fxProvenanceKind = valuation.fxEvidence?.fxProvenanceKind ?? null;
  const vendor = await tx.vendor.findFirst({
    where: { vendorId: request.proveedorId, tenantId },
    select: { vendorId: true },
  });
  if (!vendor) throw new ActionError('El proveedor no pertenece a la empresa', 'INITIALIZATION_VENDOR_INVALID');
  const fechaVencimiento = request.fechaVencimiento
    ? new Date(`${request.fechaVencimiento}T00:00:00.000Z`)
    : null;
  const cxp = await tx.cuentaPorPagar.create({
    data: {
      tenantId, inicializacionId, referenciaInicial: `DEUDA:${request.numeroCuenta}`,
      referenciaExternaInicial: request.tercero,
      proveedorId: request.proveedorId, tipo: 'inicial_externa', numeroFactura: null,
      gastoCompraId: null, gastosDEId: null, fechaEmision: null,
      montoDeuda: request.saldoInicial, saldoPendiente: request.saldoInicial, montoDeudaFuncional: montoFuncional,
      montoPagado: '0', montoPagadoFuncional: '0', moneda: request.moneda,
      monedaOriginal: request.moneda, monedaFuncional: currency,
      tasaCambio: valuation.tasaCambio === null ? null : new Prisma.Decimal(valuation.tasaCambio).toString(),
      rateEffectiveAt: valuation.sameCurrency ? null : fechaOperacion,
      fxProvenanceKind,
      fxProvenanceSource: fxProvenanceKind === null ? null : EVIDENCE_SOURCE,
      fxEvidenceJson: valuation.fxEvidence === null ? Prisma.JsonNull : { ...valuation.fxEvidence },
      fxEvidenceFingerprint: valuation.fxEvidenceFingerprint,
      fxEvidenceVersion: valuation.fxEvidenceFingerprint === null ? null : 1,
      fechaVencimiento,
      estado: 'PENDIENTE',
    },
    select: { cuentaPorPagarId: true },
  });
  const deuda = await tx.deudaCash.create({
    data: {
      tenantId, proveedorId: request.proveedorId, cuentaPorPagarId: cxp.cuentaPorPagarId,
      inyeccionId: request.inyeccionId,
      montoCapital: request.saldoInicial, moneda: request.moneda,
      tasaInteres: new Prisma.Decimal(request.tasaInteres),
      fechaVencimiento,
      observaciones: 'Deuda existente cargada en la inicialización',
      createdById: request.usuarioId, cuentaBancariaId: request.cuentaBancariaId, estado: 'ACTIVO',
      ordinaryAnnualRate: new Prisma.Decimal(request.tasaInteres),
      moratoryAnnualRate: new Prisma.Decimal(request.tasaInteresMoratorio),
      cashInterestPolicyVersion: 1,
      cashInterestGrantDate: fechaOperacion,
      cashInterestMaturityDate: fechaVencimiento,
      cashInterestAccruedThroughDate: fechaOperacion,
      cashInterestPrincipalRemaining: new Prisma.Decimal(request.saldoInicial),
      cashInterestOrdinaryCarry: new Prisma.Decimal(0),
      cashInterestMoratoryCarry: new Prisma.Decimal(0),
    },
    select: { id: true },
  });
  return {
    cuentaPorPagarId: cxp.cuentaPorPagarId, deudaCashId: deuda.id, inyeccionId: request.inyeccionId,
    proveedorId: request.proveedorId, moneda: request.moneda,
    montoOriginal: request.saldoInicial, montoFuncional,
  };
}
