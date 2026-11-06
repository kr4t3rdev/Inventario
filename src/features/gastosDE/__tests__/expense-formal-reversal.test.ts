/**
 * @description Test focal de la reversa formal en gastos reconciliados y nómina.
 *
 * Verifica que al revertir un gasto o un pago de nómina se anula el asiento
 * formal del documento con su contraasiento (orígenes `reconciliacion_gasto`,
 * `compra_servicio` y `anticipo_movimiento`), sin tocar los efectos operativos.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reverseFormalEntries = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock('@/features/contabilidad-formal/services/reversal-service', () => ({
	reverseFormalEntries,
}));

vi.mock('@/lib/services/anticipos-workflow', () => ({
	reverseAnticipo: vi.fn().mockResolvedValue({ movimientoId: 'mov-reverso' }),
}));

import { reverseExpenseEffects } from '@/features/gastosDE/reversal';
import { reversePayrollReconciliations } from '@/features/empleados/payroll-reversal';

describe('reversa formal de gastos reconciliados', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		reverseFormalEntries.mockResolvedValue([]);
	});

	function crearTxGasto(overrides: Record<string, unknown> = {}) {
		return {
			reconciliacionGasto: {
				findMany: vi.fn().mockResolvedValue([
					{
						reconciliacionId: 'rec-1',
						tenantId: 'tenant-1',
						referenciaId: 'gasto-1',
						tipoGasto: 'gastoDE',
						cuentaId: 'cuenta-1',
						monto: 100,
						montoConvertido: 100,
						moneda: 'CUP',
						tasaCambio: null,
						estado: 'PAGADO',
						cuentaPorPagarId: null,
					},
				]),
				deleteMany: vi.fn(),
			},
			cuentaBancaria: {
				findUnique: vi.fn().mockResolvedValue({
					cuentaId: 'cuenta-1',
					tenantId: 'tenant-1',
					moneda: 'CUP',
				}),
				updateMany: vi.fn().mockResolvedValue({ count: 1 }),
			},
			cuentaPorPagar: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
			pagoCuentaPorPagar: { deleteMany: vi.fn() },
			transaccionMoneda: { deleteMany: vi.fn() },
			anticipoMovimiento: { findMany: vi.fn().mockResolvedValue([]) },
			...overrides,
		};
	}

	it('anula el asiento formal de la conciliacion del gasto', async () => {
		const tx = crearTxGasto();

		await reverseExpenseEffects(tx as never, {
			tenantId: 'tenant-1',
			referenciaId: 'gasto-1',
			tipoGasto: 'gastoDE',
			usuarioId: 'user-1',
		});

		expect(reverseFormalEntries).toHaveBeenCalledWith(
			tx,
			{ tenantId: 'tenant-1', userId: 'user-1' },
			[{ tipo: 'reconciliacion_gasto', id: 'rec-1' }],
		);
	});

	it('anula tambien el asiento formal de la compra de servicio', async () => {
		const tx = crearTxGasto();
		tx.reconciliacionGasto.findMany.mockResolvedValue([]);

		await reverseExpenseEffects(tx as never, {
			tenantId: 'tenant-1',
			referenciaId: 'servicio-1',
			tipoGasto: 'servicio',
			usuarioId: 'user-1',
		});

		expect(reverseFormalEntries).toHaveBeenCalledWith(
			tx,
			{ tenantId: 'tenant-1', userId: 'user-1' },
			[{ tipo: 'compra_servicio', id: 'servicio-1' }],
		);
	});

	it('anula el asiento formal de la ejecucion del anticipo y no el de su reverso', async () => {
		const tx = crearTxGasto();
		tx.anticipoMovimiento.findMany.mockResolvedValue([
			{
				movimientoId: 'mov-ejecucion',
				anticipoId: 'advance-1',
				tipoMovimiento: 'EJECUCION',
				monto: 80,
			},
			{
				movimientoId: 'mov-reverso',
				anticipoId: 'advance-1',
				tipoMovimiento: 'REVERSO',
				monto: 20,
			},
		]);

		await reverseExpenseEffects(tx as never, {
			tenantId: 'tenant-1',
			referenciaId: 'gasto-1',
			tipoGasto: 'gastoDE',
			usuarioId: 'user-1',
			anticipoContext: true,
		});

		expect(reverseFormalEntries).toHaveBeenCalledWith(
			tx,
			{ tenantId: 'tenant-1', userId: 'user-1' },
			[
				{ tipo: 'reconciliacion_gasto', id: 'rec-1' },
				{ tipo: 'anticipo_movimiento', id: 'mov-ejecucion' },
			],
		);
	});
});

describe('reversa formal de pagos de nomina', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		reverseFormalEntries.mockResolvedValue([]);
	});

	it('anula el asiento formal de cada conciliacion pagada', async () => {
		const tx = {
			$queryRaw: vi.fn().mockResolvedValue([]),
			cuentaBancaria: {
				findMany: vi.fn().mockResolvedValue([]),
				updateMany: vi.fn(),
			},
			cuentaPorPagar: { findUnique: vi.fn(), update: vi.fn() },
			pagoCuentaPorPagar: { findMany: vi.fn(), delete: vi.fn() },
			transaccionMoneda: { deleteMany: vi.fn() },
		};

		await reversePayrollReconciliations(
			tx as never,
			[
				{
					reconciliacionId: 'rec-nomina-1',
					cuentaId: 'cuenta-1',
					monto: 0,
					montoConvertido: 0,
					cuentaPorPagarId: null,
					estado: 'PENDIENTE',
				},
			],
			'tenant-1',
			'user-1',
		);

		expect(reverseFormalEntries).toHaveBeenCalledWith(
			tx,
			{ tenantId: 'tenant-1', userId: 'user-1' },
			[{ tipo: 'reconciliacion_gasto', id: 'rec-nomina-1' }],
		);
	});
});
