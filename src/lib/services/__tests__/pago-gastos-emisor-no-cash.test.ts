import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emitirEventoLiquidacion } = vi.hoisted(() => ({
	emitirEventoLiquidacion: vi.fn(),
}));

vi.mock('@/features/contabilidad-formal/services/settlement-posting-service', () => ({
	emitirEventoLiquidacion,
}));

import { applyPagoGastoWorkflow } from '@/lib/services/pago-gastos-workflow';

/**
 * @description Crea un cliente transaccional minimo para ejecutar el workflow
 * de pago de gastos sin base de datos.
 * @returns {Record<string, unknown>} Mock transaccional de Prisma.
 */
function crearTxMock() {
	return {
		$queryRaw: vi.fn().mockResolvedValue([]),
		$queryRawUnsafe: vi.fn().mockResolvedValue([]),
		tipoPago: {
			findUnique: vi.fn().mockResolvedValue({
				tipoId: 'tp-1',
				isActive: true,
				cuentaDefecto: null,
			}),
			findFirst: vi.fn().mockResolvedValue({
				tipoId: 'tp-1',
				isActive: true,
				cuentaDefecto: null,
			}),
		},
		cuentaBancaria: {
			findFirst: vi.fn().mockResolvedValue({
				cuentaId: 'cb-1',
				moneda: 'CUP',
				isActive: true,
				tipoCuenta: 'EFECTIVO',
			}),
			findMany: vi.fn().mockResolvedValue([
				{
					cuentaId: 'cb-1',
					moneda: 'CUP',
					saldo: 1000,
					isActive: true,
					tipoCuenta: 'EFECTIVO',
				},
			]),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		reconciliacionGasto: {
			findFirst: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({
				reconciliacionId: 'rec-1',
				cuentaId: 'cb-1',
				monto: 120,
				moneda: 'CUP',
				montoConvertido: 120,
				descripcion: 'Pago directo',
			}),
		},
		cuentaPorPagar: {
			findFirst: vi.fn().mockResolvedValue(null),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		pagoCuentaPorPagar: {
			findFirst: vi.fn().mockResolvedValue(null),
			create: vi.fn(),
		},
		transaccionMoneda: {
			create: vi.fn(),
		},
		gastosDE: {
			findFirst: vi.fn().mockResolvedValue({ tenantId: 't1', isPagado: null }),
			update: vi.fn().mockResolvedValue({}),
		},
	};
}

const paramsBase = {
	tipoGasto: 'gastoDE' as const,
	referenciaId: 'gde-1',
	reconciliadoPor: 'user-1',
	descripcion: 'Pago directo',
	monto: 120,
	moneda: 'CUP',
	tenantId: 't1',
	cuentaId: 'cb-1',
	tipoPagoId: 'tp-1',
};

describe('pago-gastos-workflow: emisor formal no Cash', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		emitirEventoLiquidacion.mockResolvedValue({ estado: 'OMITIDO' });
	});

	it('emite el evento PAGO_CXP con la conciliacion persistida', async () => {
		const tx = crearTxMock();

		await applyPagoGastoWorkflow(tx as never, { ...paramsBase, estado: 'PAGADA' });

		expect(emitirEventoLiquidacion).toHaveBeenCalledTimes(1);
		const [txArg, ctxArg, payload] = emitirEventoLiquidacion.mock.calls[0];
		expect(txArg).toBe(tx);
		expect(ctxArg).toEqual({ tenantId: 't1', userId: 'user-1' });
		expect(payload).toMatchObject({
			tipo: 'PAGO_CXP',
			treasuryAccountType: 'EFECTIVO',
			reconciliacion: {
				reconciliacionId: 'rec-1',
				monto: 120,
				moneda: 'CUP',
				montoConvertido: 120,
				functionalCurrency: 'CUP',
				fechaReconciliacion: expect.any(Date),
			},
		});
	});

	it('no emite evento cuando la conciliacion queda PENDIENTE', async () => {
		const tx = crearTxMock();

		await applyPagoGastoWorkflow(tx as never, { ...paramsBase, estado: 'PENDIENTE' });

		expect(emitirEventoLiquidacion).not.toHaveBeenCalled();
	});
});
