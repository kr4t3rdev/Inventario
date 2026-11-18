import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: async () => auth.user }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: vi.fn().mockResolvedValue({}) },
}));

const tenants: Array<{ tenantId: string; userId: string }> = [];
let guardar: typeof import('@/features/contabilidad/actions-inicializacion-borrador').guardarBorradorInicializacionAction;
let obtener: typeof import('@/features/contabilidad/actions-inicializacion-borrador').obtenerBorradorInicializacionAction;
let obtenerActual: typeof import('@/features/contabilidad/actions-inicializacion-borrador').obtenerBorradorActualInicializacionAction;

const draftPayload = {
  fechaCorte: '2026-11-01',
  monedaFuncional: 'CUP',
  cuentas: [{ numeroCuenta: 'QA-DRAFT-01', nombreCuenta: 'Caja', nombreBanco: 'Banco QA', tipoCuenta: 'Ahorros', moneda: 'CUP', saldoInicial: '100000' }],
};

async function makeTenant() {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const user = {
    userId, name: 'QA borrador', email: `qa-draft-${tenantId.slice(0, 8)}@example.test`,
    role: 'admin' as const, isActive: true, tenantId, tenantRole: 'manager' as const,
  };
  await prisma.tenant.create({ data: { tenantId, nombre: 'QA borrador', slug: randomUUID() } });
  await prisma.user.create({ data: { userId, name: user.name, email: user.email, password: 'integration-only-placeholder' } });
  tenants.push({ tenantId, userId });
  return { tenantId, user };
}

describe('acciones del borrador de inicialización — PostgreSQL', { timeout: 120_000 }, () => {
  type TenantFixture = Awaited<ReturnType<typeof makeTenant>>;
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;

  beforeAll(async () => {
    const actions = await import('@/features/contabilidad/actions-inicializacion-borrador');
    guardar = actions.guardarBorradorInicializacionAction;
    obtener = actions.obtenerBorradorInicializacionAction;
    obtenerActual = actions.obtenerBorradorActualInicializacionAction;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    tenantA = await makeTenant();
    tenantB = await makeTenant();
  });

  afterAll(async () => {
    for (const { tenantId } of tenants) {
      await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
    }
    for (const { tenantId, userId } of tenants) {
      await prisma.user.deleteMany({ where: { userId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
    }
  });

  it('guarda y retoma el borrador por action con la misma clave', async () => {
    auth.user = tenantA.user as unknown as AuthenticatedUser;
    const saved = await guardar({ idempotencyKey: 'draft-actions-1', borrador: draftPayload });
    expect(saved.success).toBe(true);
    if (!saved.success) throw new Error(saved.error.message);
    expect(saved.data).toMatchObject({ idempotencyKey: 'draft-actions-1', estado: 'BORRADOR' });

    const resumed = await obtener({ idempotencyKey: 'draft-actions-1' });
    expect(resumed.success).toBe(true);
    if (!resumed.success) throw new Error(resumed.error.message);
    expect(resumed.data).toMatchObject({ idempotencyKey: 'draft-actions-1' });
    expect((resumed.data?.borrador as Record<string, unknown>).fechaCorte).toBe('2026-11-01');
  });

  it('rechaza un tenantId enviado por el cliente', async () => {
    auth.user = tenantA.user as unknown as AuthenticatedUser;
    const result = await guardar({
      idempotencyKey: 'draft-actions-2',
      borrador: draftPayload,
      tenantId: 'tenant-ajeno',
    } as never);
    expect(result.success).toBe(false);
  });

  it('otro tenant no ve el borrador', async () => {
    auth.user = tenantB.user as unknown as AuthenticatedUser;
    const result = await obtener({ idempotencyKey: 'draft-actions-1' });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error.message);
    expect(result.data).toBeNull();
  });

  it('sin permiso de apertura se rechaza con FORBIDDEN', async () => {
    const denied = {
      ...tenantA.user,
      role: 'user' as const,
      tenantRole: 'member' as const,
      permissions: new Set<string>(),
    };
    auth.user = denied as unknown as AuthenticatedUser;
    const result = await guardar({ idempotencyKey: 'draft-actions-3', borrador: draftPayload });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Se esperaba un fallo de permiso');
    expect(result.error).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('obtener actual devuelve el borrador sin conocer su clave', async () => {
    auth.user = tenantA.user as unknown as AuthenticatedUser;
    const result = await obtenerActual();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error.message);
    expect(result.data).toMatchObject({ idempotencyKey: 'draft-actions-1' });
    expect((result.data?.borrador as Record<string, unknown>).fechaCorte).toBe('2026-11-01');
  });

  it('obtener actual sin borrador devuelve null', async () => {
    auth.user = tenantB.user as unknown as AuthenticatedUser;
    const result = await obtenerActual();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error.message);
    expect(result.data).toBeNull();
  });
});
