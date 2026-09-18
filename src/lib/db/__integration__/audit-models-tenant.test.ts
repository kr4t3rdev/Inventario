/**
 * @description Integración del scope de los modelos de auditoría de AS-05 ola 2
 * (AlertHistory, ReportHistory, ScheduledReport, ScenarioSimulation).
 * Con los modelos en scoped y TENANT_ISOLATION_MODE=enforce: create inyecta el
 * tenant del contexto; lectura/escritura cruzada entre tenants no ve ni muta;
 * sin contexto falla cerrado.
 * Requiere: DATABASE_URL_TEST=... pnpm test:integration -- audit-models
 * @module src/lib/db/__integration__/audit-models-tenant.test
 */
process.env.TENANT_ISOLATION_MODE = 'enforce';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { prismaPlatform } from '@/lib/db/platform-prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
import { TenantContextRequiredError } from '@/lib/db/scoped-prisma';

interface TableHarness {
  /** @description Etiqueta del modelo bajo prueba. */
  label: string;
  /** @description Datos mínimos válidos para crear una fila. */
  sample: () => Record<string, unknown>;
  /** @description Crea una fila y devuelve id + tenantId. */
  create: (data: Record<string, unknown>) => Promise<{ id: string; tenantId: string | null }>;
  /** @description Busca la primera fila por where. */
  findFirst: (where: Record<string, unknown>) => Promise<unknown>;
  /** @description Lista todas las filas visibles. */
  findMany: () => Promise<Array<{ tenantId: string | null }>>;
  /** @description Actualiza por id (lanza P2025 si fuera de scope). */
  update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  /** @description Borra por id (lanza P2025 si fuera de scope). */
  remove: (id: string) => Promise<unknown>;
  /** @description Limpieza de filas de test (platform, sin scope). */
  clean: (tenantIds: string[]) => Promise<void>;
}

const TABLES: TableHarness[] = [
  {
    label: 'AlertHistory',
    sample: () => ({
      tipoAlerta: 'stock',
      severidad: 'alta',
      titulo: 'Sin stock',
      mensaje: 'Producto sin existencias',
    }),
    create: async (data) => prisma.alertHistory.create({ data: data as never }),
    findFirst: async (where) => prisma.alertHistory.findFirst({ where: where as never }),
    findMany: async () => prisma.alertHistory.findMany({ select: { tenantId: true } }),
    update: async (id, data) =>
      prisma.alertHistory.update({ where: { id }, data: data as never }),
    remove: async (id) => prisma.alertHistory.delete({ where: { id } }),
    clean: async (tenantIds) =>
      void (await prismaPlatform.alertHistory.deleteMany({ where: { tenantId: { in: tenantIds } } })),
  },
  {
    label: 'ReportHistory',
    sample: () => ({
      tipoReporte: 'ventas',
      formato: 'PDF',
      nombre: 'Reporte de ventas',
      generadoPor: 'user-a',
    }),
    create: async (data) => prisma.reportHistory.create({ data: data as never }),
    findFirst: async (where) => prisma.reportHistory.findFirst({ where: where as never }),
    findMany: async () => prisma.reportHistory.findMany({ select: { tenantId: true } }),
    update: async (id, data) =>
      prisma.reportHistory.update({ where: { id }, data: data as never }),
    remove: async (id) => prisma.reportHistory.delete({ where: { id } }),
    clean: async (tenantIds) =>
      void (await prismaPlatform.reportHistory.deleteMany({ where: { tenantId: { in: tenantIds } } })),
  },
  {
    label: 'ScheduledReport',
    sample: () => ({
      nombre: 'Reporte semanal',
      tipoReporte: 'ventas',
      formato: 'PDF',
      frecuencia: 'semanal',
      hora: '08:00',
      creadoPor: 'user-a',
    }),
    create: async (data) => prisma.scheduledReport.create({ data: data as never }),
    findFirst: async (where) => prisma.scheduledReport.findFirst({ where: where as never }),
    findMany: async () => prisma.scheduledReport.findMany({ select: { tenantId: true } }),
    update: async (id, data) =>
      prisma.scheduledReport.update({ where: { id }, data: data as never }),
    remove: async (id) => prisma.scheduledReport.delete({ where: { id } }),
    clean: async (tenantIds) =>
      void (await prismaPlatform.scheduledReport.deleteMany({ where: { tenantId: { in: tenantIds } } })),
  },
  {
    label: 'ScenarioSimulation',
    sample: () => ({
      nombre: 'Escenario base',
      tasasSimuladas: '{}',
      fechaProyeccion: new Date('2026-12-31T00:00:00.000Z'),
      resultados: '{}',
      creadoPor: 'user-a',
    }),
    create: async (data) => prisma.scenarioSimulation.create({ data: data as never }),
    findFirst: async (where) => prisma.scenarioSimulation.findFirst({ where: where as never }),
    findMany: async () => prisma.scenarioSimulation.findMany({ select: { tenantId: true } }),
    update: async (id, data) =>
      prisma.scenarioSimulation.update({ where: { id }, data: data as never }),
    remove: async (id) => prisma.scenarioSimulation.delete({ where: { id } }),
    clean: async (tenantIds) =>
      void (await prismaPlatform.scenarioSimulation.deleteMany({
        where: { tenantId: { in: tenantIds } },
      })),
  },
];

describe.each(TABLES)('AS-05 ola 2 $label tenant-scoped', { timeout: 30_000 }, (table) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let tenantA = '';
  let tenantB = '';

  beforeAll(async () => {
    const a = await prismaPlatform.tenant.create({
      data: { nombre: `AM ${table.label} ${suffix}`, slug: `am-${table.label}-${suffix}`.toLowerCase() },
    });
    const b = await prismaPlatform.tenant.create({
      data: { nombre: `BM ${table.label} ${suffix}`, slug: `bm-${table.label}-${suffix}`.toLowerCase() },
    });
    tenantA = a.tenantId;
    tenantB = b.tenantId;
  });

  afterAll(async () => {
    await table.clean([tenantA, tenantB]);
    await prismaPlatform.tenant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  });

  it('create inyecta el tenant desde el contexto', async () => {
    const row = await withTestTenant(tenantA, () => table.create(table.sample()));
    expect(row.tenantId).toBe(tenantA);
  });

  it('lectura cruzada no ve filas del otro tenant', async () => {
    const created = await withTestTenant(tenantB, () => table.create(table.sample()));
    const cross = await withTestTenant(tenantA, () => table.findFirst({ id: created.id }));
    expect(cross).toBeNull();

    const all = await withTestTenant(tenantA, () => table.findMany());
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((r) => r.tenantId === tenantA)).toBe(true);
  });

  it('update/delete cruzados no afectan (P2025)', async () => {
    const created = await withTestTenant(tenantB, () => table.create(table.sample()));

    const updateErr = (await withTestTenant(tenantA, () =>
      table.update(created.id, {}).catch((e: unknown) => e),
    )) as { code?: string };
    expect(updateErr?.code).toBe('P2025');

    const deleteErr = (await withTestTenant(tenantA, () =>
      table.remove(created.id).catch((e: unknown) => e),
    )) as { code?: string };
    expect(deleteErr?.code).toBe('P2025');
  });

  it('sin contexto en enforce falla cerrado', async () => {
    let error: unknown;
    try {
      await table.findMany();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TenantContextRequiredError);
  });
});
