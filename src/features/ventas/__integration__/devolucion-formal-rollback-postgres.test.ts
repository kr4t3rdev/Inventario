/**
 * @description Test de integración real del rollback físico formal de la
 * devolución de venta (R6.1).
 *
 * La devolución es la única operación de ventas que revierte el ingreso, repone
 * inventario y liquida cuentas por cobrar en la misma transacción. El test
 * comprueba, en modo `enforce`, que el asiento formal y toda la escritura
 * operativa (devolución, nota de crédito, stock, kardex, cuenta por cobrar y
 * auditoría) se revierten juntos cuando falla el insert del asiento o la
 * auditoría estricta posterior.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { DevolucionVentaService } from '@/features/ventas/services/devolucion-venta-service';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `formal_devolucion_${suffix}`;
const userId = `formal_user_${suffix}`;
const auditFailUserId = `formal_audit_fail_${suffix}`;
const ledgerFailUserId = `formal_ledger_fail_${suffix}`;
const auditFailureFunction = `formal_devolucion_audit_failure_${suffix}`;
const auditFailureTrigger = `formal_devolucion_audit_trigger_${suffix}`;
const ledgerFailureFunction = `formal_devolucion_ledger_failure_${suffix}`;
const ledgerFailureTrigger = `formal_devolucion_ledger_trigger_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

/**
 * @description Construye el actor autenticado de la prueba para el tenant aislado.
 * @param {string} actorId - Identificador del actor (marca el failpoint cuando hace falta).
 * @returns {AuthenticatedUser} Actor con tenant fijo.
 */
function userFor(actorId: string): AuthenticatedUser {
  return {
    userId: actorId,
    role: 'admin',
    tenantId,
    isActive: true,
  } as unknown as AuthenticatedUser;
}

/**
 * @description Registra la devolución dentro del contexto del tenant.
 * @param {Record<string, unknown>} input - Payload de la devolución.
 * @param {string} actorId - Actor que ejecuta la operación.
 * @returns {Promise<unknown>} Resultado del writer.
 */
function registrarDevolucion(input: Record<string, unknown>, actorId = userId) {
  return withTestTenant(tenantId, () =>
    DevolucionVentaService.registrar({
      input: input as never,
      user: userFor(actorId),
    }),
  );
}

/**
 * @description Crea la venta de control: dos lotes con costos distintos, una
 * venta que los consume, la factura, la cuenta por cobrar y el stock del punto
 * de venta ya descontado.
 * @returns {Promise<{ ventaId: string; ventaItemId: string }>} Identificadores de la venta.
 */
