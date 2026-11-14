/**
 * @description Test de integración real del escenario CT-1 «Compra sin período
 * aplicable»: un tenant con la capa formal activa pero sin período contable
 * para la fecha no debe poder registrar una compra, el diagnóstico debe ser el
 * del guard (no el genérico de auditoría) y la operación rechazada no debe
 * dejar efectos persistidos, conservando la evidencia de auditoría.
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
const tenantId = `ct1_compra_noper_${suffix}`;
const userId = `ct1_compra_user_${suffix}`;
const bancoId = `ct1_compra_bank_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
const previousNonCashMode = process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE;
const previousGuardMode = process.env.PERIODO_CONTABLE_MODE;

let productoId = '';
let proveedorId = '';
let tipoPagoId = '';

/**
 * @description Construye el actor autenticado de la prueba para el tenant aislado.
 * @param {string} actorId - Identificador del actor.
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
 * @returns {Promise<{ success: boolean; error?: { message?: string } }>} Respuesta de la action.
 */
async function registrarCompra(input: Record<string, unknown>) {
  auth.user = userFor(userId);
  return createCompraProductoAction(input as never);
}

/**
 * @description Captura el estado operativo y el libro mayor del tenant aislado.
 * @returns {Promise<object>} Fotografía del estado persistido.
 */
async function readSnapshot() {
  const [documentos, lineas, stock, kardex, gastos, cxps, banco, asientos, auditorias] =
    await Promise.all([
      prisma.compraDocumento.count({ where: { tenantId } }),
      prisma.compraDocumentoItem.count({ where: { tenantId } }),
      prisma.stockUbicacion.findMany({ where: { tenantId } }),
      prisma.stockMoveLine.count({ where: { tenantId } }),
      prisma.gastoCompra.count({ where: { tenantId } }),
      prisma.cuentaPorPagar.count({ where: { tenantId } }),
      prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: bancoId },
        select: { saldo: true },
      }),
      prisma.asiento.findMany({ where: { tenantId } }),
    ]);
  return {
    documentos,
    lineas,
    stock,
    kardex,
    gastos,
    cxps,
    banco: banco.saldo.toString(),
    asientos,
  };
}

describe('compra sin período aplicable en PostgreSQL aislado', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = 'enforce';
    process.env.PERIODO_GUARD_ENABLED = '1';
    process.env.PERIODO_CONTABLE_MODE = 'enforce';

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
      data: { tenantId, nombre: `ct1-compra-noper-${suffix}`, slug: `ct1-compra-noper-${suffix}` },
    });
    await prisma.user.create({
      data: {
        userId,
        name: `Actor ${userId}`,
        email: `${userId}@test.local`,
        password: 'x',
      },
    });
    // SIN período contable: es la condición del escenario.
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
        nombreBanco: `ct1-compra-bank-${suffix}`,
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
  });

  it('rechaza la compra con el diagnóstico del guard, sin efectos persistidos y con auditoría', async () => {
    const before = await readSnapshot();
    const resultado = await registrarCompra({
      proveedorId,
      numeroFactura: `FA-${suffix}-NOPER`,
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      cuentaId: bancoId,
      tipoPagoId,
      items: [{ productoId, cantidad: 3, precioCosto: 100 }],
    });

    // Diagnóstico accionable del guard, no el genérico de auditoría.
    expect(resultado.success).toBe(false);
    expect(resultado.error?.message).toBe(
      'No existe un período contable para esta fecha. Crea un período primero.',
    );

    // Operación rechazada: sin cambios en sus efectos persistidos.
    const after = await readSnapshot();
    expect(after).toEqual(before);
    expect(after.documentos).toBe(0);
    expect(after.asientos).toHaveLength(0);

    // La auditoría obligatoria del intento sí queda persistida.
    const auditorias = await prisma.auditoriaPeriodo.findMany({ where: { tenantId } });
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]).toMatchObject({
      tenantId,
      evento: 'INTENTO_BYPASS',
      periodoId: null,
      actor: userId,
    });
    expect(auditorias[0].motivo).toContain('No existe un período contable');
  });

  afterAll(async () => {
    if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
    else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
    if (previousNonCashMode === undefined) delete process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE;
    else process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = previousNonCashMode;
    if (previousGuardMode === undefined) delete process.env.PERIODO_CONTABLE_MODE;
    else process.env.PERIODO_CONTABLE_MODE = previousGuardMode;
    auth.user = null;
  });
});
