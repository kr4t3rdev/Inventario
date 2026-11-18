import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { registrarMovimientoEfectivoAnticipo } from '@/lib/services/anticipos-workflow';
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
const tipoPagoByTenant = new Map<string, string>();
let cupCreated = false;
let usdCreated = false;

async function makeTenant() {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const user = {
    userId, name: 'QA coordinada', email: `qa-coord-${tenantId.slice(0, 8)}@example.test`,
    role: 'admin' as const, isActive: true, tenantId, tenantRole: 'manager' as const,
  };
  auth.user = user as unknown as AuthenticatedUser;
  await prisma.tenant.create({ data: { tenantId, nombre: 'QA coordinada', slug: randomUUID() } });
  await prisma.user.create({ data: { userId, name: user.name, email: user.email, password: 'integration-only-placeholder' } });
  await prisma.tenantAccountingPolicy.create({ data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId } });
  await prisma.$transaction((tx) => seedPlanContable(tx as never, tenantId));
  await seedPlantillasGlobales(prisma as never);
  await prisma.tenantLicense.create({
    data: { tenantId, activa: true, expiracion: new Date(Date.now() + 86_400_000), features: { 'contabilidad-formal': true } },
  });
  const tipoPago = await prisma.tipoPago.create({ data: { tenantId, nombre: 'Efectivo QA', requiereCuenta: false } });
  tipoPagoByTenant.set(tenantId, tipoPago.tipoId);
  tenants.push(tenantId);
  return { tenantId, user };
}

