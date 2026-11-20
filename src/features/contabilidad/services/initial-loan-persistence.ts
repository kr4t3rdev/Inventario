import { z } from 'zod';
import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { buildFunctionalValuation } from '@/features/contabilidad-formal/lib/functional-valuation';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { parseCutoffDate, type InitialLoanDetail } from './initialization-coordinator';

const requestSchema = z.object({
  tenantId: z.string().trim().min(1).max(200),
  inicializacionId: z.string().trim().min(1).max(200),
  fechaCorte: z.string(),
  tasas: z.record(z.string()).optional(),
  monedaFuncional: z.string().trim().min(1).max(8),
  cuentaPorCobrarId: z.string().trim().min(1).max(200),
  referenciaFila: z.string().trim().min(1).max(64),
  clienteId: z.string().trim().min(1).max(200),
  moneda: z.string().trim().min(1).max(8),
  saldo: z.string(),
  tasaCambio: z.string().optional(),
  tasaInteres: z.string(),
  tasaInteresMoratorio: z.string(),
  fechaVencimiento: z.string().optional(),
  usuarioId: z.string().trim().min(1).max(200),
}).strict();

const EVIDENCE_SOURCE = 'INICIALIZACION_CONTABLE';

/**
 * @description Persiste el wrapper PrestamoCash de un préstamo otorgado en
 * la inicialización, enlazado a la CxC ya creada: no hay desembolso ni
 * movimiento bancario, el dinero ya salió antes del corte. La política de
 * interés queda completa (versión 1, devengo desde el corte) para que el
 * principal restante se pueda actualizar con cada cobro por el writer.
 * @remarks El coordinador debe autorizar, conciliar y confirmar el asiento
 * en esta transacción. Cualquier error debe abortar la transacción completa.
 * @param tx - Transacción de la inicialización.
 * @param input - Tenant, inicialización, CxC marcada como préstamo y tasas.
 * @returns El detalle del préstamo para anclarlo en la apertura y el replay.
 */
export async function persistInitialLoan(
  tx: Prisma.TransactionClient,
  input: unknown,
): Promise<InitialLoanDetail> {
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
    throw new ActionError('El préstamo en divisa requiere valoración FX verificable', 'INITIALIZATION_FX_REQUIRED');
  }
  const cxc = await tx.cuentaPorCobrar.findFirst({
    where: {
      id: request.cuentaPorCobrarId, tenantId, inicializacionId,
      referenciaInicial: request.referenciaFila,
    },
    select: { id: true, clienteId: true, monedaOriginal: true, montoDeuda: true, montoDeudaFuncional: true },
  });
  if (!cxc || cxc.clienteId !== request.clienteId || cxc.monedaOriginal !== request.moneda) {
    throw new ActionError('CxC inicial no encontrada para el préstamo', 'INITIALIZATION_INCOMPLETE');
  }
  const existing = await tx.prestamoCash.findFirst({
    where: { cuentaPorCobrarId: request.cuentaPorCobrarId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (existing) throw new ActionError('El préstamo ya existe para esta cuenta', 'INITIALIZATION_INCOMPLETE');
  const rate = request.tasaCambio ?? request.tasas?.[request.moneda];
  const valuation = buildFunctionalValuation({
    monto: Number(request.saldo),
    moneda: request.moneda,
    functionalCurrency: currency,
    tasaCambio: rate === undefined ? null : Number(rate),
    fechaOperacion,
    source: EVIDENCE_SOURCE,
  });
  if (!valuation.sameCurrency && valuation.montoConvertido === null) {
    throw new ActionError('El préstamo en divisa requiere valoración FX verificable', 'INITIALIZATION_FX_REQUIRED');
  }
  const montoFuncional = valuation.sameCurrency
    ? request.saldo
    : new Prisma.Decimal(valuation.montoConvertido as number).toString();
  const fechaVencimiento = request.fechaVencimiento
    ? new Date(`${request.fechaVencimiento}T00:00:00.000Z`)
    : null;
  const prestamo = await tx.prestamoCash.create({
    data: {
      tenantId, clienteId: request.clienteId, cuentaPorCobrarId: request.cuentaPorCobrarId,
      montoCapital: request.saldo, moneda: request.moneda,
      tasaInteres: new Prisma.Decimal(request.tasaInteres),
      fechaOtorgamiento: fechaOperacion,
      fechaVencimiento,
      tasaCambioAlCrear: valuation.tasaCambio === null ? null : new Prisma.Decimal(valuation.tasaCambio),
      cuentaBancariaId: null,
      observaciones: 'Préstamo existente cargado en la inicialización',
      createdById: request.usuarioId, estado: 'ACTIVO',
      ordinaryAnnualRate: new Prisma.Decimal(request.tasaInteres),
      moratoryAnnualRate: new Prisma.Decimal(request.tasaInteresMoratorio),
      cashInterestPolicyVersion: 1,
      cashInterestGrantDate: fechaOperacion,
      cashInterestMaturityDate: fechaVencimiento,
      cashInterestAccruedThroughDate: fechaOperacion,
      cashInterestPrincipalRemaining: new Prisma.Decimal(request.saldo),
      cashInterestOrdinaryCarry: new Prisma.Decimal(0),
      cashInterestMoratoryCarry: new Prisma.Decimal(0),
    },
    select: { id: true },
  });
  return {
    cuentaPorCobrarId: request.cuentaPorCobrarId, prestamoCashId: prestamo.id,
    clienteId: request.clienteId, moneda: request.moneda,
    montoOriginal: request.saldo, montoFuncional,
  };
}
