import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getReconciliationStats, type ReconciliationStatsDb } from '../reconciliation-stats-service';

describe('reconciliation service counts on PostgreSQL', () => {
  it('counts only null pending services for the requested tenant', async () => {
    const rollback = new Error('rollback fixture transaction');
    await expect(prisma.$transaction(async (tx) => {
      const first = await tx.tenant.create({ data: { nombre: 'Service count test A' } });
      const second = await tx.tenant.create({ data: { nombre: 'Service count test B' } });
      const a = await tx.servicios.create({ data: { tenantId: first.tenantId, nombre: 'A', descripcion: 'Test', precio: 100 } });
      const b = await tx.servicios.create({ data: { tenantId: second.tenantId, nombre: 'B', descripcion: 'Test', precio: 100 } });
      await tx.ventaServicios.createMany({ data: [
        { tenantId: first.tenantId, servicioId: a.servicioId, cantidad: 1, total: 100, reconciliado: null },
        { tenantId: first.tenantId, servicioId: a.servicioId, cantidad: 1, total: 100, reconciliado: false },
        { tenantId: first.tenantId, servicioId: a.servicioId, cantidad: 1, total: 100, reconciliado: true },
        { tenantId: second.tenantId, servicioId: b.servicioId, cantidad: 1, total: 100, reconciliado: null },
      ] });
      const stats = await getReconciliationStats({ tenantId: first.tenantId, db: tx as unknown as ReconciliationStatsDb });
      expect(stats.modules.servicios.pending).toBe(1);
      throw rollback;
    })).rejects.toBe(rollback);
  });
});
