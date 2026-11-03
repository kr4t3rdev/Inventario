/**
 * @description Pruebas del badge de alertas de vencimiento mostrado en inventario.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/features/inventario/actions-alertas', () => ({
  getAlertasVencimientoAction: vi.fn(),
}));

import { getAlertasVencimientoAction } from '@/features/inventario/actions-alertas';
import { AlertasVencimientoBadge } from '@/features/inventario/components/alertas-vencimiento-badge';

describe('AlertasVencimientoBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el conteo de lotes por vencer', async () => {
    vi.mocked(getAlertasVencimientoAction).mockResolvedValue({
      success: true,
      data: {
        alertas: [],
        total: 2,
        vencidos: 0,
        porVencer: 2,
        diasAlerta: 30,
      },
    } as never);

    render(<AlertasVencimientoBadge />);

    await waitFor(() => {
      expect(screen.getByText(/2 lotes por vencer/i)).toBeInTheDocument();
    });
  });

  it('resalta los lotes vencidos', async () => {
    vi.mocked(getAlertasVencimientoAction).mockResolvedValue({
      success: true,
      data: {
        alertas: [],
        total: 3,
        vencidos: 1,
        porVencer: 2,
        diasAlerta: 30,
      },
    } as never);

    render(<AlertasVencimientoBadge />);

    await waitFor(() => {
      expect(screen.getByText(/1 lote vencido/i)).toBeInTheDocument();
    });
  });

  it('no muestra nada cuando no hay alertas', async () => {
    vi.mocked(getAlertasVencimientoAction).mockResolvedValue({
      success: true,
      data: {
        alertas: [],
        total: 0,
        vencidos: 0,
        porVencer: 0,
        diasAlerta: 30,
      },
    } as never);

    const { container } = render(<AlertasVencimientoBadge />);

    await waitFor(() => {
      expect(getAlertasVencimientoAction).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('no muestra nada cuando la consulta está bloqueada por el plan', async () => {
    vi.mocked(getAlertasVencimientoAction).mockResolvedValue({
      success: false,
      error: { message: 'Tu plan actual no incluye la funcionalidad', code: 'FEATURE_NOT_AVAILABLE' },
    } as never);

    const { container } = render(<AlertasVencimientoBadge />);

    await waitFor(() => {
      expect(getAlertasVencimientoAction).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });
});
