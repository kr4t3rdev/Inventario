import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMonedaPrincipalAction: vi.fn(),
}));

vi.mock('@/features/contabilidad/actions-accounting-policy', () => ({
  getMonedaPrincipalAction: mocks.getMonedaPrincipalAction,
}));

import { useMonedaPrincipal } from './use-moneda-principal';

describe('useMonedaPrincipal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve la moneda de la política contable del tenant', async () => {
    mocks.getMonedaPrincipalAction.mockResolvedValue({
      success: true,
      data: { estado: 'CONFIGURADA', moneda: 'USD' },
    });

    const { result } = renderHook(() => useMonedaPrincipal());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.getMonedaPrincipalAction).toHaveBeenCalledTimes(1);
    expect(result.current.monedaPrincipal).toBe('USD');
  });

  it('devuelve null sin sustituir por CUP cuando la política está ausente', async () => {
    mocks.getMonedaPrincipalAction.mockResolvedValue({
      success: true,
      data: { estado: 'AUSENTE', moneda: null },
    });

    const { result } = renderHook(() => useMonedaPrincipal());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.monedaPrincipal).toBeNull();
  });

  it('devuelve null si la consulta falla, sin inventar una moneda', async () => {
    mocks.getMonedaPrincipalAction.mockResolvedValue({
      success: false,
      error: { message: 'Error de consulta' },
    });

    const { result } = renderHook(() => useMonedaPrincipal());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.monedaPrincipal).toBeNull();
  });
});
