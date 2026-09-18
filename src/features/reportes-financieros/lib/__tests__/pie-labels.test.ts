import { formatPiePercentLabel, PIE_LABEL_MIN_PERCENT } from '../pie-labels';

describe('formatPiePercentLabel', () => {
  it('devuelve el porcentaje redondeado para rebanadas grandes', () => {
    expect(formatPiePercentLabel(0.124)).toBe('12%');
    expect(formatPiePercentLabel(0.5)).toBe('50%');
  });

  it('omite el label en rebanadas bajo el umbral para evitar solapes', () => {
    expect(formatPiePercentLabel(0.049)).toBe('');
    expect(formatPiePercentLabel(0.01)).toBe('');
    expect(formatPiePercentLabel(0)).toBe('');
  });

  it('incluye el valor justo en el umbral', () => {
    expect(formatPiePercentLabel(PIE_LABEL_MIN_PERCENT)).toBe('5%');
  });

  it('tolera valores no numéricos sin romper el render', () => {
    expect(formatPiePercentLabel(Number.NaN)).toBe('');
  });
});