async function crearVentaDeControl(): Promise<{ ventaId: string; ventaItemId: string }> {
  const categoria = await prisma.categoria.create({
    data: { nombre: `Cat ${suffix}`, tenantId },
  });
  const almacen = await prisma.almacen.create({
    data: { nombre: `Alm ${suffix}`, tenantId },
  });
  const pv = await prisma.puntoDeVenta.create({
    data: { nombre: `PV ${suffix}`, tenantId },
  });
  const producto = await prisma.producto.create({
    data: {
      nombre: `Prod ${suffix}`,
      precioCosto: 100,
      precioVenta: 500,
      stock: 5,
      tenant: { connect: { tenantId } },
      categoria: { connect: { catId: categoria.catId } },
      almacen: { connect: { almacenId: almacen.almacenId } },
    },
  });
  const cliente = await prisma.cliente.create({
    data: { nombre: `Cliente ${suffix}`, tenantId },
  });
  const vendor = await prisma.vendor.create({
    data: { nombre: `Proveedor ${suffix}`, tenantId },
  });

  // Lote barato (3 uds a 100) y lote caro (2 uds a 300).
  const compraA = await prisma.compraDocumento.create({
    data: {
      tenantId,
      proveedorId: vendor.vendorId,
      formaPago: 'EFECTIVO',
      estado: 'RECIBIDA',
    },
  });
  const compraB = await prisma.compraDocumento.create({
    data: {
      tenantId,
      proveedorId: vendor.vendorId,
      formaPago: 'EFECTIVO',
      estado: 'RECIBIDA',
    },
  });
  const itemA = await prisma.compraDocumentoItem.create({
    data: {
      compraDocumentoId: compraA.compraDocumentoId,
      tenantId,
      productoId: producto.id,
      cantidad: 3,
      precioUnitario: 100,
      totalLinea: 300,
      createdAt: new Date('2026-09-01T00:00:00Z'),
    },
  });
  const itemB = await prisma.compraDocumentoItem.create({
    data: {
      compraDocumentoId: compraB.compraDocumentoId,
      tenantId,
      productoId: producto.id,
      cantidad: 2,
      precioUnitario: 300,
      totalLinea: 600,
      createdAt: new Date('2026-09-02T00:00:00Z'),
    },
  });

  const venta = await prisma.venta.create({
    data: {
      tenantId,
      cantidad: 4,
      puntoDeVentaId: pv.pvId,
      clienteId: cliente.clienteId,
      total: 2000,
      estado: 'FACTURADA',
      metodoPago: 'CREDITO',
      esVentaUnica: true,
      items: {
        create: [
          { productoId: producto.id, cantidad: 4, precioUnitario: 500, total: 2000 },
        ],
      },
    },
    include: { items: true },
  });
  const ventaItem = venta.items[0];

  const createAllocation = (
    compraDocumentoItemId: string,
    cantidad: number,
    costoUnitario: number,
    fechaFuente: Date,
  ) => {
    const functionalAmount = cantidad * costoUnitario;
    const evidence = buildAppliedFxEvidence({
      originalAmount: functionalAmount,
      originalCurrency: 'CUP',
      functionalCurrency: 'CUP',
      exchangeRate: 1,
      convertedAmount: functionalAmount,
      rateEffectiveAt: null,
      fxCatalogRateId: null,
      source: 'fifo-allocation',
    });
    return {
      tenantId,
      compraDocumentoItemId,
      ventaItemId: ventaItem.id,
      cantidad,
      costoUnitarioSnapshot: costoUnitario,
      fifoMonedaOrigen: 'CUP',
      fifoFechaFuente: fechaFuente,
      fifoMonedaFuncional: 'CUP',
      fifoCostoFuncional: functionalAmount,
      fifoTasaCambio: null,
      fifoFechaTasa: null,
      fifoEvidenciaFx: JSON.stringify({
        ...evidence,
        rawConvertedAmount: functionalAmount,
        rawExchangeRate: null,
      }),
    };
  };

  await prisma.purchaseAllocation.createMany({
    data: [
      createAllocation(itemA.compraDocumentoItemId, 3, 100, itemA.createdAt),
      createAllocation(itemB.compraDocumentoItemId, 1, 300, itemB.createdAt),
    ],
  });

  const serie = await prisma.serieFacturacion.create({
    data: {
      tenantId,
      prefijo: 'FV',
      descripcion: 'Ventas',
      consecutivo: 1,
      esPorDefecto: true,
    },
  });
  const factura = await prisma.factura.create({
    data: {
      tenantId,
      serieId: serie.serieId,
      numeroConsecutivo: 1,
      numeroFactura: 'FV-000001',
      clienteId: cliente.clienteId,
      ventaId: venta.ventaId,
      subtotal: 2000,
      total: 2000,
      tasaCambio: 1,
      estado: 'PENDIENTE',
      creadoPor: userId,
    },
  });
  await prisma.cuentaPorCobrar.create({
    data: {
      tenantId,
      clienteId: cliente.clienteId,
      facturaId: factura.idFactura,
      montoDeuda: 2000,
      montoPagado: 400,
      estado: 'PARCIAL',
    },
  });

  await prisma.stockUbicacion.create({
    data: {
      tenantId,
      productoId: producto.id,
      tipoUbicacion: 'punto_venta',
      ubicacionId: pv.pvId,
      cantidad: 5,
      cantidadDisponible: 1,
    },
  });

  return { ventaId: venta.ventaId, ventaItemId: ventaItem.id };
}

