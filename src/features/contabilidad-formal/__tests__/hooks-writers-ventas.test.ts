/**
 * @description Contratos de los hooks CTA-1 lote 1: los writers de venta
 * construyen el evento contable correcto desde su payload real y lo envían al
 * motor dentro de la transacción. El motor se mockea (aislado ya en sus tests).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Prisma } from '@/generated/prisma';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';

const postEventoMock = vi.hoisted(() => vi.fn());
const conversionMock = vi.hoisted(() => vi.fn());
const originalFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

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
        cuentaPorCobrar: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockImplementation(({ create }) =>
            Promise.resolve({ id: 'cxc-1', ...create }),
          ),
        },
		tenantAccountingPolicy: {
			findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
		},
	};
}

	describe('hooks CTA-1 lote 1 — writers de venta', () => {
	beforeEach(() => {
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		vi.clearAllMocks();
		postEventoMock.mockResolvedValue({ estado: 'CONTABILIZADO' });
		conversionMock.mockReturnValue({
			montoConvertido: 1100,
			tasaCambio: 44,
			fxEvidence: { functionalCurrency: 'CUP', fxEvidenceFingerprint: 'fp-1' },
		});
	});

	afterEach(() => {
		if (originalFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
		else process.env.CONTABILIDAD_FORMAL_MODE = originalFormalMode;
	});

	it('factura contra_pago emite VENTA_CONTADO', async () => {
		const tx = crearTx({ cuentaId: 'cta-1', moneda: 'CUP', tipoCuenta: 'EFECTIVO' });
		conversionMock.mockReturnValue({ montoConvertido: 500, tasaCambio: 1, fxEvidence: { functionalCurrency: 'CUP' } });

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

	it('factura a crédito emite VENTA_CREDITO anclada a la factura y valorada', async () => {
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
		const { create } = tx.cuentaPorCobrar.upsert.mock.calls[0][0];
		expect(create.monedaOriginal).toBe('CUP');
		expect((create.montoDeudaFuncional as Prisma.Decimal).toFixed()).toBe('900');
		expect(create.fxEvidenceJson).toMatchObject({ fxProvenanceKind: 'SAME_CURRENCY' });
		const [, , evento] = postEventoMock.mock.calls[0];
		expect(evento).toMatchObject({
			tipo: 'VENTA_CREDITO',
			monto: '900',
			moneda: 'CUP',
			monedaFuncional: 'CUP',
			fxEvidenceFingerprint: expect.any(String),
			origen: { tipo: 'factura', id: 'factura-4' },
		});
	});
});
