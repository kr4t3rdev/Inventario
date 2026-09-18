import { Prisma } from '@/generated/prisma';

/**
 * @description Builds the tenant-scoped sales count used by reconciliation statistics.
 * @param {string} tenantId - Tenant whose sales and related accounting records are eligible.
 * @returns {Prisma.Sql} Parameterized SQL for the pending-sales count.
 * @throws {Error} When the tenant identifier is empty.
 */
export function buildPendingSalesCountQuery(tenantId: string): Prisma.Sql {
  if (tenantId.trim().length === 0) {
    throw new Error('tenantId is required');
  }

  return Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM (
      SELECT v."ventaId"
      FROM "Venta" v
      LEFT JOIN "ReconciliacionVenta" rv
        ON rv."ventaId" = v."ventaId"
        AND rv."tenantId" = ${tenantId}
      WHERE v."tenantId" = ${tenantId}
        AND v."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "CuentaPorCobrar" cxc
          LEFT JOIN "facturas" f ON cxc."facturaId" = f."idFactura"
          WHERE cxc."tenantId" = ${tenantId}
            AND cxc."estado" IN (
              ${'PENDIENTE'}::"EstadoCuentaPorCobrar",
              ${'PARCIAL'}::"EstadoCuentaPorCobrar"
            )
            AND (
              (
                f."tenantId" = ${tenantId}
                AND f."ventaId" = v."ventaId"
              )
              OR cxc."facturaId" = v."ventaId"
            )
        )
      GROUP BY v."ventaId", v."total"
      HAVING (
        COALESCE(v."total", 0) - COALESCE(SUM(
          COALESCE(rv."montoConvertido", CASE
              WHEN rv."moneda" = 'CUP' THEN rv."monto"
              WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0
                THEN rv."monto" * rv."tasaCambio"
              ELSE rv."monto"
            END)
        ), 0)
      ) > 0.1
    ) AS pending_sales
  `;
}
