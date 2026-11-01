import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';

const { reportClientErrorMock } = vi.hoisted(() => ({
  reportClientErrorMock: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/error-reporting-client', () => ({
  reportClientError: reportClientErrorMock,
}));

import AppErrorBoundary from '@/app/error';
import GlobalErrorBoundary from '@/app/global-error';

/**
 * @description Crea un error con digest opcional, similar al que Next.js
 * inyecta en los boundaries de error.
 * @param {string} message - Mensaje del error.
 * @param {string} [digest] - Digest asignado por el servidor.
 * @returns {Error & { digest?: string }} Error de prueba.
 */
function buildError(message: string, digest?: string): Error & { digest?: string } {
  const error = new Error(message) as Error & { digest?: string };
  if (digest) error.digest = digest;
  return error;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    reportClientErrorMock.mockClear();
  });

  it('muestra un mensaje accionable en lugar del error genérico de Next.js', () => {
    render(
      <AppErrorBoundary error={buildError('Fallo de render')} reset={vi.fn()} />,
    );

    expect(screen.getByText('No pudimos cargar esta sección')).toBeInTheDocument();
    expect(screen.getByText(/error inesperado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir al inicio/i })).toBeInTheDocument();
  });

  it('muestra el código de referencia cuando el servidor asigna un digest', () => {
    render(
      <AppErrorBoundary error={buildError('Fallo', 'abc123')} reset={vi.fn()} />,
    );

    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('omite el código de referencia cuando no hay digest', () => {
    render(<AppErrorBoundary error={buildError('Fallo')} reset={vi.fn()} />);

    expect(screen.queryByText(/código de referencia/i)).not.toBeInTheDocument();
  });

  it('reintenta el render al pulsar el botón', async () => {
    const reset = vi.fn();
    render(<AppErrorBoundary error={buildError('Fallo')} reset={reset} />);

    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('reporta el error al log del servidor', async () => {
    const error = buildError('Fallo de render', 'abc123');
    render(<AppErrorBoundary error={error} reset={vi.fn()} />);

    expect(reportClientErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Fallo de render', digest: 'abc123' }),
    );
  });
});

describe('GlobalErrorBoundary', () => {
  beforeEach(() => {
    reportClientErrorMock.mockClear();
  });

  it('renderiza un documento HTML completo con el mensaje de error', () => {
    const markup = renderToStaticMarkup(
      <GlobalErrorBoundary error={buildError('Fallo global', 'xyz789')} reset={vi.fn()} />,
    );

    expect(markup).toContain('<html');
    expect(markup).toContain('No pudimos cargar esta sección');
    expect(markup).toContain('xyz789');
    expect(markup).toContain('Reintentar');
    expect(markup).toContain('Ir al inicio');
  });

  it('incluye estilos propios porque se renderiza fuera del layout raíz', () => {
    const markup = renderToStaticMarkup(
      <GlobalErrorBoundary error={buildError('Fallo global')} reset={vi.fn()} />,
    );

    expect(markup).toContain('<style');
  });
});
