/**
 * @description Test de integración real del rollback físico formal de la
 * aplicación y el reverso de anticipos (R6.1, familia de anticipos).
 *
 * Aplicar un anticipo a una compra reconoce el consumo del anticipo
 * (`ANTICIPO_PROVEEDOR_APLICADO`) y su reverso lo compensa
 * (`ANTICIPO_PROVEEDOR_APLICACION_REVERSADA`). Ambas escrituras tocan el
 * anticipo, sus movimientos y el libro mayor en la misma transacción que la
 * escritura operativa. El test comprueba, en modo `enforce`, que el fallo del
 * insert del asiento revierte el conjunto completo.
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

const { createAnticipoAction, registrarMovimientoEfectivoAnticipoAction } = await import(
  '@/features/contabilidad/actions-anticipos'
);
const { createCompraProductoAction } = await import('@/features/compras-productos/actions');
const { reverseAnticipo } = await import('@/lib/services/anticipos-workflow');

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `formal_anticipo_aplicacion_${suffix}`;
const userId = `formal_user_${suffix}`;
const ledgerFailUserId = `formal_ledger_fail_${suffix}`;
const bancoId = `formal_anticipo_aplicacion_bank_${suffix}`;
const ledgerFailureFunction = `formal_anticipo_aplicacion_ledger_failure_${suffix}`;
const ledgerFailureTrigger = `formal_anticipo_aplicacion_ledger_trigger_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

let proveedorId = '';
let productoId = '';
let tipoPagoId = '';
let anticipoCounter = 0;

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
      anticipos: true,
      compras: true,
      inventario: true,
      'cuentas-pagar': true,
    },
  } as unknown as AuthenticatedUser;
}

/**
 * @description Captura el estado del anticipo, la compra y el libro mayor para
 * comparar antes/despues del failpoint.
 * @returns {Promise<object>} Fotografia del estado persistido del tenant.
 */
