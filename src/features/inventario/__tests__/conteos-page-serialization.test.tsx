import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/almacenes', () => ({
  getAlmacenesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
vi.mock('@/features/puntos-venta', () => ({
  getPuntosDeVentaAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
vi.mock('@/features/inventario/actions-conteos', () => ({
  getConteosAction: vi.fn().mockResolvedValue({
    success: true,
    data: [{
      id: 'conteo-1',
      createdAt: new Date('2026-09-14T10:00:00.000Z'),
      conciliadoAt: new Date('2026-09-14T11:00:00.000Z'),
    }],
  }),
}));

import ConteosPage from '@/app/busy/inventario/conteos/page';

describe('ConteosPage serialization', () => {
  it('serializa createdAt y conciliadoAt antes de pasar conteos al cliente', async () => {
    const page = await ConteosPage();

    expect(page.props.conteosIniciales).toEqual([
      expect.objectContaining({
        createdAt: '2026-09-14T10:00:00.000Z',
        conciliadoAt: '2026-09-14T11:00:00.000Z',
      }),
    ]);
  });
});
