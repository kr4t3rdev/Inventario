import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTenant } from "@/lib/services/tenant-scope"
import { notificarTransferencia } from "@/lib/notificaciones-utils"
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service'
import { auth } from "@clerk/nextjs/server"
import type { AuthenticatedUser } from "@/lib/auth-middleware"

async function getStockDisponibleEnPuntoVenta(productoId: string, puntoDeVentaId: string): Promise<number> {
  const transferenciasEntrada = await prisma.transferencia.aggregate({
    where: {
      productoId,
      puntoDeVentaDestinoId: puntoDeVentaId,
    },
    _sum: {
      cantidad: true,
    },
  })

  const transferenciasSalida = await prisma.transferencia.aggregate({
    where: {
      productoId,
      puntoDeVentaOrigenId: puntoDeVentaId,
    },
    _sum: {
      cantidad: true,
    },
  })

  const [ventasItems, ventasLegacy] = await Promise.all([
    prisma.ventaItem.aggregate({
      where: {
        productoId,
        venta: {
          puntoDeVentaId,
        },
      },
      _sum: {
        cantidad: true,
      },
    }),
    prisma.venta.aggregate({
      where: {
        productoId,
        puntoDeVentaId,
        items: { none: {} },
      },
      _sum: {
        cantidad: true,
      },
    }),
  ])

  const ventasTotal = (ventasItems._sum.cantidad || 0) + (ventasLegacy._sum.cantidad || 0)

  return (
    (transferenciasEntrada._sum.cantidad || 0) -
    (transferenciasSalida._sum.cantidad || 0) -
    ventasTotal
  )
}

