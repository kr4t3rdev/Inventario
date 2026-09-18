import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CurrencyInput } from './currency-input';

describe('CurrencyInput', () => {
  it('sincroniza el valor renderizado cuando cambia la prop value', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CurrencyInput value={10} onChange={onChange} aria-label="precio" />,
    );

    const input = screen.getByLabelText('precio') as HTMLInputElement;
    expect(input.value).toBe('10.00');

    rerender(<CurrencyInput value={25} onChange={onChange} aria-label="precio" />);

    expect(input.value).toBe('25.00');
  });
});
