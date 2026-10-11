/**
 * @description Evidencia física de los gaps G5 de actions, finales móviles y carreras legacy.
 * Auth de actions controlada; wrappers, schemas, guard, Prisma, posting y AuditLog reales.
 * Los handlers HTTP usan JWT, sesión, membresía y licencia persistidos.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { ActionResponse } from '@/lib/server-actions/types';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/secrets';
import * as periodValidation from '@/lib/services/validate-period-write';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { AccountingCashOperationsMutationService as cash } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { POST as mobileLoanPayment } from '@/app/api/mobile/v1/accounting/cash-loans/[id]/payments/route';
import { POST as mobileDebtPayment } from '@/app/api/mobile/v1/accounting/cash-debts/[id]/payments/route';
import { POST as legacyLoanCreate } from '@/app/api/contabilidad/prestamos-cash/route';
import { POST as legacyDebtCreate } from '@/app/api/contabilidad/deudas-cash/route';
import { POST as legacyLoanPayment } from '@/app/api/contabilidad/prestamos-cash/[id]/pagar/route';
import { POST as legacyDebtPayment } from '@/app/api/contabilidad/deudas-cash/[id]/pagar/route';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => auth.user,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { createPrestamoCashAction, registrarPagoPrestamoAction } = await import(
  '@/features/contabilidad/actions-prestamos-cash'
);
const { createDeudaCashAction, registrarPagoDeudaAction } = await import(
  '@/features/contabilidad/actions-deudas-cash'
);
type Kind = 'loan' | 'debt';
const kinds = ['loan', 'debt'] as const;
const prefix = `g5-${crypto.randomUUID()}`;
let tenantId = '';
let userId = '';
let planId = '';
let clienteId = '';
let proveedorId = '';
let bankId = '';
let tipoPagoId = '';
let token = '';

/** @description Exige éxito real del wrapper. @param result Resultado. @returns Datos. */
function unwrap<T>(result: ActionResponse<T>): T {
  expect(result.success, JSON.stringify(result)).toBe(true);
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

/** @description Input de alta por entidad. @param key Clave. @returns Payload base. */
function createInput(key: string) {
  return { montoCapital: 20, moneda: 'CUP', cuentaBancariaId: bankId, idempotencyKey: key };
}

/** @description Invoca la action de alta real. @param kind Entidad. @param key Clave.
 * @param amount Importe. @returns Resultado del wrapper. */
async function createAction(kind: Kind, key: string, amount = 20) {
  const input = { ...createInput(key), montoCapital: amount };
  return kind === 'loan'
    ? createPrestamoCashAction({ ...input, clienteId })
    : createDeudaCashAction({ ...input, proveedorId });
}

/** @description Invoca pago por action real. @param kind Entidad. @param id Origen.
 * @param key Clave. @param amount Importe. @returns Resultado del wrapper. */
async function payAction(kind: Kind, id: string, key: string, amount: number) {
  const input = { id, monto: amount, cuentaId: bankId, tipoPagoId, idempotencyKey: key };
  return kind === 'loan'
    ? registrarPagoPrestamoAction(input)
    : registrarPagoDeudaAction(input);
}

/** @description Cierra exclusivamente el período fixture y borra su caché.
 * @returns Confirmación de la actualización. */
async function closePeriod() {
  await prisma.periodoContable.updateMany({ where: { tenantId }, data: { estado: 'CERRADO' } });
  await prisma.periodoCache.deleteMany({ where: { tenantId } });
}

/** @description Snapshot financiero completo y determinista del fixture.
 * @returns Estado serializado de fondos, obligaciones, movimientos, posting y auditoría. */
async function snapshot() {
  const rows = await Promise.all([
    prisma.cuentaBancaria.findMany({ where: { tenantId }, orderBy: { cuentaId: 'asc' } }),
    prisma.prestamoCash.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
    prisma.deudaCash.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
    prisma.cuentaPorCobrar.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
    prisma.cuentaPorPagar.findMany({ where: { tenantId }, orderBy: { cuentaPorPagarId: 'asc' } }),
    prisma.reconciliacionVenta.findMany({ where: { tenantId }, orderBy: { reconciliacionId: 'asc' } }),
    prisma.asiento.findMany({ where: { tenantId }, orderBy: { asientoId: 'asc' },
      include: { lineas: { orderBy: { lineaId: 'asc' } } } }),
    prisma.auditLog.findMany({ where: { usuarioId: userId }, orderBy: { id: 'asc' } }),
    prisma.shadowPosteoOutbox.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
  ]);
  return JSON.stringify(rows, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value);
}

/** @description Request con sesión real. @param url Ruta. @param body Payload.
 * @returns Solicitud HTTP. */
function request(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, { method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body) });
}

