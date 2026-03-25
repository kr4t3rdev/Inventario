import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description Completa una orden de producción, incrementando el stock del producto terminado
 * y creando un registro en ReconciliacionGasto para contabilidad.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Orden completada.
 */
export const POST = withAuthPost(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const userId = body.userId || 'system';

    // Obtener la orden con sus ingredientes
    const orden = await prisma.ordenProduccion.findUnique({
      where: { ordenProduccionId: id },
      include: {
        receta: {
          include: {
            producto: true,
            ingredientes: true,
          },
        },
      },
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de producción no encontrada.' }, { status: 404 });
    }

    if (String(orden.estado) !== 'EN_PROCESO') {
      return NextResponse.json({ error: 'La orden no está en proceso.' }, { status: 400 });
    }

    // Calcular costo de materiales
    let costoMateriales = 0;
    for (const ingrediente of orden.receta.ingredientes) {
      const cantidadUsada = ingrediente.cantidad * orden.cantidad;
      const producto = await prisma.producto.findUnique({
        where: { id: ingrediente.productoId },
      });
      if (producto) {
        costoMateriales += producto.precioCosto * cantidadUsada;
      }
    }

    const costoUnitario = orden.cantidad > 0 ? Math.round(costoMateriales / orden.cantidad) : 0;

    // Si hay un producto asociado, incrementar su stock
    if (orden.receta.productoId) {
      await prisma.producto.update({
        where: { id: orden.receta.productoId },
        data: {
          stock: {
            increment: orden.cantidad * orden.receta.rendimiento,
          },
        },
      });
    }

    // Actualizar estado de la orden con los costos
    const ordenActualizada = await prisma.ordenProduccion.update({
      where: { ordenProduccionId: id },
      data: {
        estado: 'COMPLETADA',
        costoMateriales,
        costoUnitario,
      },
      include: {
        receta: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
              },
            },
            ingredientes: {
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
        },
      },
    });

    // Crear historial de estado
    await prisma.ordenProduccionHistorial.create({
      data: {
        ordenProduccionId: id,
        estadoAnterior: 'EN_PROCESO',
        estadoNuevo: 'COMPLETADA',
        observaciones: `Producción completada. Costo de materiales: ${costoMateriales}`,
        usuarioId: userId,
      },
    });

    // Registrar en contabilidad (ReconciliacionGasto)
    if (costoMateriales > 0) {
      // Obtener el período actual
      const periodo = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      
      await prisma.reconciliacionGasto.create({
        data: {
          tipoGasto: 'produccion',
          referenciaId: id,
          cuentaId: body.cuentaId || 'default',
          tipoPagoId: body.tipoPagoId || 'efectivo',
          monto: costoMateriales,
          moneda: 'CUP',
          descripcion: `Costo de producción - Orden: ${orden.receta.nombre} (Cantidad: ${orden.cantidad})`,
          periodo,
          reconciliadoPor: userId,
          estado: 'PENDIENTE',
        },
      });
    }

    return NextResponse.json(ordenActualizada);
  } catch (error) {
    console.error('Error al completar orden de producción:', error);
    return NextResponse.json({ error: 'Error al completar orden de producción.' }, { status: 500 });
  }
});
