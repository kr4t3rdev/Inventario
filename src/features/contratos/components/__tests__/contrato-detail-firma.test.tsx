/**
 * @description Tests del montaje del diálogo de firma en el detalle de contrato.
 *
 * El diálogo `AddFirmaDialog` existía y se exportaba, pero no se montaba en
 * ninguna ruta: la capacidad de registrar una firma era inalcanzable desde la
 * UI. Estos tests fijan que el detalle del contrato exponga la acción de
 * agregar firma cuando el usuario puede gestionar contratos.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'ct-1' }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/components/file-upload', () => ({
  FileUpload: () => <div data-testid="file-upload" />,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/features/contratos/actions', () => ({
  getFirmantesAction: vi.fn().mockResolvedValue({
    success: true,
    data: { firmantes: [{ userId: 'u-1', name: 'Ana Pérez' }] },
  }),
}));

import { ContratoDetailContent } from '../contrato-detail-content';

const contratoBase = {
  contratoId: 'ct-1',
  numeroContrato: 'CV-0001',
  observaciones: null,
  condiciones: null,
  tipo: 'COMPRA_VENTA',
  estado: 'APROBADO',
  fechaInicio: '2026-01-01T00:00:00.000Z',
  fechaFin: null,
  monto: null,
  moneda: 'CUP',
  esMultiMoneda: false,
  cliente: null,
  vendor: null,
  creador: { userId: 'u-1', name: 'Creador', email: 'creador@test.com' },
  aprobador: null,
  versiones: [],
  firmas: [],
  aprobaciones: [],
  archivos: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('detalle de contrato — acceso a la firma', () => {
  it('expone la acción de agregar firma en la pestaña de firmas', async () => {
    const user = userEvent.setup();
    render(
      <ContratoDetailContent
        initialData={contratoBase as never}
        contratoId="ct-1"
        puedeFirmar
      />,
    );

    await user.click(screen.getByRole('tab', { name: /firmas/i }));

    expect(screen.getByRole('button', { name: /agregar firma/i })).toBeInTheDocument();
  });

  it('oculta la acción de agregar firma cuando el usuario no puede gestionar contratos', async () => {
    const user = userEvent.setup();
    render(
      <ContratoDetailContent
        initialData={contratoBase as never}
        contratoId="ct-1"
        puedeFirmar={false}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /firmas/i }));

    expect(screen.queryByRole('button', { name: /agregar firma/i })).not.toBeInTheDocument();
  });
});
