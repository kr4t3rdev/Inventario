/**
 * @description C4/G3: Sesión HTTP Bearer real en `produccion/ordenes/[id]/completar`.
 * Evidencia rechazo sin token (401) y éxito autenticado (200) sin mockear `withAuthPost`.
 */
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/secrets';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { POST } from '../route';

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: async () => undefined, logStrict: async () => undefined },
}));

const prefix = `cta-prod-auth-${crypto.randomUUID()}`;
let tenantId = '';
let userId = '';
let token = '';
let ordenId = '';
let cuentaId = '';
let tipoPagoId = '';

describe('completar producción — autenticación Bearer real (C4/G3)', { timeout: 90_000 }, () => {
  it('prepara fixtures', async () => {
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    const target = new URL(process.env.DATABASE_URL ?? '');
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1), port: Number(target.port),
    });
    expect(process.env.ALLOW_DISPOSABLE_TEST_DB).toBe('1');
    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: { 'contabilidad-formal': true, produccion: true },
    } });
    const user = await prisma.user.create({
      data: { name: `${prefix}-user`, email: `${prefix}@test.local`, password: 'x' },
    });
    userId = user.userId;
    await prisma.tenantMembership.create({
      data: { tenantId, userId, tenantRole: 'manager' },
    });
    await prisma.tenantLicense.create({
      data: { tenantId, planId: plan.planId, activa: true, expiracion: new Date('2099-01-01') },
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
    token = jwt.sign({ userId, email: user.email, tenantId }, getJwtSecret());
    await prisma.userSession.create({
      data: { userId, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    const hoy = new Date();
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59)),
    } });
    const categoriaId = (await prisma.categoria.create({
      data: { tenantId, nombre: `${prefix}-cat` },
    })).catId;
    const almacenId = (await prisma.almacen.create({
      data: { tenantId, nombre: `${prefix}-alm` },
    })).almacenId;
    const producto = await prisma.producto.create({ data: {
      tenantId, nombre: `${prefix}-final`, categoriaId, almacenId,
      precioCosto: 0, precioVenta: 20, stock: 0,
    } });
    const insumo = await prisma.producto.create({ data: {
      tenantId, nombre: `${prefix}-insumo`, categoriaId, almacenId,
      precioCosto: 10, precioVenta: 20, stock: 10,
    } });
    const receta = await prisma.receta.create({ data: {
      recetaId: `${prefix}-receta`, tenantId, nombre: prefix, productoId: producto.id,
      updatedAt: new Date(),
    } });
    await prisma.recetaIngrediente.create({ data: {
      id: `${prefix}-ing`, tenantId, recetaId: receta.recetaId, productoId: insumo.id,
      cantidad: 1, unidadSimbolo: 'u', updatedAt: new Date(),
    } });
    ordenId = (await prisma.ordenProduccion.create({ data: {
      ordenProduccionId: `${prefix}-orden`, tenantId, recetaId: receta.recetaId, cantidad: 1,
      estado: 'EN_PROCESO', updatedAt: new Date(),
    } })).ordenProduccionId;
    const cuenta = await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE', moneda: 'CUP', isActive: true,
    } });
    cuentaId = cuenta.cuentaId;
    const tipo = await prisma.tipoPago.create({ data: { tenantId, tipoId: `${prefix}-pago`, nombre: prefix, isActive: true } });
    tipoPagoId = tipo.tipoId;
    expect(ordenId).toBeTruthy();
  });

  it('rechaza sin token (401)', async () => {
    const response = await POST(
      new NextRequest(`http://localhost/api/produccion/ordenes/${ordenId}/completar`, {
        method: 'POST', body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: ordenId }) },
    );
    expect(response.status).toBe(401);
  });

  it('completa con Bearer válido (200)', async () => {
    const req = new NextRequest(`http://localhost/api/produccion/ordenes/${ordenId}/completar`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ cuentaId, tipoPagoId }),
    });
    const response = await POST(
      req as never,
      { params: Promise.resolve({ id: ordenId }) },
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await prisma.ordenProduccion.findUniqueOrThrow({
      where: { ordenProduccionId: ordenId },
    })).estado).toBe('COMPLETADA');
  });
});
