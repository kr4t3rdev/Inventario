import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';
import { initializationContract } from '@/features/contabilidad/services/initialization-contract';
import { computeInitializationPayloadHash } from '@/features/contabilidad/services/initialization-idempotency';

assertDisposableDatabase(process.env);

const user = {
  userId: randomUUID(), name: 'QA inicialización', email: 'qa-init@example.test',
  role: 'admin' as const, isActive: true, tenantId: '', tenantRole: 'manager' as const,
};
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: vi.fn(async () => user) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: vi.fn().mockResolvedValue({}) },
}));

let prisma: typeof import('@/lib/prisma').prisma;
let initialize: typeof import('@/features/contabilidad/actions-cuentas-bancarias').initializeBankAccountsAction;
const accountInput = {
  nombreCuenta: 'Operaciones QA', nombreBanco: 'Banco QA', numeroCuenta: 'INIT-ACTION-001',
  tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0',
};
const tenants: string[] = [];

async function makeTenant() {
  const tenantId = randomUUID();
  await prisma.tenant.create({ data: { tenantId, nombre: 'QA inicialización', slug: randomUUID() } });
  user.tenantId = tenantId;
  tenants.push(tenantId);
  return tenantId;
}

describe('acción de inicialización coordinada en PostgreSQL aislado', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).prisma;
    initialize = (await import('@/features/contabilidad/actions-cuentas-bancarias')).initializeBankAccountsAction;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
  });

  afterAll(async () => {
    if (!prisma) return;
    for (const tenantId of tenants) {
      await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
      await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
      await prisma.aperturaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.periodoContable.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
    }
    await prisma.$disconnect();
  });

  it('abre una cuenta en cero con período y apertura sin asiento', async () => {
    const tenantId = await makeTenant();
    const result = await initialize({ idempotencyKey: 'zero-opening', fechaCorte: '2026-11-01', monedaFuncional: 'CUP', cuentas: [accountInput] });
    expect(result).toMatchObject({ success: true, data: { replayed: false, resultado: { asientoId: null } } });
    const created = await prisma.cuentaBancaria.findMany({ where: { tenantId } });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ nombreCuenta: 'Operaciones QA', saldo: 0, moneda: 'CUP' });
    const periodo = await prisma.periodoContable.findFirstOrThrow({ where: { tenantId } });
    expect(periodo).toMatchObject({ tipo: 'MENSUAL', estado: 'ABIERTO' });
    expect(periodo.fechaInicio.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    const apertura = await prisma.aperturaPeriodo.findFirstOrThrow({ where: { tenantId } });
    const detalle = apertura.detalleJson as Record<string, unknown>;
    expect(detalle.origen).toBe('INICIALIZACION_CONTABLE');
    expect(detalle.asientoId).toBeNull();
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(0);
  });

  it('rechaza un resultado previo sin cuentas reales y no crea ni altera registros', async () => {
    const tenantId = await makeTenant();
    const input = { idempotencyKey: 'completed-action', fechaCorte: '2026-11-01', monedaFuncional: 'CUP', cuentas: [{ ...accountInput,
      saldoInicial: '10', origen: { tipo: 'CAPITAL_SOCIAL' as const, tercero: 'Socio' } }] };
    const parsed = initializationContract.parse(input);
    const { idempotencyKey, ...payload } = parsed;
    const payloadHash = computeInitializationPayloadHash(payload);
    await prisma.inicializacionContable.create({ data: { tenantId, idempotencyKey: parsed.idempotencyKey,
      payloadHash, estado: 'COMPLETADA', resultado: { cuentas: [] } } });
    const replay = await initialize(input);
    expect(replay).toMatchObject({ success: false, error: { code: 'INITIALIZATION_INCOMPLETE' } });
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.inicializacionContable.count({ where: { tenantId, estado: 'COMPLETADA' } })).toBe(1);
    await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
  });

  it('crea una vez, reproduce el resultado y bloquea la misma clave con otra carga', async () => {
    const tenantId = await makeTenant();
    const request = { idempotencyKey: 'init-action-qa', fechaCorte: '2026-11-01', monedaFuncional: 'CUP', cuentas: [accountInput] };
    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });
    const created = await prisma.cuentaBancaria.findMany({ where: { tenantId } });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ nombreCuenta: 'Operaciones QA', saldo: 0, moneda: 'CUP' });

    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(1);

    const conflict = await initialize({
      ...request,
      cuentas: [{ ...accountInput, nombreCuenta: 'Otra carga' }],
    });
    expect(conflict).toMatchObject({ success: false, error: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(1);
  });
});