async function generarNumeroTransferencia(tx: any): Promise<string> {
  const year = new Date().getFullYear()
  const count = await tx.transferencia.count({
    where: {
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  })
  return `TRF-${year}-${String(count + 1).padStart(6, '0')}`
}

export async function getTransferenciasHandler(request: NextRequest, _context: any, user: AuthenticatedUser) {
  try {
    const tenantId = requireTenant(user);
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const skip = (page - 1) * limit

    const transferencias = await prisma.transferencia.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      select: {
        transferenciaId: true,
        numeroTransferencia: true,
        productoId: true,
        cantidad: true,
        costoUnitario: true,
        costoTotal: true,
        estado: true,
        createdAt: true,
        updatedAt: true,
        producto: {
          select: {
            nombre: true,
            codigoInterno: true,
          }
        },
        origen: {
          select: {
            almacenId: true,
            nombre: true,
          }
        },
        destino: {
          select: {
            almacenId: true,
            nombre: true,
          }
        },
        puntoDeVentaOrigen: {
          select: {
            pvId: true,
            nombre: true,
          }
        },
        puntoDeVentaDestino: {
          select: {
            pvId: true,
            nombre: true,
          }
        },
        creadoPor: {
          select: {
            userId: true,
            name: true,
            email: true,
          }
        },
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    })

    const total = await prisma.transferencia.count({
      where: { deletedAt: null }
    })

    const transferenciasProcessed = transferencias.map((t: any) => {
      let tipoTransferencia = ""
      let origenNombre = ""
      let destinoNombre = ""

      if (t.origen) {
        origenNombre = `${t.origen.nombre} (Almacén)`
        tipoTransferencia += "Almacén"
      } else if (t.puntoDeVentaOrigen) {
        origenNombre = `${t.puntoDeVentaOrigen.nombre} (Punto de Venta)`
        tipoTransferencia += "Punto de Venta"
      }

      tipoTransferencia += " → "
      if (t.destino) {
        destinoNombre = `${t.destino.nombre} (Almacén)`
        tipoTransferencia += "Almacén"
      } else if (t.puntoDeVentaDestino) {
        destinoNombre = `${t.puntoDeVentaDestino.nombre} (Punto de Venta)`
        tipoTransferencia += "Punto de Venta"
      }

      return {
        transferenciaId: t.transferenciaId,
        numeroTransferencia: t.numeroTransferencia,
        productoId: t.productoId,
        productoNombre: t.producto.nombre,
        productoCodigoInterno: t.producto.codigoInterno,
        cantidad: t.cantidad,
        costoUnitario: t.costoUnitario,
        costoTotal: t.costoTotal,
        tipoTransferencia,
        origenNombre,
        destinoNombre,
        estado: t.estado,
        creadoPor: t.creadoPor,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }
    })

    return NextResponse.json({
      transferencias: transferenciasProcessed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error("Error al obtener transferencias:", error)
    return NextResponse.json({ error: "Error al obtener transferencias" }, { status: 500 })
  }
}

export async function createTransferenciaHandler(request: NextRequest, _context: any, user: any) {
  try {
    const body = await request.json()
    const { productos, tipoOrigen, origenId, tipoDestino, destinoId, descripcion } = body

    if (!user || !user.userId) {
      return NextResponse.json({ message: "Usuario no autenticado" }, { status: 401 })
    }

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return NextResponse.json({ message: "Se requiere al menos un producto" }, { status: 400 })
    }

    if (!tipoOrigen || !origenId || !tipoDestino || !destinoId) {
      return NextResponse.json({ message: "Faltan campos requeridos" }, { status: 400 })
    }

    if (tipoOrigen === tipoDestino && origenId === destinoId) {
      return NextResponse.json({ message: "El origen y destino no pueden ser iguales" }, { status: 400 })
    }

    const productosValidados: { producto: { categoria: { nombre: string; catId: string; createdAt: Date; updatedAt: Date; }; unidad: { nombre: string; createdAt: Date; updatedAt: Date; unidadId: string; simbolo: string; } | null; } & { id: string; nombre: string; stock: number; createdAt: Date; updatedAt: Date; descripcion: string | null; precioCosto: number; precioVenta: number; categoriaId: string; unidadId: string | null; vendorId: string | null; almacenId: string; puntoDeVentaId: string | null; }; cantidad: any; }[] = []
    for (const item of productos) {
      const { productoId, cantidad } = item
      const cantidadNum = Number(cantidad)

      if (!productoId || !Number.isFinite(cantidadNum) || cantidadNum <= 0) {
        return NextResponse.json({ message: "Datos de producto inválidos" }, { status: 400 })
      }

      const producto = await prisma.producto.findUnique({
        where: { id: productoId },
        include: {
          categoria: true,
          unidad: true,
        },
      })

      if (!producto) {
        return NextResponse.json({ message: `Producto con ID ${productoId} no encontrado` }, { status: 404 })
      }

      if (tipoOrigen === "punto_venta") {
        const stockDisponible = await getStockDisponibleEnPuntoVenta(productoId, origenId)
        if (stockDisponible < cantidadNum) {
          return NextResponse.json({
            message: `Stock insuficiente para ${producto.nombre} en el punto de venta. Disponible: ${stockDisponible}, Solicitado: ${cantidadNum}`
          }, { status: 400 })
        }
      } else if (producto.stock < cantidadNum) {
        return NextResponse.json({
          message: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}, Solicitado: ${cantidadNum}`
        }, { status: 400 })
      }

      productosValidados.push({
        producto,
        cantidad: cantidadNum,
      })
    }

    let origenValido = null
    let destinoValido = null

    if (tipoOrigen === "almacen") {
      origenValido = await prisma.almacen.findUnique({
        where: { almacenId: origenId },
      })
    } else {
      origenValido = await prisma.puntoDeVenta.findUnique({
        where: { pvId: origenId },
      })
    }

    if (tipoDestino === "almacen") {
      destinoValido = await prisma.almacen.findUnique({
        where: { almacenId: destinoId },
      })
    } else {
      destinoValido = await prisma.puntoDeVenta.findUnique({
        where: { pvId: destinoId },
      })
    }

    if (!origenValido) {
      return NextResponse.json({ message: "Origen no encontrado" }, { status: 404 })
    }

    if (!destinoValido) {
      return NextResponse.json({ message: "Destino no encontrado" }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const transferenciasCreadas = []

      const numeroTransferencia = await generarNumeroTransferencia(tx)

      for (const item of productosValidados) {
        const { producto, cantidad } = item

        const costoUnitario = producto.precioCosto
        const costoTotal = cantidad * costoUnitario

        const transferenciaData: any = {
          productoId: producto.id,
          cantidad,
          costoUnitario,
          costoTotal,
          descripcion: descripcion || `Transferencia múltiple - ${producto.nombre}`,
          estado: 'COMPLETADA',
          creadoPorId: user.userId,
          numeroTransferencia: `${numeroTransferencia}-${String(transferenciasCreadas.length + 1).padStart(3, '0')}`,
        }

        if (tipoOrigen === "almacen") {
          transferenciaData.origenId = origenId
        } else {
          transferenciaData.puntoDeVentaOrigenId = origenId
        }

        if (tipoDestino === "almacen") {
          transferenciaData.destinoId = destinoId
        } else {
          transferenciaData.puntoDeVentaDestinoId = destinoId
        }

        const transferencia = await tx.transferencia.create({
          data: transferenciaData,
          include: {
            producto: {
              include: {
                categoria: true,
                unidad: true,
              },
            },
          },
        })

        const stockDelta =
          (tipoOrigen === "almacen" ? -cantidad : 0) +
          (tipoDestino === "almacen" ? cantidad : 0)

        if (stockDelta !== 0) {
          await tx.producto.update({
            where: { id: producto.id },
            data: {
              stock: {
                increment: stockDelta,
              },
            },
          })
        }

        transferenciasCreadas.push(transferencia)

        await upsertStockUbicacion(tx, {
          productoId: producto.id,
          tipoUbicacion: tipoOrigen,
          ubicacionId: origenId,
          modo: 'increment',
          delta: -cantidad,
        })

        await upsertStockUbicacion(tx, {
          productoId: producto.id,
          tipoUbicacion: tipoDestino,
          ubicacionId: destinoId,
          modo: 'increment',
          delta: cantidad,
        })
      }

      return transferenciasCreadas
    })

    for (const transferencia of result) {
      try {
        await notificarTransferencia(transferencia.transferenciaId)
      } catch (error) {
        console.error("Error enviando notificación de transferencia:", error)
      }
    }

    return NextResponse.json({
      message: `${result.length} transferencias creadas exitosamente`,
      transferencias: result,
      totalProductos: result.length,
      totalUnidades: result.reduce((sum: number, t: { cantidad: number }) => sum + t.cantidad, 0),
    })
  } catch (error) {
    console.log("[TRANSFERENCIAS_POST]", error)
    return NextResponse.json({
      message: "Error interno del servidor"
    }, {
      status: 500
    })
  }
}

export async function getTransferenciaByIdHandler(request: NextRequest, context: any) {
  try {
    const params = await context.params;
    const { id } = params;
    const transferencia = await prisma.transferencia.findFirst({
      where: {
        transferenciaId: id,
        deletedAt: null,
      },
      include: {
        producto: true,
        origen: true,
        destino: true,
        puntoDeVentaOrigen: true,
        puntoDeVentaDestino: true,
        creadoPor: {
          select: {
            userId: true,
            name: true,
            email: true,
          }
        },
      },
    })

    if (!transferencia) {
      return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 })
    }

    return NextResponse.json(transferencia)
  } catch (error) {
    console.error("Error al obtener transferencia:", error)
    return NextResponse.json({ error: "Error al obtener transferencia" }, { status: 500 })
  }
}

export async function updateTransferenciaHandler(request: NextRequest, context: any, user: any) {
  try {
    const params = await context.params;
    const { id } = params;
    const { productoId, cantidad, tipoOrigen, origenId, tipoDestino, destinoId } = await request.json()
    const nuevaCantidad = Number(cantidad)

    if (!user || !user.userId) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 })
    }

    if (!productoId || !Number.isFinite(nuevaCantidad) || nuevaCantidad <= 0) {
      return NextResponse.json({ error: "Datos de transferencia inválidos" }, { status: 400 })
    }

    const transferenciaActual = await prisma.transferencia.findFirst({
      where: {
        transferenciaId: id,
        deletedAt: null,
      },
    })

    if (!transferenciaActual) {
      return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 })
    }

    if (transferenciaActual.estado === 'CANCELADA') {
      return NextResponse.json({
        error: "No se puede modificar una transferencia cancelada"
      }, { status: 400 })
    }

    if (tipoOrigen === "punto_venta") {
      let stockDisponible = await getStockDisponibleEnPuntoVenta(productoId, origenId)

      if (
        transferenciaActual.productoId === productoId &&
        transferenciaActual.puntoDeVentaOrigenId === origenId
      ) {
        stockDisponible += transferenciaActual.cantidad
      }

      if (stockDisponible < nuevaCantidad) {
        return NextResponse.json(
          {
            error: "Stock insuficiente en el punto de venta",
            stockDisponible,
          },
          { status: 400 },
        )
      }
    }

    const data: any = {
      productoId,
      cantidad: nuevaCantidad,
      origenId: null,
      destinoId: null,
      puntoDeVentaOrigenId: null,
      puntoDeVentaDestinoId: null,
    }

    if (tipoOrigen === "almacen") {
      data.origenId = origenId
    } else if (tipoOrigen === "punto_venta") {
      data.puntoDeVentaOrigenId = origenId
    }

    if (tipoDestino === "almacen") {
      data.destinoId = destinoId
    } else if (tipoDestino === "punto_venta") {
      data.puntoDeVentaDestinoId = destinoId
    }

    const oldDelta =
      (transferenciaActual.origenId ? -transferenciaActual.cantidad : 0) +
      (transferenciaActual.destinoId ? transferenciaActual.cantidad : 0)

    const newDelta =
      (tipoOrigen === "almacen" ? -nuevaCantidad : 0) +
      (tipoDestino === "almacen" ? nuevaCantidad : 0)

    const transferencia = await prisma.$transaction(async (tx: any) => {
      const transferenciaActualizada = await tx.transferencia.update({
        where: { transferenciaId: id },
        data,
        include: {
          producto: true,
          origen: true,
          destino: true,
          puntoDeVentaOrigen: true,
          puntoDeVentaDestino: true,
        },
      })

      if (transferenciaActual.productoId !== productoId) {
        if (oldDelta !== 0) {
          await tx.producto.update({
            where: { id: transferenciaActual.productoId },
            data: {
              stock: {
                increment: -oldDelta,
              },
            },
          })
        }

        if (newDelta !== 0) {
          await tx.producto.update({
            where: { id: productoId },
            data: {
              stock: {
                increment: newDelta,
              },
            },
          })
        }
      } else if (newDelta !== oldDelta) {
        await tx.producto.update({
          where: { id: productoId },
          data: {
            stock: {
              increment: newDelta - oldDelta,
            },
          },
        })
      }

      return transferenciaActualizada
    })

    return NextResponse.json(transferencia)
  } catch (error) {
    console.error("Error al actualizar transferencia:", error)
    return NextResponse.json({ error: "Error al actualizar transferencia" }, { status: 500 })
  }
}

export async function deleteTransferenciaHandler(request: NextRequest, context: any, user: any) {
  try {
    const params = await context.params;
    const { id } = params;

    if (!user || !user.userId) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 })
    }

    const transferencia = await prisma.transferencia.findFirst({
      where: {
        transferenciaId: id,
        deletedAt: null,
      },
      include: {
        producto: {
          include: {
            categoria: true,
            unidad: true,
          }
        },
        origen: true,
        destino: true,
        puntoDeVentaOrigen: true,
        puntoDeVentaDestino: true,
      }
    })

    if (!transferencia) {
      return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 })
    }

    if (transferencia.estado === 'CANCELADA') {
      return NextResponse.json({
        error: "La transferencia ya está cancelada"
      }, { status: 400 })
    }

    const stockDelta =
      (transferencia.origenId ? transferencia.cantidad : 0) +
      (transferencia.destinoId ? -transferencia.cantidad : 0)

    await prisma.$transaction(async (tx: any) => {
      await tx.transferencia.update({
        where: { transferenciaId: id },
        data: {
          estado: 'CANCELADA',
          deletedAt: new Date(),
        }
      })

      if (stockDelta !== 0) {
        await tx.producto.update({
          where: {
            id: transferencia.productoId
          },
          data: {
            stock: {
              increment: stockDelta
            }
          }
        })
      }
    })

    let origenNombre = ""
    let destinoNombre = ""

    if (transferencia.origen) {
      origenNombre = `${transferencia.origen.nombre} (Almacén)`
    } else if (transferencia.puntoDeVentaOrigen) {
      origenNombre = `${transferencia.puntoDeVentaOrigen.nombre} (Punto de Venta)`
    }

    if (transferencia.destino) {
      destinoNombre = `${transferencia.destino.nombre} (Almacén)`
    } else if (transferencia.puntoDeVentaDestino) {
      destinoNombre = `${transferencia.puntoDeVentaDestino.nombre} (Punto de Venta)`
    }

    return NextResponse.json({
      success: true,
      id: id,
      message: stockDelta !== 0
        ? `Transferencia cancelada. Stock de ${Math.abs(stockDelta)} ${transferencia.producto.unidad?.simbolo || 'unidades'} de ${transferencia.producto.nombre} ajustado.`
        : "Transferencia cancelada exitosamente.",
      detalles: {
        producto: transferencia.producto.nombre,
        cantidad: transferencia.cantidad,
        origen: origenNombre,
        destino: destinoNombre,
        stockAjustado: stockDelta,
        estado: 'CANCELADA'
      }
    })
  } catch (error) {
    console.error("Error al cancelar transferencia:", error)
    return NextResponse.json({
      error: "Error al cancelar transferencia",
      details: error instanceof Error ? error.message : "Error desconocido"
    }, { status: 500 })
  }
}

export async function enviarTransferenciaHandler(request: NextRequest, context: any, user: any) {
  try {
    const params = await context.params;
    const { id } = params;

    if (!user || !user.userId) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json({ error: "ID de transferencia requerido" }, { status: 400 })
    }

    const transferencia = await prisma.transferencia.findFirst({
      where: {
        transferenciaId: id,
        deletedAt: null,
      },
      include: {
        producto: {
          include: {
            unidad: true,
          },
        },
        origen: true,
        destino: true,
        puntoDeVentaOrigen: true,
        puntoDeVentaDestino: true,
      },
    })

    if (!transferencia) {
      return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 })
    }

    if (transferencia.estado !== 'PENDIENTE') {
      return NextResponse.json({
        error: `No se puede marcar como en tránsito una transferencia en estado ${transferencia.estado}`
      }, { status: 400 })
    }

    const transferenciaActualizada = await prisma.transferencia.update({
      where: { transferenciaId: id },
      data: {
        estado: 'EN_TRANSITO',
      },
      include: {
        producto: {
          include: {
            unidad: true,
          },
        },
        origen: true,
        destino: true,
        puntoDeVentaOrigen: true,
        puntoDeVentaDestino: true,
      },
    })

    const origenNombre = transferencia.origen?.nombre || transferencia.puntoDeVentaOrigen?.nombre || "Origen"
    const destinoNombre = transferencia.destino?.nombre || transferencia.puntoDeVentaDestino?.nombre || "Destino"

    return NextResponse.json({
      success: true,
      mensaje: "Transferencia marcada como en tránsito",
      transferencia: transferenciaActualizada,
      detalles: {
        transferenciaId: id,
        producto: transferencia.producto.nombre,
        cantidad: transferencia.cantidad,
        estado: 'EN_TRANSITO',
        origen: origenNombre,
        destino: destinoNombre,
      }
    })

  } catch (error) {
    console.error("Error al marcar como en tránsito:", error)
    return NextResponse.json({
      error: "Error al marcar transferencia como en tránsito",
      details: error instanceof Error ? error.message : "Error desconocido"
    }, { status: 500 })
  }
}

export async function confirmarTransferenciaHandler(request: NextRequest, context: any, user: any) {
  try {
    const params = await context.params;
    const { id } = params;
    const { cantidadRecibida } = await request.json()

    if (!user || !user.userId) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json({ error: "ID de transferencia requerido" }, { status: 400 })
    }

    if (cantidadRecibida === undefined || cantidadRecibida === null) {
      return NextResponse.json({ error: "Cantidad recibida requerida" }, { status: 400 })
    }

    const cantidadRecibidaNum = Number(cantidadRecibida)
    if (!Number.isFinite(cantidadRecibidaNum) || cantidadRecibidaNum < 0) {
      return NextResponse.json({ error: "Cantidad recibida inválida" }, { status: 400 })
    }

    const transferencia = await prisma.transferencia.findFirst({
      where: {
        transferenciaId: id,
        deletedAt: null,
      },
      include: {
        producto: {
          include: {
            unidad: true,
          },
        },
        origen: true,
        destino: true,
        puntoDeVentaOrigen: true,
        puntoDeVentaDestino: true,
      },
    })

    if (!transferencia) {
      return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 })
    }

    if (transferencia.estado !== 'PENDIENTE' && transferencia.estado !== 'EN_TRANSITO') {
      return NextResponse.json({
        error: `No se puede confirmar una transferencia en estado ${transferencia.estado}`
      }, { status: 400 })
    }

    const cantidadEnviada = transferencia.cantidad
    let nuevoEstado: 'COMPLETADA' | 'PARCIAL'
    let mensaje: string

    if (cantidadRecibidaNum === cantidadEnviada) {
      nuevoEstado = 'COMPLETADA'
      mensaje = "Recepción confirmada exitosamente - Cantidad completa"
    } else if (cantidadRecibidaNum < cantidadEnviada) {
      nuevoEstado = 'PARCIAL'
      const faltante = cantidadEnviada - cantidadRecibidaNum
      mensaje = `Recepción confirmada - Cantidad parcial. Faltan ${faltante} unidades.`
    } else {
      return NextResponse.json({
        error: "La cantidad recibida no puede ser mayor a la cantidad enviada"
      }, { status: 400 })
    }

    const resultado = await prisma.$transaction(async (tx: any) => {
      const transferenciaActualizada = await tx.transferencia.update({
        where: { transferenciaId: id },
        data: {
          estado: nuevoEstado,
          cantidad: cantidadRecibidaNum,
        },
        include: {
          producto: {
            include: {
              unidad: true,
            },
          },
          origen: true,
          destino: true,
          puntoDeVentaOrigen: true,
          puntoDeVentaDestino: true,
        },
      })

      if (nuevoEstado === 'PARCIAL') {
        const diferencia = cantidadEnviada - cantidadRecibidaNum

        if (transferencia.origenId) {
          await tx.producto.update({
            where: { id: transferencia.productoId },
            data: {
              stock: {
                increment: diferencia,
              },
            },
          })
        }

        if (transferencia.destinoId) {
          await tx.producto.update({
            where: { id: transferencia.productoId },
            data: {
              stock: {
                decrement: diferencia,
              },
            },
          })
        }
      }

      return transferenciaActualizada
    })

    const origenNombre = transferencia.origen?.nombre || transferencia.puntoDeVentaOrigen?.nombre || "Origen"
    const destinoNombre = transferencia.destino?.nombre || transferencia.puntoDeVentaDestino?.nombre || "Destino"

    return NextResponse.json({
      success: true,
      mensaje,
      transferencia: resultado,
      detalles: {
        transferenciaId: id,
        producto: resultado.producto.nombre,
        cantidadEnviada,
        cantidadRecibida: cantidadRecibidaNum,
        diferencia: cantidadEnviada - cantidadRecibidaNum,
        estado: nuevoEstado,
        origen: origenNombre,
        destino: destinoNombre,
      }
    })

  } catch (error) {
    console.error("Error al confirmar recepción:", error)
    return NextResponse.json({
      error: "Error al confirmar recepción de transferencia",
      details: error instanceof Error ? error.message : "Error desconocido"
    }, { status: 500 })
  }
}

export async function notificarTransferenciaHandler(req: Request) {
  try {
    const { userId } = await auth()
    const body = await req.json()

    const { productoId, cantidad, descripcion, origenId, destinoId, puntoDeVentaOrigenId, puntoDeVentaDestinoId } = body

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!productoId || !cantidad) {
      return new NextResponse("Missing required fields", { status: 400 })
    }

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    })

    if (!producto) {
      return new NextResponse("Producto no encontrado", { status: 404 })
    }

    if (producto.stock < cantidad) {
      return new NextResponse("Stock insuficiente", { status: 400 })
    }

    await prisma.producto.update({
      where: { id: productoId },
      data: {
        stock: producto.stock - cantidad,
      },
    })

    const transferencia = await prisma.transferencia.create({
      data: {
        productoId,
        cantidad,
        descripcion,
        origenId,
        destinoId,
        puntoDeVentaOrigenId,
        puntoDeVentaDestinoId,
        creadoPorId: userId,
        tenantId: producto.tenantId,
      },
    })

    return NextResponse.json(transferencia)
  } catch (error) {
    console.log("[TRANSFERENCIA_POST]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
}
