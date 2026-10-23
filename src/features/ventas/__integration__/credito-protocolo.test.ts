/**
 * @description Carrera end-to-end del protocolo de cupo (tarea 4.1 del change
 * remediacion-integridad-ventas-credito-fiscal): dos WRITERS REALES — la
 * creación de venta a crédito de productos (`VentaMutationService.create`,
 * con turno resuelto en tx, factura, workflow de vencimiento y FIFO) contra
 * el desembolso real de préstamo cash
 * (`AccountingCashOperationsMutationService.createCashLoan`) — compitiendo
 * por el mismo cupo del cliente en PostgreSQL aislado.
 *
 * La creación de PEDIDO no reserva cupo por diseño (validado en unitarios);
 * la carrera de facturación de pedidos queda cubierta por
 * `credito-pago-carrera-real.test.ts` (pago concurrente) y los tests de
 * facturarVenta.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { saldoVivoCliente } from '@/features/crm/services/credito-calculo';

const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const tenantIds: string[] = [];

/** Vendedor con features/permisos reales de ambos orígenes. */
function vendedor(userId: string, tenantId: string): AuthenticatedUser {
  return {
    userId,
    tenantId,
    name: 'Vendedor Protocolo',
    email: `${userId}@protocolo.test.local`,
    role: 'user',
    isActive: true,
    tenantRole: 'manager',
    planFeatures: {
      'ventas-pos': true,
      facturacion: true,
      'ventas-factura': true,
      'prestamos-cash': true,
    },
    permissions: new Set(['ventas.venta.registrar', 'financiero.contabilidad.acceder']),
  } as unknown as AuthenticatedUser;
}

/**
 * @description Crea tenant aislado con cliente (límite 100), almacén,
 * categoría, producto, PV MOVIL, stock en PV, banco y tipo de pago.
 * @returns {Promise<object>} IDs del escenario.
 */
async function crearEscenario() {
  const tenant = await prisma.tenant.create({
    data: { nombre: `Protocolo ${stamp}`, slug: `protocolo-${stamp}` },
  });
  tenantIds.push(tenant.tenantId);
  const tenantId = tenant.tenantId;

  // El kardex (StockMoveLine.creadoPorId) exige un User real para la FK.
  const userRow = await prisma.user.create({
    data: {
      name: 'Vendedor Protocolo',
      email: `protocolo-${stamp}@test.local`,
      password: 'x',
    },
  });
  const cliente = await prisma.cliente.create({
    data: { nombre: 'Cliente Protocolo', tenantId, limiteCredito: 100 },
  });
  const almacen = await prisma.almacen.create({ data: { nombre: 'Almacén Protocolo', tenantId } });
  const categoria = await prisma.categoria.create({ data: { nombre: 'Categoría Protocolo', tenantId } });
  const pv = await prisma.puntoDeVenta.create({
    data: { nombre: 'PV Protocolo', tenantId, tipoCaja: 'MOVIL' },
  });
  const producto = await prisma.producto.create({
    data: {
      nombre: 'Producto Protocolo',
      tenantId,
      precioCosto: 20,
      precioVenta: 60,
      stock: 10,
      categoriaId: categoria.catId,
      almacenId: almacen.almacenId,
    },
  });
  await prisma.stockUbicacion.create({
    data: {
      tenantId,
      productoId: producto.id,
      tipoUbicacion: 'punto_venta',
      ubicacionId: pv.pvId,
      cantidad: 10,
      cantidadDisponible: 10,
    },
  });
  const cuenta = await prisma.cuentaBancaria.create({
    data: {
      tenantId,
      nombreBanco: 'Banco Protocolo',
      numeroCuenta: `NC-${stamp}`,
      tipoCuenta: 'AHORRO',
      saldo: 100_000,
    },
  });
  const tipoPago = await prisma.tipoPago.create({
    data: { tenantId, nombre: 'Efectivo', requiereCuenta: false, isActive: true },
  });
  // La política funcional permite que el workflow selle la valoración de la
  // CxC de la venta (modo formal shadow): sin ella, el CxC quedaría sin
  // moneda verificable y las validaciones posteriores fallan cerrado.
  await prisma.moneda.upsert({
    where: { codigo: 'CUP' },
    create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
    update: {},
  });
  await prisma.tenantAccountingPolicy.create({
    data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userRow.userId },
  });
  return { tenantId, userRow, cliente, pv, producto, cuenta, tipoPago };
}

