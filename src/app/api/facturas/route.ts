import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from "@/lib/services/periodo-operacion-guard"
import { registrarEventoContable } from "@/lib/services/evento-contable-integration"

/**
 * @description Obtener listado de facturas con filtros y paginación
 */
export const GET = withAuthGet(async (request: NextRequest, context: any, user: any) => {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const estado = searchParams.get('estado')
    const clienteId = searchParams.get('clienteId')
    const serieId = searchParams.get('serieId')
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    // Construir cláusula WHERE
    const whereClause: Record<string, any> = {}

    // Filtro por estado
    if (estado) {
      whereClause.estado = estado
    }

    // Filtro por cliente
    if (clienteId) {
      whereClause.clienteId = clienteId
    }

    // Filtro por serie
    if (serieId) {
      whereClause.serieId = serieId
    }

    // Filtro por rango de fechas
    if (fechaInicio || fechaFin) {
      whereClause.createdAt = {}
      if (fechaInicio) {
        whereClause.createdAt.gte = new Date(fechaInicio)
      }
      if (fechaFin) {
        whereClause.createdAt.lte = new Date(fechaFin)
      }
    }

    // Búsqueda por número de factura o nombre de cliente
    if (search) {
      whereClause.OR = [
        {
          numeroFactura: {
            contains: search
          }
        },
        {
          cliente: {
            nombre: {
              contains: search
            }
          }
        },
        {
          venta: {
            producto: {
              nombre: {
                contains: search
              }
            }
          }
        }
      ]
    }

    // Obtener facturas con relaciones
    const [facturas, totalCount] = await Promise.all([
      prisma.factura.findMany({
        where: whereClause,
        include: {
          serie: {
            select: {
              serieId: true,
              prefijo: true,
              descripcion: true
            }
          },
          cliente: {
            select: {
              clienteId: true,
              nombre: true,
              direccion: true,
              telefono: true
            }
          },
          venta: {
            include: {
              puntoDeVenta: {
                select: {
                  pvId: true,
                  nombre: true
                }
              },
              producto: {
                select: {
                  id: true,
                  nombre: true,
                  precioVenta: true
                }
              },
              oferta: {
                select: {
                  id: true,
                  numeroOferta: true,
                  subtotal: true,
                  impuestos: true,
                  total: true
                }
              }
            }
          },


        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.factura.count({ where: whereClause })
    ])

    // Calcular totales por estado si se solicita
    const totalsByStatus = searchParams.get('includeTotals') === 'true'
      ? await prisma.factura.groupBy({
          by: ['estado'],
          where: whereClause,
          _count: { idFactura: true },
          _sum: { total: true }
        })
      : []

    return NextResponse.json({
      facturas,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      totalsByStatus: totalsByStatus.reduce((acc: any, item: any) => ({
        ...acc,
        [item.estado]: {
          count: item._count.idFactura,
          total: item._sum.total
        }
      }), {})
    })
  } catch (error) {
    console.error("Error al obtener facturas:", error)
    return NextResponse.json(
      { error: "Error al obtener facturas" },
      { status: 500 }
    )
  }
})

/**
 * @description Crear una factura manualmente (sin venta asociada)
 */
export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  try {
    const body = await request.json()
    
    await assertOperationAllowed(new Date(), 'FACTURA')
    
    // Validar campos requeridos
    const { clienteId, subtotal, impuestos, descuento, total, serieId, observaciones, tipoDocumento = 'FACTURA' } = body
    
    if (!clienteId || subtotal === undefined || total === undefined) {
      return NextResponse.json(
        { error: "clienteId, subtotal y total son requeridos" },
        { status: 400 }
      )
    }

    // Obtener serie (si no se proporciona, usar la serie por defecto)
    let serie
    if (serieId) {
      serie = await prisma.serieFacturacion.findUnique({
        where: { serieId }
      })
      if (!serie || !serie.activa) {
        return NextResponse.json(
          { error: "Serie de facturación no disponible" },
          { status: 400 }
        )
      }
    } else {
      // Obtener la serie por defecto "SD"
      serie = await prisma.serieFacturacion.findFirst({
        where: { esPorDefecto: true }
      })
      
      if (!serie) {
        // Crear serie por defecto si no existe
        serie = await prisma.serieFacturacion.create({
          data: {
            prefijo: "SD",
            descripcion: "Serie por defecto para ventas",
            consecutivo: 1,
            activa: true,
            esPorDefecto: true
          }
        })
      }
    }

    // Obtener el número consecutivo actual de la serie
    const numeroConsecutivoSerie = serie.consecutivo

    // Crear la factura
    const factura = await prisma.factura.create({
      data: {
        clienteId,
        serieId: serie.serieId,
        subtotal: Number(subtotal),
        impuestos: Number(impuestos || 0),
        descuento: Number(descuento || 0),
        total: Number(total),
         observaciones: observaciones || null,
         tipoDocumento,
        estado: 'PENDIENTE',
        creadoPor: user.userId,
        numeroFactura: `temp-${Date.now()}`, // Temporal, se actualizará
      }
    })

    // Actualizar el numeroFactura con formato {prefijo}-{numeroConsecutivoSerie}
    const facturaActualizada = await prisma.factura.update({
      where: { idFactura: factura.idFactura },
      data: {
        numeroFactura: `${serie.prefijo}-${numeroConsecutivoSerie}`
      }
    })

    // Incrementar el consecutivo de la serie
    await prisma.serieFacturacion.update({
      where: { serieId: serie.serieId },
      data: {
        consecutivo: serie.consecutivo + 1
      }
    })

    await registrarEventoContable({
      origenTipo: 'FACTURA',
      origenId: facturaActualizada.idFactura,
      monto: Number(total),
      fechaOperacion: new Date(),
      descripcion: `Factura ${facturaActualizada.numeroFactura}`,
      usuarioId: user.userId,
    })

    return NextResponse.json(facturaActualizada, { status: 201 })
  } catch (error) {
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json(serializePeriodoOperacionError(error), { status: error.status })
    }
    console.error("Error al crear factura:", error)
    return NextResponse.json(
      { error: "Error al crear factura" },
      { status: 500 }
    )
  }
})