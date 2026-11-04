/**
 * @description Test de integración real del rollback físico formal de los
 * servicios (R6.1, familia de servicios).
 *
 * La compra de un servicio reconoce el gasto devengado (`GASTO_CREDITO`) y la
 * venta de un servicio reconoce el ingreso (`VENTA_SERVICIO_CREDITO`). Ambas
 * escrituras comparten transacción con su asiento formal y, en el caso de la
 * venta a crédito, con la cuenta por cobrar del cliente. El test comprueba, en
 * modo `enforce`, que el fallo del insert del asiento revierte el conjunto
 * completo de cada operación.
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

const { createCompraServicioAction } = await import('@/features/compras-servicios/actions');
const { createVentaServicioAction } = await import('@/features/venta-servicios/actions');

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `formal_servicio_${suffix}`;
const userId = `formal_user_${suffix}`;
const ledgerFailUserId = `formal_ledger_fail_${suffix}`;
const ledgerFailureFunction = `formal_servicio_ledger_failure_${suffix}`;
const ledgerFailureTrigger = `formal_servicio_ledger_trigger_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

let servicioId = '';
let proveedorId = '';
let clienteId = '';

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
    planFeatures: {
      servicios: true,
      'cuentas-cobrar': true,
      'cuentas-pagar': true,
      facturacion: true,
    },
  } as unknown as AuthenticatedUser;
}

/**
 * @description Ejecuta una action de servicios con el actor indicado.
 * @param {() => Promise<unknown>} accion - Invocacion de la action.
 * @param {string} actorId - Actor que ejecuta la operacion.
 * @returns {Promise<{ success: boolean; error?: { message?: string } }>} Respuesta de la action.
 */
async function conActor(accion: () => Promise<unknown>, actorId = userId) {
  auth.user = userFor(actorId);
  return (await accion()) as { success: boolean; error?: { message?: string } };
}

/**
 * @description Captura el estado operativo y el libro mayor para comparar
 * antes/despues del failpoint.
 * @returns {Promise<object>} Fotografia del estado persistido del tenant.
 */
async function readSnapshot() {
  const [compras, ventas, cxcs, asientos, lineas] = await Promise.all([
    prisma.compraServicio.findMany({
      where: { tenantId },
      select: { compraServicioId: true, total: true, estado: true },
      orderBy: { compraServicioId: 'asc' },
    }),
    prisma.ventaServicios.findMany({
      where: { tenantId },
      select: { ventaServicioId: true, total: true, condicionPago: true },
      orderBy: { ventaServicioId: 'asc' },
    }),
    prisma.cuentaPorCobrar.findMany({
      where: { tenantId },
      select: { id: true, montoDeuda: true, estado: true },
      orderBy: { id: 'asc' },
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
    compras: compras.map((row) => ({
      id: row.compraServicioId,
      total: row.total,
      estado: row.estado,
    })),
    ventas: ventas.map((row) => ({
      id: row.ventaServicioId,
      total: row.total,
      condicionPago: row.condicionPago,
    })),
    cxcs: cxcs.map((row) => ({
      id: row.id,
      montoDeuda: row.montoDeuda.toString(),
      estado: row.estado,
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
  'rollback fisico formal de los servicios en PostgreSQL aislado',
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
          nombre: `formal-servicio-${suffix}`,
          slug: `formal-servicio-${suffix}`,
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

      const servicio = await prisma.servicios.create({
        data: {
          tenantId,
          nombre: `Servicio ${suffix}`,
          precio: 200,
          costo: 120,
          descripcion: `Servicio de prueba ${suffix}`,
          moneda: 'CUP',
        },
      });
      servicioId = servicio.servicioId;
      const proveedor = await prisma.vendor.create({
        data: { nombre: `Proveedor ${suffix}`, tenantId },
      });
      proveedorId = proveedor.vendorId;
      const cliente = await prisma.cliente.create({
        data: { nombre: `Cliente ${suffix}`, tenantId },
      });
      clienteId = cliente.clienteId;

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

    it('contabiliza el gasto devengado de la compra de un servicio', async () => {
      const before = await readSnapshot();
      const resultado = await conActor(() =>
        createCompraServicioAction({
          servicioId,
          proveedorId,
          numeroFactura: `FS-${suffix}-OK`,
          costoUnitario: 200,
          cantidad: 2,
          formaPago: 'PAGO_PARCIAL',
          estado: 'PENDIENTE',
          descripcion: 'Servicio recibido de prueba',
        }),
      );

      expect(resultado.success).toBe(true);
      const after = await readSnapshot();
      expect(after.compras).toHaveLength(before.compras.length + 1);
      expect(after.ledger).toHaveLength(before.ledger.length + 1);

      const compra = after.compras.at(-1);
      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'compra_servicio',
            origenId: compra?.id as string,
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
      expect(debe.toString()).toBe('400');
      expect(haber.toString()).toBe('400');
    });

    it('revierte la compra del servicio cuando falla el insert del asiento', async () => {
      const before = await readSnapshot();
      const resultado = await conActor(
        () =>
          createCompraServicioAction({
            servicioId,
            proveedorId,
            numeroFactura: `FS-${suffix}-FAIL`,
            costoUnitario: 200,
            cantidad: 3,
            formaPago: 'PAGO_PARCIAL',
            estado: 'PENDIENTE',
          }),
        ledgerFailUserId,
      );

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });

    it('contabiliza el ingreso de la venta de un servicio a credito', async () => {
      const before = await readSnapshot();
      const resultado = await conActor(() =>
        createVentaServicioAction({
          servicioId,
          cantidad: 2,
          clienteId,
          condicionPago: 'CREDITO',
          observaciones: 'Venta de servicio de prueba',
        }),
      );

      expect(resultado.success).toBe(true);
      const after = await readSnapshot();
      expect(after.ventas).toHaveLength(before.ventas.length + 1);
      expect(after.cxcs).toHaveLength(before.cxcs.length + 1);
      expect(after.ledger).toHaveLength(before.ledger.length + 1);

      const venta = after.ventas.at(-1);
      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'venta_servicio',
            origenId: venta?.id as string,
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
      expect(debe.toString()).toBe('400');
      expect(haber.toString()).toBe('400');
    });

    it('revierte la venta del servicio cuando falla el insert del asiento', async () => {
      const before = await readSnapshot();
      const resultado = await conActor(
        () =>
          createVentaServicioAction({
            servicioId,
            cantidad: 3,
            clienteId,
            condicionPago: 'CREDITO',
          }),
        ledgerFailUserId,
      );

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });
  },
);
