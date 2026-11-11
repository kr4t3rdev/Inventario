/**
 * @description Test de integración real del rollback físico formal de la merma
 * de inventario (R6.1, familia de inventario).
 *
 * La merma escribe la merma, descuenta el stock de la ubicación, registra el
 * kardex y crea su documento espejo `AjusteInventario`; todo eso comparte
 * transacción con el asiento formal `MERMA_INVENTARIO`. El test comprueba, en
 * modo `enforce`, que el fallo del insert del asiento revierte el conjunto
 * completo: no queda merma, ni ajuste, ni kardex, ni stock descontado.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { emitirReversionMermaSiContabilizada } from '@/features/contabilidad-formal/services/inventory-adjustment-posting-service';
import { recolectarCandidatos } from '@/features/contabilidad-formal/services/replay-source-collector';
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

const { createMermaAction, deleteMermaAction } = await import('@/features/mermas/actions');

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `formal_merma_${suffix}`;
const userId = `formal_user_${suffix}`;
const ledgerFailUserId = `formal_ledger_fail_${suffix}`;
const ledgerFailureFunction = `formal_merma_ledger_failure_${suffix}`;
const ledgerFailureTrigger = `formal_merma_ledger_trigger_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

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
    role: 'regularUser',
    isActive: true,
    tenantId,
    tenantRole: 'manager',
    planFeatures: { inventario: true },
  } as unknown as AuthenticatedUser;
}

/**
 * @description Registra la merma dentro del contexto del tenant.
 * @param {Record<string, unknown>} input - Payload de la merma.
 * @param {string} actorId - Actor que ejecuta la operación.
 * @returns {Promise<{ success: boolean; error?: { message?: string } }>} Respuesta de la action.
 */
async function registrarMerma(input: Record<string, unknown>, actorId = userId) {
  auth.user = userFor(actorId);
  return createMermaAction(input as never);
}

/**
 * @description Captura el estado operativo y el libro mayor para comparar
 * antes/después del failpoint.
 * @returns {Promise<object>} Fotografía del estado persistido del tenant.
 */
