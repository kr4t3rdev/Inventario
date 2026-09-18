/**
 * @description Tests del helper restaurarAllocacionesFifo (DNC-T3): restaura
 * unidades a los lotes más antiguos primero y reporta el costo ponderado.
 */
import { describe, it, expect, vi } from 'vitest';
import { restaurarAllocacionesFifo } from '@/lib/services/fifo-allocation';

function alloc(id: string, cantidad: number, fecha: string, costo: number) {
	return {
		id,
		cantidad,
		compraDocumentoItem: { createdAt: new Date(fecha), precioUnitario: costo },
	};
}

describe('restaurarAllocacionesFifo (DNC-T3)', () => {
	it('restaura al lote más antiguo primero y pondera el costo', async () => {
		// Lote nuevo (300) tenía 2 consumidas; lote viejo (100) tenía 1.
		const tx = {
			purchaseAllocation: {
				findMany: vi.fn().mockResolvedValue([
					alloc('a-nueva', 2, '2026-09-10', 300),
					alloc('a-vieja', 1, '2026-09-01', 100),
				]),
				update: vi.fn(),
				delete: vi.fn(),
			},
		};

		const r = await restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1',
			ventaItemId: 'vi-1',
			cantidad: 2,
		});

		// FIFO: se borra la allocation del lote viejo y se reduce la del nuevo.
		expect(tx.purchaseAllocation.delete).toHaveBeenCalledWith({ where: { id: 'a-vieja' } });
		expect(tx.purchaseAllocation.update).toHaveBeenCalledWith({
			where: { id: 'a-nueva' },
			data: { cantidad: 1 },
		});
		expect(r).toEqual({ restaurado: 2, costoTotal: 1 * 100 + 1 * 300 });
	});

	it('cantidad 0 no toca nada', async () => {
		const tx = {
			purchaseAllocation: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
		};
		const r = await restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1',
			ventaItemId: 'vi-1',
			cantidad: 0,
		});
		expect(r).toEqual({ restaurado: 0, costoTotal: 0 });
		expect(tx.purchaseAllocation.findMany).not.toHaveBeenCalled();
	});

	it('sin allocations (venta legacy) restaura 0 y el costo cae al fallback del caller', async () => {
		const tx = {
			purchaseAllocation: {
				findMany: vi.fn().mockResolvedValue([]),
				update: vi.fn(),
				delete: vi.fn(),
			},
		};
		const r = await restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1',
			ventaItemId: 'vi-1',
			cantidad: 2,
		});
		expect(r).toEqual({ restaurado: 0, costoTotal: 0 });
	});
});
