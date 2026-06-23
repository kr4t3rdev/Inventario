import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import { AccountingOperationsReadService } from '@/features/contabilidad/services/accounting-operations-read-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatCurrency(amount: number, moneda: string): string {
  return `${amount.toFixed(2)} ${moneda}`;
}

function drawVoucher(page: any, fontRegular: any, fontBold: any, transferencia: any): void {
  const { width, height } = page.getSize();
  const left = 50;
  const right = width - 50;
  let y = height - 60;

  page.drawText('COMPROBANTE DE TRANSFERENCIA BANCARIA', {
    x: left,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 24;

  const lines = [
    `Comprobante No: ${transferencia.numeroComprobante}`,
    `Fecha: ${new Date(transferencia.fechaTransferencia).toLocaleDateString('es-ES')}`,
    `Hora: ${new Date(transferencia.fechaTransferencia).toLocaleTimeString('es-ES')}`,
    `Cuenta origen: ${transferencia.cuentaOrigen.nombreBanco} - ${transferencia.cuentaOrigen.numeroCuenta}`,
    `Cuenta destino: ${transferencia.cuentaDestino.nombreBanco} - ${transferencia.cuentaDestino.numeroCuenta}`,
    `Monto origen: ${formatCurrency(Number(transferencia.montoOrigen), transferencia.monedaOrigen)}`,
    transferencia.monedaOrigen !== transferencia.monedaDestino
      ? `Monto destino: ${formatCurrency(Number(transferencia.montoDestino), transferencia.monedaDestino)}`
      : null,
    transferencia.monedaOrigen !== transferencia.monedaDestino
      ? `Tasa de cambio: ${Number(transferencia.tasaCambio).toFixed(4)}`
      : null,
    `Motivo: ${transferencia.motivo}`,
    transferencia.descripcion ? `Descripción: ${transferencia.descripcion}` : null,
    `Realizado por: ${transferencia.realizadoPor}`,
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
    const transferencia = await AccountingOperationsReadService.getBankTransferById(id);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    drawVoucher(page, fontRegular, fontBold, transferencia);

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="comprobante-${transferencia.numeroComprobante}.pdf"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, error.code === 'NOT_FOUND' ? 404 : 400, error.code);
    }
    console.error('Error en mobile bank transfer comprobante route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