describe('G5 — actions y adaptadores reales', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    vi.stubEnv('CONTABILIDAD_FORMAL_MODE', 'enforce');
    vi.stubEnv('PERIODO_CONTABLE_MODE', 'enforce');
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'true');
    const target = new URL(process.env.DATABASE_URL_TEST!);
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port`;
    expect(identity[0]).toEqual({ db: target.pathname.slice(1), port: Number(target.port) });
    tenantId = (await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } })).tenantId;
    const user = await prisma.user.create({ data: {
      name: prefix, email: `${prefix}@test.local`, password: 'fixture',
    } });
    userId = user.userId;
    const features = { 'contabilidad-formal': true, 'prestamos-cash': true, 'deudas-cash': true };
    planId = (await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365, features,
    } })).planId;
    await prisma.tenantMembership.create({ data: { tenantId, userId, tenantRole: 'manager' } });
    await prisma.tenantLicense.create({ data: {
      tenantId, planId, activa: true, expiracion: new Date('2099-01-01'),
    } });
    auth.user = { userId, tenantId, name: user.name ?? prefix, email: user.email,
      role: 'regularUser', isActive: true, tenantRole: 'manager', planFeatures: features };
    token = jwt.sign({ userId, tenantId, email: user.email }, getJwtSecret());
    await prisma.userSession.create({ data: {
      userId, token, expiresAt: new Date(Date.now() + 3600_000),
    } });
    clienteId = (await prisma.cliente.create({ data: { tenantId, nombre: prefix } })).clienteId;
    proveedorId = (await prisma.vendor.create({ data: { tenantId, nombre: prefix } })).vendorId;
    bankId = (await prisma.cuentaBancaria.create({ data: { tenantId, nombreBanco: prefix,
      numeroCuenta: prefix, tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 10000 } })).cuentaId;
    tipoPagoId = (await prisma.tipoPago.create({ data: { tenantId, nombre: 'Transferencia' } })).tipoId;
    await prisma.tenantAccountingPolicy.create({ data: {
      tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId,
    } });
    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    const now = new Date();
    await prisma.periodoContable.create({ data: { tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
    } });
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await prisma.periodoContable.updateMany({ where: { tenantId }, data: { estado: 'ABIERTO' } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    auth.user = null;
    if (!tenantId) return;
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.shadowPosteoOutbox.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { usuarioId: userId } });
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.prestamoCash.deleteMany({ where: { tenantId } });
    await prisma.deudaCash.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.vendor.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId } });
    await prisma.userSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { userId } });
    await prisma.plan.deleteMany({ where: { planId } });
    await prisma.tenant.delete({ where: { tenantId } });
  });

  it.each(kinds)('%s: alta action concurrente, replay post-cierre y conflicto sin efectos', async (kind) => {
    const key = `alta-${crypto.randomUUID()}`;
    const [first, concurrent] = await Promise.all([createAction(kind, key), createAction(kind, key)]);
    const original = unwrap(first);
    expect(unwrap(concurrent).id).toBe(original.id);
    const source = kind === 'loan' ? 'prestamo_cash' : 'deuda_cash';
    const entry = await prisma.asiento.findFirstOrThrow({ where: {
      tenantId, origenTipo: source, origenId: original.id,
    }, include: { lineas: true } });
    expect(entry.lineas).toHaveLength(2);
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId, idempotencyKey: key } })).toBe(1);
    const before = await snapshot();
    await closePeriod();
    expect(unwrap(await createAction(kind, key)).id).toBe(original.id);
    expect(await snapshot()).toBe(before);
    expect(await createAction(kind, key, 21)).toMatchObject({
      success: false, error: { code: 'IDEMPOTENCY_CONFLICT' },
    });
    expect(await createAction(kind, `nuevo-${crypto.randomUUID()}`)).toMatchObject({
      success: false, error: { code: 'PERIODO_CERRADO' },
    });
    expect(await snapshot()).toBe(before);
  });

  it.each(kinds)('%s: pago parcial y final action keyed con replay post-cierre', async (kind) => {
    const entity = unwrap(await createAction(kind, `alta-${crypto.randomUUID()}`));
    for (const amount of [5, 15]) {
      const key = `pago-${crypto.randomUUID()}`;
      const original = unwrap(await payAction(kind, entity.id, key, amount));
      const before = await snapshot();
      await closePeriod();
      expect(unwrap(await payAction(kind, entity.id, key, amount))).toEqual(original);
      expect(await payAction(kind, entity.id, key, amount + 1)).toMatchObject({
        success: false, error: { code: 'IDEMPOTENCY_CONFLICT' },
      });
      expect(await payAction(kind, entity.id, `nuevo-${crypto.randomUUID()}`, amount)).toMatchObject({
        success: false, error: { code: 'PERIODO_CERRADO' },
      });
      expect(await snapshot()).toBe(before);
      await prisma.periodoContable.updateMany({ where: { tenantId }, data: { estado: 'ABIERTO' } });
      await prisma.periodoCache.deleteMany({ where: { tenantId } });
    }
  });

  it.each(kinds)('%s: pagos parcial/final móvil conservan respuesta y estado ante replay/conflicto', async (kind) => {
    const entity = unwrap(await createAction(kind, `alta-${crypto.randomUUID()}`));
    const url = `http://localhost/api/mobile/v1/accounting/cash-${kind === 'loan' ? 'loans' : 'debts'}/${entity.id}/payments`;
    for (const amount of [5, 15]) {
      const key = `movil-${crypto.randomUUID()}`;
      const input = { monto: amount, cuentaId: bankId, tipoPagoId, idempotencyKey: key };
      const send = (monto = amount) => (kind === 'loan' ? mobileLoanPayment : mobileDebtPayment)(
        request(url, { ...input, monto }), { params: Promise.resolve({ id: entity.id }) },
      );
      const first = await send();
      expect(first.status, await first.clone().text()).toBe(200);
      const original = await first.json();
      const before = await snapshot();
      await closePeriod();
      const replay = await send();
      expect(replay.status, await replay.clone().text()).toBe(200);
      expect(await replay.json()).toEqual(original);
      expect((await send(amount + 1)).status).toBe(409);
      expect(await snapshot()).toBe(before);
      await prisma.periodoContable.updateMany({ where: { tenantId }, data: { estado: 'ABIERTO' } });
      await prisma.periodoCache.deleteMany({ where: { tenantId } });
    }
  });

  it.each(kinds)('%s: el replay action revalida permiso y rechaza claves inválidas', async (kind) => {
    const key = `acceso-${crypto.randomUUID()}`;
    const entity = unwrap(await createAction(kind, key));
    const paymentKey = `acceso-pago-${crypto.randomUUID()}`;
    unwrap(await payAction(kind, entity.id, paymentKey, 5));
    const before = await snapshot();
    expect(await createAction(kind, '')).toMatchObject({
      success: false, error: { code: 'VALIDATION_ERROR' },
    });
    expect(await createAction(kind, 'k'.repeat(65))).toMatchObject({
      success: false, error: { code: 'VALIDATION_ERROR' },
    });
    const authorized = auth.user;
    auth.user = { ...authorized!, permissions: new Set<string>() };
    try {
      expect(await createAction(kind, key)).toMatchObject({
        success: false, error: { code: 'FORBIDDEN' },
      });
      expect(await payAction(kind, entity.id, paymentKey, 5)).toMatchObject({
        success: false, error: { code: 'FORBIDDEN' },
      });
      auth.user = null;
      expect(await createAction(kind, key)).toMatchObject({
        success: false, error: { code: 'AUTH_REQUIRED' },
      });
    } finally {
      auth.user = authorized;
    }
    expect(await snapshot()).toBe(before);
  });

  it.each(kinds)('%s: alta legacy relee un commit intercalado antes del rechazo real del período', async (kind) => {
    const key = `race-alta-${crypto.randomUUID()}`;
    const input = kind === 'loan'
      ? { ...createInput(key), clienteId }
      : { ...createInput(key), proveedorId };
    const validate = periodValidation.validarEscrituraPeriodo;
    let committedId = '';
    let committedState = '';
    let denied = false;
    // Intercalado determinista: lookup inicial real sin fila; writer real confirma;
    // el guard real observa el cierre; la ruta debe releer bajo lock sin volver a escribir.
    const gate = vi.spyOn(periodValidation, 'validarEscrituraPeriodo')
      .mockImplementationOnce(async (params) => {
        expect(await prisma.reconciliacionVenta.count({ where: {
          tenantId, idempotencyKey: key,
        } })).toBe(0);
        const committed = kind === 'loan'
          ? await cash.createCashLoan({ input: { ...createInput(key), clienteId }, user: auth.user! })
          : await cash.createCashDebt({ input: { ...createInput(key), proveedorId }, user: auth.user! });
        committedId = committed.id;
        committedState = await snapshot();
        await closePeriod();
        const result = await validate(params);
        denied = !result.permitido;
        return result;
      });
    try {
      const response = kind === 'loan'
        ? await legacyLoanCreate(request('http://localhost/api/contabilidad/prestamos-cash', input), {})
        : await legacyDebtCreate(request('http://localhost/api/contabilidad/deudas-cash', input), {});
      expect(gate).toHaveBeenCalledTimes(1);
      expect(denied).toBe(true);
      expect(response.status, await response.clone().text()).toBe(201);
      const body = await response.json();
      expect(kind === 'loan' ? body.prestamo.id : body.deuda.id).toBe(committedId);
      expect(await snapshot()).toBe(committedState);
    } finally {
      gate.mockRestore();
    }
  });

  it.each(kinds)('%s: pago legacy relee un commit intercalado antes del rechazo real del período', async (kind) => {
    const entity = unwrap(await createAction(kind, `alta-${crypto.randomUUID()}`));
    const key = `race-pago-${crypto.randomUUID()}`;
    const input = { id: entity.id, monto: 5, cuentaId: bankId, tipoPagoId, idempotencyKey: key };
    const validate = periodValidation.validarEscrituraPeriodo;
    let committedId = '';
    let committedState = '';
    let denied = false;
    const gate = vi.spyOn(periodValidation, 'validarEscrituraPeriodo')
      .mockImplementationOnce(async (params) => {
        expect(await prisma.reconciliacionVenta.count({ where: {
          tenantId, idempotencyKey: key,
        } })).toBe(0);
        const committed = kind === 'loan'
          ? await cash.registerCashLoanPayment({ input, user: auth.user! })
          : await cash.registerCashDebtPayment({ input, user: auth.user! });
        committedId = committed.reconciliacionId;
        committedState = await snapshot();
        await closePeriod();
        const result = await validate(params);
        denied = !result.permitido;
        return result;
      });
    try {
      const context = { params: Promise.resolve({ id: entity.id }) };
      const response = kind === 'loan'
        ? await legacyLoanPayment(request(
            `http://localhost/api/contabilidad/prestamos-cash/${entity.id}/pagar`, input,
          ), context)
        : await legacyDebtPayment(request(
            `http://localhost/api/contabilidad/deudas-cash/${entity.id}/pagar`, input,
          ), context);
      expect(gate).toHaveBeenCalledTimes(1);
      expect(denied).toBe(true);
      expect(response.status, await response.clone().text()).toBe(201);
      expect((await response.json()).reconciliacion.reconciliacionId).toBe(committedId);
      expect(await snapshot()).toBe(committedState);
    } finally {
      gate.mockRestore();
    }
  });
});
