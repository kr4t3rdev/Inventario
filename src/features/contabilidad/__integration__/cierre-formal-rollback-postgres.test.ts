/**
 * @description Test de integración real del rollback físico formal del cierre
 * de período (R6.1, familia de cierre).
 *
 * Aprobar un período y contabilizar su cierre formal ocurren en la misma
 * transacción: el período no queda aprobado sin el asiento que vacía sus
 * cuentas de resultado. El test comprueba, en modo `enforce`, que el fallo del
 * insert del asiento de cierre revierte también la aprobación del período y su
 * auditoría.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => auth.user,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { createMermaAction } = await import('@/features/mermas/actions');
const { aprobarPeriodoAction } = await import('@/features/contabilidad/actions-periodos');

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `formal_cierre_${suffix}`;
const userId = `formal_user_${suffix}`;
const ledgerFailUserId = `formal_ledger_fail_${suffix}`;
const ledgerFailureFunction = `formal_cierre_ledger_failure_${suffix}`;
const ledgerFailureTrigger = `formal_cierre_ledger_trigger_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

let periodoId = '';
let productoId = '';
let almacenId = '';

/**
 * @description Construye el actor autenticado de la prueba para el tenant aislado.
 * @param {string} actorId - Identificador del actor (marca el failpoint cuando hace falta).
 * @returns {AuthenticatedUser} Actor con tenant y plan fijo.
 */
function userFor(actorId: string): AuthenticatedUser {
  return {
    userId: actorId,
    name: `Actor ${actorId}`,
    email: `${actorId}@test.local`,
    role: 'admin',
    isActive: true,
    tenantId,
    planFeatures: { inventario: true, contabilidad: true },
  } as unknown as AuthenticatedUser;
}

/**
 * @description Ejecuta una action con el actor indicado.
 * @param {() => Promise<unknown>} accion - Invocacion de la action.
 * @param {string} actorId - Actor que ejecuta la operacion.
 * @returns {Promise<{ success: boolean; error?: { message?: string } }>} Respuesta de la action.
 */
async function conActor(accion: () => Promise<unknown>, actorId = userId) {
  auth.user = userFor(actorId);
  return (await accion()) as { success: boolean; error?: { message?: string } };
}

/**
 * @description Captura el estado del período, su auditoría y el libro mayor
 * para comparar antes/despues del failpoint.
 * @returns {Promise<object>} Fotografia del estado persistido del tenant.
 */
async function readSnapshot() {
  const [periodo, auditorias, asientos, lineas] = await Promise.all([
    prisma.periodoContable.findUniqueOrThrow({
      where: { periodoId },
      select: { periodoId: true, estado: true, aprobadoPor: true, aprobadoAt: true },
    }),
    prisma.auditoriaPeriodo.count({ where: { tenantId } }),
    prisma.asiento.findMany({
      where: { tenantId },
      orderBy: { tenantSequence: 'asc' },
      select: {
        asientoId: true,
        origenTipo: true,
        origenId: true,
        estado: true,
        hash: true,
        hashAnterior: true,
      },
    }),
    prisma.asientoLinea.count({ where: { tenantId } }),
  ]);
  return {
    periodo: {
      estado: periodo.estado,
      aprobadoPor: periodo.aprobadoPor,
      aprobadoAt: periodo.aprobadoAt?.toISOString() ?? null,
    },
    auditorias,
    lineas,
    ledger: asientos.map((row) => ({
      id: row.asientoId,
      origenTipo: row.origenTipo,
      origenId: row.origenId,
      estado: row.estado,
      hash: row.hash,
      hashAnterior: row.hashAnterior,
    })),
  };
}

