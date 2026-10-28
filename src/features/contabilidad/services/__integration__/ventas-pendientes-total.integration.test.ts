import { describe, expect, it, vi } from 'vitest';
import { Prisma, PrismaClient } from '@/generated/prisma';

const db = vi.hoisted(() => ({ current: null as Prisma.TransactionClient | null }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (query: Prisma.Sql) => db.current!.$queryRaw(query),
  },
}));
vi.mock('@/lib/server-actions', () => ({
  withAction: (handler: (input: unknown, user: unknown) => unknown) =>
    (input: unknown) => handler(input, { userId: 'test-user', tenantId: 'test-tenant' }),
  ActionError: class ActionError extends Error {},
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: () => undefined,
  requireTenant: (user: { tenantId: string }) => user.tenantId,
}));

import { getVentasPendientesAction } from '../../actions-reconciliacion';

describe('totales de ventas pendientes en PostgreSQL', () => {
  it('incluye todas las páginas, excluye CxC activas y respeta fechas y punto de venta', async () => {
    const client = new PrismaClient();
    try {
      await client.$transaction(async (tx) => {
        db.current = tx;
        await tx.$executeRawUnsafe(`CREATE TEMP TABLE "Venta" (
          "ventaId" text PRIMARY KEY, "tenantId" text, "total" numeric,
          "deletedAt" timestamptz, "createdAt" timestamptz, "puntoDeVentaId" text
        ) ON COMMIT DROP`);
        await tx.$executeRawUnsafe(`CREATE TEMP TABLE "ReconciliacionVenta" (
          "ventaId" text, "monto" numeric, "moneda" text, "tasaCambio" numeric
        ) ON COMMIT DROP`);
        await tx.$executeRawUnsafe(`CREATE TEMP TABLE "facturas" (
          "idFactura" text, "ventaId" text
        ) ON COMMIT DROP`);
        await tx.$executeRawUnsafe(`CREATE TEMP TABLE "CuentaPorCobrar" (
          "facturaId" text, "tenantId" text, "estado" "EstadoCuentaPorCobrar"
        ) ON COMMIT DROP`);
        await tx.$executeRaw`INSERT INTO "Venta" ("ventaId", "tenantId", "total", "createdAt", "puntoDeVentaId")
          SELECT 'sale-' || n, 'test-tenant', 100, '2026-01-15'::timestamptz, 'pv-1'
          FROM generate_series(1, 250) AS n`;
        await tx.$executeRaw`INSERT INTO "facturas" VALUES ('invoice-1', 'sale-1'), ('invoice-2', 'sale-2')`;
        await tx.$executeRaw`INSERT INTO "CuentaPorCobrar" VALUES
          ('invoice-1', 'test-tenant', 'PENDIENTE'), ('invoice-2', 'test-tenant', 'PARCIAL')`;
        await tx.$executeRaw`INSERT INTO "ReconciliacionVenta" VALUES ('sale-3', 40, 'CUP', NULL)`;
        await tx.$executeRaw`INSERT INTO "Venta" ("ventaId", "tenantId", "total", "createdAt", "puntoDeVentaId") VALUES
          ('otro-punto', 'test-tenant', 300, '2026-01-15', 'pv-2'),
          ('otra-fecha', 'test-tenant', 500, '2026-02-15', 'pv-1'),
          ('otro-tenant', 'other-tenant', 700, '2026-01-15', 'pv-1')`;

        const result = await getVentasPendientesAction({
          fechaInicio: '2026-01-01', fechaFin: '2026-01-31', puntoDeVentaId: 'pv-1',
          page: 4, limit: 100,
        }) as unknown as { pagination: { total: number }; saldoPendienteTotal: number; ventas: unknown[] };
        expect(result.pagination.total).toBe(248);
        expect(result.saldoPendienteTotal).toBe(24760);
        expect(result.ventas).toEqual([]);
      });
    } finally {
      db.current = null;
      await client.$disconnect();
    }
  });
});
