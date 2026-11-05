/**
 * @description Test de integración real del rollback físico formal de la
 * producción (R6.1, familia de producción).
 *
 * Completar una orden de producción reclasifica el costo histórico consumido
 * hacia el producto terminado (`PRODUCCION_SALIDA`) en la misma transacción
 * que termina la orden, incrementa el stock del producto final y deja su
 * movimiento en el kardex. El test comprueba, en modo `enforce`, que el fallo
 * del insert del asiento revierte el conjunto completo.
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

const { completarOrdenProduccionAction } = await import('@/features/produccion/actions');

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `formal_produccion_${suffix}`;
const userId = `formal_user_${suffix}`;
const ledgerFailUserId = `formal_ledger_fail_${suffix}`;
const ledgerFailureFunction = `formal_produccion_ledger_failure_${suffix}`;
const ledgerFailureTrigger = `formal_produccion_ledger_trigger_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

let recetaId = '';
let productoFinalId = '';
let almacenId = '';
let ingredientProductoId = '';
let ordenCounter = 0;

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
    planFeatures: { produccion: true, inventario: true },
  } as unknown as AuthenticatedUser;
}

/**
 * @description Captura el estado de la producción, el stock y el libro mayor
 * para comparar antes/despues del failpoint.
 * @returns {Promise<object>} Fotografia del estado persistido del tenant.
 */
