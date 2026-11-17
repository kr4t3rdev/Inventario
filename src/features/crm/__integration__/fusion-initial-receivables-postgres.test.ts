import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let prisma: typeof import('@/lib/prisma').prisma;
let persist: typeof import('@/features/contabilidad/services/initial-receivables-persistence').persistInitialReceivables;
let merge: typeof import('@/features/crm/actions').fusionarClientesAction;
let tenantId = '';
let principal = '';
let secundario = '';
let initId = '';
let createdCurrency = false;

describe('fusión y CxC inicial concurrentes en PostgreSQL', { timeout: 30_000 }, () => {
  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).prisma;
    persist = (await import('@/features/contabilidad/services/initial-receivables-persistence')).persistInitialReceivables;
    merge = (await import('@/features/crm/actions')).fusionarClientesAction;
    const getCurrentUser = (await import('@/lib/server-actions/get-current-user')).getCurrentUser;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    if (!(await prisma.moneda.findUnique({ where: { codigo: 'CUP' } }))) {
      await prisma.moneda.create({ data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' } });
      createdCurrency = true;
    }
    tenantId = (await prisma.tenant.create({ data: { nombre: 'QA CRM', slug: randomUUID() } })).tenantId;
    principal = (await prisma.cliente.create({ data: { tenantId, nombre: 'Principal' } })).clienteId;
    secundario = (await prisma.cliente.create({ data: { tenantId, nombre: 'Secundario' } })).clienteId;
    await prisma.tenantAccountingPolicy.create({ data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'qa' } });
    initId = (await prisma.inicializacionContable.create({ data: {
      tenantId, idempotencyKey: 'qa-crm', payloadHash: 'a'.repeat(64),
    } })).inicializacionId;
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'qa', tenantId, name: 'QA', email: 'qa@test.invalid', role: 'ADMIN',
      isActive: true, planFeatures: { 'crm-cdp': true },
    } as never);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    if (tenantId) await prisma.tenant.delete({ where: { tenantId } });
    if (createdCurrency) await prisma.moneda.delete({ where: { codigo: 'CUP' } });
    await prisma.$disconnect();
  });

  it('espera a la carga y rechaza la fusión al ver la deuda ya confirmada', async () => {
    let release!: () => void;
    let ready!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const locked = new Promise<void>((resolve) => { ready = resolve; });
    const loading = prisma.$transaction(async (tx) => {
      await persist(tx, { tenantId, inicializacionId: initId, cuentas: [{
        referenciaFila: 'fila-1', clienteId: secundario, moneda: 'CUP', saldo: '20',
      }] });
      ready();
      await gate;
    });
    await locked;
    const merging = merge({ clientePrincipal: principal, clienteSecundario: secundario });
    try {
      const premature = await Promise.race([
        merging.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 150)),
      ]);
      expect(premature).toBe(false);
    } finally {
      release();
      await loading;
    }
    const result = await merging;
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INITIAL_RECEIVABLE_MERGE_BLOCKED');
    expect(await prisma.cliente.count({ where: { tenantId } })).toBe(2);
    const debt = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } });
    expect(debt.clienteId).toBe(secundario);
  });
});
