import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sileo } from '@/lib/sileo-shim';

const mocks = vi.hoisted(() => ({
  createUnidadAction: vi.fn(),
  updateUnidadAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/features/unidades/actions', () => ({
  createUnidadAction: mocks.createUnidadAction,
  updateUnidadAction: mocks.updateUnidadAction,
}));
vi.mock('@/lib/sileo-shim', () => ({
  sileo: { success: vi.fn(), error: vi.fn() },
}));

import { UnidadForm } from './unidad-form';

describe('UnidadForm dimension field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createUnidadAction.mockResolvedValue({ success: true, data: {} });
    mocks.updateUnidadAction.mockResolvedValue({ success: true, data: {} });
  });

  it('defaults new units to UNKNOWN and submits the selected dimension', async () => {
    const user = userEvent.setup();
    render(<UnidadForm />);

    const dimension = screen.getByRole('combobox', { name: 'Dimensión' });
    expect(dimension).toHaveValue('UNKNOWN');
    await user.type(screen.getByPlaceholderText('Ej: Kilogramo, Litro, Metro...'), 'Paquete');
    await user.type(screen.getByPlaceholderText('Ej: kg, L, m...'), 'paq');
    await user.selectOptions(dimension, 'COUNT');
    await user.click(screen.getByRole('button', { name: 'Crear unidad' }));

    await waitFor(() => {
      expect(mocks.createUnidadAction).toHaveBeenCalledWith({
        nombre: 'Paquete',
        simbolo: 'paq',
        dimension: 'COUNT',
      });
    });
  });

  it('preselects an existing dimension and sends an edit selection', async () => {
    const user = userEvent.setup();
    render(
      <UnidadForm
        initialData={{ unidadId: 'unit-1', nombre: 'Kilogramo', simbolo: 'kg', dimension: 'MASS' }}
      />
    );

    const dimension = screen.getByRole('combobox', { name: 'Dimensión' });
    expect(dimension).toHaveValue('MASS');
    await user.selectOptions(dimension, 'VOLUME');
    await user.click(screen.getByRole('button', { name: 'Actualizar unidad' }));

    await waitFor(() => {
      expect(mocks.updateUnidadAction).toHaveBeenCalledWith({
        unidadId: 'unit-1',
        nombre: 'Kilogramo',
        simbolo: 'kg',
        dimension: 'VOLUME',
      });
    });
  });

  it.each(['create', 'update'] as const)('shows the pending state while %s is saving', async (mode) => {
    const user = userEvent.setup();
    let finish: ((result: { success: true; data: Record<string, never> }) => void) | undefined;
    const pending = new Promise<{ success: true; data: Record<string, never> }>((resolve) => {
      finish = resolve;
    });
    if (mode === 'create') {
      mocks.createUnidadAction.mockReturnValue(pending);
      render(<UnidadForm />);
      await user.type(screen.getByPlaceholderText('Ej: Kilogramo, Litro, Metro...'), 'Paquete');
      await user.type(screen.getByPlaceholderText('Ej: kg, L, m...'), 'paq');
    } else {
      mocks.updateUnidadAction.mockReturnValue(pending);
      render(
        <UnidadForm
          initialData={{ unidadId: 'unit-1', nombre: 'Kilogramo', simbolo: 'kg', dimension: 'MASS' }}
        />
      );
    }

    const buttonName = mode === 'create' ? 'Crear unidad' : 'Actualizar unidad';
    await user.click(screen.getByRole('button', { name: buttonName }));

    const pendingButton = await screen.findByRole('button', {
      name: mode === 'create' ? 'Creando...' : 'Actualizando...',
    });
    expect(pendingButton).toBeDisabled();
    finish?.({ success: true, data: {} });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/busy/unidad'));
  });

  it.each(['create', 'update'] as const)('reports a failed %s action', async (mode) => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    if (mode === 'create') {
      mocks.createUnidadAction.mockResolvedValue({
        success: false,
        error: { message: 'Create failed' },
      });
      render(<UnidadForm />);
      await user.type(screen.getByPlaceholderText('Ej: Kilogramo, Litro, Metro...'), 'Paquete');
      await user.type(screen.getByPlaceholderText('Ej: kg, L, m...'), 'paq');
    } else {
      mocks.updateUnidadAction.mockResolvedValue({
        success: false,
        error: { message: 'Update failed' },
      });
      render(
        <UnidadForm
          initialData={{ unidadId: 'unit-1', nombre: 'Kilogramo', simbolo: 'kg', dimension: 'MASS' }}
        />
      );
    }

    await user.click(screen.getByRole('button', {
      name: mode === 'create' ? 'Crear unidad' : 'Actualizar unidad',
    }));

    await waitFor(() => {
      expect(sileo.error).toHaveBeenCalledWith({ title: 'Hubo un error al guardar la unidad.' });
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
