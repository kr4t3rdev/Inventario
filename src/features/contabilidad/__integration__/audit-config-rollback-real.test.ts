/**
 * @description R6-LOGS — la auditoría de configuración es atómica con su mutación.
 *
 * Los writers de configuración migrados (cierres, tipos de pago, cuentas bancarias
 * y monedas) escriben `AuditLog` con `logStrict(tx)` dentro de la misma transacción
 * que crea o modifica la entidad. Esta prueba demuestra en PostgreSQL aislado que:
 *
 * 1. Con la auditoría operativa, cada writer persiste la mutación Y su fila de
 *    `AuditLog`.
 * 2. Cuando el `INSERT` en `AuditLog` falla (trigger `BEFORE INSERT`), la mutación
 *    se revierte por completo y la operación reporta error, en lugar de quedar
 *    escrita sin auditoría.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { prisma } from '@/lib/prisma';

assertDisposableDatabase(process.env);

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const mockAuth = vi.hoisted(() => ({
  userId: `cfg-audit-${crypto.randomUUID()}`,
  tenantId: '',
}));

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => ({
    userId: mockAuth.userId,
    tenantId: mockAuth.tenantId,
    tenantRole: 'manager',
    role: 'admin',
    planFeatures: { contabilidad: true, 'multi-moneda': true },
    permissions: new Set(['financiero.tipos-pago.crear']),
  }),
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: async () => ({
    user: {
      userId: mockAuth.userId,
      tenantId: mockAuth.tenantId,
      tenantRole: 'manager',
      role: 'admin',
      planFeatures: { contabilidad: true, 'multi-moneda': true },
      permissions: new Set(['financiero.tipos-pago.crear']),
    },
  }),
}));

const { createCierreAction } = await import('@/features/contabilidad/actions-cierres');
const { createTipoPagoAction } = await import('@/features/contabilidad/actions-tipos-pago');
const { updateCuentaBancariaAction } = await import(
  '@/features/contabilidad/actions-cuentas-bancarias'
);
const { createMonedaAction } = await import('@/features/contabilidad/actions-exchange');
const { POST } = await import('@/app/api/contabilidad/tipos-pago/route');

const prefix = `cfg-audit-${crypto.randomUUID()}`;
let tenantId = '';
let cuentaId = '';
let auditTrigger = '';
let monedaCupCreada = false;
let secuencia = 0;

const siguiente = () => `${prefix}-${(secuencia += 1)}`;

interface CasoWriter {
  nombre: string;
  entidad: string;
  /** Observación estable que debe cambiar si la mutación se confirma. */
  snapshot: () => Promise<string>;
  /** Ejecuta el writer con entradas frescas y reporta si la operación tuvo éxito. */
  correr: () => Promise<boolean>;
}

const contarAudit = (entidad: string) =>
  prisma.auditLog.count({ where: { usuarioId: mockAuth.userId, entidad } });

const hoy = new Date();
const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
const finMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59));

/** @description Writers migrados a `logStrict` en la misma transacción que la mutación. */
const casos: CasoWriter[] = [
  {
    nombre: 'createCierreAction (actions-cierres)',
    entidad: 'CIERRE_CONTABLE',
    snapshot: async () =>
      String(await prisma.cierreContable.count({ where: { tenantId } })),
    correr: async () => {
      const r = await createCierreAction({
        tipo: 'MENSUAL',
        fechaInicio: inicioMes.toISOString(),
        fechaFin: finMes.toISOString(),
        creadoPor: siguiente(),
        observaciones: prefix,
      });
      return r.success === true;
    },
  },
  {
    nombre: 'createTipoPagoAction (actions-tipos-pago)',
    entidad: 'TIPO_PAGO',
    snapshot: async () => String(await prisma.tipoPago.count({ where: { tenantId } })),
    correr: async () => {
      const r = await createTipoPagoAction({
        nombre: siguiente(),
        requiereCuenta: false,
      });
      return r.success === true;
    },
  },
  {
    nombre: 'updateCuentaBancariaAction (actions-cuentas-bancarias)',
    entidad: 'CUENTA_BANCARIA',
    snapshot: async () =>
      (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).nombreBanco,
    correr: async () => {
      const r = await updateCuentaBancariaAction({ cuentaId, nombreBanco: siguiente() });
      return r.success === true;
    },
  },
  {
    nombre: 'createMonedaAction (actions-exchange)',
    entidad: 'MONEDA',
    snapshot: async () =>
      String(
        await prisma.moneda.count({
          where: { codigo: { startsWith: `${prefix}-`.toUpperCase() } },
        }),
      ),
    correr: async () => {
      const codigo = siguiente().toUpperCase();
      const r = await createMonedaAction({
        codigo,
        nombre: codigo,
        simbolo: '₮',
        esPrincipal: false,
      });
      return r.success === true;
    },
  },
  {
    nombre: 'POST /api/contabilidad/tipos-pago (API)',
    entidad: 'TIPO_PAGO',
    snapshot: async () => String(await prisma.tipoPago.count({ where: { tenantId } })),
    correr: async () => {
      const response = await POST(
        new NextRequest('http://localhost/api/contabilidad/tipos-pago', {
          method: 'POST',
          body: JSON.stringify({ nombre: siguiente(), requiereCuenta: false }),
        }),
      );
      return response.status === 201;
    },
  },
];

