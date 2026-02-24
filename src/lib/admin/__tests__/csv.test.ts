import { describe, expect, it } from 'vitest';

import { buildCsv, sanitizeCsvCell } from '@/lib/admin/csv';

describe('csv utilities', () => {
  it('neutraliza fórmulas peligrosas', () => {
    const value = sanitizeCsvCell('=HYPERLINK("http://x")');
    expect(value.startsWith('"\'=HYPERLINK')).toBe(true);
    expect(sanitizeCsvCell('+SUM(1,2)').includes("'+SUM(1,2)")).toBe(true);
  });

  it('escapa comillas y comas de forma segura', () => {
    expect(sanitizeCsvCell('Juan, "Pérez"')).toBe('"Juan, ""Pérez"""');
  });

  it('construye CSV consistente con encabezados y filas', () => {
    const csv = buildCsv(['Nombre', 'Email'], [['Ana', 'ana@test.com']]);
    expect(csv).toContain('Nombre,Email');
    expect(csv).toContain('Ana,ana@test.com');
  });
});
