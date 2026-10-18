/**
 * @description Integración real del enforcement tenant (AS-02 T3).
 * Dos tenants sembrados demuestran que en enforce el tenant A no puede
 * leer/crear/modificar/borrar datos del tenant B aunque el handler olvide
 * el filtro, que la transacción interactiva mantiene el scope y que los
 * modelos globales siguen accesibles sin contexto.
 * Requiere: DATABASE_URL_TEST=... pnpm test:integration -- tenant-isolation
 * @module src/lib/db/__integration__/tenant-isolation.test
 */
process.env.TENANT_ISOLATION_MODE = 'enforce';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { prismaPlatform } from '@/lib/db/platform-prisma';
import type { Prisma } from '@/generated/prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
import {
  TenantContextRequiredError,
  TenantMismatchError,
} from '@/lib/db/scoped-prisma';

type OptionalProperty<T, K extends keyof T> = Omit<T, K> & { [P in K]?: T[P] };
type CategoriaInjectionDelegate = Omit<Prisma.TransactionClient['categoria'], 'create'> & {
  create: (args: Omit<Prisma.CategoriaCreateArgs, 'data'> & {
    data: OptionalProperty<Prisma.CategoriaCreateInput, 'tenant'>;
  }) => Promise<Prisma.CategoriaGetPayload<{}>>;
};

/**
 * @description Cliente tipado para los casos donde la extensión inyecta el
 * tenant; las llamadas mantienen el cliente real y ejercitan el middleware.
 */
type TenantInjectionTestClient = Omit<typeof prisma, 'categoria' | 'contrato'> & {
  categoria: CategoriaInjectionDelegate;
  contrato: Omit<typeof prisma.contrato, 'create'> & {
    create: (args: Omit<Prisma.ContratoCreateArgs, 'data'> & {
      data: OptionalProperty<Prisma.ContratoCreateInput, 'tenant'>;
    }) => Promise<Prisma.ContratoGetPayload<{ include: { alertas: true } }>>;
  };
};

// Keep this narrow assertion at the integration boundary; runtime remains the
// original extended Prisma client, so tenant injection and mismatch rejection
// are still covered rather than simulated by fixtures.
const scopedPrisma = prisma as unknown as TenantInjectionTestClient;

