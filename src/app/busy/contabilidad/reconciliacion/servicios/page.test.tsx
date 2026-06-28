import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUserMock = vi.fn();
const redirectMock = vi.fn();

vi.mock('@/lib/server-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server-actions')>();
  return {
    ...actual,
    getCurrentUser: () => getCurrentUserMock(),
  };
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock('@/features/contabilidad/components/reconciliacion/reconciliacion-servicios-page', () => ({
  ReconciliacionServiciosPage: () => <div data-testid="reconciliacion-servicios-page" />,
}));

import ServiciosReconciliacionPage from './page';

describe('/busy/contabilidad/reconciliacion/servicios page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige a contabilidad cuando el plan es Básico', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'u-1',
      role: 'user',
      planName: 'Básico',
      planFeatures: { contabilidad: true, servicios: true },
    });

    await expect(Promise.resolve().then(() => ServiciosReconciliacionPage())).rejects.toThrow(
      'NEXT_REDIRECT:/busy/contabilidad/reconciliacion',
    );
    expect(redirectMock).toHaveBeenCalledWith('/busy/contabilidad/reconciliacion');
  });
});
