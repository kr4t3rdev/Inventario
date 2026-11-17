import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let prisma: typeof import('@/lib/prisma').prisma;
let createAccount: typeof import('@/features/contabilidad/actions-cuentas-bancarias').createCuentaBancariaAction;
let tenantId = '';
let userId = '';
const unique = randomUUID().replaceAll('-', '');
const email = `saldo-inicial-${unique}@test.local`;
const input = {
  nombreBanco: 'Banco de prueba', numeroCuenta: `QA-${unique}`, tipoCuenta: 'AHORRO',
  moneda: 'CUP', saldo: 100000, fuenteSaldoInicial: 'CAPITAL_SOCIAL' as const, socio: 'Socio QA',
};

describe('saldo inicial de cuenta bancaria en contabilidad formal', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'true');
    vi.stubEnv('PERIODO_CONTABLE_MODE', 'enforce');
    vi.stubEnv('CONTABILIDAD_FORMAL_MODE', 'enforce');
    prisma = (await import('@/lib/prisma')).prisma;
    createAccount = (await import('@/features/contabilidad/actions-cuentas-bancarias')).createCuentaBancariaAction;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    tenantId = (await prisma.tenant.create({ data: { nombre: `saldo-inicial-${unique}`, slug: `saldo-inicial-${unique}` } })).tenantId;
    userId = (await prisma.user.create({ data: { name: 'QA saldo inicial', email, password: 'integration-only-placeholder' } })).userId;
    await prisma.moneda.upsert({ where: { codigo: 'CUP' }, create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' }, update: {} });
    await prisma.tenantAccountingPolicy.create({ data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId } });
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    await seedPlantillasGlobales(prisma);
    await prisma.tenantLicense.create({ data: { tenantId, activa: true, expiracion: new Date(Date.now() + 86_400_000), features: { 'contabilidad-formal': true } } });
    const actor: AuthenticatedUser = {
      userId, email, name: 'QA saldo inicial', role: 'user', isActive: true, tenantId,
      tenantRole: 'manager', planFeatures: { contabilidad: true }, permissions: new Set(),
    };
    vi.mocked(getCurrentUser).mockResolvedValue(actor);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.auditLog.deleteMany({ where: { usuarioId: userId } });
    await prisma.asientoLinea.deleteMany({ where: { tenantId } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.inyeccionCapital.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    const accounts = await prisma.cuentaContable.findMany({ where: { tenantId }, orderBy: { nivel: 'desc' } });
    for (const account of accounts) await prisma.cuentaContable.delete({ where: { cuentaContableId: account.cuentaContableId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { userId } });
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  });

  it('rechaza sin período y no deja cuenta ni aporte', async () => {
    const result = await createAccount(input);
    expect(result.success).toBe(false);
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.inyeccionCapital.count({ where: { tenantId } })).toBe(0);
  });

  it('con período abierto registra el saldo y un asiento formal asociado', async () => {
    const now = Date.now();
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(now - 86400000), fechaFin: new Date(now + 86400000),
    } });
    // La apertura real invalida la caché; la fixture escribe directamente.
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    const result = await createAccount(input);
    expect(result.success, JSON.stringify(result)).toBe(true);
    const account = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId, numeroCuenta: input.numeroCuenta } });
    expect(account.saldo).toBe(100000);
    const contribution = await prisma.inyeccionCapital.findFirstOrThrow({ where: { tenantId, cuentaId: account.cuentaId } });
    expect(contribution.montoRecibido.toString()).toBe('100000');
    expect(await prisma.asiento.count({ where: { tenantId, origenId: contribution.id } })).toBe(1);
  });

  it('revierte cuenta y aporte si no puede valorar una moneda extranjera', async () => {
    const before = await prisma.inyeccionCapital.count({ where: { tenantId } });
    const result = await createAccount({ ...input, numeroCuenta: `FX-${unique}`, moneda: 'USD' });
    expect(result.success).toBe(false);
    expect(await prisma.cuentaBancaria.count({ where: { tenantId, numeroCuenta: `FX-${unique}` } })).toBe(0);
    expect(await prisma.inyeccionCapital.count({ where: { tenantId } })).toBe(before);
  });
});