describe('AS-02 aislamiento tenant end-to-end', { timeout: 30_000 }, () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let tenantA = '';
  let tenantB = '';
  let catA = '';
  let catB = '';
  let userId = '';

  beforeAll(async () => {
    const user = await prismaPlatform.user.create({
      data: { name: `Aislado ${suffix}`, email: `aislado-${suffix}@test.local`, password: 'x' },
    });
    userId = user.userId;
    const a = await prismaPlatform.tenant.create({
      data: { nombre: `Aislado A ${suffix}`, slug: `aislado-a-${suffix}` },
    });
    const b = await prismaPlatform.tenant.create({
      data: { nombre: `Aislado B ${suffix}`, slug: `aislado-b-${suffix}` },
    });
    tenantA = a.tenantId;
    tenantB = b.tenantId;

    const ca = await prismaPlatform.categoria.create({
      data: { nombre: `Cat A ${suffix}`, tenantId: tenantA },
    });
    const cb = await prismaPlatform.categoria.create({
      data: { nombre: `Cat B ${suffix}`, tenantId: tenantB },
    });
    catA = ca.catId;
    catB = cb.catId;
  });

  afterAll(async () => {
    await prismaPlatform.contratoAlerta.deleteMany({
      where: { contrato: { tenantId: { in: [tenantA, tenantB] } } },
    });
    await prismaPlatform.contrato.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prismaPlatform.categoria.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prismaPlatform.tenant.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prismaPlatform.user.deleteMany({ where: { userId } });
  });

  it('lectura cruzada devuelve vacío aunque se pida el id ajeno', async () => {
    const rows = await withTestTenant(tenantA, async () => {
      return await prisma.categoria.findMany({});
    });
    expect(rows.map((r) => r.tenantId)).toEqual([tenantA]);

    const cross = await withTestTenant(tenantA, async () => {
      return await prisma.categoria.findFirst({ where: { catId: catB } });
    });
    expect(cross).toBeNull();

    const count = await withTestTenant(tenantA, async () => {
      return await prisma.categoria.count({ where: { catId: catB } });
    });
    expect(count).toBe(0);
  });

  it('update/delete cruzados no afectan (P2025)', async () => {
    const updateErr = await withTestTenant(tenantA, async () => {
      return await prisma.categoria
        .update({ where: { catId: catB }, data: { nombre: 'Atacada' } })
        .catch((e: unknown) => e);
    }) as { code?: string };
    expect(updateErr?.code).toBe('P2025');

    const deleteErr = await withTestTenant(tenantA, async () => {
      return await prisma.categoria.delete({ where: { catId: catB } }).catch((e: unknown) => e);
    }) as { code?: string };
    expect(deleteErr?.code).toBe('P2025');

    const intact = await prismaPlatform.categoria.findUnique({ where: { catId: catB } });
    expect(intact?.nombre).toContain('Cat B');
  });

  it('create sin tenantId lo inyecta desde el contexto', async () => {
    const created = await withTestTenant(tenantA, async () => {
      return await scopedPrisma.categoria.create({ data: { nombre: `Inyectada ${suffix}` } });
    });
    expect(created.tenantId).toBe(tenantA);
  });

  it('create con tenant ajeno falla antes de tocar la base', async () => {
    let error: unknown;
    try {
      await withTestTenant(tenantA, async () => {
        return await prisma.categoria.create({ data: { nombre: 'Fuga', tenantId: tenantB } });
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TenantMismatchError);
  });

  it('nested create (contrato + alertas) queda escopado', async () => {
    const contrato = await withTestTenant(tenantA, async () => {
      return await scopedPrisma.contrato.create({
        data: {
          numeroContrato: `C-${suffix}`,
          numeroConsecutivo: 1,
          tipo: 'prueba',
          fechaInicio: new Date(),
          creador: { connect: { userId } },
          tenant: { connect: { tenantId: tenantA } },
          alertas: {
            create: [{ tipo: 'vencimiento', fechaAlerta: new Date(), mensaje: 'hola' }],
          },
        },
        include: { alertas: true },
      });
    });
    expect(contrato.tenantId).toBe(tenantA);
    expect(contrato.alertas).toHaveLength(1);

    const visibleFromB = await withTestTenant(tenantB, async () => {
      return await prisma.contrato.findFirst({ where: { contratoId: contrato.contratoId } });
    });
    expect(visibleFromB).toBeNull();
  });

  it('la transacción interactiva mantiene el scope', async () => {
    const seen = await withTestTenant(tenantA, () =>
      prisma.$transaction(async (tx) => {
        const rows = await tx.categoria.findMany({});
        const scopedTx = tx as unknown as Pick<TenantInjectionTestClient, 'categoria'>;
        const created = await scopedTx.categoria.create({ data: { nombre: `Tx ${suffix}` } });
        return { tenants: new Set(rows.map((r) => r.tenantId)), createdTenant: created.tenantId };
      }),
    );
    expect([...seen.tenants]).toEqual([tenantA]);
    expect(seen.createdTenant).toBe(tenantA);
  });

  it('modelos globales funcionan sin contexto en enforce', async () => {
    await expect(prisma.plan.findMany({ take: 1 })).resolves.toBeDefined();
    await expect(
      prisma.tenant.findUnique({ where: { tenantId: tenantA } }),
    ).resolves.toBeDefined();
  });

  it('sin contexto en enforce falla cerrado', async () => {
    let error: unknown;
    try {
      await prisma.categoria.findMany({});
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TenantContextRequiredError);
  });
});
