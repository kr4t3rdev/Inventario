/**
 * @description Contratos de los hooks CTA-1 lote 1: los writers de venta
 * construyen el evento contable correcto desde su payload real y lo envían al
 * motor dentro de la transacción. El motor se mockea (aislado ya en sus tests).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	applyFacturacionCobroWorkflow,
	reconciliarVentaDirecta,
} from '@/features/ventas/services/facturacion-workflow';

const postEventoMock = vi.hoisted(() => vi.fn());
const conversionMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
	postEvento: postEventoMock,
}));

vi.mock(
	'@/features/contabilidad/services/accounting-reconciliation-service',
	() => ({
		buildPersistedAccountingAmount: conversionMock,
	}),
);

function crearTx(cuenta: { cuentaId: string; moneda: string; tipoCuenta?: string | null }) {
	return {
		cuentaBancaria: {
			findFirst: vi.fn().mockResolvedValue({
				cuentaId: cuenta.cuentaId,
				moneda: cuenta.moneda,
				tipoCuenta: cuenta.tipoCuenta ?? null,
			}),
			update: vi.fn().mockResolvedValue({}),
		},
		tipoPago: {
			findMany: vi.fn().mockResolvedValue([
				{ tipoId: 'tp-1', nombre: 'Efectivo', cuentaDefecto: null },
			]),
		},
		reconciliacionVenta: {
			create: vi.fn().mockResolvedValue({ reconciliacionId: 'rec-1' }),
		},
		factura: { update: vi.fn().mockResolvedValue({}) },
		cuentaPorCobrar: { upsert: vi.fn().mockResolvedValue({ id: 'cxc-1' }) },
	};
}

describe('hooks CTA-1 lote 1 — writers de venta', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		postEventoMock.mockResolvedValue({ estado: 'CONTABILIZADO' });
		conversionMock.mockReturnValue({
			montoConvertido: 1100,
			tasaCambio: 44,
			fxEvidence: { functionalCurrency: 'CUP', fxEvidenceFingerprint: 'fp-1' },
		});
	});

	it('reconciliarVentaDirecta emite VENTA_CONTADO con la valoración heredada', async () => {
		const tx = crearTx({ cuentaId: 'cta-bank', moneda: 'USD', tipoCuenta: 'AHORROS' });

		await reconciliarVentaDirecta(tx as never, {
			ventaId: 'venta-1',
			montoTotal: 25,
			usuarioId: 'u1',
			tenantId: 'tenant-1',
			observaciones: 'Cobro mostrador',
		});

		expect(postEventoMock).toHaveBeenCalledTimes(1);
		const [txArg, ctxArg, evento] = postEventoMock.mock.calls[0];
		expect(txArg).toBe(tx);
		expect(ctxArg).toEqual({ tenantId: 'tenant-1', userId: 'u1' });
		expect(evento).toMatchObject({
			tipo: 'VENTA_CONTADO',
			monto: 25,
			moneda: 'USD',
			montoFuncional: 1100,
			tasaCambio: 44,
			fxEvidenceFingerprint: 'fp-1',
			medioCobro: 'BANCOS',
			origen: { tipo: 'reconciliacion_venta', id: 'rec-1' },
		});
	});

	it('cuenta en efectivo produce medioCobro CAJA', async () => {
		const tx = crearTx({ cuentaId: 'cta-caja', moneda: 'CUP', tipoCuenta: 'EFECTIVO' });
		conversionMock.mockReturnValue({ montoConvertido: null, tasaCambio: null, fxEvidence: null });

		await reconciliarVentaDirecta(tx as never, {
			ventaId: 'venta-2',
			montoTotal: 100,
			usuarioId: 'u1',
			tenantId: 'tenant-1',
		});

		const [, , evento] = postEventoMock.mock.calls[0];
		expect(evento.medioCobro).toBe('CAJA');
		expect(evento.montoFuncional).toBe(100);
	});

	it('factura contra_pago emite VENTA_CONTADO', async () => {
		const tx = crearTx({ cuentaId: 'cta-1', moneda: 'CUP', tipoCuenta: 'EFECTIVO' });
		conversionMock.mockReturnValue({ montoConvertido: null, tasaCambio: null, fxEvidence: null });

		const resultado = await applyFacturacionCobroWorkflow(tx as never, {
			ventaId: 'venta-3',
			facturaId: 'factura-3',
			clienteId: 'cli-3',
			montoTotal: 500,
			usuarioId: 'u1',
			tenantId: 'tenant-1',
			tipoVencimiento: 'contra_pago',
		});

		expect(resultado.tipoVencimiento).toBe('contra_pago');
		const [, , evento] = postEventoMock.mock.calls[0];
		expect(evento.tipo).toBe('VENTA_CONTADO');
		expect(evento.montoFuncional).toBe(500);
	});

	it('factura a crédito emite VENTA_CREDITO anclada a la factura', async () => {
		const tx = crearTx({ cuentaId: 'cta-1', moneda: 'CUP' });

		const resultado = await applyFacturacionCobroWorkflow(tx as never, {
			ventaId: 'venta-4',
			facturaId: 'factura-4',
			clienteId: 'cli-4',
			montoTotal: 900,
			usuarioId: 'u1',
			tenantId: 'tenant-1',
			tipoVencimiento: 'plazo',
		});

		expect(resultado.reconciliacionId).toBeNull();
		expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledOnce();
		const [, , evento] = postEventoMock.mock.calls[0];
		expect(evento).toMatchObject({
			tipo: 'VENTA_CREDITO',
			monto: 900,
			montoFuncional: 900,
			moneda: 'CUP',
			monedaFuncional: 'CUP',
			origen: { tipo: 'factura', id: 'factura-4' },
		});
	});
});