describe(
  'rollback fisico formal del cierre de periodo en PostgreSQL aislado',
  { timeout: 120_000 },
  () => {
    beforeAll(async () => {
      process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
      const identity = await prisma.$queryRaw<Array<{
        databaseName: string;
        roleName: string;
        serverPort: number;
      }>>`
        SELECT current_database() AS "databaseName",
          current_user AS "roleName", inet_server_port() AS "serverPort"
      `;
      expect(identity).toHaveLength(1);
      assertDisposableDatabaseIdentity(identity[0], process.env);

      await prisma.tenant.create({
        data: {
          tenantId,
          nombre: `formal-cierre-${suffix}`,
          slug: `formal-cierre-${suffix}`,
        },
      });
      // Los actores existen como usuarios reales: el trigger los distingue por
      // su identificador y las escrituras los referencian.
      for (const actorId of [userId, ledgerFailUserId]) {
        await prisma.user.create({
          data: {
            userId: actorId,
            name: `Actor ${actorId}`,
            email: `${actorId}@test.local`,
            password: 'x',
          },
        });
      }
      const now = new Date();
      const periodo = await prisma.periodoContable.create({
        data: {
          tenantId,
          tipo: 'MENSUAL',
          estado: 'ABIERTO',
          fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
          fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
        },
      });
      periodoId = periodo.periodoId;
      await prisma.moneda.upsert({
        where: { codigo: 'CUP' },
        create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
        update: {},
      });
      await prisma.tenantAccountingPolicy.create({
        data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
      });
      await prisma.$transaction((tx) => seedPlanContable(tx as never, tenantId));
      await seedPlantillasGlobales(prisma as never);
      await prisma.tenantLicense.create({
        data: {
          tenantId,
          activa: true,
          expiracion: new Date(Date.now() + 86_400_000),
          features: { 'contabilidad-formal': true },
        },
      });

      const categoria = await prisma.categoria.create({
        data: { nombre: `Cat ${suffix}`, tenantId },
      });
      const almacen = await prisma.almacen.create({
        data: { nombre: `Alm ${suffix}`, tenantId },
      });
      almacenId = almacen.almacenId;
      const producto = await prisma.producto.create({
        data: {
          nombre: `Prod ${suffix}`,
          precioCosto: 100,
          precioVenta: 500,
          stock: 10,
          tenant: { connect: { tenantId } },
          categoria: { connect: { catId: categoria.catId } },
          almacen: { connect: { almacenId: almacen.almacenId } },
        },
      });
      productoId = producto.id;
      await prisma.stockUbicacion.create({
        data: {
          tenantId,
          productoId,
          tipoUbicacion: 'almacen',
          ubicacionId: almacenId,
          cantidad: 10,
          cantidadDisponible: 10,
        },
      });

      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION public."${ledgerFailureFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."tenantId" = '${tenantId}' AND NEW."createdBy" LIKE 'formal_ledger_fail_%' THEN RAISE EXCEPTION 'forced asiento failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER "${ledgerFailureTrigger}" BEFORE INSERT ON public."asientos" FOR EACH ROW EXECUTE FUNCTION public."${ledgerFailureFunction}"()`,
      );

      // Una merma deja saldo en una cuenta de resultado: sin ella el cierre
      // formal se omitiria por resultado cero y no habria asiento que fallar.
      const merma = await conActor(() =>
        createMermaAction({
          productoId,
          cantidad: 2,
          motivo: 'Merma que genera el resultado del periodo',
          almacenId,
        }),
      );
      expect(merma.success).toBe(true);
    });

    afterAll(async () => {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${ledgerFailureTrigger}" ON public."asientos"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${ledgerFailureFunction}"()`);
      // Limpieza tenant-scoped: la prueba crea tenant, actores, período,
      // plan contable, inventario y asientos. Sin este bloque la base
      // desechable conserva residuos sintéticos entre corridas.
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "fx_evidence" DISABLE TRIGGER "fx_evidence_immutable_delete"',
      );
      try {
        await prisma.fxEvidence.deleteMany({ where: { tenantId } });
      } finally {
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "fx_evidence" ENABLE TRIGGER "fx_evidence_immutable_delete"',
        );
      }
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "StockMoveLine" DISABLE TRIGGER "stock_move_line_no_delete"',
      );
      try {
        await prisma.stockMoveLine.deleteMany({ where: { tenantId } });
      } finally {
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "StockMoveLine" ENABLE TRIGGER "stock_move_line_no_delete"',
        );
      }
      await prisma.stockUbicacionDetalle.deleteMany({ where: { tenantId } });
      await prisma.stockUbicacion.deleteMany({ where: { tenantId } });
      await prisma.ajusteInventario.deleteMany({ where: { tenantId } });
      await prisma.merma.deleteMany({ where: { tenantId } });
      await prisma.asientoLinea.deleteMany({ where: { tenantId } });
      await prisma.asiento.deleteMany({ where: { tenantId } });
      await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.periodoContable.deleteMany({ where: { tenantId } });
      await prisma.periodoCache.deleteMany({ where: { tenantId } });
      await prisma.auditLog.deleteMany({
        where: { usuarioId: { in: [userId, ledgerFailUserId] } },
      });
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
      await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
      await prisma.diario.deleteMany({ where: { tenantId } });
      await prisma.cuentaContable.deleteMany({ where: { tenantId } });
      await prisma.ubicacion.deleteMany({ where: { tenantId } });
      await prisma.tenantLicense.deleteMany({ where: { tenantId } });
      await prisma.producto.deleteMany({ where: { tenantId } });
      await prisma.categoria.deleteMany({ where: { tenantId } });
      await prisma.almacen.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({
        where: { userId: { in: [userId, ledgerFailUserId] } },
      });
      if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
      auth.user = null;
    });

    it('revierte la aprobacion del periodo cuando falla el insert del asiento de cierre', async () => {
      const before = await readSnapshot();

      const resultado = await conActor(
        () => aprobarPeriodoAction({ periodoId }),
        ledgerFailUserId,
      );

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });

    it('aprueba el periodo y contabiliza su asiento de cierre formal', async () => {
      const before = await readSnapshot();

      const resultado = await conActor(() => aprobarPeriodoAction({ periodoId }));

      expect(resultado.success).toBe(true);
      const after = await readSnapshot();
      expect(after.periodo.estado).toBe('APROBADO');
      expect(after.ledger).toHaveLength(before.ledger.length + 1);

      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'cierre_periodo',
            origenId: periodoId,
          },
        },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(asiento.estado).toBe('CONTABILIZADO');
      expect(asiento.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(asiento.lineas.length).toBeGreaterThanOrEqual(2);
      const debe = asiento.lineas.reduce(
        (sum, linea) => sum.add(linea.debe),
        asiento.lineas[0].debe.mul(0),
      );
      const haber = asiento.lineas.reduce(
        (sum, linea) => sum.add(linea.haber),
        asiento.lineas[0].haber.mul(0),
      );
      expect(debe.toString()).toBe(haber.toString());
      expect(debe.toString()).toBe('200');
    });
  },
);