/**
 * @description Captura el estado operativo y el libro mayor para comparar
 * antes/después del failpoint.
 * @param {string} actorId - Actor cuyas auditorías se cuentan.
 * @returns {Promise<object>} Fotografía del estado persistido del tenant.
 */
async function readSnapshot(actorId: string) {
  const [
    devoluciones,
    items,
    notasCredito,
    kardex,
    cxcs,
    allocations,
    auditCount,
    asientos,
    lineas,
    stock,
  ] = await Promise.all([
    prisma.devolucionVenta.count({ where: { tenantId } }),
    prisma.devolucionVentaItem.count({ where: { devolucion: { tenantId } } }),
    prisma.factura.count({ where: { tenantId, tipoDocumento: 'NOTA_CREDITO' } }),
    prisma.stockMoveLine.count({ where: { tenantId, tipoOrigen: 'VENTA' } }),
    prisma.cuentaPorCobrar.findMany({
      where: { tenantId },
      select: { id: true, montoDeuda: true, montoPagado: true, estado: true },
      orderBy: { id: 'asc' },
    }),
    prisma.purchaseAllocation.findMany({
      where: { tenantId },
      select: { id: true, cantidad: true },
      orderBy: { id: 'asc' },
    }),
    prisma.auditLog.count({ where: { usuarioId: actorId } }),
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
    prisma.stockUbicacion.findMany({
      where: { tenantId },
      select: { productoId: true, cantidad: true, cantidadDisponible: true },
      orderBy: { productoId: 'asc' },
    }),
  ]);
  return {
    devoluciones,
    items,
    notasCredito,
    kardex,
    lineas,
    auditCount,
    cxcs: cxcs.map((cxc) => ({
      id: cxc.id,
      montoDeuda: cxc.montoDeuda.toString(),
      montoPagado: cxc.montoPagado.toString(),
      estado: cxc.estado,
    })),
    allocations: allocations.map((row) => ({ id: row.id, cantidad: row.cantidad })),
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
  'rollback fisico formal de la devolucion de venta en PostgreSQL aislado',
  { timeout: 90_000 },
  () => {
    let ventaId = '';
    let ventaItemId = '';

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
          nombre: `formal-devolucion-${suffix}`,
          slug: `formal-devolucion-${suffix}`,
        },
      });
      // Los actores existen como usuarios reales: el kardex los referencia por
      // clave foranea y los triggers los distinguen por su identificador.
      for (const actorId of [userId, auditFailUserId, ledgerFailUserId]) {
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
          features: { 'contabilidad-formal': true, 'ventas-pos': true },
        },
      });

      ({ ventaId, ventaItemId } = await crearVentaDeControl());

      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION public."${auditFailureFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."usuarioId" LIKE 'formal_audit_fail_%' THEN RAISE EXCEPTION 'forced audit failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER "${auditFailureTrigger}" BEFORE INSERT ON public."AuditLog" FOR EACH ROW EXECUTE FUNCTION public."${auditFailureFunction}"()`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION public."${ledgerFailureFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."tenantId" = '${tenantId}' AND NEW."createdBy" LIKE 'formal_ledger_fail_%' THEN RAISE EXCEPTION 'forced asiento failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER "${ledgerFailureTrigger}" BEFORE INSERT ON public."asientos" FOR EACH ROW EXECUTE FUNCTION public."${ledgerFailureFunction}"()`,
      );
    });

    afterAll(async () => {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${auditFailureTrigger}" ON public."AuditLog"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${auditFailureFunction}"()`);
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${ledgerFailureTrigger}" ON public."asientos"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${ledgerFailureFunction}"()`);
      if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
    });

    it('contabiliza la devolucion con el desglose real y el costo FIFO repuesto', async () => {
      const before = await readSnapshot(userId);
      const resultado = (await registrarDevolucion({
        ventaId,
        items: [{ ventaItemId, cantidad: 2 }],
        motivo: 'Devolucion parcial de control',
        preferenciaFinanciera: 'SALDO_FAVOR',
        idempotencyKey: randomUUID(),
      })) as { devolucionId: string };

      const after = await readSnapshot(userId);
      expect(after.devoluciones).toBe(before.devoluciones + 1);
      expect(after.items).toBe(before.items + 1);
      expect(after.notasCredito).toBe(before.notasCredito + 1);
      expect(after.kardex).toBe(before.kardex + 1);
      expect(after.auditCount).toBe(before.auditCount + 1);
      expect(after.ledger).toHaveLength(before.ledger.length + 1);

      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'devolucion_venta',
            origenId: resultado.devolucionId,
          },
        },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(asiento.estado).toBe('CONTABILIZADO');
      expect(asiento.hash).toMatch(/^[a-f0-9]{64}$/);
      // El ingreso revertido (1.000) se compensa con la cuenta por cobrar
      // aplicada (1.000) y el par FIFO repone la mercaderia (200).
      expect(asiento.lineas).toHaveLength(4);
      const debe = asiento.lineas.reduce(
        (sum, linea) => sum.add(linea.debe),
        asiento.lineas[0].debe.mul(0),
      );
      const haber = asiento.lineas.reduce(
        (sum, linea) => sum.add(linea.haber),
        asiento.lineas[0].haber.mul(0),
      );
      expect(debe.toString()).toBe('1200');
      expect(haber.toString()).toBe('1200');

      // El costo FIFO repuesto queda persistido en moneda funcional.
      const devolucion = await prisma.devolucionVenta.findUniqueOrThrow({
        where: { devolucionId: resultado.devolucionId },
      });
      expect(Number(devolucion.costoFifoFuncional)).toBe(200);
      expect(devolucion.montoAplicadoCxc).toBe(1000);
      expect(devolucion.montoSaldoFavor).toBe(0);
      expect(devolucion.montoReembolsado).toBe(0);

      const allocationRestante = await prisma.purchaseAllocation.findFirstOrThrow({
        where: { tenantId, ventaItemId, compraDocumentoItemId: { not: null } },
        orderBy: { fifoFechaFuente: 'asc' },
      });
      expect(allocationRestante.cantidad).toBe(1);
      expect(Number(allocationRestante.fifoCostoFuncional)).toBe(100);
      const evidenciaRestante = JSON.parse(allocationRestante.fifoEvidenciaFx ?? '{}') as {
        functionalCurrency?: string;
        fxEvidenceFingerprint?: string;
        rawConvertedAmount?: number;
      };
      expect(evidenciaRestante.functionalCurrency).toBe('CUP');
      expect(evidenciaRestante.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(evidenciaRestante.rawConvertedAmount).toBe(100);
    });

    it('revierte la escritura operativa y el libro mayor cuando falla el insert del asiento', async () => {
      const before = await readSnapshot(ledgerFailUserId);
      await expect(
        registrarDevolucion(
          {
            ventaId,
            items: [{ ventaItemId, cantidad: 1 }],
            motivo: 'Devolucion con failpoint de ledger',
            preferenciaFinanciera: 'SALDO_FAVOR',
            idempotencyKey: randomUUID(),
          },
          ledgerFailUserId,
        ),
      ).rejects.toThrow('forced asiento failure');
      expect(await readSnapshot(ledgerFailUserId)).toEqual(before);
    });

    it('revierte el asiento ya contabilizado cuando la auditoria estricta falla despues', async () => {
      const before = await readSnapshot(auditFailUserId);
      await expect(
        registrarDevolucion(
          {
            ventaId,
            items: [{ ventaItemId, cantidad: 1 }],
            motivo: 'Devolucion con failpoint de auditoria',
            preferenciaFinanciera: 'SALDO_FAVOR',
            idempotencyKey: randomUUID(),
          },
          auditFailUserId,
        ),
      ).rejects.toThrow('forced audit failure');
      const after = await readSnapshot(auditFailUserId);
      expect(after).toEqual(before);
      expect(after.ledger).toHaveLength(before.ledger.length);
    });
  },
);
