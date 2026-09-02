import { describe, expect, it } from 'vitest';

import { formatHoraCorta } from '../timestamps';

describe('formatHoraCorta', () => {
  it('formatea hora y minutos con dos dígitos en locale es-ES', () => {
    const fecha = new Date(2026, 7, 12, 14, 5, 30);
    expect(formatHoraCorta(fecha)).toBe('14:05');
  });

  it('rellena con cero las horas de un dígito', () => {
    expect(formatHoraCorta(new Date(2026, 0, 1, 9, 7))).toBe('09:07');
  });
});
