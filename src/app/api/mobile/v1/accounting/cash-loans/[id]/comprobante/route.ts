import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse } from '@/lib/api-response';
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatCurrency(amount: number, moneda: string): string {
  return `${amount.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${moneda}`;
}

function drawComprobante(page: any, fontRegular: any, fontBold: any, prestamo: any): void {
  const { width, height } = page.getSize();
  const left = 50;
  const right = width - 50;
  let y = height - 60;

  page.drawText('COMPROBANTE DE PRÉSTAMO', {
    x: left,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 26;

  const lines = [
    `Comprobante No: PREST-${prestamo.idNumerico}`,
    `Cliente: ${prestamo.cliente?.nombre ?? 'Desconocido'}`,
    `Monto capital: ${formatCurrency(Number(prestamo.montoCapital), prestamo.moneda || 'CUP')}`,
    `Monto a pagar: ${formatCurrency(Number(prestamo.cuentaPorCobrar?.montoDeuda ?? prestamo.montoCapital), prestamo.moneda || 'CUP')}`,
    `Fecha de otorgamiento: ${new Date(prestamo.fechaOtorgamiento).toLocaleDateString('es-ES')}`,
    prestamo.fechaVencimiento
      ? `Fecha de vencimiento: ${new Date(prestamo.fechaVencimiento).toLocaleDateString('es-ES')}`
      : null,
    prestamo.observaciones ? `Observaciones: ${prestamo.observaciones}` : null,
  ].filter((line): line is string => Boolean(line));

  for (const line of lines) {
    page.drawText(line, {
      x: left,
      y,
      size: 11,
      font: fontRegular,
    });
    y -= 16;
  }

  page.drawLine({
    start: { x: left, y: y - 8 },
    end: { x: right, y: y - 8 },
    color: rgb(0.75, 0.75, 0.75),
    thickness: 1,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const { id } = await context.params;
    const prestamo = await AccountingCashOperationsService.getCashLoanById({
      tenantId: authResult.user.tenantId ?? '',
      id,
    });

    if (!prestamo) {
      return errorResponse('Préstamo no encontrado', 404, 'NOT_FOUND');
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    drawComprobante(page, fontRegular, fontBold, prestamo);

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="comprobante-PREST-${prestamo.idNumerico}.pdf"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error en mobile cash loan comprobante route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
