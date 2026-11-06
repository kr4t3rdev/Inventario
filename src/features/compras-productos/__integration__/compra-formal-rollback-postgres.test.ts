/**
 * @description Test de integración real del rollback físico formal de la compra
 * de productos (R6.1, familia comercial).
 *
 * La compra abre varias escrituras operativas —documento, línea, stock, kardex,
 * historial de costo, gasto, cuenta por pagar y, con pago completo, la
 * reconciliación y el movimiento de tesorería— y todas comparten transacción
 * con el asiento formal `COMPRA_CREDITO`. El test comprueba, en modo
 * `enforce`, que el fallo del insert del asiento revierte el conjunto completo.
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

const { createCompraProductoAction } = await import('@/features/compras-productos/actions');

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `formal_compra_${suffix}`;
const userId = `formal_user_${suffix}`;
const ledgerFailUserId = `formal_ledger_fail_${suffix}`;
const bancoId = `formal_compra_bank_${suffix}`;
const ledgerFailureFunction = `formal_compra_ledger_failure_${suffix}`;
const ledgerFailureTrigger = `formal_compra_ledger_trigger_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

let productoId = '';
let proveedorId = '';
let tipoPagoId = '';

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
    planFeatures: { contabilidad: true, 'cuentas-pagar': true },
  } as unknown as AuthenticatedUser;
}

/**
 * @description Registra la compra de productos dentro del contexto del tenant.
 * @param {Record<string, unknown>} input - Payload de la compra.
 * @param {string} actorId - Actor que ejecuta la operación.
 * @returns {Promise<{ success: boolean; error?: { message?: string } }>} Respuesta de la action.
 */
async function registrarCompra(input: Record<string, unknown>, actorId = userId) {
  auth.user = userFor(actorId);
  return createCompraProductoAction(input as never);
}

/**
 * @description Captura el estado operativo y el libro mayor para comparar
 * antes/después del failpoint.
 * @returns {Promise<object>} Fotografía del estado persistido del tenant.
 */
async function readSnapshot() {
  const [
    documentos,
    lineas,
    stock,
    kardex,
    costos,
    gastos,
    cxps,
    reconciliaciones,
    banco,
    asientos,
    lineasContables,
  ] = await Promise.all([
    prisma.compraDocumento.count({ where: { tenantId } }),
    prisma.compraDocumentoItem.count({ where: { tenantId } }),
    prisma.stockUbicacion.findMany({
      where: { tenantId },
      select: { productoId: true, cantidad: true, cantidadDisponible: true },
      orderBy: { productoId: 'asc' },
    }),
    prisma.stockMoveLine.count({ where: { tenantId } }),
    prisma.productoCostHistory.count({ where: { productoId } }),
    prisma.gastoCompra.count({ where: { tenantId } }),
    prisma.cuentaPorPagar.count({ where: { tenantId } }),
    prisma.reconciliacionGasto.count({ where: { tenantId } }),
    prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: bancoId },
      select: { saldo: true },
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
    documentos,
    lineas,
    kardex,
    costos,
    gastos,
    cxps,
    reconciliaciones,
    lineasContables,
    banco: banco.saldo.toString(),
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
  'rollback fisico formal de la compra de productos en PostgreSQL aislado',
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
          nombre: `formal-compra-${suffix}`,
          slug: `formal-compra-${suffix}`,
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

      const proveedor = await prisma.vendor.create({
        data: { nombre: `Proveedor ${suffix}`, tenantId },
      });
      proveedorId = proveedor.vendorId;
      await prisma.cuentaBancaria.create({
        data: {
          cuentaId: bancoId,
          tenantId,
          nombreBanco: `formal-compra-bank-${suffix}`,
          numeroCuenta: `compra-${suffix}`,
          tipoCuenta: 'EFECTIVO',
          moneda: 'CUP',
          saldo: 1000,
        },
      });
      const tipoPago = await prisma.tipoPago.create({
        data: {
          tenantId,
          nombre: `Efectivo ${suffix}`,
          requiereCuenta: true,
          cuentaDefecto: bancoId,
        },
      });
      tipoPagoId = tipoPago.tipoId;
      const categoria = await prisma.categoria.create({
        data: { nombre: `Cat ${suffix}`, tenantId },
      });
      const almacen = await prisma.almacen.create({
        data: { nombre: `Alm ${suffix}`, tenantId },
      });
      const producto = await prisma.producto.create({
        data: {
          nombre: `Prod ${suffix}`,
          precioCosto: 100,
          precioVenta: 500,
          stock: 0,
          tenant: { connect: { tenantId } },
          categoria: { connect: { catId: categoria.catId } },
          almacen: { connect: { almacenId: almacen.almacenId } },
        },
      });
      productoId = producto.id;

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

    it('contabiliza la compra con su asiento formal y su cuenta por pagar', async () => {
      const before = await readSnapshot();
      const resultado = await registrarCompra({
        proveedorId,
        numeroFactura: `FA-${suffix}-OK`,
        formaPago: 'PAGO_COMPLETO',
        estado: 'PAGADA',
        cuentaId: bancoId,
        tipoPagoId,
        items: [{ productoId, cantidad: 3, precioCosto: 100 }],
      });

      expect(resultado.success).toBe(true);
      const after = await readSnapshot();
      expect(after.documentos).toBe(before.documentos + 1);
      expect(after.lineas).toBe(before.lineas + 1);
      expect(after.kardex).toBe(before.kardex + 1);
      // El costo unitario no cambia (100), asi que no hay historial de costo.
      expect(after.costos).toBe(before.costos);
      expect(after.gastos).toBe(before.gastos + 1);
      expect(after.cxps).toBe(before.cxps + 1);
      expect(after.reconciliaciones).toBe(before.reconciliaciones + 1);
      expect(Number(after.banco)).toBe(Number(before.banco) - 300);
      expect(after.ledger).toHaveLength(before.ledger.length + 1);

      const documento = await prisma.compraDocumento.findFirstOrThrow({
        where: { tenantId, numeroFactura: `FA-${suffix}-OK` },
        select: { compraDocumentoId: true },
      });
      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'compra_documento',
            origenId: documento.compraDocumentoId,
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
      expect(debe.toString()).toBe('300');
      expect(haber.toString()).toBe('300');
    });

    it('revierte la escritura operativa y el libro mayor cuando falla el insert del asiento', async () => {
      const before = await readSnapshot();
      const resultado = await registrarCompra(
        {
          proveedorId,
          numeroFactura: `FA-${suffix}-FAIL`,
          formaPago: 'PAGO_COMPLETO',
          estado: 'PAGADA',
          cuentaId: bancoId,
          tipoPagoId,
          items: [{ productoId, cantidad: 5, precioCosto: 100 }],
        },
        ledgerFailUserId,
      );

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });
  },
);
