import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListasPreciosPageClient } from './listas-precios-page-client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/features/listas-precios', () => ({
  createListaPrecioAction: vi.fn(),
  deleteListaPrecioAction: vi.fn(),
  updateListaPrecioAction: vi.fn(),
}));

describe('ListasPreciosPageClient', () => {
  it('muestra el error inicial sin transformarlo en estado vacío', () => {
    render(<ListasPreciosPageClient listas={[]} initialError='Base de datos no disponible' />);

    expect(screen.getByRole('alert')).toHaveTextContent('Base de datos no disponible');
    expect(screen.queryByText('Todavía no hay listas de precios')).not.toBeInTheDocument();
  });

  it('muestra métricas agregadas y acciones accesibles', () => {
    render(<ListasPreciosPageClient listas={[{
      id: 'lista-1', nombre: 'Mayorista', descripcion: null, esDefault: true,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'),
      _count: { precios: 12, puntosDeVenta: 2 },
    }]} />);

    const metrics = within(screen.getByRole('region', { name: 'Métricas' }));
    expect(metrics.getByText('12')).toBeInTheDocument();
    expect(metrics.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Mayorista' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar Mayorista' })).toBeInTheDocument();
  });
});
