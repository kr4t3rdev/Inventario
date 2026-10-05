import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/secrets';
import { assertDisposableDatabase } from '../../../../../../../../scripts/ci/disposable-database.mjs';
import { POST } from '../route';

assertDisposableDatabase(process.env);

const prefix = `g3-completar-${crypto.randomUUID()}`;
const originalMode = process.env.CONTABILIDAD_FORMAL_MODE;
const oldLastActive = new Date('2020-01-01T00:00:00.000Z');
let tenantId = '';
let planId = '';
let managerId = '';
let managerEmail = '';
let managerToken = '';
let noSessionToken = '';
let expiredToken = '';
let ordenExitoId = '';
let ordenAnonimaId = '';
let productoId = '';
let cuentaId = '';
let tipoPagoId = '';
let recetaId = '';
let almacenId = '';
let categoriaId = '';

/**
 * @description Construye un POST real hacia la ruta de completar producción.
 * @param {string | undefined} token - Token Bearer; undefined simula petición anónima.
 * @param {string} ordenId - Orden destino.
 * @returns {NextRequest} Request HTTP con el payload de cuenta/tipo de pago.
 */
function crearRequest(token: string | undefined, ordenId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/produccion/ordenes/${ordenId}/completar`,
    {
      method: 'POST',
      headers: token
        ? { authorization: `Bearer ${token}` }
        : { 'content-type': 'application/json' },
      body: JSON.stringify({ cuentaId, tipoPagoId }),
    },
  );
}

/**
 * @description Invoca el handler de completar producción con el wrapper real de autenticación.
 * @param {NextRequest} request - Request con o sin Bearer.
 * @param {string} ordenId - Orden que se intenta completar.
 * @returns {Promise<Response>} Respuesta HTTP del route.
 */
function invocar(request: NextRequest, ordenId: string): Promise<Response> {
  return POST(request, { params: Promise.resolve({ id: ordenId }) });
}

/**
 * @description Certifica la sesión HTTP real (G3) de `produccion/ordenes/[id]/completar`:
 * 401 sin Bearer, 401 con JWT sin sesión y 401 con sesión expirada, más el alta
 * completa con Bearer válido contra `userSession` (sin mock de auth-middleware).
 * El modo de posteo queda en `off`: el posteo en enforce ya está certificado por
 * `rollback-real.test.ts`.
 */
describe('completar producción — sesión HTTP real', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    const target = new URL(process.env.DATABASE_URL ?? '');
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1), port: Number(target.port),
    });
    process.env.CONTABILIDAD_FORMAL_MODE = 'off';

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const plan = await prisma.plan.create({
      data: { nombre: prefix, duracionDias: 365, features: { produccion: true } },
    });
    planId = plan.planId;
    await prisma.tenantLicense.create({ data: {
      tenantId, planId, expiracion: new Date('2099-01-01'),
    } });
    await prisma.moneda.upsert({
      where: { codigo: 'USD' },
      update: { isActive: true },
      create: { codigo: 'USD', nombre: 'Dólar', simbolo: '$', esPrincipal: false },
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'USD', updatedBy: prefix },
    });

    const manager = await prisma.user.create({
      data: { name: `${prefix}-manager`, email: `${prefix}-manager@test.local`, password: 'x' },
    });
    managerId = manager.userId;
    managerEmail = manager.email;
    await prisma.tenantMembership.create({
      data: { tenantId, userId: managerId, tenantRole: 'manager' },
    });

    managerToken = jwt.sign(
      { userId: managerId, email: managerEmail, tenantId },
      getJwtSecret(),
    );
    noSessionToken = jwt.sign(
      { userId: managerId, email: managerEmail, tenantId, jti: 'sin-sesion' },
      getJwtSecret(),
    );
    expiredToken = jwt.sign(
      { userId: managerId, email: managerEmail, tenantId, jti: 'sesion-expirada' },
      getJwtSecret(),
    );
    await prisma.userSession.create({ data: {
      userId: managerId, token: managerToken, lastActive: oldLastActive,
      expiresAt: new Date(Date.now() + 3_600_000),
    } });
    await prisma.userSession.create({ data: {
      userId: managerId, token: expiredToken, expiresAt: new Date(Date.now() - 1_000),
    } });

    const almacen = await prisma.almacen.create({ data: { tenantId, nombre: prefix } });
    almacenId = almacen.almacenId;
    const categoria = await prisma.categoria.create({ data: { tenantId, nombre: prefix } });
    categoriaId = categoria.catId;
    const productoFinal = await prisma.producto.create({
      data: {
        tenantId, nombre: `${prefix}-final`, categoriaId, almacenId,
        precioCosto: 0, precioVenta: 20, stock: 2,
      },
    });
    productoId = productoFinal.id;
    const insumo = await prisma.producto.create({
      data: {
        tenantId, nombre: `${prefix}-insumo`, categoriaId, almacenId,
        precioCosto: 10, precioVenta: 20, stock: 4,
      },
    });
    const receta = await prisma.receta.create({
      data: {
        recetaId: `${prefix}-receta`, tenantId, nombre: prefix, productoId,
        updatedAt: new Date(),
      },
    });
    recetaId = receta.recetaId;
    await prisma.recetaIngrediente.create({
      data: {
        id: `${prefix}-ingrediente`, tenantId, recetaId, productoId: insumo.id,
        cantidad: 1, unidadSimbolo: 'u', updatedAt: new Date(),
      },
    });
    ordenAnonimaId = `${prefix}-orden-anonima`;
    ordenExitoId = `${prefix}-orden-exito`;
    await prisma.ordenProduccion.createMany({
      data: [
        { ordenProduccionId: ordenAnonimaId, tenantId, recetaId, cantidad: 1,
          estado: 'EN_PROCESO', updatedAt: new Date() },
        { ordenProduccionId: ordenExitoId, tenantId, recetaId, cantidad: 1,
          estado: 'EN_PROCESO', updatedAt: new Date() },
      ],
    });
    const cuenta = await prisma.cuentaBancaria.create({
      data: {
        tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE',
        moneda: 'USD',
      },
    });
    cuentaId = cuenta.cuentaId;
    const tipo = await prisma.tipoPago.create({ data: { tenantId, nombre: prefix } });
    tipoPagoId = tipo.tipoId;
  });

  afterAll(async () => {
    if (originalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
    else process.env.CONTABILIDAD_FORMAL_MODE = originalMode;
    if (!tenantId) return;
    await prisma.ordenProduccionHistorial.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } });
    await prisma.ordenProduccion.deleteMany({ where: { tenantId } });
    await prisma.recetaIngrediente.deleteMany({ where: { tenantId } });
    await prisma.receta.deleteMany({ where: { tenantId } });
    await prisma.producto.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.categoria.deleteMany({ where: { tenantId } });
    await prisma.almacen.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.userSession.deleteMany({ where: { userId: managerId } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } });
    await prisma.plan.deleteMany({ where: { planId } });
    await prisma.user.deleteMany({ where: { userId: managerId } });
  });

  it('responde 401 sin Bearer y no toca la orden', async () => {
    const response = await invocar(crearRequest(undefined, ordenAnonimaId), ordenAnonimaId);

    expect(response.status).toBe(401);
    expect((await prisma.ordenProduccion.findUniqueOrThrow({
      where: { ordenProduccionId: ordenAnonimaId },
    })).estado).toBe('EN_PROCESO');
    expect(await prisma.ordenProduccionHistorial.count({
      where: { ordenProduccionId: ordenAnonimaId },
    })).toBe(0);
  });

  it('responde 401 con JWT firmado que no tiene sesión registrada', async () => {
    const response = await invocar(crearRequest(noSessionToken, ordenAnonimaId), ordenAnonimaId);

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('Sesión no válida');
    expect((await prisma.ordenProduccion.findUniqueOrThrow({
      where: { ordenProduccionId: ordenAnonimaId },
    })).estado).toBe('EN_PROCESO');
  });

  it('responde 401 con sesión expirada y la desactiva', async () => {
    const response = await invocar(crearRequest(expiredToken, ordenAnonimaId), ordenAnonimaId);

    expect(response.status).toBe(401);
    expect((await prisma.userSession.findUniqueOrThrow({
      where: { token: expiredToken },
    })).isActive).toBe(false);
  });

  it('completa la orden con sesión Bearer real y usa la identidad de la sesión', async () => {
    const response = await invocar(crearRequest(managerToken, ordenExitoId), ordenExitoId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.estado).toBe('COMPLETADA');
    expect(body.costoMateriales).toBe(10);

    const orden = await prisma.ordenProduccion.findUniqueOrThrow({
      where: { ordenProduccionId: ordenExitoId },
    });
    expect(orden.estado).toBe('COMPLETADA');
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stock).toBe(3);
    expect(await prisma.ordenProduccionHistorial.count({
      where: { ordenProduccionId: ordenExitoId, estadoNuevo: 'COMPLETADA', usuarioId: managerId },
    })).toBe(1);
    const reconciliacion = await prisma.reconciliacionGasto.findFirstOrThrow({
      where: { tenantId, referenciaId: ordenExitoId, tipoGasto: 'produccion' },
    });
    expect(reconciliacion.monto.toString()).toBe('10');
    expect(reconciliacion.reconciliadoPor).toBe(managerId);

    const session = await prisma.userSession.findUniqueOrThrow({
      where: { token: managerToken },
    });
    expect(session.lastActive.getTime()).toBeGreaterThan(oldLastActive.getTime());
  });
});