afterAll(async () => {
  for (const tenantId of tenantIds) {
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.prestamoCash.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.factura.deleteMany({ where: { tenantId } });
    await prisma.venta.deleteMany({ where: { tenantId } });
    await prisma.turnoPuntoVenta.deleteMany({ where: { tenantId } });
    // StockMoveLine es append-only: purgarla requiere omitir el trigger; la DB de
    // pruebas es desechable y esta limpieza no relaja las garantías de producción.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica'");
      await tx.stockMoveLine.deleteMany({ where: { tenantId } });
    });
    await prisma.stockUbicacion.deleteMany({ where: { tenantId } });
    await prisma.producto.deleteMany({ where: { tenantId } });
    await prisma.categoria.deleteMany({ where: { tenantId } });
    await prisma.puntoDeVenta.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.almacen.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: { contains: `protocolo-${stamp}` } } });
    await prisma.tenant.delete({ where: { tenantId } }).catch(() => undefined);
  }
});

describe('protocolo de cupo: writers reales venta vs préstamo en PostgreSQL', () => {
  it('creación de venta a crédito contra desembolso de préstamo: uno solo confirma', async () => {
    // Modo formal shadow: el workflow de la venta sella la valoración de su
    // CxC; con modo off ese CxC nace sin moneda verificable y la validación
    // del perdedor falla cerrado por diseño (histórico no verificable).
    const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
    process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
    try {
      const { tenantId, userRow, cliente, pv, producto, cuenta } = await crearEscenario();
      const user = vendedor(userRow.userId, tenantId);

      const crearVentaCredito = VentaMutationService.create({
        input: {
          puntoDeVentaId: pv.pvId,
          clienteId: cliente.clienteId,
          items: [{ productoId: producto.id, cantidad: 1, precioUnitario: 60 }],
          metodoPago: 'CREDITO',
          montoCredito: 60,
          tipoVencimiento: 'plazo',
        },
        user,
      });

      const desembolsarPrestamo = AccountingCashOperationsMutationService.createCashLoan({
        input: { clienteId: cliente.clienteId, montoCapital: 60, moneda: 'CUP', cuentaBancariaId: cuenta.cuentaId },
        user,
      });

      const [resultadoVenta, resultadoPrestamo] = await Promise.allSettled([
        crearVentaCredito,
        desembolsarPrestamo,
      ]);

      const confirmados = [resultadoVenta, resultadoPrestamo].filter((r) => r.status === 'fulfilled');
      const rechazados = [resultadoVenta, resultadoPrestamo].filter((r) => r.status === 'rejected');
      expect(confirmados).toHaveLength(1);
      expect(rechazados).toHaveLength(1);
      expect((rechazados[0] as PromiseRejectedResult).reason).toMatchObject({
        code: 'CREDITO_EXCEDIDO',
      });

      // El perdedor no deja efectos parciales: saldo final = deuda del ganador.
      const cxc = await prisma.cuentaPorCobrar.findMany({
        where: { tenantId, clienteId: cliente.clienteId, estado: { not: 'ANULADA' } },
        select: { montoDeuda: true, montoPagado: true, estado: true },
      });
      expect(cxc).toHaveLength(1);
      expect(
        saldoVivoCliente(
          cxc.map((cuenta) => ({
            estado: String(cuenta.estado),
            montoDeuda: Number(cuenta.montoDeuda),
            montoPagado: Number(cuenta.montoPagado),
          })),
        ),
      ).toBe(60);
    } finally {
      if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
    }
  });
});
