import { render, screen } from '@testing-library/react';

import { CategoryLegend } from '../category-legend';

describe('CategoryLegend', () => {
  it('acota la altura y habilita scroll para no recortar el gráfico', () => {
    // Regresión: una leyenda sin altura máxima (11 categorías ≈ 316px) exprimía
    // el área del pie dentro del contenedor de 300px y el svg se cortaba por arriba.
    render(
      <CategoryLegend
        payload={[
          { value: 'Bebidas', color: '#123456', payload: { percent: 0.6 } },
          { value: 'Snacks', color: '#654321', payload: { percent: 0.4 } },
        ]}
      />,
    );

    const list = screen.getByRole('list');
    expect(list).toHaveClass('max-h-40');
    expect(list).toHaveClass('overflow-y-auto');
  });

  it('muestra nombre de categoría y porcentaje', () => {
    render(
      <CategoryLegend
        payload={[{ value: 'Bebidas', color: '#123456', payload: { percent: 0.6 } }]}
      />,
    );

    expect(screen.getByText('Bebidas')).toBeInTheDocument();
    expect(screen.getByText('(60.0%)')).toBeInTheDocument();
  });
});