async function readSnapshot() {
  const [anticipos, movimientos, compras, ubicaciones, kardex, asientos, lineas] = await Promise.all([
    prisma.anticipo.findMany({
      where: { tenantId },
      select: {
        anticipoId: true,
        estado: true,
        montoFinanciado: true,
        saldoDisponible: true,
      },
      orderBy: { anticipoId: 'asc' },
    }),
    prisma.anticipoMovimiento.findMany({
      where: { anticipo: { tenantId } },
      select: {
        movimientoId: true,
        tipoMovimiento: true,
        contexto: true,
        documentoDestinoId: true,
        monto: true,
        saldoDespues: true,
      },
      orderBy: { movimientoId: 'asc' },
    }),
    prisma.compraDocumento.findMany({
      where: { tenantId },
      select: { compraDocumentoId: true, formaPago: true, estado: true, total: true },
      orderBy: { compraDocumentoId: 'asc' },
    }),
    prisma.stockUbicacion.findMany({
      where: { tenantId },
      select: { productoId: true, cantidad: true, cantidadDisponible: true },
      orderBy: { productoId: 'asc' },
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
    anticipos: anticipos.map((row) => ({
      id: row.anticipoId,
      estado: row.estado,
      montoFinanciado: row.montoFinanciado.toString(),
      saldoDisponible: row.saldoDisponible.toString(),
    })),
    movimientos: movimientos.map((row) => ({
      id: row.movimientoId,
      tipo: row.tipoMovimiento,
      contexto: row.contexto,
      documentoDestinoId: row.documentoDestinoId,
      monto: row.monto.toString(),
      saldoDespues: row.saldoDespues.toString(),
    })),
    compras: compras.map((row) => ({
      id: row.compraDocumentoId,
      formaPago: row.formaPago,
      estado: row.estado,
      total: row.total,
    })),
    ubicaciones: ubicaciones.map((row) => ({
      productoId: row.productoId,
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

/**
 * @description Crea un anticipo de pago al proveedor con sus fondos entregados.
 * @param {number} monto - Monto del anticipo.
 * @returns {Promise<string>} Identificador del anticipo listo para aplicar.
 */
async function crearAnticipoEntregado(monto: number): Promise<string> {
  anticipoCounter += 1;
  auth.user = userFor(userId);
  const creado = await createAnticipoAction({
    tipo: 'PAGO',
    monto,
    moneda: 'CUP',
    proveedorId,
    concepto: `Anticipo de pago ${suffix}-${anticipoCounter}`,
  });
  expect(creado.success).toBe(true);
  const anticipoId = (
    creado as { data?: { anticipo?: { anticipoId?: string } } }
  ).data?.anticipo?.anticipoId as string;
  expect(typeof anticipoId).toBe('string');

  const entrega = await registrarMovimientoEfectivoAnticipoAction({
    anticipoId,
    cuentaId: bancoId,
    tipoPagoId,
    monto,
    idempotencyKey: `formal-anticipo-entrega-${suffix}-${anticipoCounter}`,
  });
  expect(entrega.success).toBe(true);
  return anticipoId;
}

/**
 * @description Registra una compra pagada con el anticipo indicado.
 * @param {string} anticipoId - Anticipo que financia la compra.
 * @param {number} total - Total de la compra.
 * @param {string} actorId - Actor que ejecuta la operacion.
 * @returns {Promise<{ success: boolean; data?: { compraDocumentoId?: string } }>} Resultado de la compra.
 */
async function crearCompraConAnticipo(
  anticipoId: string,
  total: number,
  actorId = userId,
) {
  anticipoCounter += 1;
  auth.user = userFor(actorId);
  const resultado = await createCompraProductoAction({
    proveedorId,
    numeroFactura: `F-${suffix}-${anticipoCounter}`,
    formaPago: 'ANTICIPO_PAGO',
    estado: 'PAGADA',
    anticipoPagoId: anticipoId,
    idempotencyKey: `formal-compra-anticipo-${suffix}-${anticipoCounter}`,
    items: [{ productoId, cantidad: 2, precioCosto: 150 }],
  });
  return resultado as {
    success: boolean;
    data?: { compraDocumentoId?: string };
  };
}

describe(
  'rollback fisico formal de la aplicacion de anticipos en PostgreSQL aislado',
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
          nombre: `formal-anticipo-aplicacion-${suffix}`,
          slug: `formal-anticipo-aplicacion-${suffix}`,
        },
      });
      // Los actores existen como usuarios reales: el anticipo y el kardex los
      // referencian y el trigger los distingue por su identificador.
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
      const categoria = await prisma.categoria.create({
        data: { nombre: `Cat ${suffix}`, tenantId },
      });
      const almacen = await prisma.almacen.create({
        data: { nombre: `Alm ${suffix}`, tenantId },
      });
      const producto = await prisma.producto.create({
        data: {
          nombre: `Prod ${suffix}`,
          precioCosto: 150,
          precioVenta: 400,
          stock: 0,
          tenant: { connect: { tenantId } },
          categoria: { connect: { catId: categoria.catId } },
          almacen: { connect: { almacenId: almacen.almacenId } },
        },
      });
      productoId = producto.id;
      await prisma.cuentaBancaria.create({
        data: {
          cuentaId: bancoId,
          tenantId,
          nombreBanco: `formal-anticipo-aplicacion-bank-${suffix}`,
          numeroCuenta: `anticipo-aplicacion-${suffix}`,
          tipoCuenta: 'EFECTIVO',
          moneda: 'CUP',
          saldo: 5000,
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

    it('contabiliza la aplicacion del anticipo a la compra', async () => {
      const anticipoId = await crearAnticipoEntregado(500);
      const before = await readSnapshot();

      const resultado = await crearCompraConAnticipo(anticipoId, 300);

      expect(resultado.success).toBe(true);
      const after = await readSnapshot();
      const anticipo = after.anticipos.find((row) => row.id === anticipoId);
      expect(anticipo?.saldoDisponible).toBe('200');
      expect(after.compras).toHaveLength(before.compras.length + 1);
      // El reconocimiento de la compra y la aplicacion del anticipo.
      expect(after.ledger).toHaveLength(before.ledger.length + 2);
      const aplicacion = after.ledger.at(-1);
      expect(aplicacion?.origenTipo).toBe('anticipo_movimiento');

      const movimiento = after.movimientos.find(
        (row) => row.tipo === 'EJECUCION' && row.documentoDestinoId === resultado.data?.compraDocumentoId,
      );
      expect(movimiento).toBeDefined();
      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'anticipo_movimiento',
            origenId: movimiento?.id as string,
          },
        },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(asiento.estado).toBe('CONTABILIZADO');
      expect(asiento.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(asiento.lineas).toHaveLength(2);
    });

    it('revierte la aplicacion del anticipo cuando falla el insert del asiento', async () => {
      const anticipoId = await crearAnticipoEntregado(500);
      const before = await readSnapshot();

      const resultado = await crearCompraConAnticipo(anticipoId, 300, ledgerFailUserId);

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });

    it('contabiliza el reverso de la aplicacion del anticipo', async () => {
      const anticipoId = await crearAnticipoEntregado(500);
      const compra = await crearCompraConAnticipo(anticipoId, 300);
      expect(compra.success).toBe(true);
      const compraDocumentoId = compra.data?.compraDocumentoId as string;
      const before = await readSnapshot();

      const reverso = await prisma.$transaction((tx) =>
        reverseAnticipo(tx, {
          anticipoId,
          tenantId,
          documentoDestinoId: compraDocumentoId,
          montoReverso: 300,
          usuarioId: userId,
          observaciones: 'Reverso de la aplicacion del anticipo',
        }),
      );

      expect(reverso.movimientoId).toBeTruthy();
      const after = await readSnapshot();
      const anticipo = after.anticipos.find((row) => row.id === anticipoId);
      expect(anticipo?.saldoDisponible).toBe('500');
      expect(after.ledger).toHaveLength(before.ledger.length + 1);
      const reversoAsiento = after.ledger.at(-1);
      expect(reversoAsiento?.origenTipo).toBe('anticipo_movimiento');
      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'anticipo_movimiento',
            origenId: reverso.movimientoId,
          },
        },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(asiento.estado).toBe('CONTABILIZADO');
      expect(asiento.lineas).toHaveLength(2);
    });

    it('revierte el reverso de la aplicacion cuando falla el insert del asiento', async () => {
      const anticipoId = await crearAnticipoEntregado(500);
      const compra = await crearCompraConAnticipo(anticipoId, 300);
      expect(compra.success).toBe(true);
      const compraDocumentoId = compra.data?.compraDocumentoId as string;
      const before = await readSnapshot();

      let error: unknown = null;
      try {
        await prisma.$transaction((tx) =>
          reverseAnticipo(tx, {
            anticipoId,
            tenantId,
            documentoDestinoId: compraDocumentoId,
            montoReverso: 300,
            usuarioId: ledgerFailUserId,
            observaciones: 'Reverso de la aplicacion del anticipo',
          }),
        );
      } catch (err) {
        error = err;
      }

      expect(error).not.toBeNull();
      expect(await readSnapshot()).toEqual(before);
    });
  },
);
