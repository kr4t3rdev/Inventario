import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/features/productos/actions', () => ({
  getProductosAction: vi.fn(),
}));
vi.mock('@/features/servicios/actions', () => ({
  getServiciosAction: vi.fn(),
}));
vi.mock('@/features/ofertas/actions', () => ({
  updateOfertaAction: vi.fn(),
}));

import { getProductosAction } from '@/features/productos/actions';
import { getServiciosAction } from '@/features/servicios/actions';
import { updateOfertaAction } from '@/features/ofertas/actions';
import { OfertaItemsEditor } from './oferta-items-editor';
import type { Oferta } from '@/app/models/model';

const oferta = {
  id: 'of-1',
  numeroOferta: 'OF-000001',
  clienteId: 'cli-1',
  fechaEmision: '2026-10-01T00:00:00.000Z',
  fechaVencimiento: null,
  estado: 'PENDIENTE',
  subtotal: 100,
  impuestos: 10,
  total: 110,
  observaciones: null,
  items: [{
    id: 'item-1',
    ofertaId: 'of-1',
    productoId: 'prod-1',
    cantidad: 2,
    precioUnitario: 50,
    total: 100,
    producto: { id: 'prod-1', nombre: 'Café' },
  }],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
} as Oferta;

describe('OfertaItemsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProductosAction).mockResolvedValue({ success: true, data: [] } as never);
    vi.mocked(getServiciosAction).mockResolvedValue({ success: true, data: [] } as never);
    vi.mocked(updateOfertaAction).mockResolvedValue({ success: true, data: oferta } as never);
  });

  it('guarda los ítems actuales y devuelve la oferta actualizada al detalle', async () => {
    const onSaved = vi.fn();
    render(<OfertaItemsEditor oferta={oferta} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole('button', { name: /editar ítems/i }));
    fireEvent.click(await screen.findByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(updateOfertaAction).toHaveBeenCalledWith({
        ofertaId: 'of-1',
        impuestos: 10,
        items: [{ productoId: 'prod-1', servicioId: undefined, cantidad: 2 }],
      });
      expect(onSaved).toHaveBeenCalledWith(oferta);
    });
  });
});
