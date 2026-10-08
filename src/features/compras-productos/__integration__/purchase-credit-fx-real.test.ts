import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import {
  anularCompraProductoAction as _anularCompraProductoAction,
  createCompraProductoAction as _createCompraProductoAction,
} from '@/features/compras-productos/actions'
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { ServerAction } from '@/lib/server-actions/types';
type RawAction<A> = A extends ServerAction<infer I, infer O> ? (input: I, user: AuthenticatedUser) => Promise<O> : never;
const anularCompraProductoAction = _anularCompraProductoAction as unknown as RawAction<typeof _anularCompraProductoAction>;
const createCompraProductoAction = _createCompraProductoAction as unknown as RawAction<typeof _createCompraProductoAction>;
import { createAnticipo } from '@/lib/services/anticipos-workflow';

vi.mock('@/lib/server-actions', async (importOriginal) => {
	const original = await importOriginal<typeof import('@/lib/server-actions')>();
	return { ...original, withAction: (handler: (...args: any[]) => unknown) => handler };
});
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/inventario/movimientos', () => ({
	registrarMovimiento: vi.fn(),
	mapearMotivoLegacy: vi.fn((reason: string) => reason),
	getMovimientosDeOrigen: vi.fn().mockResolvedValue([]),
	revertirMovimientosDeOrigen: vi.fn(),
}));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({ upsertStockUbicacion: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-queries', () => ({ getStockTotalProducto: vi.fn().mockResolvedValue(0) }));
vi.mock('@/lib/cost-history-utils', () => ({
	recordCostChange: vi.fn(),
	CostChangeReason: { RESTOCK: 'RESTOCK' },
}));

const prefix = `cta-compra-fx-${crypto.randomUUID()}`;
let tenantId = '';
let planId = '';
let proveedorId = '';
let productoId = '';
let usuarioId = '';
let contratoId = '';
let cuentaAnticipoId = '';
let tipoPagoAnticipoId = '';
let trigger = '';

const manager = () => ({
	userId: usuarioId, tenantId, tenantRole: 'manager',
	planFeatures: { compras: true, anticipos: true, 'contabilidad-formal': true },
}) as never;

/** @description Prueba el writer de compra a crédito y su FX contra PostgreSQL aislado. */
describe('compra de producto a crédito FX — PostgreSQL aislado', { timeout: 90_000 }, () => {
	beforeAll(async () => {
		const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
			SELECT current_database() AS db, inet_server_port() AS port
		`;
		const target = new URL(process.env.DATABASE_URL ?? '');
		expect(identity[0]).toMatchObject({ db: target.pathname.slice(1), port: Number(target.port) });
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
		tenantId = tenant.tenantId;
		const user = await prisma.user.create({ data: {
			name: `${prefix}-user`, email: `${prefix}@test.local`, password: 'x',
		} });
		usuarioId = user.userId;
		const proveedor = await prisma.vendor.create({ data: { tenantId, nombre: prefix } });
		proveedorId = proveedor.vendorId;
		const almacen = await prisma.almacen.create({ data: { tenantId, nombre: prefix } });
		const categoria = await prisma.categoria.create({ data: { tenantId, nombre: prefix } });
		const producto = await prisma.producto.create({ data: {
			tenantId, nombre: prefix, categoriaId: categoria.catId, almacenId: almacen.almacenId,
			precioCosto: 100, precioVenta: 200, stock: 0,
		} });
		productoId = producto.id;
		const plan = await prisma.plan.create({ data: {
			nombre: prefix, duracionDias: 365,
			features: { compras: true, anticipos: true, 'contabilidad-formal': true },
		} });
		planId = plan.planId;
		await prisma.tenantLicense.create({ data: {
			tenantId, planId, expiracion: new Date('2099-01-01'),
		} });
      await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
      await prisma.moneda.upsert({
        where: { codigo: 'USD' },
        update: { isActive: true },
        create: { codigo: 'USD', nombre: 'Dólar', simbolo: '$', esPrincipal: false },
      });
      await prisma.tenantAccountingPolicy.create({ data: {
			tenantId, functionalCurrencyCode: 'CUP', updatedBy: usuarioId,
		} });
		contratoId = (await prisma.contrato.create({ data: {
			tenantId, numeroContrato: `${prefix}-ctr`, numeroConsecutivo: 1,
			tipo: 'COMPRA', estado: 'ACTIVO', vendorId: proveedorId,
			fechaInicio: new Date('2026-01-01'), creadoPor: usuarioId,
		} })).contratoId;
		cuentaAnticipoId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-advance`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 10_000,
		} })).cuentaId;
		tipoPagoAnticipoId = (await prisma.tipoPago.create({
			data: { tenantId, nombre: prefix },
		})).tipoId;
		const now = new Date();
		await prisma.periodoContable.create({ data: {
			tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
			fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
			fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
		} });
		await PeriodoGuard.assertWritable(now, tenantId, 'asiento', {
			actorId: usuarioId, actorTipo: 'USUARIO',
			origen: { tipo: 'compra_documento', id: prefix },
		});
	});

	afterAll(async () => {
		delete process.env.CONTABILIDAD_FORMAL_MODE;
		if (trigger) {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
		}
    if (!tenantId) return;
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } });
    await prisma.compraDocumentoItem.deleteMany({ where: { tenantId } });
		await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
		await prisma.compraDocumento.deleteMany({ where: { tenantId } });
		await prisma.gastoCompra.deleteMany({ where: { tenantId } });
		await prisma.anticipoMovimiento.deleteMany({ where: { anticipo: { tenantId } } });
		await prisma.anticipo.deleteMany({ where: { tenantId } });
		await prisma.stockUbicacion.deleteMany({ where: { tenantId } });
		await prisma.producto.deleteMany({ where: { tenantId } });
		await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
		await prisma.cuentaContable.deleteMany({ where: { tenantId } });
		await prisma.diario.deleteMany({ where: { tenantId } });
		await prisma.periodoCache.deleteMany({ where: { tenantId } });
		await prisma.periodoContable.deleteMany({ where: { tenantId } });
		await prisma.contrato.deleteMany({ where: { tenantId } });
		await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
		await prisma.tipoPago.deleteMany({ where: { tenantId } });
		await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
		await prisma.tenantLicense.deleteMany({ where: { tenantId } });
		await prisma.vendor.deleteMany({ where: { tenantId } });
		await prisma.almacen.deleteMany({ where: { tenantId } });
		await prisma.categoria.deleteMany({ where: { tenantId } });
		await prisma.tenant.delete({ where: { tenantId } });
		await prisma.user.deleteMany({ where: { userId: usuarioId } });
		await prisma.plan.deleteMany({ where: { planId } });
	});

  it('registra compra extranjera y hereda FX al asiento de CxP', async () => {
		const result = await createCompraProductoAction({
			proveedorId,
			formaPago: 'PAGO_PARCIAL',
			estado: 'PENDIENTE',
			moneda: 'USD',
			tasaCambio: 24,
			fechaTasa: new Date().toISOString(),
			items: [{ productoId, precioCosto: 100, cantidad: 1 }],
		}, manager());
		expect(result.success).toBe(true);
		if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
		expect(result.data.compraDocumentoId).toBeTruthy();
		const documento = await prisma.compraDocumento.findFirstOrThrow({ where: {
			tenantId, proveedorId, moneda: 'USD', formaPago: 'PAGO_PARCIAL',
		} });
    expect(documento.montoConvertido?.toString()).toBe('2400');
    expect(documento.fxEvidenceFingerprint).toBeTruthy();
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: productoId } }))
      .precioCosto).toBe(2400);
		const asientos = await prisma.asiento.findMany({ where: {
			tenantId, origenTipo: 'compra_documento', origenId: documento.compraDocumentoId,
		}, include: { lineas: true } });
		expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((line) =>
      line.fxEvidenceFingerprint === documento.fxEvidenceFingerprint
      && line.tasaCambio?.toString() === '24')).toBe(true);
  });

  it('anular una compra a crédito crea reverso formal y preserva evidencia FX', async () => {
    const result = await createCompraProductoAction({
      proveedorId,
      formaPago: 'PAGO_PARCIAL',
      estado: 'PENDIENTE',
      moneda: 'USD',
      tasaCambio: 24,
      fechaTasa: new Date().toISOString(),
      items: [{ productoId, precioCosto: 75, cantidad: 1 }],
    }, manager());
    expect(result.success).toBe(true)
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    const original = await prisma.asiento.findUniqueOrThrow({
      where: {
        tenantId_origenTipo_origenId: {
          tenantId,
          origenTipo: 'compra_documento',
          origenId: result.data.compraDocumentoId,
        },
      },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    await anularCompraProductoAction({ id: result.data.compraDocumentoId }, manager());

    const anulado = await prisma.asiento.findUniqueOrThrow({
      where: { asientoId: original.asientoId },
    });
    expect(anulado.estado).toBe('ANULADO');
    expect(anulado.revertidoPorId).toBeTruthy();
    const reverso = await prisma.asiento.findUniqueOrThrow({
      where: { asientoId: anulado.revertidoPorId! },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    });
    expect(reverso).toMatchObject({
      origenTipo: 'REVERSO_ASIENTO',
      origenId: original.asientoId,
      estado: 'CONTABILIZADO',
    });
    expect(reverso.lineas.map((linea) => [
      linea.cuentaId, linea.debe.toString(), linea.haber.toString(),
      linea.monedaOriginal, linea.montoOriginal.toString(),
      linea.tasaCambio?.toString() ?? null, linea.fxEvidenceFingerprint,
    ])).toEqual(original.lineas.map((linea) => [
      linea.cuentaId, linea.haber.toString(), linea.debe.toString(),
      linea.monedaOriginal, linea.montoOriginal.toString(),
      linea.tasaCambio?.toString() ?? null, linea.fxEvidenceFingerprint,
    ]));
  });

  it('registra PAGO_COMPLETO como COMPRA_CONTADO, debita la cuenta y es idempotente', async () => {
    const saldoInicial = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaAnticipoId },
    })).saldo;
    const claveIdempotencia = `compra-cash-${crypto.randomUUID()}`;
    const input = {
      proveedorId,
      formaPago: 'PAGO_COMPLETO' as const,
      estado: 'PAGADA' as const,
      moneda: 'USD' as const,
      tasaCambio: 24,
      fechaTasa: new Date().toISOString(),
      cuentaId: cuentaAnticipoId,
      tipoPagoId: tipoPagoAnticipoId,
      claveIdempotencia,
      items: [{ productoId, precioCosto: 100, cantidad: 1 }],
    };

    const compra = await createCompraProductoAction(input, manager());
    const retry = await createCompraProductoAction(input, manager());
    expect(retry.success).toBe(true);
    if (!retry.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(retry.data.data.compraDocumentoId).toBe(compra.compraDocumentoId);
    const saldoFinal = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaAnticipoId },
    })).saldo;
    expect(Number(saldoInicial) - Number(saldoFinal)).toBe(2400);

    const documento = await prisma.compraDocumento.findFirstOrThrow({ where: {
      tenantId, claveIdempotencia,
    } });
    const reconciliacion = await prisma.reconciliacionGasto.findFirstOrThrow({ where: {
      tenantId, tipoGasto: 'compra', referenciaId: documento.gastoCompraId!,
    } });
    expect(reconciliacion).toMatchObject({
      cuentaId: cuentaAnticipoId, tipoPagoId: tipoPagoAnticipoId,
      estado: 'PAGADA', moneda: 'USD',
    });
    expect(reconciliacion.tasaCambio?.toString()).toBe('24');
    expect(reconciliacion.montoConvertido.toString()).toBe('2400');
    const asiento = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'reconciliacion_gasto', origenId: reconciliacion.reconciliacionId,
    }, include: { lineas: true } });
    expect(asiento).toHaveLength(1);
    expect(asiento[0].lineas.reduce((sum, line) => sum + Number(line.debe), 0)).toBe(2400);
    expect(asiento[0].lineas.reduce((sum, line) => sum + Number(line.haber), 0)).toBe(2400);
    expect(asiento[0].lineas.every((line) =>
      line.fxEvidenceFingerprint === reconciliacion.fxEvidenceFingerprint
      && line.tasaCambio?.toString() === '24')).toBe(true);
  });

  it('mantiene precio de inventario y asiento en la moneda funcional no-CUP', async () => {
    // La moneda funcional es INMUTABLE una vez que existe evidencia contable
    // (regla reforzada por trigger), así que este escenario usa un tenant propio
    // cuya política ya es USD desde el alta.
    const prefixUsd = `${prefix}-usd`;
    const tenantUsd = await prisma.tenant.create({ data: { nombre: prefixUsd, slug: prefixUsd } });
    const tenantUsdId = tenantUsd.tenantId;
    const usuarioUsd = await prisma.user.create({ data: {
      name: `${prefixUsd}-user`, email: `${prefixUsd}@test.local`, password: 'x',
    } });
    const proveedorUsd = await prisma.vendor.create({ data: { tenantId: tenantUsdId, nombre: prefixUsd } });
    const almacenUsd = await prisma.almacen.create({ data: { tenantId: tenantUsdId, nombre: prefixUsd } });
    const categoriaUsd = await prisma.categoria.create({ data: { tenantId: tenantUsdId, nombre: prefixUsd } });
    const productoUsd = await prisma.producto.create({ data: {
      tenantId: tenantUsdId, nombre: prefixUsd, categoriaId: categoriaUsd.catId,
      almacenId: almacenUsd.almacenId, precioCosto: 100, precioVenta: 200, stock: 0,
    } as never });
    const planUsd = await prisma.plan.create({ data: {
      nombre: prefixUsd, duracionDias: 365,
      features: { compras: true, anticipos: true, 'contabilidad-formal': true },
    } });
    await prisma.tenantLicense.create({ data: {
      tenantId: tenantUsdId, planId: planUsd.planId, expiracion: new Date('2099-01-01'),
    } });
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantUsdId));
    await prisma.tenantAccountingPolicy.create({ data: {
      tenantId: tenantUsdId, functionalCurrencyCode: 'USD', updatedBy: usuarioUsd.userId,
    } });
    const cuentaUsd = (await prisma.cuentaBancaria.create({ data: {
      tenantId: tenantUsdId, nombreBanco: prefixUsd, numeroCuenta: `${prefixUsd}-acc`,
      tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: 10_000,
    } })).cuentaId;
    const tipoPagoUsd = (await prisma.tipoPago.create({
      data: { tenantId: tenantUsdId, nombre: prefixUsd },
    })).tipoId;
    const now = new Date();
    await prisma.periodoContable.create({ data: {
      tenantId: tenantUsdId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
    } });
    try {
      const claveIdempotencia = `compra-usd-func-${crypto.randomUUID()}`;
      const saldoInicial = (await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaUsd },
      })).saldo;
      const compra = await createCompraProductoAction({
        proveedorId: proveedorUsd.vendorId,
        formaPago: 'PAGO_COMPLETO',
        estado: 'PAGADA',
        moneda: 'USD',
        tasaCambio: 24,
        fechaTasa: new Date().toISOString(),
        cuentaId: cuentaUsd,
        tipoPagoId: tipoPagoUsd,
        claveIdempotencia,
        items: [{ productoId: productoUsd.id, precioCosto: 100, cantidad: 1 }],
      }, { userId: usuarioUsd.userId, tenantId: tenantUsdId, tenantRole: 'manager',
        planFeatures: { compras: true, anticipos: true, 'contabilidad-formal': true } } as never);
      expect(compra.success).toBe(true);
      if (!compra.success) expect.unreachable('Se esperaba que la accion tuviera exito');
      expect(compra.data.compraDocumentoId).toBeTruthy();

      const documento = await prisma.compraDocumento.findFirstOrThrow({ where: {
        tenantId: tenantUsdId, claveIdempotencia,
      } });
      expect(documento.functionalCurrency).toBe('USD');
      expect(documento.montoConvertido?.toString()).toBe('100');
      expect((await prisma.producto.findUniqueOrThrow({ where: { id: productoUsd.id } }))
        .precioCosto).toBe(100);

      const reconciliacion = await prisma.reconciliacionGasto.findFirstOrThrow({ where: {
        tenantId: tenantUsdId, tipoGasto: 'compra', referenciaId: documento.gastoCompraId!,
      } });
      expect(reconciliacion.functionalCurrency).toBe('USD');
      expect(reconciliacion.montoConvertido?.toString()).toBe('100');
      const asiento = await prisma.asiento.findFirstOrThrow({ where: {
        tenantId: tenantUsdId, origenTipo: 'reconciliacion_gasto',
        origenId: reconciliacion.reconciliacionId,
      }, include: { lineas: true } });
      expect(asiento.lineas.every((line) => line.monedaOriginal === 'USD')).toBe(true);
      expect(asiento.lineas.reduce((sum, line) => sum + Number(line.debe), 0)).toBe(100);
      expect(asiento.lineas.reduce((sum, line) => sum + Number(line.haber), 0)).toBe(100);
      expect(Number(saldoInicial) - Number((await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaUsd },
      })).saldo)).toBe(100);
    } finally {
      await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId: tenantUsdId } } })
        .catch(() => undefined);
      await prisma.asiento.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.reconciliacionGasto.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.compraDocumentoItem.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.cuentaPorPagar.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.compraDocumento.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.gastoCompra.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.producto.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.cuentaRolTenant.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.cuentaContable.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.diario.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.periodoContable.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.tipoPago.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.cuentaBancaria.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.tenantLicense.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.vendor.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.almacen.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.categoria.deleteMany({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.tenant.delete({ where: { tenantId: tenantUsdId } }).catch(() => undefined);
      await prisma.user.delete({ where: { userId: usuarioUsd.userId } }).catch(() => undefined);
      await prisma.plan.deleteMany({ where: { planId: planUsd.planId } }).catch(() => undefined);
    }
  });

  it('revierte compra, reconciliación y saldo si falla el asiento de PAGO_COMPLETO', async () => {
    trigger = `cta_purchase_cash_${crypto.randomUUID().replaceAll('-', '')}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'pago contado fallido' USING ERRCODE = '22012';
      RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "asientos"
      FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${trigger}()`);
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaAnticipoId },
    })).saldo;
    const comprasAntes = await prisma.compraDocumento.count({ where: { tenantId } });
    const reconciliacionesAntes = await prisma.reconciliacionGasto.count({ where: { tenantId } });
    try {
      await expect(createCompraProductoAction({
        proveedorId, formaPago: 'PAGO_COMPLETO', estado: 'PAGADA', moneda: 'CUP',
        cuentaId: cuentaAnticipoId, tipoPagoId: tipoPagoAnticipoId,
        items: [{ productoId, precioCosto: 101, cantidad: 1 }],
      }, manager())).rejects.toThrow('pago contado fallido');
      expect(await prisma.compraDocumento.count({ where: { tenantId } })).toBe(comprasAntes);
      expect(await prisma.reconciliacionGasto.count({ where: { tenantId } })).toBe(reconciliacionesAntes);
      expect((await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaAnticipoId },
      })).saldo).toEqual(saldoAntes);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
      trigger = '';
    }
  });

  it('devenga compra bruta, aplica anticipo al CxP sin segundo movimiento bancario', async () => {
    const saldoInicial = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaAnticipoId },
    })).saldo;
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
			tenantId, tipo: 'PAGO', contratoId, proveedorId, monto: 100, moneda: 'CUP',
			cuentaOrigenId: cuentaAnticipoId, tipoPagoOrigenId: tipoPagoAnticipoId,
			usuarioId,
		}));
		const saldoTrasAnticipo = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: cuentaAnticipoId },
		})).saldo;
    expect(Number(saldoInicial) - Number(saldoTrasAnticipo)).toBe(100);
		expect(await prisma.asiento.count({ where: {
			tenantId, origenTipo: 'anticipo', origenId: anticipo.anticipoId,
		} })).toBe(1);

    const compraClaveIdempotencia = `compra-${crypto.randomUUID()}`;
    const compra = await createCompraProductoAction({
			proveedorId,
			formaPago: 'ANTICIPO_PAGO',
			estado: 'PAGADA',
			moneda: 'CUP',
			anticipoPagoId: anticipo.anticipoId,
			idempotencyKey: `advance-${crypto.randomUUID()}`,
      claveIdempotencia: compraClaveIdempotencia,
			items: [{ productoId, precioCosto: 100, cantidad: 1 }],
		}, manager());
		expect(compra.success).toBe(true);
		if (!compra.success) expect.unreachable('Se esperaba que la accion tuviera exito');
		expect(compra.data.compraDocumentoId).toBeTruthy();
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: cuentaAnticipoId },
		})).saldo).toEqual(saldoTrasAnticipo);

    const documento = await prisma.compraDocumento.findFirstOrThrow({ where: {
      tenantId, claveIdempotencia: compraClaveIdempotencia,
		} });
		const cxp = await prisma.cuentaPorPagar.findFirstOrThrow({ where: {
			tenantId, gastoCompraId: documento.gastoCompraId,
		} });
		expect(cxp.montoDeuda.toString()).toBe('100');
		expect(cxp.montoPagado.toString()).toBe('100');
		expect(cxp.saldoPendiente.toString()).toBe('0');
		expect(cxp.estado).toBe('PAGADA');
		expect(cxp.fxSnapshot).toMatchObject({ originalAmount: '100', originalCurrency: 'CUP' });

		const devengo = await prisma.asiento.findMany({ where: {
			tenantId, origenTipo: 'compra_documento', origenId: documento.compraDocumentoId,
		} });
		const movimiento = await prisma.anticipoMovimiento.findFirstOrThrow({ where: {
			anticipoId: anticipo.anticipoId, tipoMovimiento: 'EJECUCION',
		} });
		const aplicacion = await prisma.asiento.findMany({ where: {
			tenantId, origenTipo: 'anticipo_movimiento', origenId: movimiento.movimientoId,
		} });
		expect(devengo).toHaveLength(1);
		expect(aplicacion).toHaveLength(1);
		expect(await prisma.reconciliacionGasto.count({ where: {
			tenantId, referenciaId: documento.compraDocumentoId,
		} })).toBe(0);
	});

	it('revierte CxP y documento si falla SQL en el asiento de compra', async () => {
		trigger = `cta_purchase_${crypto.randomUUID().replaceAll('-', '')}`;
		await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger
			LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'compra posteo fallido' USING ERRCODE = '22012';
			RETURN NEW; END $$`);
		await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "asientos"
			FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${trigger}()`);
		const comprasAntes = await prisma.compraDocumento.count({ where: { tenantId } });
		const cxpAntes = await prisma.cuentaPorPagar.count({ where: { tenantId } });
		try {
			await expect(createCompraProductoAction({
				proveedorId, formaPago: 'PAGO_PARCIAL', estado: 'PENDIENTE', moneda: 'CUP',
				items: [{ productoId, precioCosto: 101, cantidad: 1 }],
			}, manager())).rejects.toThrow('compra posteo fallido');
			expect(await prisma.compraDocumento.count({ where: { tenantId } })).toBe(comprasAntes);
			expect(await prisma.cuentaPorPagar.count({ where: { tenantId } })).toBe(cxpAntes);
		} finally {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
			trigger = '';
		}
	});
});
