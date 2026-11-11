/**
 * @description Tests del backfill de la fecha de devengo del costo de venta
 * (`Venta.costoVentaFecha`, CT-1).
 *
 * El backfill solo repone la fecha de las ventas cuyo devengo ocurrió en el
 * acto de crearlas (la fila nunca fue modificada después): es exactamente la
 * población que el criterio anterior del replay admitía. Las ventas PVE
 * entregadas más tarde se quedan sin fecha, porque su devengo real es
 * desconocido.
 */
import { describe, expect, it, vi } from 'vitest';

import {
	aplicarBackfillVentaCostoFecha,
	clasificarVentaCostoFecha,
} from '../venta-costo-fecha-backfill';

const CREACION = new Date('2026-02-20T12:00:00.000Z');

describe('clasificarVentaCostoFecha', () => {
	it('repone la fecha de creacion cuando la venta nunca fue modificada', () => {
		const clasificacion = clasificarVentaCostoFecha({
			ventaId: 'venta-1',
			tenantId: 'tenant-1',
			createdAt: CREACION,
			updatedAt: CREACION,
		});

		expect(clasificacion).toEqual({ fechaDevengo: CREACION, causa: 'DEVENGO_EN_ACTO' });
	});

	it('no inventa la fecha cuando la venta fue modificada despues de crearse', () => {
		const clasificacion = clasificarVentaCostoFecha({
			ventaId: 'venta-2',
			tenantId: 'tenant-1',
			createdAt: CREACION,
			updatedAt: new Date('2026-03-05T09:30:00.000Z'),
		});

		expect(clasificacion).toEqual({
			fechaDevengo: null,
			causa: 'FECHA_DEVENGO_DESCONOCIDA',
		});
	});
});

describe('aplicarBackfillVentaCostoFecha', () => {
	it('repone solo las ventas con devengo en el acto y respeta el aislamiento por tenant', async () => {
		const updateMany = vi.fn().mockResolvedValue({ count: 1 });
		const db = {
			venta: {
				findMany: vi.fn().mockResolvedValue([
					{
						ventaId: 'venta-1', tenantId: 'tenant-1',
						createdAt: CREACION, updatedAt: CREACION,
					},
					{
						ventaId: 'venta-2', tenantId: 'tenant-2',
						createdAt: CREACION, updatedAt: new Date('2026-03-05T09:30:00.000Z'),
					},
				]),
				updateMany,
			},
		};

		const resumen = await aplicarBackfillVentaCostoFecha(db as never);

		expect(resumen).toMatchObject({
			evaluadas: 2,
			repostas: 1,
			omitidas: 1,
			actualizadas: 0,
		});
		// En simulacion no se escribe nada.
		expect(updateMany).not.toHaveBeenCalled();
		// La consulta solo trae ventas vivas con devengo consumido.
		expect(db.venta.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: {
				costoVentaFecha: null,
				deletedAt: null,
				estado: { in: ['ENTREGADA', 'FACTURADA'] },
			},
		}));
	});

	it('escribe la fecha reponida con comparacion atomica sobre la columna vacia', async () => {
		const updateMany = vi.fn().mockResolvedValue({ count: 1 });
		const db = {
			venta: {
				findMany: vi.fn().mockResolvedValue([{
					ventaId: 'venta-1', tenantId: 'tenant-1',
					createdAt: CREACION, updatedAt: CREACION,
				}]),
				updateMany,
			},
		};

		const resumen = await aplicarBackfillVentaCostoFecha(db as never, { simular: false });

		expect(resumen.actualizadas).toBe(1);
		expect(updateMany).toHaveBeenCalledWith({
			where: { ventaId: 'venta-1', tenantId: 'tenant-1', costoVentaFecha: null },
			data: { costoVentaFecha: CREACION },
		});
	});

	it('no cuenta como actualizada una fila que otra corrida ya repuso', async () => {
		const db = {
			venta: {
				findMany: vi.fn().mockResolvedValue([{
					ventaId: 'venta-1', tenantId: 'tenant-1',
					createdAt: CREACION, updatedAt: CREACION,
				}]),
				updateMany: vi.fn().mockResolvedValue({ count: 0 }),
			},
		};

		const resumen = await aplicarBackfillVentaCostoFecha(db as never, { simular: false });

		expect(resumen.repostas).toBe(1);
		expect(resumen.actualizadas).toBe(0);
	});
});
