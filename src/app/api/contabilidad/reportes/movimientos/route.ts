import { NextRequest, NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import { authenticateUser } from '@/lib/auth-middleware';
import { canAccessAccountingItem } from '@/lib/plan-access';
import { requireTenant } from '@/lib/services/tenant-scope';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { normalizeExportLimit } from '@/lib/reports-release-check';

/**
 * @description Construye un PDF descargable con los movimientos filtrados.
 * @param {{ data: Array<Record<string, unknown>> }} report - Datos del reporte.
 * @returns {ArrayBuffer} Bytes del documento PDF.
 */
function renderMovementsPdf(report: { data: Array<Record<string, unknown>> }): ArrayBuffer {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Reporte de movimientos contables', 14, 18);
  doc.setFontSize(9);

  let y = 28;
  report.data.forEach((movement, index) => {
    if (y > 280) {
      doc.addPage();
      y = 18;
    }
    const line = `${index + 1}. ${String(movement.fecha ?? '')} | ${String(movement.tipo ?? '')} | ${String(movement.descripcion ?? '')} | ${String(movement.monto ?? '')} ${String(movement.moneda ?? '')}`;
    doc.text(line.slice(0, 180), 14, y);
    y += 6;
  });

  return doc.output('arraybuffer');
}

/**
 * @description Expone los movimientos reconciliados como adaptador del servicio canónico.
 * @param {NextRequest} request - Solicitud con filtros y formato de exportación.
 * @returns {Promise<NextResponse>} Movimientos JSON, CSV o PDF.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if ('status' in authResult) return authResult as Response;

    const user = authResult.user;
    const tenantId = requireTenant(user);
    const searchParams = request.nextUrl.searchParams;
    const formato = searchParams.get('formato') ?? searchParams.get('export');
    const report = await AccountingReportsService.getMovementsReport({
      tenantId,
      busqueda: searchParams.get('busqueda'),
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
      cuentaId: searchParams.get('cuentaId'),
      tipoMovimiento: searchParams.get('tipoMovimiento'),
      moneda: searchParams.get('moneda'),
      page: formato ? 1 : Number(searchParams.get('page') ?? 1),
      limit: formato
        ? normalizeExportLimit(Number(searchParams.get('limit') ?? 10_000))
        : Number(searchParams.get('limit') ?? 10),
      formato,
      includeServicios: user.planFeatures?.servicios === true,
      includeTransfers: canAccessAccountingItem(user, 'Transferencias Bancarias'),
      includeAdjustments: canAccessAccountingItem(user, 'Ajustes Bancarios'),
      includeCapital: user.planFeatures?.['inyeccion-capital'] === true,
      includePrestamosCash: user.planFeatures?.['prestamos-cash'] === true,
      includeDeudasCash: user.planFeatures?.['deudas-cash'] === true,
    });

    if (formato === 'csv' && report.exportContent) {
      return new NextResponse(report.exportContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="movimientos-contables.csv"',
        },
      });
    }

    if (formato === 'pdf') {
      const bytes = renderMovementsPdf(report);
      return new NextResponse(bytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="movimientos-contables.pdf"',
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error al generar reporte de movimientos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
