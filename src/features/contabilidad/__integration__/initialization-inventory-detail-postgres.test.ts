import { randomUUID } from 'node:crypto';
import { hashInitialInventoryEvidence } from '@/features/contabilidad/services/initial-inventory-evidence';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { expectActionFailure } from '@/test/action-response';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: async () => auth.user }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: vi.fn().mockResolvedValue({}) },
}));

const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
const previousNonCashMode = process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE;
const tenants: string[] = [];
let initialize: typeof import('@/features/contabilidad/actions-cuentas-bancarias').initializeBankAccountsAction;
let cupCreated = false;
let usdCreated = false;

async function makeTenant() {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const user = {
    userId, name: 'QA detalle inventario', email: `qa-det-${tenantId.slice(0, 8)}@example.test`,
    role: 'admin' as const, isActive: true, tenantId, tenantRole: 'manager' as const,
  };
  auth.user = user as unknown as AuthenticatedUser;
  await prisma.tenant.create({ data: { tenantId, nombre: 'QA detalle inventario', slug: randomUUID() } });
  await prisma.user.create({ data: { userId, name: user.name, email: user.email, password: 'integration-only-placeholder' } });
  await prisma.tenantAccountingPolicy.create({ data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId } });
  await prisma.$transaction((tx) => seedPlanContable(tx as never, tenantId));
  await seedPlantillasGlobales(prisma as never);
  await prisma.tenantLicense.create({
    data: { tenantId, activa: true, expiracion: new Date(Date.now() + 86_400_000), features: { 'contabilidad-formal': true } },
  });
  const tipoPago = await prisma.tipoPago.create({ data: { tenantId, nombre: 'Efectivo QA', requiereCuenta: false } });
  void tipoPago;
  tenants.push(tenantId);
  return { tenantId, user };
}

async function makeInventorySetup(tenantId: string) {
  const categoria = await prisma.categoria.create({
    data: { tenantId, nombre: `Categoría inventario ${tenantId.slice(0, 8)}` },
  });
  const almacen = await prisma.almacen.create({
    data: { tenantId, nombre: `Almacén inventario ${tenantId.slice(0, 8)}` },
  });
  const producto = await prisma.producto.create({
    data: {
      tenantId,
      nombre: `Producto inicial ${tenantId.slice(0, 8)}`,
      precioCosto: 25,
      precioVenta: 40,
      stock: 0,
      categoriaId: categoria.catId,
      almacenId: almacen.almacenId,
    },
  });
  // El seed del plan ya crea el rol INVENTARIOS; reutilizarlo en vez de
  // crear un segundo rol (la unicidad es por tenant + rol).
  const inventoryRole = await prisma.cuentaRolTenant.findUniqueOrThrow({
    where: { tenantId_rol: { tenantId, rol: 'INVENTARIOS' } },
  });
  return { categoria, almacen, producto, inventoryRole };
}

function inventoryRequest(tenantId: string, productoId: string, almacenId: string) {
  return {
    idempotencyKey: `inventory-det-${tenantId.slice(0, 8)}`,
    fechaCorte: '2026-11-01',
    monedaFuncional: 'CUP',
    cuentas: [{
      nombreCuenta: 'Cuenta sin saldo',
      nombreBanco: 'Banco QA',
      numeroCuenta: `INV-${tenantId.slice(0, 8)}`,
      tipoCuenta: 'CORRIENTE',
      moneda: 'CUP',
      saldoInicial: '0',
    }],
    inventario: [{
      referenciaFila: 'fila-inventario-1',
      productoId,
      almacenId,
      loteCodigo: 'LOTE-INICIAL-1',
      cantidad: '4',
      costoUnitario: '25',
      moneda: 'CUP',
    }],
  };
}

