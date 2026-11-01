import { describe, expect, it, vi } from 'vitest';

/**
 * La página de ajustes recibe el listado desde `getAjustesAction`, una Server
 * Action envuelta en `withAction`. `withAction` aplica `serializePrismaData`,
 * que convierte los `Date` de Prisma a string ISO ANTES de devolverlos.
 * Por eso la página debe tolerar `createdAt` como string y no llamar a
 * `.toISOString()` sin normalizar: de lo contrario el render del Server
 * Component lanza `TypeError` y Next.js muestra "This page couldn't load".
 */

const { getAjustesActionMock } = vi.hoisted(() => ({
	getAjustesActionMock: vi.fn(),
}));

vi.mock('@/features/almacenes', () => ({
	getAlmacenesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
vi.mock('@/features/puntos-venta', () => ({
	getPuntosDeVentaAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
vi.mock('@/features/productos/actions', () => ({
	getProductosAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
vi.mock('@/features/inventario/actions-ajustes', () => ({
	getAjustesAction: getAjustesActionMock,
}));

import AjustesPage from '@/app/busy/inventario/ajustes/page';

describe('AjustesPage serialization', () => {
	it('entrega createdAt como ISO cuando la action ya lo serializó a string', async () => {
		getAjustesActionMock.mockResolvedValue({
			success: true,
			data: {
				items: [
					{
						id: 'ajuste-1',
						productoId: 'prod-1',
						motivo: 'DANO',
						tipoUbicacion: 'almacen',
						ubicacionId: 'alm-1',
						cantidadTeorica: 10,
						cantidadContada: 8,
						diferencia: -2,
						costoTotal: -100,
						estado: 'APLICADO',
						createdAt: '2026-09-14T10:00:00.000Z',
					},
				],
				total: 1,
				page: 1,
				limit: 100,
			},
		});

		const page = await AjustesPage();

		expect(page.props.ajustesIniciales).toEqual([
			expect.objectContaining({
				id: 'ajuste-1',
				createdAt: '2026-09-14T10:00:00.000Z',
			}),
		]);
	});

	it('normaliza a ISO cuando createdAt llega como Date', async () => {
		getAjustesActionMock.mockResolvedValue({
			success: true,
			data: {
				items: [
					{
						id: 'ajuste-1',
						productoId: 'prod-1',
						motivo: 'DANO',
						tipoUbicacion: 'almacen',
						ubicacionId: 'alm-1',
						cantidadTeorica: 10,
						cantidadContada: 8,
						diferencia: -2,
						costoTotal: -100,
						estado: 'APLICADO',
						createdAt: new Date('2026-09-14T10:00:00.000Z'),
					},
				],
				total: 1,
				page: 1,
				limit: 100,
			},
		});

		const page = await AjustesPage();

		expect(page.props.ajustesIniciales).toEqual([
			expect.objectContaining({
				createdAt: '2026-09-14T10:00:00.000Z',
			}),
		]);
	});

	it('no falla cuando la action devuelve un error', async () => {
		getAjustesActionMock.mockResolvedValue({
			success: false,
			error: { message: 'No autorizado', code: 'FORBIDDEN' },
		});

		const page = await AjustesPage();

		expect(page.props.ajustesIniciales).toEqual([]);
	});
});
