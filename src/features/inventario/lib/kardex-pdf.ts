import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface KardexPdfMovimiento {
  id: string;
  tipoOrigen: string;
  origenId: string;
  cantidad: number;
  costoUnitario: number;
  createdAt: string;
  saldo: number;
}

interface KardexPdfDatos {
  productoId: string;
  productoNombre: string;
  saldoInicial: number;
  pagina: number;
  totalPaginas: number;
  movimientos: KardexPdfMovimiento[];
}

const MARGEN_PDF = 14;

/**
 * @description Genera y descarga el PDF de los movimientos visibles del kardex.
 * @param {KardexPdfDatos} datos - Producto, saldo inicial, paginación y movimientos a exportar.
 * @returns {void}
 */
export function exportarKardexPdf(datos: KardexPdfDatos): void {
  const documento = new jsPDF();

  documento.setFontSize(18);
  documento.setFont('helvetica', 'bold');
  documento.text('Kardex de inventario', MARGEN_PDF, 20);

  documento.setFontSize(10);
  documento.setFont('helvetica', 'normal');
  documento.text(`Producto: ${datos.productoNombre}`, MARGEN_PDF, 28);
  documento.text(`Saldo inicial: ${datos.saldoInicial}`, MARGEN_PDF, 34);
  documento.text(
    `Página del kardex: ${datos.pagina} de ${datos.totalPaginas}`,
    MARGEN_PDF,
    40,
  );

  autoTable(documento, {
    head: [[
      'Fecha',
      'Tipo',
      'Origen',
      'Cantidad',
      'Costo unitario',
      'Saldo',
    ]],
    body: datos.movimientos.map((movimiento) => [
      new Date(movimiento.createdAt).toLocaleString(),
      movimiento.tipoOrigen,
      movimiento.origenId,
      String(movimiento.cantidad),
      String(movimiento.costoUnitario),
      String(movimiento.saldo),
    ]),
    startY: 46,
    styles: {
      fontSize: 9,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: '#2980b9',
      textColor: '#ffffff',
    },
    alternateRowStyles: {
      fillColor: '#f5f5f5',
    },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: {
      left: MARGEN_PDF,
      right: MARGEN_PDF,
      bottom: 20,
    },
  });

  const cantidadPaginas = documento.getNumberOfPages();
  const anchoPagina = documento.internal.pageSize.getWidth();
  const altoPagina = documento.internal.pageSize.getHeight();

  for (let pagina = 1; pagina <= cantidadPaginas; pagina += 1) {
    documento.setPage(pagina);
    documento.setFontSize(8);
    documento.text(
      `Página ${pagina} de ${cantidadPaginas}`,
      anchoPagina / 2,
      altoPagina - 10,
      { align: 'center' },
    );
  }

  const productoId = datos.productoId.replace(/[^a-zA-Z0-9-_]/g, '-');
  documento.save(`kardex-${productoId}-${Date.now()}.pdf`);
}
