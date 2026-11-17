import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';
import { initializationContract } from '@/features/contabilidad/services/initialization-contract';

assertDisposableDatabase(process.env);

const tenantId = randomUUID();
const user = {
  userId: randomUUID(), name: 'QA inicialización', email: 'qa-init@example.test',
  role: 'admin' as const, isActive: true, tenantId, tenantRole: 'manager' as const,
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

describe('acción de inicialización coordinada en PostgreSQL aislado', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).prisma;
    initialize = (await import('@/features/contabilidad/actions-cuentas-bancarias')).initializeBankAccountsAction;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    await prisma.tenant.create({ data: { tenantId, nombre: 'QA inicialización', slug: randomUUID() } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { tenantId } });
    await prisma.$disconnect();
  });

  it('rechaza una carga nueva sin persistir cuentas ni marcadores', async () => {
    const result = await initialize({ idempotencyKey: 'blocked-action', cuentas: [accountInput] });
    expect(result).toMatchObject({ success: false, error: { code: 'INICIALIZACION_NO_DISPONIBLE' } });
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.inicializacionContable.count({ where: { tenantId } })).toBe(0);
  });

  it('rechaza un resultado previo sin cuentas reales y no crea ni altera registros', async () => {
    const input = { idempotencyKey: 'completed-action', cuentas: [{ ...accountInput,
      saldoInicial: '10', origen: { tipo: 'CAPITAL_SOCIAL' as const, tercero: 'Socio' } }] };
    const parsed = initializationContract.parse(input);
    const payloadHash = createHash('sha256').update(JSON.stringify({ cuentas: parsed.cuentas })).digest('hex');
    await prisma.inicializacionContable.create({ data: { tenantId, idempotencyKey: parsed.idempotencyKey,
      payloadHash, estado: 'COMPLETADA', resultado: { cuentas: [] } } });
    const replay = await initialize(input);
    expect(replay).toMatchObject({ success: false, error: { code: 'INITIALIZATION_INCOMPLETE' } });
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.inicializacionContable.count({ where: { tenantId, estado: 'COMPLETADA' } })).toBe(1);
    await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
  });

  it.skip('pendiente: crea una vez, reproduce el resultado y bloquea la misma clave con otra carga', async () => {
    const request = { idempotencyKey: 'init-action-qa', cuentas: [accountInput] };
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
