import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { withAuthGet } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';

export const runtime = 'nodejs';

const ORANGE = rgb(249 / 255, 115 / 255, 22 / 255);
const RED = rgb(220 / 255, 38 / 255, 38 / 255);
const DARK = rgb(30 / 255, 30 / 255, 30 / 255);
const GRAY = rgb(100 / 255, 100 / 255, 100 / 255);
const LIGHT_GRAY = rgb(240 / 255, 240 / 255, 240 / 255);
const WHITE = rgb(1, 1, 1);

/**
 * @description Genera un PDF del reporte de nómina filtrado por tenant.
 * @param {NextRequest} request - Request con query params.
 * @param {unknown} _context - Contexto de Next.js.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} PDF del reporte.
 */
async function getNominaPdfHandler(
  request: NextRequest,
  _context: unknown,
  user: AuthenticatedUser,
): Promise<NextResponse> {
  try {
    const tenantId = requireTenant(user);
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo');

    const pagos = await prisma.pagosalario.findMany({
      where: {
        tenantId,
        ...(periodo ? { periodo } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        empleado: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true,
            salarioBases: true,
          },
        },
      },
    });

    if (pagos.length === 0) {
      return NextResponse.json(
        { error: 'No hay registros de nómina para el período seleccionado' },
        { status: 404 },
      );
    }

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 800;
    const marginLeft = 50;
    const pageWidth = 495.28;
    const lineHeight = 18;

    page.drawRectangle({ x: 0, y: y + 20, width: 595.28, height: 50, color: ORANGE });
    page.drawText('REPORTE DE NÓMINA', {
      x: marginLeft,
      y: y + 40,
      size: 18,
      font: fontBold,
      color: WHITE,
    });
    page.drawText(periodo ? `Período: ${periodo}` : 'Todos los períodos', {
      x: marginLeft,
      y: y + 22,
      size: 10,
      font: fontRegular,
      color: WHITE,
    });

    y -= 45;

    const totalSalarios = pagos.reduce((s, p) => s + p.salario, 0);
    const totalBonos = pagos.reduce((s, p) => s + (p.bonificaciones || 0), 0);
    const totalDeducciones = pagos.reduce((s, p) => s + (p.deducciones || 0), 0);
    // B-05: el dinero de horas extras viene del campo calculado en servidor,
    // nunca de multiplicar horas como si fueran pesos.
    const totalHorasExtras = pagos.reduce((s, p) => s + (p.montoHorasExtras ?? 0), 0);
    const totalNeto = pagos.reduce((s, p) => {
      const bono = p.bonificaciones || 0;
      const ded = p.deducciones || 0;
      const he = p.montoHorasExtras ?? 0;
      return s + p.salario + bono + he - ded;
    }, 0);

    page.drawText(`Total Empleados: ${pagos.length}`, {
      x: marginLeft,
      y,
      size: 11,
      font: fontBold,
      color: DARK,
    });
    y -= 16;
    page.drawText(`Total Salarios: $${totalSalarios.toLocaleString('es-ES')}`, {
      x: marginLeft,
      y,
      size: 10,
      font: fontRegular,
      color: GRAY,
    });
    y -= 14;
    page.drawText(`Total Horas Extras: $${totalHorasExtras.toLocaleString('es-ES')}`, {
      x: marginLeft,
      y,
      size: 10,
      font: fontRegular,
      color: GRAY,
    });
    y -= 14;
    page.drawText(`Total Bonificaciones: $${totalBonos.toLocaleString('es-ES')}`, {
      x: marginLeft + 200,
      y,
      size: 10,
      font: fontRegular,
      color: GRAY,
    });
    y -= 14;
    page.drawText(`Total Deducciones: $${totalDeducciones.toLocaleString('es-ES')}`, {
      x: marginLeft + 200,
      y,
      size: 10,
      font: fontRegular,
      color: GRAY,
    });

    y -= 20;
    page.drawRectangle({ x: marginLeft, y: y - 4, width: pageWidth, height: 22, color: RED });
    page.drawText(`TOTAL NETO: $${totalNeto.toLocaleString('es-ES')}`, {
      x: marginLeft + 10,
      y: y + 4,
      size: 12,
      font: fontBold,
      color: WHITE,
    });

    y -= 40;
    const colX = [
      marginLeft,
      marginLeft + 120,
      marginLeft + 220,
      marginLeft + 290,
      marginLeft + 360,
      marginLeft + 430,
    ];

    page.drawRectangle({ x: marginLeft, y: y - 4, width: pageWidth, height: 22, color: LIGHT_GRAY });

    ['Empleado', 'Salario Base', 'Bonos', 'Deducc.', 'Hrs Extras', 'Neto'].forEach((header, i) => {
      page.drawText(header, { x: colX[i] + 4, y: y + 2, size: 8, font: fontBold, color: DARK });
    });

    y -= lineHeight;

    for (const [index, pago] of pagos.entries()) {
      if (y < 60) {
        page.drawText(`Pág. ${pdfDoc.getPageCount()}`, {
          x: pageWidth + marginLeft - 30,
          y: 40,
          size: 8,
          font: fontRegular,
          color: GRAY,
        });
        page = pdfDoc.addPage([595.28, 841.89]);
        y = 800;
      }

      const nombre = `${pago.empleado.nombre} ${pago.empleado.apellido}`.slice(0, 22);
      const bono = pago.bonificaciones || 0;
      const ded = pago.deducciones || 0;
      const he = pago.montoHorasExtras ?? 0;
      const neto = pago.salario + bono + he - ded;

      if (index % 2 === 0) {
        page.drawRectangle({
          x: marginLeft,
          y: y - 4,
          width: pageWidth,
          height: lineHeight,
          color: rgb(0.98, 0.98, 0.98),
        });
      }

      page.drawText(nombre, { x: colX[0] + 4, y, size: 8, font: fontRegular, color: DARK });
      page.drawText(`$${pago.salario.toLocaleString('es-ES')}`, {
        x: colX[1] + 4, y, size: 8, font: fontRegular, color: DARK,
      });
      page.drawText(`$${bono.toLocaleString('es-ES')}`, {
        x: colX[2] + 4, y, size: 8, font: fontRegular, color: DARK,
      });
      page.drawText(`-$${ded.toLocaleString('es-ES')}`, {
        x: colX[3] + 4, y, size: 8, font: fontRegular, color: DARK,
      });
      page.drawText(`$${he.toLocaleString('es-ES')}`, {
        x: colX[4] + 4, y, size: 8, font: fontRegular, color: DARK,
      });
      page.drawText(`$${neto.toLocaleString('es-ES')}`, {
        x: colX[5] + 4, y, size: 8, font: fontBold, color: ORANGE,
      });

      y -= lineHeight;
    }

    page.drawText(
      `Generado el ${new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
      {
        x: marginLeft,
        y: 40,
        size: 8,
        font: fontRegular,
        color: GRAY,
      },
    );
    page.drawText(`Pág. ${pdfDoc.getPageCount()}`, {
      x: pageWidth + marginLeft - 30,
      y: 40,
      size: 8,
      font: fontRegular,
      color: GRAY,
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="nomina-${periodo || 'completa'}.pdf"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generando PDF de nómina:', error);
    return NextResponse.json({ error: 'Error generando PDF de nómina' }, { status: 500 });
  }
}

export const GET = withAuthGet(getNominaPdfHandler);
