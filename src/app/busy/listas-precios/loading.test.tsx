import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import ListasPreciosLoading from './loading';

it('anuncia la precarga de listas de precios sin mostrar controles interactivos', () => {
  render(<ListasPreciosLoading />);

  expect(screen.getByRole('status')).toHaveTextContent('Cargando listas de precios');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