describe('inicialización coordinada de banco/caja — PostgreSQL', { timeout: 120_000 }, () => {
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

  it('abre banco y caja multimoneda con asiento de apertura y período', async () => {
    const { tenantId } = await makeTenant();
    const request = {
      idempotencyKey: `coord-${tenantId.slice(0, 8)}`, fechaCorte: '2026-11-01', monedaFuncional: 'CUP',
      tasas: { USD: '400' },
      cuentas: [
        { nombreCuenta: 'Operaciones', nombreBanco: 'Banco QA', numeroCuenta: 'COORD-001', tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '100000', origen: { tipo: 'CAPITAL_SOCIAL' as const, tercero: 'Socio QA' } },
        { nombreCuenta: 'Caja USD', nombreBanco: 'Banco QA', numeroCuenta: 'COORD-002', tipoCuenta: 'CORRIENTE', moneda: 'USD', saldoInicial: '100', origenNoDocumentado: true },
      ],
    };
    const result = await initialize(request);
    expect(result).toMatchObject({ success: true, data: { replayed: false, resultado: { totalDebeFuncional: '140000', totalHaberFuncional: '140000' } } });
    if (!result.success) throw new Error(JSON.stringify(result));
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(2);
    const periodo = await prisma.periodoContable.findFirstOrThrow({ where: { tenantId } });
    expect(periodo).toMatchObject({ tipo: 'MENSUAL', estado: 'ABIERTO' });
    expect(periodo.fechaInicio.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(periodo.fechaFin.toISOString()).toBe('2026-11-30T00:00:00.000Z');
    const apertura = await prisma.aperturaPeriodo.findFirstOrThrow({ where: { tenantId } });
    const detalle = apertura.detalleJson as Record<string, unknown>;
    expect(detalle.origen).toBe('INICIALIZACION_CONTABLE');
    expect(detalle.payloadHash).toBeDefined();
    expect(result.data.resultado.periodoId).toBe(periodo.periodoId);
    expect(result.data.resultado.asientoId).toBe(detalle.asientoId);
    const asientos = await prisma.asiento.findMany({ where: { tenantId }, include: { lineas: { orderBy: { orden: 'asc' } } } });
    expect(asientos).toHaveLength(2);
    const aperturaAsiento = asientos.find((a) => a.origenTipo === 'inicializacion_contable');
    expect(aperturaAsiento).toBeDefined();
    expect(aperturaAsiento!.lineas).toHaveLength(2);
    expect(aperturaAsiento!.lineas[0].debe.toString()).toBe('40000');
    expect(aperturaAsiento!.lineas[0].haber.toString()).toBe('0');
    expect(aperturaAsiento!.lineas[1].debe.toString()).toBe('0');
    expect(aperturaAsiento!.lineas[1].haber.toString()).toBe('40000');
    const capitalAsiento = asientos.find((a) => a.origenTipo === 'inyeccion_capital');
    expect(capitalAsiento).toBeDefined();
    expect(capitalAsiento!.lineas).toHaveLength(2);
  });

  it('reproduce el resultado sin duplicar y bloquea la misma clave con otra carga', async () => {
    const { tenantId } = await makeTenant();
    const request = {
      idempotencyKey: `replay-${tenantId.slice(0, 8)}`, fechaCorte: '2026-11-01', monedaFuncional: 'CUP',
      cuentas: [
        { nombreCuenta: 'Operaciones', nombreBanco: 'Banco QA', numeroCuenta: 'REPLAY-001', tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '50000', origen: { tipo: 'CAPITAL_SOCIAL' as const, tercero: 'Socio QA' } },
      ],
    };
    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });
    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.aperturaPeriodo.count({ where: { tenantId } })).toBe(1);
    const conflict = await initialize({ ...request, cuentas: [{ ...request.cuentas[0], nombreCuenta: 'Otra carga' }] });
    expect(conflict).toMatchObject({ success: false, error: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(1);
  });

  it('carga un anticipo de cliente a fecha de corte con la tasa declarada y el replay lo reconoce', async () => {
    const { tenantId } = await makeTenant();
    const tipoPagoId = tipoPagoByTenant.get(tenantId)!;
    const request = {
      idempotencyKey: `anticipo-${tenantId.slice(0, 8)}`, fechaCorte: '2026-11-01', monedaFuncional: 'CUP',
      tasas: { USD: '24' },
      cuentas: [
        { nombreCuenta: 'Anticipos', nombreBanco: 'Banco QA', numeroCuenta: 'ANT-001', tipoCuenta: 'CORRIENTE', moneda: 'USD', saldoInicial: '100', origen: { tipo: 'ANTICIPO' as const, tercero: 'Cliente QA', tipoPagoId } },
      ],
    };
    const result = await initialize(request);
    expect(result).toMatchObject({ success: true, data: { replayed: false } });
    const anticipo = await prisma.anticipo.findFirstOrThrow({ where: { tenantId } });
    expect(anticipo).toMatchObject({ tipo: 'COBRO', estado: 'RESERVADO', moneda: 'USD' });
    expect(Number(anticipo.montoOriginal)).toBe(100);
    expect(Number(anticipo.montoFinanciado)).toBe(100);
    expect(Number(anticipo.saldoDisponible)).toBe(100);
    const movimiento = await prisma.anticipoMovimiento.findFirstOrThrow({ where: { anticipoId: anticipo.anticipoId, tipoMovimiento: 'RECEPCION' } });
    expect(movimiento.tipoMovimiento).toBe('RECEPCION');
    expect(Number(movimiento.tasaAplicada)).toBe(24);
    expect(Number(movimiento.montoFuncional)).toBe(2400);
    expect(movimiento.functionalCurrency).toBe('CUP');
    expect(movimiento.fxEvidenceFingerprint).not.toBeNull();
    const cuenta = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId } });
    expect(Number(cuenta.saldo)).toBe(100);
    expect(cuenta.moneda).toBe('USD');
    const asientos = await prisma.asiento.findMany({ where: { tenantId }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0]!.fecha.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(asientos[0]!.lineas).toHaveLength(2);
    expect(asientos[0]!.lineas.some((linea) => Number(linea.debe) === 2400)).toBe(true);
    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
    if (!result.success || !replay.success) throw new Error('la inicialización con anticipo debe completarse');
    expect(replay.data.resultado).toEqual(result.data.resultado);
    expect(await prisma.anticipo.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.anticipoMovimiento.count({ where: { anticipoId: anticipo.anticipoId } })).toBe(2);
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(1);
    expect((await prisma.inicializacionContable.findFirstOrThrow({ where: { tenantId, idempotencyKey: request.idempotencyKey } })).estado).toBe('COMPLETADA');
  });

  it('rechaza la apertura si el tenant ya tiene saldos en submayores', async () => {
    const { tenantId } = await makeTenant();
    await prisma.cuentaPorPagar.create({ data: { tenantId, tipo: 'compra', montoDeuda: 100, saldoPendiente: 100, monedaOriginal: 'CUP', numeroFactura: 'F-001', fechaEmision: new Date('2026-10-01T00:00:00.000Z') } });
    const result = await initialize({
      idempotencyKey: `guard-${tenantId.slice(0, 8)}`, fechaCorte: '2026-11-01', monedaFuncional: 'CUP',
      cuentas: [{ nombreCuenta: 'Operaciones', nombreBanco: 'Banco QA', numeroCuenta: 'GUARD-001', tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0' }],
    });
    expect(result).toMatchObject({ success: false, error: { code: 'INITIALIZATION_NOT_EMPTY' } });
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(0);
  });

  it('revierte todo si el posteo formal no se confirma y permite el reintento con licencia', async () => {
    const { tenantId } = await makeTenant();
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    const key = `rollback-${tenantId.slice(0, 8)}`;
    const request = {
      idempotencyKey: key, fechaCorte: '2026-11-01', monedaFuncional: 'CUP',
      cuentas: [
        { nombreCuenta: 'Operaciones', nombreBanco: 'Banco QA', numeroCuenta: 'RB-001', tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '100', origen: { tipo: 'CAPITAL_SOCIAL' as const, tercero: 'Socio QA' } },
      ],
    };
    const failed = await initialize(request);
    expect(failed).toMatchObject({ success: false, error: { code: 'INITIALIZATION_POSTING_NO_CONFIRMADO' } });
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.inyeccionCapital.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.aperturaPeriodo.count({ where: { tenantId } })).toBe(0);
    // La fila se crea dentro de la transacción del runner y revierte con ella:
    // el reintento la vuelve a crear y completa.
    expect(await prisma.inicializacionContable.count({ where: { tenantId } })).toBe(0);
    await prisma.tenantLicense.create({
      data: { tenantId, activa: true, expiracion: new Date(Date.now() + 86_400_000), features: { 'contabilidad-formal': true } },
    });
    const retry = await initialize(request);
    expect(retry).toMatchObject({ success: true, data: { replayed: false } });
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(1);
    expect((await prisma.inicializacionContable.findFirstOrThrow({ where: { tenantId, idempotencyKey: key } })).estado).toBe('COMPLETADA');
  });

  it('reproduce el resultado aunque el saldo haya cambiado por un movimiento posterior', async () => {
    const { tenantId, user } = await makeTenant();
    const tipoPagoId = tipoPagoByTenant.get(tenantId)!;
    const request = {
      idempotencyKey: `replay-mov-${tenantId.slice(0, 8)}`, fechaCorte: '2026-11-01', monedaFuncional: 'CUP',
      cuentas: [
        { nombreCuenta: 'Operaciones', nombreBanco: 'Banco QA', numeroCuenta: 'REPLAY-MOV-001', tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '50000', origen: { tipo: 'CAPITAL_SOCIAL' as const, tercero: 'Socio QA' } },
      ],
    };
    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });
    if (!first.success) throw new Error(JSON.stringify(first));
    const cuenta = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId } });
    const anticipo = await prisma.anticipo.create({ data: {
      tenantId, tipo: 'COBRO', estado: 'RESERVADO', montoOriginal: 10000, montoFinanciado: 0, saldoDisponible: 0,
      moneda: 'CUP', cuentaOrigenId: cuenta.cuentaId,
      referenciaExterna: `POST-OPENING:${request.idempotencyKey}`, createdById: user.userId,
    } });
    await prisma.$transaction((tx) => registrarMovimientoEfectivoAnticipo(tx as never, {
      anticipoId: anticipo.anticipoId, tenantId, cuentaId: cuenta.cuentaId, tipoPagoId,
      monto: 10000, idempotencyKey: `post-opening-${tenantId.slice(0, 8)}`, usuarioId: user.userId,
      observaciones: 'Anticipo recibido tras la apertura',
    }));
    expect(Number((await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId } })).saldo)).toBe(60000);
    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
    if (!replay.success) throw new Error(JSON.stringify(replay));
    expect(replay.data.resultado).toEqual(first.data.resultado);
    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.aperturaPeriodo.count({ where: { tenantId } })).toBe(1);
  });

  it('carga inventario inicial en lote, stock y asiento sin crear compras', async () => {
    const { tenantId } = await makeTenant();
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
    await prisma.cuentaRolTenant.findUniqueOrThrow({
      where: { tenantId_rol: { tenantId, rol: 'INVENTARIOS' } },
    });

    const request = {
      idempotencyKey: `inventory-${tenantId.slice(0, 8)}`,
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
        productoId: producto.id,
        almacenId: almacen.almacenId,
        loteCodigo: 'LOTE-INICIAL-1',
        cantidad: '4',
        costoUnitario: '25',
        moneda: 'CUP',
      }],
    };

    const first = await initialize(request);
    expect(first).toMatchObject({
      success: true,
      data: {
        replayed: false,
        resultado: {
          inventario: { count: 1, totalFuncional: '100.0000' },
          totalDebeFuncional: '100',
          totalHaberFuncional: '100',
        },
      },
    });
    expect(await prisma.compraDocumento.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.inventarioInicialFuente.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.lote.count({ where: { tenantId, productoId: producto.id } })).toBe(1);
    expect(await prisma.stockUbicacion.findFirstOrThrow({
      where: { tenantId, productoId: producto.id, ubicacionId: almacen.almacenId },
    })).toMatchObject({ cantidad: 4, cantidadDisponible: 4 });
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: producto.id } })).stock).toBe(4);

    const asiento = await prisma.asiento.findFirstOrThrow({
      where: { tenantId, origenTipo: 'inicializacion_contable' },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    });
    expect(asiento.lineas).toHaveLength(2);
    expect(asiento.lineas[0].debe.toString()).toBe('100');
    expect(asiento.lineas[1].haber.toString()).toBe('100');

    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
    expect(await prisma.inventarioInicialFuente.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.lote.count({ where: { tenantId, productoId: producto.id } })).toBe(1);
  });
});
