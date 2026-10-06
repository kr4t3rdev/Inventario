/**
 * @description Idempotencia en compras de servicios (C3/G2): `createCompraServicioAction`
 * rechaza la creación duplicada cuando se provee el mismo `numeroFactura`.
 * Sin factura no hay clave natural y se permite (comportamiento documentado).
 */
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: async () => undefined, logStrict: async () => undefined },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const prefix = `cta-compra-srv-${crypto.randomUUID()}`;
let tenantId = '';
let userId = '';
let servicioId = '';
let proveedorId = '';

const mockAuth = vi.hoisted(() => ({ userId: '', tenantId: '' }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => ({
    userId: mockAuth.userId, tenantId: mockAuth.tenantId, tenantRole: 'manager',
    role: 'manager',
    planFeatures: { servicios: true },
    permissions: new Set(['compras.servicios.crear']),
  }),
}));

const { createCompraServicioAction } = await import('@/features/compras-servicios/actions');

describe('compras-servicios — idempotencia por factura (C3/G2)', { timeout: 90_000 }, () => {
  it('prepara fixtures', async () => {
    const tenant = await prisma.tenant.create({
      data: { nombre: `${prefix}-t`, slug: `${prefix}-t` },
    });
    tenantId = tenant.tenantId;
    const user = await prisma.user.create({
      data: { name: `${prefix}-user`, email: `${prefix}@test.cu`, password: 'x' },
    });
    userId = user.userId;
    mockAuth.userId = userId;
    mockAuth.tenantId = tenantId;
    await prisma.tenantMembership.create({
      data: { tenantId, userId, tenantRole: 'manager' },
    });
    servicioId = (await prisma.servicios.create({
      data: { tenantId, nombre: `${prefix}-srv`, precio: 1000, descripcion: 'test', moneda: 'CUP' },
    })).servicioId;
    proveedorId = (await prisma.vendor.create({
      data: { tenantId, nombre: `${prefix}-prov` },
    })).vendorId;
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
    const hoy = new Date();
    const mesInicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const mesFin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59));
    await prisma.periodoContable.create({
      data: { tenantId, tipo: 'MENSUAL', estado: 'ABIERTO', fechaInicio: mesInicio, fechaFin: mesFin },
    });
    expect(tenantId).toBeTruthy();
  });

  it('rechaza la compra con factura duplicada (no duplica)', async () => {
    const factura = `FAC-${prefix.slice(0, 8)}`;
    // Pre-crear directamente vía prisma (el action completo requiere fixtures contables extensos).
    await prisma.compraServicio.create({
      data: {
        tenantId, servicioId, proveedorId, numeroFactura: factura,
        costoUnitario: 1000, cantidad: 1, total: 1000,
        moneda: 'CUP', formaPago: 'PAGO_COMPLETO', estado: 'PENDIENTE',
      },
    });

    const reintento = await createCompraServicioAction({
      servicioId, proveedorId, numeroFactura: factura,
      costoUnitario: 1000, cantidad: 1,
      formaPago: 'PAGO_COMPLETO' as const, estado: 'PENDIENTE' as const,
    });
    expect(reintento.success).toBe(false);
    expect(JSON.stringify(reintento)).toContain('COMPRA_SERVICIO_DUPLICADA');

    expect(await prisma.compraServicio.count({
      where: { tenantId, numeroFactura: factura },
    })).toBe(1);
  });
});
