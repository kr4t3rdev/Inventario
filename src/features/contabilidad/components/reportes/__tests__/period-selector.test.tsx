import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PeriodSelector } from '../period-selector';

describe('PeriodSelector', () => {
  it('expone un grupo accesible con las tres opciones', () => {
    render(<PeriodSelector value="mes" onChange={vi.fn()} />);

    const group = screen.getByRole('radiogroup', { name: /seleccionar período/i });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Hoy' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Esta semana' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Este mes' })).toBeInTheDocument();
  });

  it('marca la opción activa con aria-checked', () => {
    render(<PeriodSelector value="semana" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Esta semana' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Hoy' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('notifica el cambio al seleccionar otra opción', async () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="mes" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Hoy' }));
    expect(onChange).toHaveBeenCalledWith('hoy');
  });

  it('soporta navegación con flechas entre opciones', async () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="mes" onChange={onChange} />);

    const mes = screen.getByRole('radio', { name: 'Este mes' });
    mes.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('semana');
  });
});
