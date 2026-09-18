import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware';
import { requireTenant } from '@/lib/services/tenant-scope';
import { prisma } from '@/lib/prisma';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { z } from 'zod';

const createValeSchema = z.object({
  concepto: z.string().min(1).max(200),
  observaciones: z.string().max(1000).optional(),
  items: z.array(
    z.object({
      productoId: z.string(),
      cantidad: z.number().int().positive(),
    })
  ).min(1),
});

/**
 * @description Obtiene vales de salida con filtro opcional por concepto.
 * @param {NextRequest} request - Request HTTP con filtros opcionales.
 * @returns {Promise<NextResponse>} Vales encontrados.
 */
export const GET = withAuthGet(async (request: NextRequest, _ctx: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const searchParams = request.nextUrl.searchParams;
    const concepto = searchParams.get('concepto')?.trim();
    const estado = searchParams.get('estado')?.trim();

    const whereClause: any = { tenantId };

    if (concepto) {
      whereClause.concepto = {
        contains: concepto,
        mode: 'insensitive',
      };
    }

    if (estado) {
      whereClause.estado = estado;
    }

    const vales = await prisma.valeSalida.findMany({
      where: whereClause,
      include: {
        ValeSalidaItem: {
          include: {
            Producto: {
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(vales);
  } catch (error) {
    console.error('Error al obtener vales de salida:', error);
    return NextResponse.json({ error: 'Error al obtener vales de salida.' }, { status: 500 });
  }
});

/**
 * @description Crea un nuevo vale de salida, decrementando el stock de los productos.
 * @param {NextRequest} request - Request HTTP con datos del vale.
 * @returns {Promise<NextResponse>} Vale creado.
 */
export const POST = withAuthPost(async (request: NextRequest, _ctx: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const body = await request.json();
    const payload = createValeSchema.parse(body);
    const userId = body.userId || 'system';

    // Crear el vale y validar stock + decrementar de forma atómica en una sola transacción
    let vale;
    try {
      vale = await prisma.$transaction(async (tx) => {
        // Validar disponibilidad dentro de la transacción para evitar race conditions
        const productosFaltantes: Array<{ productoId: string; productoNombre: string; requerido: number; disponible: number }> = [];
        const itemsValidados: Array<{
          productoId: string;
          cantidad: number;
          productoNombre: string;
          almacenId: string;
        }> = [];

        for (const item of payload.items) {
          const producto = await tx.producto.findUnique({
            where: { id: item.productoId },
            select: { id: true, nombre: true, almacenId: true },
          });

          const stockEnAlmacen = producto?.almacenId
            ? await tx.stockUbicacion.findUnique({
                where: {
                  productoId_tipoUbicacion_ubicacionId: {
                    productoId: item.productoId,
                    tipoUbicacion: 'almacen',
                    ubicacionId: producto.almacenId,
                  },
                },
                select: {
                  productoId: true,
                  cantidad: true,
                  cantidadReservada: true,
                  cantidadDisponible: true,
                },
              })
            : null;

          if (!producto || !producto.almacenId || !stockEnAlmacen || stockEnAlmacen.cantidadDisponible < item.cantidad) {
            productosFaltantes.push({
              productoId: item.productoId,
              productoNombre: producto?.nombre || 'Desconocido',
              requerido: item.cantidad,
              disponible: stockEnAlmacen?.cantidadDisponible || 0,
            });
            continue;
          }

          itemsValidados.push({
            productoId: item.productoId,
            cantidad: item.cantidad,
            productoNombre: producto.nombre,
            almacenId: producto.almacenId,
          });
        }

        if (productosFaltantes.length > 0) {
          throw Object.assign(new Error('Stock insuficiente.'), { productosFaltantes, statusCode: 400 });
        }

        // Crear el vale
        const nuevoVale = await tx.valeSalida.create({
          data: {
            valeSalidaId: `vale_${Date.now()}`,
            tenantId,
            concepto: payload.concepto,
            observaciones: payload.observaciones,
            estado: 'COMPLETADA',
            updatedAt: new Date(),
          },
        });

        // Crear los items y decrementar stock
        for (const item of itemsValidados) {
          await tx.valeSalidaItem.create({
            data: {
              valeSalidaItemId: uuid(),
              tenantId,
              valeSalidaId: nuevoVale.valeSalidaId,
              productoId: item.productoId,
              cantidad: item.cantidad,
            },
          });

          await upsertStockUbicacion(tx, {
            productoId: item.productoId,
            tipoUbicacion: 'almacen',
            ubicacionId: item.almacenId,
            modo: 'increment',
            delta: -item.cantidad,
          });
        }

        return tx.valeSalida.findUnique({
          where: { valeSalidaId: nuevoVale.valeSalidaId },
          include: {
            ValeSalidaItem: {
              include: {
                Producto: {
                  select: { id: true, nombre: true, precioCosto: true, stock: true },
                },
              },
            },
          },
        });
      });
    } catch (txError: any) {
      if (txError?.statusCode === 400) {
        return NextResponse.json(
          { error: 'Stock insuficiente.', productosFaltantes: txError.productosFaltantes },
          { status: 400 }
        );
      }
      throw txError;
    }

    return NextResponse.json(vale, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos para crear vale.', issues: error.issues },
        { status: 400 }
      );
    }

    console.error('Error al crear vale de salida:', error);
    return NextResponse.json({ error: 'Error al crear vale de salida.' }, { status: 500 });
  }
});
