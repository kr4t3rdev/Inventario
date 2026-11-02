import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const doc = {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    getNumberOfPages: vi.fn(() => 2),
    setPage: vi.fn(),
    save: vi.fn(),
    internal: {
      pageSize: {
        getWidth: vi.fn(() => 210),
        getHeight: vi.fn(() => 297),
      },
    },
  };

  return {
    doc,
    autoTable: vi.fn(),
  };
});

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => mocks.doc),
}));

vi.mock('jspdf-autotable', () => ({
  default: mocks.autoTable,
}));

import autoTable from 'jspdf-autotable';

import { exportarKardexPdf } from '../kardex-pdf';

describe('exportarKardexPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.doc.getNumberOfPages.mockReturnValue(2);
  });

  it('genera una tabla con los movimientos visibles y la descarga', () => {
    exportarKardexPdf({
      productoId: 'prod-1',
      productoNombre: 'Arroz',
      saldoInicial: 5,
      pagina: 1,
      totalPaginas: 1,
      movimientos: [
        {
          id: 'm-1',
          tipoOrigen: 'COMPRA',
          origenId: 'compra-1',
          cantidad: 3,
          costoUnitario: 45,
          createdAt: '2026-10-03T10:00:00.000Z',
          saldo: 8,
        },
      ],
    });

    expect(autoTable).toHaveBeenCalledWith(
      mocks.doc,
      expect.objectContaining({
        head: [[
          'Fecha',
          'Tipo',
          'Origen',
          'Cantidad',
          'Costo unitario',
          'Saldo',
        ]],
        body: [[
          expect.any(String),
          'COMPRA',
          'compra-1',
          '3',
          '45',
          '8',
        ]],
      }),
    );
    expect(mocks.doc.text).toHaveBeenCalledWith(
      'Producto: Arroz',
      expect.any(Number),
      expect.any(Number),
    );
    expect(mocks.doc.text).toHaveBeenCalledWith(
      'Saldo inicial: 5',
      expect.any(Number),
      expect.any(Number),
    );
    expect(mocks.doc.text).toHaveBeenCalledWith(
      'Página del kardex: 1 de 1',
      expect.any(Number),
      expect.any(Number),
    );
    expect(mocks.doc.save).toHaveBeenCalledWith(expect.stringMatching(/^kardex-prod-1-\d+\.pdf$/));
  });
});
