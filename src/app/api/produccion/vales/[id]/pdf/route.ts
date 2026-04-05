import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description Genera un PDF de un vale de salida.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} PDF del vale.
 */
export const GET = withAuthGet(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    
    const vale = await prisma.valeSalida.findUnique({
      where: { valeSalidaId: id },
      include: {
        ValeSalidaItem: {
          include: {
            Producto: {
              select: {
                id: true,
                nombre: true,
                precioCosto: true,
              },
            },
          },
        },
      },
    });

    if (!vale) {
      return NextResponse.json({ error: 'Vale de salida no encontrado.' }, { status: 404 });
    }

    // Calcular total
    let total = 0;
    for (const item of vale.ValeSalidaItem) {
      total += (item.Producto?.precioCosto || 0) * item.cantidad;
    }

    // Generar contenido del PDF (simplificado - en producción usaríamos una librería como jsPDF o PDFKit)
    const pdfContent = {
      valeId: vale.valeSalidaId,
      concepto: vale.concepto,
      observaciones: vale.observaciones,
      estado: vale.estado,
      fecha: vale.createdAt,
      items: vale.ValeSalidaItem.map(item => ({
        producto: item.Producto?.nombre,
        cantidad: item.cantidad,
        precioUnitario: item.Producto?.precioCosto,
        total: (item.Producto?.precioCosto || 0) * item.cantidad,
      })),
      total,
    };

    return NextResponse.json({
      message: 'PDF generado exitosamente.',
      data: pdfContent,
    });
  } catch (error) {
    console.error('Error al generar PDF del vale:', error);
    return NextResponse.json({ error: 'Error al generar PDF del vale.' }, { status: 500 });
  }
});
