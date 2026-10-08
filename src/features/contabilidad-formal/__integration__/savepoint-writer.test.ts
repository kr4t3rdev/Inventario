/**
 * @description Prueba PostgreSQL real de recuperación de un error SQL en savepoint
 * de la misma conexión del writer. No activa shadow ni modifica datos persistentes.
 */
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { intentarPosteoShadow } from '@/features/contabilidad-formal/services/shadow-savepoint';

describe('savepoint del writer — PostgreSQL real', () => {
  it('aísla un INSERT parcial y un error SQL real; el writer confirma en el mismo backend', async () => {
    const origen = `shadow-probe-${crypto.randomUUID()}`;
    const resultado = await prisma.$transaction(async (tx) => {
      const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      const intento = await intentarPosteoShadow(tx, async () => {
        await tx.$executeRaw`INSERT INTO "plantillas_asiento"
          ("plantillaId", "evento", "orden", "lado", "rolCuenta", "montoRegla", "version", "activa")
          VALUES (${origen}, 'VENTA_CONTADO', 1, 'DEBE', 'CAJA_PRINCIPAL', 'TOTAL', 1, true)`;
        await tx.$queryRawUnsafe('SELECT 1 / 0');
      });
      const [{ pid: despues }] = await tx.$queryRaw<Array<{ pid: number }>>`
        SELECT pg_backend_pid() AS pid
      `;
      expect(despues).toBe(pid);
      expect(intento.ok).toBe(false);
      expect(await tx.plantillaAsiento.count({ where: { plantillaId: origen } })).toBe(0);
      return tx.$queryRaw<Array<{ committed: number }>>`SELECT 1 AS committed`;
    });
    expect(resultado[0].committed).toBe(1);
    expect(await prisma.plantillaAsiento.count({ where: { plantillaId: origen } })).toBe(0);
  });
  it('recupera una violación SQL en el mismo backend sin abortar la transacción', async () => {
    const backend = await prisma.$transaction(async (tx) => {
      const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      await tx.$executeRawUnsafe('SAVEPOINT cta_shadow_probe');
      try {
        await tx.$queryRawUnsafe('SELECT 1 / 0');
        throw new Error('Se esperaba error SQL');
      } catch (error) {
        if (error instanceof Error && error.message === 'Se esperaba error SQL') throw error;
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT cta_shadow_probe');
      }
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT cta_shadow_probe');
      const [{ pid: despues }] = await tx.$queryRaw<Array<{ pid: number }>>`
        SELECT pg_backend_pid() AS pid
      `;
      expect(despues).toBe(pid);
      return pid;
    });
    expect(backend).toBeGreaterThan(0);
  });
});