describe('inventario inicial en el detalle de la apertura — PostgreSQL', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = 'enforce';
    initialize = (await import('@/features/contabilidad/actions-cuentas-bancarias')).initializeBankAccountsAction;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    if (!(await prisma.moneda.findUnique({ where: { codigo: 'CUP' } }))) {
      await prisma.moneda.create({ data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' } });
      cupCreated = true;
    }
    if (!(await prisma.moneda.findUnique({ where: { codigo: 'USD' } }))) {
      await prisma.moneda.create({ data: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' } });
      usdCreated = true;
    }
  });

  afterAll(async () => {
    if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
    else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
    if (previousNonCashMode === undefined) delete process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE;
    else process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = previousNonCashMode;
    for (const tenantId of tenants) {
      await prisma.purchaseAllocation.deleteMany({ where: { tenantId } });
      await prisma.inventarioInicialFuente.deleteMany({ where: { tenantId } });
      await prisma.lote.deleteMany({ where: { tenantId } });
      await prisma.stockUbicacion.deleteMany({ where: { tenantId } });
      await prisma.producto.deleteMany({ where: { tenantId } });
      await prisma.ubicacion.deleteMany({ where: { tenantId } });
      await prisma.almacen.deleteMany({ where: { tenantId } });
      await prisma.categoria.deleteMany({ where: { tenantId } });
      await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
      await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
      const anticipos = await prisma.anticipo.findMany({ where: { tenantId }, select: { anticipoId: true } });
      await prisma.anticipoMovimiento.deleteMany({ where: { anticipoId: { in: anticipos.map((a) => a.anticipoId) } } });
      await prisma.anticipo.deleteMany({ where: { tenantId } });
      await prisma.inyeccionCapital.deleteMany({ where: { tenantId } });
      await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
      await prisma.asientoLinea.deleteMany({ where: { tenantId } });
      await prisma.asiento.deleteMany({ where: { tenantId } });
      await prisma.aperturaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.periodoContable.deleteMany({ where: { tenantId } });
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
      await prisma.diario.deleteMany({ where: { tenantId } });
      await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
      await prisma.cuentaContable.deleteMany({ where: { tenantId } });
      await prisma.tipoPago.deleteMany({ where: { tenantId } });
      await prisma.tenantLicense.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
    }
    if (cupCreated) await prisma.moneda.deleteMany({ where: { codigo: 'CUP' } });
    if (usdCreated) await prisma.moneda.deleteMany({ where: { codigo: 'USD' } });
    await prisma.$disconnect();
  });

  it('ancla el inventario en el detalle de la apertura y el replay lo verifica', async () => {
    const { tenantId } = await makeTenant();
    const { almacen, producto } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId);

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });

    const fuente = await prisma.inventarioInicialFuente.findFirstOrThrow({ where: { tenantId } });
    const apertura = await prisma.aperturaPeriodo.findFirstOrThrow({ where: { tenantId } });
    const detalle = apertura.detalleJson as Record<string, unknown>;
    expect(detalle.inventario).toEqual({
      count: 1, totalFuncional: '100.0000',
      fuentes: [{
        referenciaFila: 'fila-inventario-1', fuenteId: fuente.id, loteId: fuente.loteId,
        productoId: producto.id, cantidad: '4', costoUnitario: '25',
        moneda: 'CUP', montoFuncional: '100.0000',
      }],
    });

    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
  });

  it('rechaza el replay si la cantidad de una fuente ya no coincide con el detalle', async () => {
    // El producto y el lote no se pueden cambiar solos: el FK compuesto
    // (tenantId, loteId, productoId) lo impide. La cantidad en la evidencia
    // aísla igual el anclaje por fuente: el total y el hash siguen intactos.
    const { tenantId } = await makeTenant();
    const { almacen, producto } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId);

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });

    const fuente = await prisma.inventarioInicialFuente.findFirstOrThrow({ where: { tenantId } });
    const evidencia = fuente.evidencia as Record<string, unknown>;
    const tampered = { ...evidencia, cantidad: '5' };
    const hash = hashInitialInventoryEvidence(tampered);
    await prisma.inventarioInicialFuente.update({
      where: { id: fuente.id },
      data: { evidencia: tampered, evidenciaHash: hash },
    });

    const replay = await initialize(request);
    expect(expectActionFailure(replay).error?.code).toBe('INITIALIZATION_INCOMPLETE');
  });

  it('rechaza el replay si la fecha de corte de la evidencia ya no coincide con el detalle', async () => {
    const { tenantId } = await makeTenant();
    const { almacen, producto } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId);

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });

    const fuente = await prisma.inventarioInicialFuente.findFirstOrThrow({ where: { tenantId } });
    const evidencia = fuente.evidencia as Record<string, unknown>;
    const tampered = { ...evidencia, fechaCorte: '2026-11-02' };
    const hash = hashInitialInventoryEvidence(tampered);
    await prisma.inventarioInicialFuente.update({
      where: { id: fuente.id },
      data: { evidencia: tampered, evidenciaHash: hash },
    });

    const replay = await initialize(request);
    expect(expectActionFailure(replay).error?.code).toBe('INITIALIZATION_INCOMPLETE');
  });
});
