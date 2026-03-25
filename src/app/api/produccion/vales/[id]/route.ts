import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet, withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateValeSchema = z.object({
  concepto: z.string().min(1).max(200).optional(),
  observaciones: z.string().max(1000).optional().nullable(),
});

/**
 * @description Obtiene un vale de salida por ID.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Vale encontrado.
 */
export const GET = withAuthGet(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    
    const vale = await prisma.valeSalida.findUnique({
      where: { valeSalidaId: id },
      include: {
        items: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                precioCosto: true,
                stock: true,
              },
            },
          },
        },
      },
    });

    if (!vale) {
      return NextResponse.json({ error: 'Vale de salida no encontrado.' }, { status: 404 });
    }

    return NextResponse.json(vale);
  } catch (error) {
    console.error('Error al obtener vale de salida:', error);
    return NextResponse.json({ error: 'Error al obtener vale de salida.' }, { status: 500 });
  }
});

/**
 * @description Actualiza un vale de salida (solo si está pendiente).
 * @param {NextRequest} request - Request HTTP con datos de actualización.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Vale actualizado.
 */
export const PATCH = withAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const payload = updateValeSchema.parse(await request.json());

    const valeExistente = await prisma.valeSalida.findUnique({
      where: { valeSalidaId: id },
    });

    if (!valeExistente) {
      return NextResponse.json({ error: 'Vale de salida no encontrado.' }, { status: 404 });
    }

    if (valeExistente.estado !== 'pendiente') {
      return NextResponse.json({ error: 'Solo se pueden modificar vales pendientes.' }, { status: 400 });
    }

    const vale = await prisma.valeSalida.update({
      where: { valeSalidaId: id },
      data: payload,
      include: {
        items: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(vale);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos para actualizar vale.', issues: error.issues },
        { status: 400 }
      );
    }

    console.error('Error al actualizar vale de salida:', error);
    return NextResponse.json({ error: 'Error al actualizar vale de salida.' }, { status: 500 });
  }
});

/**
 * @description Anula un vale de salida, restaurando el stock.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Respuesta de anulación.
 */
export const DELETE = withAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;

    const valeExistente = await prisma.valeSalida.findUnique({
      where: { valeSalidaId: id },
      include: {
        items: true,
      },
    });

    if (!valeExistente) {
      return NextResponse.json({ error: 'Vale de salida no encontrado.' }, { status: 404 });
    }

    if (String(valeExistente.estado) === 'anulada') {
      return NextResponse.json({ error: 'El vale ya está anulado.' }, { status: 400 });
    }

    // Restaurar stock y marcar como anulado
    await prisma.$transaction(async (tx) => {
      // Restaurar stock de cada item
      for (const item of valeExistente.items) {
        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stock: {
              increment: item.cantidad,
            },
          },
        });
      }

      // Marcar vale como anulado
      await tx.valeSalida.update({
        where: { valeSalidaId: id },
        data: {
          estado: 'anulada',
        },
      });
    });

    return NextResponse.json({ success: true, message: 'Vale anulado correctamente.' });
  } catch (error) {
    console.error('Error al anular vale de salida:', error);
    return NextResponse.json({ error: 'Error al anular vale de salida.' }, { status: 500 });
  }
});