async function readSnapshot() {
  const [ordenes, historial, ubicaciones, detalles, kardex, asientos, lineas] = await Promise.all([
    prisma.ordenProduccion.findMany({
      where: { tenantId },
      select: { ordenProduccionId: true, estado: true, costoMateriales: true },
      orderBy: { ordenProduccionId: 'asc' },
    }),
    prisma.ordenProduccionHistorial.count({ where: { tenantId } }),
    prisma.stockUbicacion.findMany({
      where: { tenantId },
      select: {
        productoId: true,
        tipoUbicacion: true,
        ubicacionId: true,
        cantidad: true,
        cantidadDisponible: true,
      },
      orderBy: [{ productoId: 'asc' }, { tipoUbicacion: 'asc' }, { ubicacionId: 'asc' }],
    }),
    prisma.stockUbicacionDetalle.findMany({
      where: { tenantId },
      select: {
        productoId: true,
        almacenId: true,
        ubicacionHijaId: true,
        cantidad: true,
        cantidadDisponible: true,
      },
      orderBy: [{ productoId: 'asc' }, { ubicacionHijaId: 'asc' }],
    }),
    prisma.stockMoveLine.findMany({
      where: { tenantId },
      select: {
        productoId: true,
        tipoOrigen: true,
        origenId: true,
        secuencia: true,
        cantidad: true,
        costoUnitario: true,
      },
      orderBy: [{ origenId: 'asc' }, { secuencia: 'asc' }],
    }),
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
    ordenes: ordenes.map((row) => ({
      id: row.ordenProduccionId,
      estado: row.estado,
      costoMateriales: row.costoMateriales,
    })),
    historial,
    ubicaciones: ubicaciones.map((row) => ({
      productoId: row.productoId,
      tipoUbicacion: row.tipoUbicacion,
      ubicacionId: row.ubicacionId,
      cantidad: row.cantidad,
      cantidadDisponible: row.cantidadDisponible,
    })),
    detalles: detalles.map((row) => ({
      productoId: row.productoId,
      almacenId: row.almacenId,
      ubicacionHijaId: row.ubicacionHijaId,
      cantidad: row.cantidad,
      cantidadDisponible: row.cantidadDisponible,
    })),
    kardex: kardex.map((row) => ({
      productoId: row.productoId,
      tipoOrigen: row.tipoOrigen,
      origenId: row.origenId,
      secuencia: row.secuencia,
      cantidad: row.cantidad,
      costoUnitario: row.costoUnitario,
    })),
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
  'rollback fisico formal de la produccion en PostgreSQL aislado',
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
          nombre: `formal-produccion-${suffix}`,
          slug: `formal-produccion-${suffix}`,
        },
      });
      // Los actores existen como usuarios reales: el kardex los referencia por
      // clave foranea y el trigger los distingue por su identificador.
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
      await prisma.periodoContable.create({
        data: {
          tenantId,
          tipo: 'MENSUAL',
          estado: 'ABIERTO',
          fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
          fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
        },
      });
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
      const ingrediente = await prisma.producto.create({
        data: {
          nombre: `Ingrediente ${suffix}`,
          precioCosto: 100,
          precioVenta: 150,
          stock: 20,
          tenant: { connect: { tenantId } },
          categoria: { connect: { catId: categoria.catId } },
          almacen: { connect: { almacenId: almacen.almacenId } },
        },
      });
      ingredientProductoId = ingrediente.id;
      const productoFinal = await prisma.producto.create({
        data: {
          nombre: `Producto final ${suffix}`,
          precioCosto: 0,
          precioVenta: 400,
          stock: 0,
          tenant: { connect: { tenantId } },
          categoria: { connect: { catId: categoria.catId } },
          almacen: { connect: { almacenId: almacen.almacenId } },
        },
      });
      productoFinalId = productoFinal.id;
      await prisma.stockUbicacion.create({
        data: {
          tenantId,
          productoId: ingrediente.id,
          tipoUbicacion: 'almacen',
          ubicacionId: almacen.almacenId,
          cantidad: 20,
          cantidadDisponible: 20,
        },
      });
      // La receta se escribe con el cliente Prisma: el esquema y la base ya
      // coinciden en el tipo de `costoUnitario` (Float / DOUBLE PRECISION).
      const receta = await prisma.receta.create({
        data: {
          recetaId: `formal-receta-${suffix}`,
          tenantId,
          nombre: `Receta ${suffix}`,
          rendimiento: 1,
          productoId: productoFinal.id,
          updatedAt: new Date(),
        },
      });
      recetaId = receta.recetaId;
      await prisma.recetaIngrediente.create({
        data: {
          id: `formal-receta-ingrediente-${suffix}`,
          recetaId,
          tenantId,
          productoId: ingrediente.id,
          cantidad: 2,
          desperdicio: 0,
          updatedAt: new Date(),
        },
      });

      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION public."${ledgerFailureFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."tenantId" = '${tenantId}' AND NEW."createdBy" LIKE 'formal_ledger_fail_%' THEN RAISE EXCEPTION 'forced asiento failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER "${ledgerFailureTrigger}" BEFORE INSERT ON public."asientos" FOR EACH ROW EXECUTE FUNCTION public."${ledgerFailureFunction}"()`,
      );
    });

    afterAll(async () => {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${ledgerFailureTrigger}" ON public."asientos"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${ledgerFailureFunction}"()`);
      if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
      auth.user = null;
    });

    /**
     * @description Crea una orden de produccion lista para completarse.
     * @returns {Promise<string>} Identificador de la orden creada.
     */
    async function crearOrdenEnProceso(): Promise<string> {
      ordenCounter += 1;
      const ordenId = `formal-orden-${suffix}-${ordenCounter}`;
      await prisma.ordenProduccion.create({
        data: {
          ordenProduccionId: ordenId,
          tenantId,
          recetaId,
          cantidad: 1,
          estado: 'EN_PROCESO',
          updatedAt: new Date(),
        },
      });
      return ordenId;
    }

    it('contabiliza la salida de produccion y termina la orden', async () => {
      const ordenId = await crearOrdenEnProceso();
      const before = await readSnapshot();

      auth.user = userFor(userId);
      const resultado = await completarOrdenProduccionAction(ordenId);

      expect(resultado.success).toBe(true);
      const after = await readSnapshot();
      const orden = after.ordenes.find((row) => row.id === ordenId);
      expect(orden?.estado).toBe('COMPLETADA');
      expect(orden?.costoMateriales).toBe(200);
      expect(after.historial).toBe(before.historial + 1);
      expect(after.ledger).toHaveLength(before.ledger.length + 1);

      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'orden_produccion',
            origenId: ordenId,
          },
        },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(asiento.estado).toBe('CONTABILIZADO');
      expect(asiento.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(asiento.lineas).toHaveLength(2);
      const debe = asiento.lineas.reduce(
        (sum, linea) => sum.add(linea.debe),
        asiento.lineas[0].debe.mul(0),
      );
      const haber = asiento.lineas.reduce(
        (sum, linea) => sum.add(linea.haber),
        asiento.lineas[0].haber.mul(0),
      );
      expect(debe.toString()).toBe('200');
      expect(haber.toString()).toBe('200');
    });

    it('revierte la salida de produccion cuando falla el insert del asiento', async () => {
      const ordenId = await crearOrdenEnProceso();
      const before = await readSnapshot();

      auth.user = userFor(ledgerFailUserId);
      const resultado = await completarOrdenProduccionAction(ordenId);

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });
  },
);
