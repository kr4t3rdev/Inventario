import { describe, expect, it, vi } from 'vitest';

/**
 * `getConteosAction` es una Server Action envuelta en `withAction`, que aplica
 * `serializePrismaData` y devuelve los `Date` de Prisma ya convertidos a string
 * ISO. La página debe tolerar ambos formatos.
 */

const { getConteosActionMock } = vi.hoisted(() => ({
	getConteosActionMock: vi.fn(),
}));

vi.mock('@/features/almacenes', () => ({
	getAlmacenesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
vi.mock('@/features/puntos-venta', () => ({
	getPuntosDeVentaAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
vi.mock('@/features/inventario/actions-conteos', () => ({
	getConteosAction: getConteosActionMock,
}));

import ConteosPage from '@/app/busy/inventario/conteos/page';

describe('ConteosPage serialization', () => {
	it('serializa createdAt y conciliadoAt antes de pasar conteos al cliente', async () => {
		getConteosActionMock.mockResolvedValue({
			success: true,
			data: [
				{
					id: 'conteo-1',
					createdAt: new Date('2026-09-14T10:00:00.000Z'),
					conciliadoAt: new Date('2026-09-14T11:00:00.000Z'),
				},
			],
		});

		const page = await ConteosPage();

		expect(page.props.conteosIniciales).toEqual([
			expect.objectContaining({
				createdAt: '2026-09-14T10:00:00.000Z',
				conciliadoAt: '2026-09-14T11:00:00.000Z',
			}),
		]);
	});

	it('tolera fechas ya serializadas a string por withAction', async () => {
		getConteosActionMock.mockResolvedValue({
			success: true,
			data: [
				{
					id: 'conteo-1',
					createdAt: '2026-09-14T10:00:00.000Z',
					conciliadoAt: '2026-09-14T11:00:00.000Z',
				},
			],
		});

		const page = await ConteosPage();

		expect(page.props.conteosIniciales).toEqual([
			expect.objectContaining({
				createdAt: '2026-09-14T10:00:00.000Z',
				conciliadoAt: '2026-09-14T11:00:00.000Z',
			}),
		]);
	});

	it('mantiene conciliadoAt en null cuando el conteo no está conciliado', async () => {
		getConteosActionMock.mockResolvedValue({
			success: true,
			data: [
				{
					id: 'conteo-1',
					createdAt: '2026-09-14T10:00:00.000Z',
					conciliadoAt: null,
				},
			],
		});

		const page = await ConteosPage();

		expect(page.props.conteosIniciales).toEqual([
			expect.objectContaining({
				createdAt: '2026-09-14T10:00:00.000Z',
				conciliadoAt: null,
			}),
		]);
	});
});