async function readSnapshot() {
  const [mermas, ajustes, kardex, stock, notificaciones, asientos, lineas] = await Promise.all([
    prisma.merma.count({ where: { tenantId } }),
    prisma.ajusteInventario.count({ where: { tenantId } }),
    prisma.stockMoveLine.count({ where: { tenantId } }),
    prisma.stockUbicacion.findMany({
      where: { tenantId },
      select: { productoId: true, cantidad: true, cantidadDisponible: true },
      orderBy: { productoId: 'asc' },
    }),
    prisma.notification.count({ where: { type: 'merma' } }),
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
    mermas,
    ajustes,
    kardex,
    notificaciones,
    lineas,
    stock: stock.map((row) => ({
      productoId: row.productoId,
      cantidad: row.cantidad,
      disponible: row.cantidadDisponible,
    })),
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
  'rollback fisico formal de la merma de inventario en PostgreSQL aislado',
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
          nombre: `formal-merma-${suffix}`,
          slug: `formal-merma-${suffix}`,
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

    it('contabiliza la merma con su asiento formal y su documento espejo', async () => {
      const before = await readSnapshot();
      const resultado = await registrarMerma({
        productoId,
        cantidad: 2,
        motivo: 'Merma de control',
        almacenId,
      });

      expect(resultado.success).toBe(true);
      const after = await readSnapshot();
      expect(after.mermas).toBe(before.mermas + 1);
      expect(after.ajustes).toBe(before.ajustes + 1);
      expect(after.kardex).toBe(before.kardex + 1);
      expect(after.stock[0].cantidad).toBe(8);
      expect(after.stock[0].disponible).toBe(8);
      expect(after.ledger).toHaveLength(before.ledger.length + 1);

      const ajuste = await prisma.ajusteInventario.findFirstOrThrow({
        where: { tenantId },
        select: { id: true },
      });
      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'ajuste_merma',
            origenId: ajuste.id,
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

    it('revierte la escritura operativa y el libro mayor cuando falla el insert del asiento', async () => {
      const before = await readSnapshot();
      const resultado = await registrarMerma(
        {
          productoId,
          cantidad: 3,
          motivo: 'Merma con failpoint de ledger',
          almacenId,
        },
        ledgerFailUserId,
      );

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });

    it('elimina la merma con su asiento inverso y devuelve el stock', async () => {
      const creada = await registrarMerma({
        productoId,
        cantidad: 1,
        motivo: 'Merma que se anula',
        almacenId,
      });
      expect(creada.success).toBe(true);
      const mermaId = (creada as { data?: { mermaId?: string } }).data?.mermaId;
      expect(typeof mermaId).toBe('string');

      const before = await readSnapshot();
      auth.user = userFor(userId);
      const eliminada = await deleteMermaAction(mermaId as string);

      expect(eliminada.success).toBe(true);
      const after = await readSnapshot();
      expect(after.mermas).toBe(before.mermas - 1);
      // La eliminacion devuelve al stock la cantidad de la merma anulada.
      expect(after.stock[0].cantidad).toBe(before.stock[0].cantidad + 1);
      expect(after.stock[0].disponible).toBe(before.stock[0].disponible + 1);
      // El asiento inverso compensa el reconocimiento de la merma.
      expect(after.ledger).toHaveLength(before.ledger.length + 1);
      const inverso = after.ledger.at(-1);
      expect(inverso?.origenTipo).toBe('ajuste_merma_reversado');
      const ajuste = await prisma.ajusteInventario.findFirstOrThrow({ where: { tenantId, origenMermaId: mermaId } });
      const asiento = await prisma.asiento.findFirstOrThrow({ where: {
        tenantId, origenTipo: 'ajuste_merma_reversado', origenId: ajuste.id,
      } });
      expect(ajuste.mermaReversionFecha).toEqual(asiento.fecha);
      expect(ajuste.mermaReversionRegistradaAt).toEqual(asiento.fecha);
      const candidato = (await recolectarCandidatos(tenantId))
        .find((item) => item.origenTipo === 'ajuste_merma_reversado' && item.origenId === ajuste.id);
      expect(candidato).toMatchObject({ fecha: asiento.fecha,
        evento: { tipo: 'MERMA_INVENTARIO_REVERSADA', montoFuncional: Math.abs(ajuste.costoTotal) } });
      expect(candidato?.causaOmision).toBeUndefined();
    });

    it('revierte la eliminacion de la merma cuando falla el insert del asiento inverso', async () => {
      const creada = await registrarMerma({
        productoId,
        cantidad: 1,
        motivo: 'Merma anulada con failpoint',
        almacenId,
      });
      expect(creada.success).toBe(true);
      const mermaId = (creada as { data?: { mermaId?: string } }).data?.mermaId;

      const before = await readSnapshot();
      auth.user = userFor(ledgerFailUserId);
      const eliminada = await deleteMermaAction(mermaId as string);

      expect(eliminada.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
      const ajuste = await prisma.ajusteInventario.findFirstOrThrow({ where: { tenantId, origenMermaId: mermaId } });
      expect(ajuste.mermaReversionFecha).toBeNull();
      expect(ajuste.mermaReversionRegistradaAt).toBeNull();
    });

    it('no duplica stock ni asiento al eliminar la misma merma concurrentemente', async () => {
      const creada = await registrarMerma({ productoId, cantidad: 1, motivo: 'Carrera local', almacenId });
      expect(creada.success).toBe(true);
      const mermaId = (creada as { data?: { mermaId?: string } }).data?.mermaId as string;
      const ajuste = await prisma.ajusteInventario.findFirstOrThrow({ where: { tenantId, origenMermaId: mermaId } });
      const before = await readSnapshot();
      auth.user = userFor(userId);
      const resultados = await Promise.all([deleteMermaAction(mermaId), deleteMermaAction(mermaId)]);
      expect(resultados.filter((resultado) => resultado.success)).toHaveLength(1);
      const after = await readSnapshot();
      expect(after.stock[0].cantidad).toBe(before.stock[0].cantidad + 1);
      expect(after.stock[0].disponible).toBe(before.stock[0].disponible + 1);
      expect(await prisma.asiento.count({ where: {
        tenantId, origenTipo: 'ajuste_merma_reversado', origenId: ajuste.id,
      } })).toBe(1);
    });

    it('revierte la fecha provisional si ya existía un asiento inverso', async () => {
      const creada = await registrarMerma({ productoId, cantidad: 1, motivo: 'Reverso previo', almacenId });
      expect(creada.success).toBe(true);
      const mermaId = (creada as { data?: { mermaId?: string } }).data?.mermaId as string;
      const ajuste = await prisma.ajusteInventario.findFirstOrThrow({ where: { tenantId, origenMermaId: mermaId } });
      await prisma.$transaction((tx) => emitirReversionMermaSiContabilizada(tx, { tenantId, userId }, {
        ajusteInventarioId: ajuste.id, fecha: new Date(), costoTotal: ajuste.costoTotal,
        fechaValoracionOriginal: ajuste.createdAt,
      }));
      const before = await readSnapshot();
      auth.user = userFor(userId);
      const resultado = await deleteMermaAction(mermaId);
      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
      const despues = await prisma.ajusteInventario.findUniqueOrThrow({ where: { id: ajuste.id } });
      expect(despues.mermaReversionFecha).toBeNull();
      expect(despues.mermaReversionRegistradaAt).toBeNull();
    });

    it('conserva evidencia FX de la reversión con moneda funcional USD', async () => {
      const tasa = await prisma.tasaCambio.create({ data: { monedaOrigenId: 'CUP', monedaDestino: 'USD',
        tasa: 0.04, fechaVigencia: new Date(Date.now() - 60_000) } });
      try {
        await prisma.tenantAccountingPolicy.update({ where: { tenantId }, data: { functionalCurrencyCode: 'USD' } });
        const creada = await registrarMerma({ productoId, cantidad: 1, motivo: 'Merma FX local', almacenId });
        expect(creada.success).toBe(true);
        const mermaId = (creada as { data?: { mermaId?: string } }).data?.mermaId as string;
        const ajuste = await prisma.ajusteInventario.findFirstOrThrow({ where: { tenantId, origenMermaId: mermaId } });
        auth.user = userFor(userId);
        expect((await deleteMermaAction(mermaId)).success).toBe(true);
        const evidencia = await prisma.fxEvidence.findFirstOrThrow({ where: {
          tenantId, sourceType: 'ajuste_merma_reversado', sourceId: ajuste.id,
        } });
        const asiento = await prisma.asiento.findFirstOrThrow({ where: {
          tenantId, origenTipo: 'ajuste_merma_reversado', origenId: ajuste.id,
        }, include: { lineas: true } });
        expect(evidencia.functionalCurrency).toBe('USD');
        expect(evidencia.fxCatalogRateId).toBe(tasa.tasaId);
        expect(evidencia.cutoffAt).toEqual(ajuste.createdAt);
        expect(asiento.lineas.every((linea) => linea.fxEvidenceFingerprint === evidencia.evidenceFingerprint)).toBe(true);
        const candidato = (await recolectarCandidatos(tenantId))
          .find((item) => item.origenTipo === 'ajuste_merma_reversado' && item.origenId === ajuste.id);
        expect(candidato?.causaOmision).toBeUndefined();
        expect(candidato?.evento).toMatchObject({ montoFuncional: 100 * 0.04,
          monedaFuncional: 'USD', fxEvidenceFingerprint: evidencia.evidenceFingerprint });

        const otra = await registrarMerma({ productoId, cantidad: 1, motivo: 'Rollback FX local', almacenId });
        expect(otra.success).toBe(true);
        const otraId = (otra as { data?: { mermaId?: string } }).data?.mermaId as string;
        const otroAjuste = await prisma.ajusteInventario.findFirstOrThrow({ where: { tenantId, origenMermaId: otraId } });
        auth.user = userFor(ledgerFailUserId);
        expect((await deleteMermaAction(otraId)).success).toBe(false);
        expect(await prisma.fxEvidence.count({ where: { tenantId,
          sourceType: 'ajuste_merma_reversado', sourceId: otroAjuste.id } })).toBe(0);
        const trasFallo = await prisma.ajusteInventario.findUniqueOrThrow({ where: { id: otroAjuste.id } });
        expect(trasFallo.mermaReversionFecha).toBeNull();
      } finally {
        await prisma.tenantAccountingPolicy.update({ where: { tenantId }, data: { functionalCurrencyCode: 'CUP' } });
        await prisma.tasaCambio.delete({ where: { tasaId: tasa.tasaId } });
      }
    });
  },
);
