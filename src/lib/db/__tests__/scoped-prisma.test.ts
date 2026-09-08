/**
 * @description Tests unitarios de la matriz de transformación del enforcement
 * tenant (AS-02 T1). Capa pura sin base de datos: ninguna prueba aquí toca
 * Prisma real (barrera MM-B).
 * @module src/lib/db/__tests__/scoped-prisma.test
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma';
import {
  getTenantContext,
  runWithTenantContext,
  enterTenantContext,
  withTestTenant,
} from '@/lib/db/tenant-context';
import {
  getIsolationMode,
  applyTenantScope,
  interceptOperation,
  buildScopedClient,
  setViolationReporter,
  TenantContextRequiredError,
  TenantMismatchError,
  type ViolationReport,
} from '@/lib/db/scoped-prisma';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

describe('AS-02 getIsolationMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('default off cuando la variable no existe', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', '');
    expect(getIsolationMode()).toBe('off');
  });

  it('parsea shadow y enforce', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'shadow');
    expect(getIsolationMode()).toBe('shadow');
    vi.stubEnv('TENANT_ISOLATION_MODE', 'enforce');
    expect(getIsolationMode()).toBe('enforce');
  });

  it('valor inválido cae a off', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'paranoid');
    expect(getIsolationMode()).toBe('off');
  });
});

describe('AS-02 tenant-context (AsyncLocalStorage)', () => {
  it('sin contexto devuelve undefined', () => {
    expect(getTenantContext()).toBeUndefined();
  });

  it('run expone el tenant dentro y lo limpia fuera', () => {
    let inside: string | undefined;
    runWithTenantContext(TENANT_A, () => {
      inside = getTenantContext()?.tenantId;
    });
    expect(inside).toBe(TENANT_A);
    expect(getTenantContext()).toBeUndefined();
  });

  it('contextos anidados: el interno gana y el externo se restaura', () => {
    const seen: Array<string | undefined> = [];
    runWithTenantContext(TENANT_A, () => {
      seen.push(getTenantContext()?.tenantId);
      runWithTenantContext(TENANT_B, () => {
        seen.push(getTenantContext()?.tenantId);
      });
      seen.push(getTenantContext()?.tenantId);
    });
    expect(seen).toEqual([TENANT_A, TENANT_B, TENANT_A]);
  });

  it('el contexto sobrevive awaits dentro del run', async () => {
    const seen = await runWithTenantContext(TENANT_A, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return getTenantContext()?.tenantId;
    });
    expect(seen).toBe(TENANT_A);
  });

  it('cadenas concurrentes no se contaminan', async () => {
    const probe = async (tenant: string, delay: number) =>
      runWithTenantContext(tenant, async () => {
        await new Promise((r) => setTimeout(r, delay));
        return getTenantContext()?.tenantId;
      });
    const [a, b] = await Promise.all([probe(TENANT_A, 10), probe(TENANT_B, 1)]);
    expect([a, b]).toEqual([TENANT_A, TENANT_B]);
  });

  it('enter fija el contexto en la cadena actual', () => {
    enterTenantContext(TENANT_A);
    expect(getTenantContext()?.tenantId).toBe(TENANT_A);
  });

  it('withTestTenant es alias de run para tests', () => {
    const seen = withTestTenant(TENANT_B, () => getTenantContext()?.tenantId);
    expect(seen).toBe(TENANT_B);
    expect(getTenantContext()).toBeUndefined();
  });
});

describe('AS-02 applyTenantScope (matriz de operaciones)', () => {
  it('modelos global/child/pending pasan sin cambios', () => {
    const args = { where: { nombre: 'x' } };
    expect(applyTenantScope('Plan', 'findMany', args, TENANT_A)).toBe(args);
    expect(applyTenantScope('Tenant', 'findMany', args, TENANT_A)).toBe(args);
    expect(applyTenantScope('VentaItem', 'findMany', args, TENANT_A)).toBe(args);
    expect(applyTenantScope('TipoContratoCustom', 'findMany', args, TENANT_A)).toBe(args);
  });

  it('modelo desconocido falla cerrado', () => {
    expect(() => applyTenantScope('NoExiste', 'findMany', {}, TENANT_A)).toThrow(
      /sin clasificar/,
    );
  });

  it.each(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy'])(
    '%s inyecta tenantId con AND sin mutar el original',
    (op) => {
      const args = { where: { nombre: 'x' } };
      const out = applyTenantScope('Venta', op, args, TENANT_A) as {
        where: { AND: unknown[] };
      };
      expect(out.where).toEqual({ AND: [{ nombre: 'x' }, { tenantId: TENANT_A }] });
      expect(args).toEqual({ where: { nombre: 'x' } });
    },
  );

  it('findMany sin where crea el filtro', () => {
    const out = applyTenantScope('Venta', 'findMany', {}, TENANT_A) as {
      where: unknown;
    };
    expect(out.where).toEqual({ tenantId: TENANT_A });
  });

  it.each(['findUnique', 'findUniqueOrThrow', 'update', 'delete'])(
    '%s extiende el where único con tenantId',
    (op) => {
      const out = applyTenantScope('Venta', op, { where: { ventaId: 'v1' } }, TENANT_A) as {
        where: unknown;
      };
      expect(out.where).toEqual({ ventaId: 'v1', tenantId: TENANT_A });
    },
  );

  it.each(['updateMany', 'updateManyAndReturn', 'deleteMany'])('%s usa AND', (op) => {
    const out = applyTenantScope('Venta', op, { where: { total: 5 } }, TENANT_A) as {
      where: unknown;
    };
    expect(out.where).toEqual({ AND: [{ total: 5 }, { tenantId: TENANT_A }] });
  });

  it('create inyecta tenantId cuando falta', () => {
    const out = applyTenantScope('Venta', 'create', { data: { total: 5 } }, TENANT_A) as {
      data: unknown;
    };
    expect(out.data).toEqual({ total: 5, tenantId: TENANT_A });
  });

  it('create con tenant propio pasa; con ajeno rechaza', () => {
    const own = applyTenantScope(
      'Venta',
      'create',
      { data: { total: 5, tenantId: TENANT_A } },
      TENANT_A,
    ) as { data: unknown };
    expect(own.data).toEqual({ total: 5, tenantId: TENANT_A });

    let error: unknown;
    try {
      applyTenantScope('Venta', 'create', { data: { total: 5, tenantId: TENANT_B } }, TENANT_A);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TenantMismatchError);
    expect((error as TenantMismatchError).code).toBe('TENANT_MISMATCH');
  });

  it('createMany valida cada fila (arreglo y objeto único)', () => {
    const out = applyTenantScope(
      'Venta',
      'createMany',
      { data: [{ total: 1 }, { total: 2, tenantId: TENANT_A }] },
      TENANT_A,
    ) as { data: unknown[] };
    expect(out.data).toEqual([
      { total: 1, tenantId: TENANT_A },
      { total: 2, tenantId: TENANT_A },
    ]);

    expect(() =>
      applyTenantScope('Venta', 'createMany', { data: { total: 1, tenantId: TENANT_B } }, TENANT_A),
    ).toThrow(TenantMismatchError);
  });

  it('nested create con tenant ajeno rechaza; child sin tenant pasa', () => {
    expect(() =>
      applyTenantScope(
        'Venta',
        'create',
        { data: { total: 1, items: { create: { tenantId: TENANT_B } } } },
        TENANT_A,
      ),
    ).toThrow(TenantMismatchError);

    const out = applyTenantScope(
      'Oferta',
      'create',
      { data: { total: 1, items: { create: [{ cantidad: 2 }] } } },
      TENANT_A,
    ) as { data: Record<string, unknown> };
    expect(out.data.tenantId).toBe(TENANT_A);
  });

  it('update con tenantId ajeno en data rechaza; sin tenantId pasa', () => {
    expect(() =>
      applyTenantScope(
        'Venta',
        'update',
        { where: { ventaId: 'v1' }, data: { tenantId: TENANT_B } },
        TENANT_A,
      ),
    ).toThrow(TenantMismatchError);

    const out = applyTenantScope(
      'Venta',
      'update',
      { where: { ventaId: 'v1' }, data: { total: 9 } },
      TENANT_A,
    ) as { where: unknown };
    expect(out.where).toEqual({ ventaId: 'v1', tenantId: TENANT_A });
  });

  it('upsert compone where + create + update', () => {
    const out = applyTenantScope(
      'Categoria',
      'upsert',
      { where: { catId: 'c1' }, create: { nombre: 'n' }, update: { nombre: 'm' } },
      TENANT_A,
    ) as { where: unknown; create: unknown };
    expect(out.where).toEqual({ catId: 'c1', tenantId: TENANT_A });
    expect(out.create).toEqual({ nombre: 'n', tenantId: TENANT_A });

    expect(() =>
      applyTenantScope(
        'Categoria',
        'upsert',
        { where: { catId: 'c1' }, create: { nombre: 'n', tenantId: TENANT_B }, update: {} },
        TENANT_A,
      ),
    ).toThrow(TenantMismatchError);
  });
});

describe('AS-02 interceptOperation (modos + contexto)', () => {
  let reports: ViolationReport[];
  beforeEach(() => {
    reports = [];
    setViolationReporter((r) => {
      reports.push(r);
    });
  });
  afterEach(() => {
    setViolationReporter(null);
    vi.unstubAllEnvs();
  });

  it('off deja pasar todo sin contexto ni reportes', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'off');
    const args = { where: {} };
    expect(interceptOperation('Venta', 'findMany', args)).toBe(args);
    expect(reports).toEqual([]);
  });

  it('enforce sin contexto lanza TenantContextRequiredError', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'enforce');
    let error: unknown;
    try {
      interceptOperation('Venta', 'findMany', { where: {} });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TenantContextRequiredError);
    expect((error as TenantContextRequiredError).code).toBe('TENANT_CONTEXT_REQUIRED');
  });

  it('shadow sin contexto registra y deja pasar', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'shadow');
    const args = { where: {} };
    expect(interceptOperation('Venta', 'findMany', args)).toBe(args);
    expect(reports).toEqual([
      expect.objectContaining({ kind: 'missing-context', model: 'Venta', mode: 'shadow' }),
    ]);
  });

  it('shadow con contexto y sin filtro no es violación (enforce inyecta)', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'shadow');
    const args = { where: { nombre: 'x' } };
    const out = withTestTenant(TENANT_A, () => interceptOperation('Venta', 'findMany', args));
    expect(out).toBe(args);
    expect(reports).toEqual([]);
  });

  it('shadow con filtro propio no reporta', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'shadow');
    withTestTenant(TENANT_A, () =>
      interceptOperation('Venta', 'findMany', { where: { tenantId: TENANT_A } }),
    );
    expect(reports).toEqual([]);
  });

  it('shadow reporta tenant-mismatch en escritura con tenant ajeno', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'shadow');
    withTestTenant(TENANT_A, () =>
      interceptOperation('Venta', 'create', { data: { tenantId: TENANT_B } }),
    );
    expect(reports).toEqual([
      expect.objectContaining({ kind: 'tenant-mismatch', model: 'Venta', mode: 'shadow' }),
    ]);
  });

  it('shadow nunca lanza ante mismatch (solo reporta)', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'shadow');
    const out = withTestTenant(TENANT_A, () =>
      interceptOperation('Venta', 'create', { data: { tenantId: TENANT_B } }),
    );
    expect(out).toEqual({ data: { tenantId: TENANT_B } });
    expect(reports.length).toBeGreaterThan(0);
  });

  it('enforce con contexto transforma', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'enforce');
    const out = withTestTenant(TENANT_A, () =>
      interceptOperation('Venta', 'findMany', { where: { nombre: 'x' } }),
    ) as { where: unknown };
    expect(out.where).toEqual({ AND: [{ nombre: 'x' }, { tenantId: TENANT_A }] });
    expect(reports).toEqual([]);
  });

  it('modelos no scoped pasan en enforce sin contexto', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'enforce');
    const args = { where: {} };
    expect(interceptOperation('Plan', 'findMany', args)).toBe(args);
    expect(reports).toEqual([]);
  });
});

describe('AS-02 buildScopedClient', () => {
  it('construye el cliente extendido con los mismos delegados', () => {
    const base = new PrismaClient();
    const scoped = buildScopedClient(base);
    expect(typeof scoped.$transaction).toBe('function');
    expect(scoped.categoria).toBeDefined();
    expect(scoped.venta).toBeDefined();
  });
});
