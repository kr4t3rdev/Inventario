import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  CuadreDetailActions,
  CuadreDetailReadonlyNotice,
} from '../components/cuadre-detail-mode';

describe('CuadreDetailReadonlyNotice', () => {
  it('renders the readonly badge and historical inventory warning', () => {
    render(<CuadreDetailReadonlyNotice isReadOnly={true} />);

    expect(screen.getByText('Consulta histórica')).toBeInTheDocument();
    expect(
      screen.getByText('El bloque de inventario no es un snapshot histórico exacto'),
    ).toBeInTheDocument();
  });

  it('renders nothing for active shifts', () => {
    const { container } = render(<CuadreDetailReadonlyNotice isReadOnly={false} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('CuadreDetailActions', () => {
  it('hides mutating actions in readonly mode and keeps a back action', () => {
    render(
      <CuadreDetailActions
        backLabel='Volver al historial'
        isClosing={false}
        isReadOnly={true}
        onBack={vi.fn()}
        onCerrarTurno={vi.fn()}
        onRepetirArqueo={vi.fn()}
        tieneDiferencia={false}
      />,
    );

    expect(screen.getByRole('button', { name: /volver al historial/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /repetir arqueo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cerrar turno/i })).not.toBeInTheDocument();
  });

  it('keeps operational buttons for open shifts with mismatch', () => {
    const onRepetirArqueo = vi.fn();

    render(
      <CuadreDetailActions
        backLabel='Cancelar'
        isClosing={false}
        isReadOnly={false}
        onBack={vi.fn()}
        onCerrarTurno={vi.fn()}
        onRepetirArqueo={onRepetirArqueo}
        tieneDiferencia={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /repetir arqueo/i }));

    expect(onRepetirArqueo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /cierre bloqueado/i })).toBeDisabled();
  });
});
