import { z } from 'zod';
import type { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { initialPayablesContract } from './initial-payables-contract';

const requestSchema = z.object({
  tenantId: z.string().trim().min(1).max(200),
  inicializacionId: z.string().trim().min(1).max(200),
  cuentas: z.unknown(),
}).strict();

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
): Promise<{ count: number }> {
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
  if (cuentas.some((account) => account.moneda !== currency)) {
    throw new ActionError('La CxP en divisa requiere valoración FX verificable', 'INITIALIZATION_FX_REQUIRED');
  }
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
    data: cuentas.map((account) => ({
      tenantId, inicializacionId, referenciaInicial: account.referenciaFila,
      referenciaExternaInicial: account.referenciaExterna ?? null,
      proveedorId: account.proveedorId, tipo: 'inicial_externa', numeroFactura: null,
      gastoCompraId: null, gastosDEId: null, fechaEmision: null,
      montoDeuda: account.saldo, saldoPendiente: account.saldo, montoDeudaFuncional: account.saldo,
      montoPagado: '0', montoPagadoFuncional: '0', moneda: currency,
      monedaOriginal: currency, monedaFuncional: currency,
      fechaVencimiento: account.fechaVencimiento ? new Date(`${account.fechaVencimiento}T00:00:00.000Z`) : null,
      estado: 'PENDIENTE',
    })),
  });
  if (created.count !== cuentas.length) {
    throw new ActionError('No se pudieron registrar todas las CxP', 'INITIALIZATION_INCOMPLETE');
  }
  return { count: created.count };
}
