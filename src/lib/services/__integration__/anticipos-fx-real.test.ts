/**
 * @description Filas 25/26 de la matriz R0.5 — anticipos:
 * 1) FX del builder: `createAnticipo` en moneda extranjera resuelve la tasa de
 *    catálogo y transmite monto funcional, tasa y fingerprint al evento
 *    (ANTICIPO_CLIENTE_RECIBIDO); sin esto `postEvento` rechaza con
 *    `VALORACION_FX_INCOMPLETA` y el anticipo no puede crearse;
 * 2) valoración aplicada: `applyAnticipoAllocations` con anticipo extranjero
 *    transmite la valoración aplicada con FX al evento ANTICIPO_*_APLICADO;
 * 3) permiso del canal web `/api/contabilidad/anticipos`: `requireFeature` +
 *    `requirePermission` antes de crear el anticipo (el canal móvil ya aplica
 *    el permiso de grupo vía el mapa mobile).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { createAnticipo, applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { POST as WEB_POST } from '@/app/api/contabilidad/anticipos/route';
import { POST as WEB_EXECUTE } from '@/app/api/contabilidad/anticipos/[id]/ejecutar/route';
import { POST as WEB_REVERT } from '@/app/api/contabilidad/anticipos/[id]/revertir/route';
import { POST as MOBILE_POST } from '@/app/api/mobile/v1/accounting/advances/route';
import { POST as MOBILE_EXECUTE } from '@/app/api/mobile/v1/accounting/advances/[id]/ejecutar/route';
import { POST as MOBILE_REVERT } from '@/app/api/mobile/v1/accounting/advances/[id]/revertir/route';
import { POST as LEGACY_POST } from '@/app/api/anticipos/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/secrets';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: async () => undefined,
    logStrict: async (params: {
      accion: string;
      entidad: string;
      entidadId: string;
      usuarioId: string;
      detalles?: Record<string, unknown>;
    }, client: { auditLog: { create: (args: unknown) => Promise<unknown> } }) =>
      client.auditLog.create({
        data: {
          accion: params.accion,
          entidad: params.entidad,
          entidadId: params.entidadId,
          usuarioId: params.usuarioId,
          detalles: params.detalles ?? {},
          ip: 'internal',
          userAgent: 'system',
        },
      }),
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const prefix = `cta-ant-fx-${crypto.randomUUID()}`;
let tenantId = '';
let userId = '';
let userIdDependente = '';
let token = '';
let tokenDependente = '';
let clienteId = '';
let contratoId = '';
let tasaId = '';
let cuentaId = '';
let tipoPagoId = '';
const admin = (targetTenantId: string) => ({
  userId: 'actor-ant-fx', role: 'admin', tenantId: targetTenantId,
  tenantRole: 'manager', planFeatures: { anticipos: true },
}) as never;

/** @description Solicitud POST al canal de anticipos con Bearer opcional. */
function requestAnticipo(url: string, body: Record<string, unknown>, bearer?: string): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('filas 25/26 — FX y permiso de anticipos', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '');
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1),
      port: Number(target.port),
    });
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    await prisma.moneda.upsert({
      where: { codigo: 'CUP' },
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
      update: {},
    });
    await prisma.moneda.upsert({
      where: { codigo: 'USD' },
      create: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' },
      update: {},
    });
    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: prefix },
    });
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: { 'contabilidad-formal': true, anticipos: true },
    } });
    const user = await prisma.user.create({
      data: { name: `${prefix}-user`, email: `${prefix}@test.local`, password: 'x' },
    });
    userId = user.userId;
    const dependiente = await prisma.user.create({
      data: { name: `${prefix}-dep`, email: `${prefix}-dep@test.local`, password: 'x' },
    });
    userIdDependente = dependiente.userId;
    await prisma.tenantMembership.createMany({
      data: [
        { tenantId, userId, tenantRole: 'manager' },
        { tenantId, userId: userIdDependente, tenantRole: 'dependiente' },
      ],
    });
    await prisma.tenantLicense.create({
      data: { tenantId, planId: plan.planId, activa: true, expiracion: new Date('2099-01-01') },
    });
    token = jwt.sign({ userId, email: user.email, tenantId }, getJwtSecret());
    tokenDependente = jwt.sign(
      { userId: userIdDependente, email: dependiente.email, tenantId },
      getJwtSecret(),
    );
    await prisma.userSession.createMany({
      data: [
        { userId, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
        { userId: userIdDependente, token: tokenDependente,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      ],
    });
    clienteId = (await prisma.cliente.create({
      data: { tenantId, nombre: `${prefix}-cliente` },
    })).clienteId;
    contratoId = (await prisma.contrato.create({
      data: {
        tenantId, numeroContrato: `${prefix}-c1`, numeroConsecutivo: 1, tipo: 'SERVICIO',
        estado: 'ACTIVO', clienteId, fechaInicio: new Date('2026-01-01'), creadoPor: userId,
      },
    })).contratoId;
    cuentaId = (await prisma.cuentaBancaria.create({
      data: { tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE',
        moneda: 'CUP' },
    })).cuentaId;
    tipoPagoId = (await prisma.tipoPago.create({
      data: { tenantId, nombre: prefix },
    })).tipoId;
    tasaId = (await prisma.tasaCambio.create({
      data: {
        monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: 24,
        fechaVigencia: new Date('2026-01-01T00:00:00Z'),
      },
    })).tasaId;
    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    const hoy = new Date();
    const mesInicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const mesFin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59));
    await prisma.periodoContable.create({
      data: { tenantId, tipo: 'MENSUAL', estado: 'ABIERTO', fechaInicio: mesInicio, fechaFin: mesFin },
    });
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    if (!tenantId) return;
    const anticipoIds = (await prisma.anticipo.findMany({
      where: { tenantId },
      select: { anticipoId: true },
    })).map((row) => row.anticipoId);
    await prisma.auditLog.deleteMany({
      where: { entidad: 'ANTICIPO', entidadId: { in: anticipoIds } },
    });
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.anticipoMovimiento.deleteMany({ where: { anticipo: { tenantId } } });
    await prisma.anticipo.deleteMany({ where: { tenantId } });
    await prisma.contrato.deleteMany({ where: { tenantId } });
    await prisma.tasaCambio.deleteMany({
      where: { tasaId },
    });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId } });
    await prisma.userSession.deleteMany({
      where: { userId: { in: [userId, userIdDependente].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { userId: { in: [userId, userIdDependente].filter(Boolean) } },
    });
    await prisma.plan.deleteMany({ where: { nombre: prefix } });
    await prisma.tenant.delete({ where: { tenantId } });
  });

  it('RED FX: anticipo extranjero resuelve tasa de catálogo y transmite evidencia', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId,
      tipo: 'COBRO',
      contratoId,
      clienteId,
      monto: 100,
      moneda: 'USD',
      usuarioId: userId,
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId,
    }));

    expect(anticipo.moneda).toBe('USD');
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo).toBe(2400);
    expect(anticipo.fxSnapshot).toMatchObject({
      originalCurrency: 'USD', functionalCurrency: 'CUP', functionalAmount: '2400',
      exchangeRate: '24', fxEvidenceVersion: 2,
    });
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'anticipo', origenId: anticipo.anticipoId,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.tasaCambio?.toString() === '24' && linea.fxEvidenceFingerprint)).toBe(true);
  });

  it('valoración aplicada del anticipo extranjero lleva FX al evento', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'COBRO', contratoId, clienteId, monto: 100,
      moneda: 'USD', usuarioId: userId,
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId,
    }));
    const newer = await prisma.tasaCambio.create({ data: {
      monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: 30, fechaVigencia: new Date(),
    } });
    try {
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo;
    const aplicados = await prisma.$transaction((tx) => applyAnticipoAllocations(tx, [{
      anticipoId: anticipo.anticipoId,
      montoAplicado: 40,
    }], {
      tenantId, documentoDestinoId: 'doc-1', contexto: 'COMPRA_SERVICIO', usuarioId: userId,
    }));
    expect(aplicados).toHaveLength(1);

    const movimiento = await prisma.anticipoMovimiento.findUniqueOrThrow({
      where: { movimientoId: aplicados[0].movimientoId },
    });
    expect(movimiento.tipoMovimiento).toBe('EJECUCION');
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo).toBe(saldoAntes);
    expect(movimiento.fxSnapshot).toMatchObject({
      originalAmount: '40', functionalAmount: '960', exchangeRate: '24',
    });
    const asiento = await prisma.asiento.findFirstOrThrow({ where: {
      tenantId, origenTipo: 'anticipo_movimiento', origenId: aplicados[0].movimientoId,
    }, include: { lineas: true } });
    expect(asiento.lineas.some((linea) =>
      linea.tasaCambio?.toString() === '24' && linea.fxEvidenceFingerprint)).toBe(true);
    } finally {
      await prisma.tasaCambio.delete({ where: { tasaId: newer.tasaId } });
    }
  });

  it('RED permiso: el canal web deniega un dependiente sin permiso', async () => {
    const response = await WEB_POST(requestAnticipo(
      'http://localhost/api/contabilidad/anticipos',
      { tipo: 'COBRO', contratoId, clienteId, monto: 50, moneda: 'CUP' },
      tokenDependente,
    ), {});
    expect(response.status, await response.clone().text()).toBe(403);
  });

  it('el canal móvil aplica el permiso de grupo al dependiente', async () => {
    const response = await MOBILE_POST(requestAnticipo(
      'http://localhost/api/mobile/v1/accounting/advances',
      { tipo: 'COBRO', contratoId, clienteId, monto: 50, moneda: 'CUP' },
      tokenDependente,
    ) as never);
    expect(response.status, await response.clone().text()).toBe(403);
  });

  it('web y móvil crean anticipo USD con sesión Bearer y valoración de fondos real', async () => {
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    const payload = {
      tipo: 'COBRO', contratoId, clienteId, monto: 10, moneda: 'USD',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId,
    };
    const web = await WEB_POST(requestAnticipo(
      'http://localhost/api/contabilidad/anticipos', payload, token,
    ), {});
    expect(web.status, await web.clone().text()).toBe(201);
    const webBody = await web.json();
    expect(webBody.anticipo.fxSnapshot).toMatchObject({
      originalCurrency: 'USD', functionalCurrency: 'CUP', exchangeRate: '24',
    });

    const mobile = await MOBILE_POST(requestAnticipo(
      'http://localhost/api/mobile/v1/accounting/advances', payload, token,
    ));
    expect(mobile.status, await mobile.clone().text()).toBe(201);
    const mobileBody = await mobile.json();
    expect(mobileBody.anticipo.fxSnapshot.fxEvidenceFingerprint).toBeTruthy();

    const legacy = await LEGACY_POST(requestAnticipo(
      'http://localhost/api/anticipos', payload, token,
    ), {});
    expect(legacy.status, await legacy.clone().text()).toBe(201);
    const legacyBody = await legacy.json();
    expect(legacyBody.anticipo.tenantId).toBe(tenantId);
    expect(legacyBody.anticipo.fxSnapshot.fxEvidenceFingerprint).toBeTruthy();

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toBe(Number(saldoAntes) + 720);
    expect(await prisma.asiento.count({ where: {
      tenantId, origenTipo: 'anticipo',
    } })).toBeGreaterThanOrEqual(4);
  });

  it('web y móvil bloquean ejecución/reversión manual sin tocar anticipos ni movimientos', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'COBRO', contratoId, clienteId, monto: 50, moneda: 'CUP',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }));
    const movimientosAntes = await prisma.anticipoMovimiento.count({
      where: { anticipoId: anticipo.anticipoId },
    });
    const saldoAntes = Number((await prisma.anticipo.findUniqueOrThrow({
      where: { anticipoId: anticipo.anticipoId },
    })).saldoDisponible);
    const executeBody = {
      contexto: 'FACTURA_DIRECTA', documentoDestinoId: `manual-${Date.now()}`,
      montoObjetivo: 50, monedaObjetivo: 'CUP', idempotencyKey: crypto.randomUUID(),
    };
    const reverseBody = { documentoDestinoId: `manual-reverse-${Date.now()}`, montoReverso: 50 };
    const webExecute = (authToken: string) => WEB_EXECUTE(requestAnticipo(
      `http://localhost/api/contabilidad/anticipos/${anticipo.anticipoId}/ejecutar`,
      executeBody, authToken,
    ), { params: Promise.resolve({ id: anticipo.anticipoId }) });
    const webReverse = (authToken: string) => WEB_REVERT(requestAnticipo(
      `http://localhost/api/contabilidad/anticipos/${anticipo.anticipoId}/revertir`,
      reverseBody, authToken,
    ), { params: Promise.resolve({ id: anticipo.anticipoId }) });
    const mobileExecute = (authToken: string) => MOBILE_EXECUTE(requestAnticipo(
      `http://localhost/api/mobile/v1/accounting/advances/${anticipo.anticipoId}/ejecutar`,
      executeBody, authToken,
    ), { params: Promise.resolve({ id: anticipo.anticipoId }) });
    const mobileReverse = (authToken: string) => MOBILE_REVERT(requestAnticipo(
      `http://localhost/api/mobile/v1/accounting/advances/${anticipo.anticipoId}/revertir`,
      reverseBody, authToken,
    ), { params: Promise.resolve({ id: anticipo.anticipoId }) });

    for (const response of await Promise.all([
      webExecute(token), webReverse(token), mobileExecute(token), mobileReverse(token),
    ])) {
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('DOCUMENT_WORKFLOW_REQUIRED');
    }
    for (const response of await Promise.all([
      webExecute(tokenDependente), webReverse(tokenDependente),
      mobileExecute(tokenDependente), mobileReverse(tokenDependente),
    ])) {
      expect(response.status).toBe(403);
    }

    const unchanged = await prisma.anticipo.findUniqueOrThrow({
      where: { anticipoId: anticipo.anticipoId },
    });
    expect(Number(unchanged.saldoDisponible)).toBe(saldoAntes);
    expect(unchanged.estado).toBe('RESERVADO');
    expect(await prisma.anticipoMovimiento.count({
      where: { anticipoId: anticipo.anticipoId },
    })).toBe(movimientosAntes);
  });

  it('reintentos concurrentes de creación mueven fondos una única vez', async () => {
    const input = { tenantId, tipo: 'COBRO' as const, contratoId, clienteId,
      monto: 100, moneda: 'USD', cuentaOrigenId: cuentaId,
      tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
      idempotencyKey: crypto.randomUUID() };
    const saldo = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    const [first, replay] = await Promise.all([
      prisma.$transaction((tx) => createAnticipo(tx, input)),
      prisma.$transaction((tx) => createAnticipo(tx, input)),
    ]);
    expect(replay.anticipoId).toBe(first.anticipoId);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toBe(saldo + 2400);
    expect(await prisma.asiento.count({ where: { tenantId,
      origenTipo: 'anticipo', origenId: first.anticipoId } })).toBe(1);
    await expect(prisma.$transaction((tx) => createAnticipo(tx, {
      ...input, monto: 200,
    }))).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('aplicar dos veces al mismo documento no consume el saldo ni postea otra vez', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'COBRO', contratoId, clienteId, monto: 100, moneda: 'USD',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }));
    const context = { tenantId, documentoDestinoId: crypto.randomUUID(),
      contexto: 'FACTURA_DIRECTA' as const, usuarioId: userId };
    const allocations = [{ anticipoId: anticipo.anticipoId, montoAplicado: 100 }];
    const [first, replay] = await Promise.all([
      prisma.$transaction((tx) => applyAnticipoAllocations(tx, allocations, context)),
      prisma.$transaction((tx) => applyAnticipoAllocations(tx, allocations, context)),
    ]);
    expect(replay[0].movimientoId).toBe(first[0].movimientoId);
    expect(await prisma.anticipoMovimiento.count({ where: {
      anticipoId: anticipo.anticipoId, tipoMovimiento: 'EJECUCION',
    } })).toBe(1);
    expect(await prisma.asiento.count({ where: { tenantId,
      origenTipo: 'anticipo_movimiento', origenId: first[0].movimientoId } })).toBe(1);
  });

  it('rechaza un snapshot alterado antes de consumir el anticipo', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'COBRO', contratoId, clienteId, monto: 100, moneda: 'USD',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }));
    await prisma.anticipo.update({ where: { anticipoId: anticipo.anticipoId }, data: {
      fxSnapshot: { ...(anticipo.fxSnapshot as Record<string, unknown>), exchangeRate: '30' },
    } });
    await expect(prisma.$transaction((tx) => applyAnticipoAllocations(tx, [{
      anticipoId: anticipo.anticipoId, montoAplicado: 40,
    }], { tenantId, documentoDestinoId: crypto.randomUUID(),
      contexto: 'FACTURA_DIRECTA', usuarioId: userId }))).rejects.toThrow();
    expect((await prisma.anticipo.findUniqueOrThrow({ where: {
      anticipoId: anticipo.anticipoId,
    } })).saldoDisponible.toString()).toBe('100');
  });

  it('un fallo SQL en el posteo revierte creación, movimiento inicial y fondos', async () => {
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `anticipo_create_fail_${suffix}`;
    const trigger = `anticipo_create_fail_${suffix}`;
    const saldo = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    const count = await prisma.anticipo.count({ where: { tenantId } });
    try {
      await prisma.$executeRawUnsafe(`CREATE FUNCTION "${fn}"() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."tenantId" = '${tenantId}' AND NEW."origenTipo" = 'anticipo' THEN
          RAISE EXCEPTION 'anticipo create rejected' USING ERRCODE = '22012';
        END IF; RETURN NEW; END $$`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "asientos"
        FOR EACH ROW EXECUTE FUNCTION "${fn}"()`);
      await expect(prisma.$transaction((tx) => createAnticipo(tx, {
        tenantId, tipo: 'COBRO', contratoId, clienteId, monto: 25, moneda: 'USD',
        cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
      }))).rejects.toThrow('anticipo create rejected');
      expect(await prisma.anticipo.count({ where: { tenantId } })).toBe(count);
      expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
        .toEqual(saldo);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"()`);
    }
  });

  it('un fallo SQL al aplicar revierte movimiento y saldo disponible', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'COBRO', contratoId, clienteId, monto: 100, moneda: 'USD',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }));
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `anticipo_apply_fail_${suffix}`;
    const trigger = `anticipo_apply_fail_${suffix}`;
    const disponible = (await prisma.anticipo.findUniqueOrThrow({
      where: { anticipoId: anticipo.anticipoId },
    })).saldoDisponible;
    const movimientosAntes = await prisma.anticipoMovimiento.count({
      where: { anticipoId: anticipo.anticipoId },
    });
    try {
      await prisma.$executeRawUnsafe(`CREATE FUNCTION "${fn}"() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."tenantId" = '${tenantId}' AND NEW."origenTipo" = 'anticipo_movimiento' THEN
          RAISE EXCEPTION 'anticipo apply rejected' USING ERRCODE = '22012';
        END IF; RETURN NEW; END $$`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "asientos"
        FOR EACH ROW EXECUTE FUNCTION "${fn}"()`);
      await expect(prisma.$transaction((tx) => applyAnticipoAllocations(tx, [{
        anticipoId: anticipo.anticipoId, montoAplicado: 40,
      }], { tenantId, documentoDestinoId: `rollback-${suffix}`,
        contexto: 'FACTURA_DIRECTA', usuarioId: userId })))
        .rejects.toThrow('anticipo apply rejected');
      expect((await prisma.anticipo.findUniqueOrThrow({
        where: { anticipoId: anticipo.anticipoId },
      })).saldoDisponible).toEqual(disponible);
      expect(await prisma.anticipoMovimiento.count({
        where: { anticipoId: anticipo.anticipoId },
      })).toBe(movimientosAntes);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"()`);
    }
  });
});