/** @description Prueba los writers de configuración contra PostgreSQL aislado. */
describe('R6-LOGS — auditoría atómica en writers de configuración', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    const target = new URL(process.env.DATABASE_URL ?? '');
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1),
      port: Number(target.port),
    });

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    mockAuth.tenantId = tenantId;
    const plan = await prisma.plan.create({
      data: {
        nombre: prefix,
        duracionDias: 365,
        features: { contabilidad: true, 'multi-moneda': true },
      },
    });
    await prisma.tenantLicense.create({
      data: { tenantId, planId: plan.planId, expiracion: new Date('2099-01-01') },
    });
    // `functionalCurrencyCode` referencia a Moneda: la DB desechable puede no tener CUP.
    if (!(await prisma.moneda.findUnique({ where: { codigo: 'CUP' } }))) {
      await prisma.moneda.create({
        data: { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true },
      });
      monedaCupCreada = true;
    }
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: mockAuth.userId },
    });
    cuentaId = (
      await prisma.cuentaBancaria.create({
        data: {
          tenantId,
          nombreBanco: `${prefix}-base`,
          numeroCuenta: `${prefix}-base`,
          tipoCuenta: 'CORRIENTE',
          moneda: 'CUP',
          saldo: 0,
        },
      })
    ).cuentaId;
    await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: inicioMes,
        fechaFin: finMes,
      },
    });
  });

  afterAll(async () => {
    if (auditTrigger) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${auditTrigger}" ON "AuditLog"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${auditTrigger}"()`);
      auditTrigger = '';
    }
    if (!tenantId) return;
    await prisma.auditLog.deleteMany({ where: { usuarioId: mockAuth.userId } });
    await prisma.cierreContable.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.moneda.deleteMany({
      where: { codigo: { startsWith: `${prefix}-`.toUpperCase() } },
    });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    if (monedaCupCreada) {
      await prisma.moneda.delete({ where: { codigo: 'CUP' } });
      monedaCupCreada = false;
    }
    await prisma.tenant.deleteMany({ where: { tenantId } });
    await prisma.plan.deleteMany({ where: { nombre: prefix } });
    tenantId = '';
  });

  it('persiste la mutación y su fila de AuditLog cuando la auditoría funciona', async () => {
    for (const caso of casos) {
      const auditAntes = await contarAudit(caso.entidad);
      const snapshotAntes = await caso.snapshot();

      expect(await caso.correr(), `${caso.nombre}: la operación debe tener éxito`).toBe(true);
      expect(await caso.snapshot(), `${caso.nombre}: la mutación debe persistirse`).not.toBe(
        snapshotAntes,
      );
      expect(await contarAudit(caso.entidad), `${caso.nombre}: debe quedar AuditLog`).toBe(
        auditAntes + 1,
      );
    }
  });

  it('revierte la mutación cuando el INSERT en AuditLog falla', async () => {
    auditTrigger = `cfg_audit_${crypto.randomUUID().replaceAll('-', '')}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${auditTrigger}"() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."usuarioId" = '${mockAuth.userId}' THEN
          RAISE EXCEPTION 'config audit rejected' USING ERRCODE = '22012';
        END IF;
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${auditTrigger}" BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "${auditTrigger}"()`);

    try {
      for (const caso of casos) {
        const auditAntes = await contarAudit(caso.entidad);
        const snapshotAntes = await caso.snapshot();

        expect(await caso.correr(), `${caso.nombre}: debe fallar con la auditoría bloqueada`).toBe(
          false,
        );
        expect(await caso.snapshot(), `${caso.nombre}: la mutación debe revertirse`).toBe(
          snapshotAntes,
        );
        expect(await contarAudit(caso.entidad), `${caso.nombre}: sin fila de auditoría`).toBe(
          auditAntes,
        );
      }
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${auditTrigger}" ON "AuditLog"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${auditTrigger}"()`);
      auditTrigger = '';
    }
  });
});
