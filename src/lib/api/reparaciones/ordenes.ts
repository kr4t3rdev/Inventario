import prisma from '@/lib/prisma'
import type { OrdenReparacion } from '@/app/models/model'
import { getAuthenticatedContext } from '@/lib/api/client'
import { ServerActionError } from '@/lib/api/errors'
import { applyFacturacionCobroWorkflow } from '@/lib/services/facturacion-cobro-workflow'

function requireTenant(ctx: { tenantId?: string }): string {
  if (!ctx.tenantId) throw new ServerActionError('OrdenesReparacion', 'UNKNOWN', 403, 'Se requiere un tenant activo')
  return ctx.tenantId
}

export async function getOrdenesReparacion(params?: {
  estado?: string
  search?: string
}): Promise<OrdenReparacion[]> {
  const ctx = await getAuthenticatedContext()
  const tenantId = requireTenant(ctx)

  try {
    const whereClause: any = { tenantId }

    if (params?.estado && params.estado !== 'TODOS') {
      whereClause.estado = params.estado
    }

    if (params?.search) {
      const orConditions: any[] = [
        { cliente: { nombre: { contains: params.search } } },
        { marca: { contains: params.search } },
        { numeroSerie: { contains: params.search } },
        {
          equipos: {
            some: {
              OR: [
                { marca: { contains: params.search } },
                { numeroSerie: { contains: params.search } },
                { equipoTipo: { nombre: { contains: params.search } } },
              ],
            },
          },
        },
      ]
      const searchAsNumber = parseInt(params.search)
      if (!isNaN(searchAsNumber)) {
        orConditions.push({ numeroOrden: { equals: searchAsNumber } })
      }
      whereClause.OR = orConditions
    }

    return await prisma.ordenReparacion.findMany({
      where: whereClause,
      include: {
        cliente: { select: { nombre: true, telefono: true } },
        equipoTipo: { select: { nombre: true } },
        equipos: { include: { equipoTipo: { select: { nombre: true } } } },
        tecnico: { select: { nombre: true, apellido: true } },
      },
      orderBy: { createdAt: 'desc' },
    }) as any
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    throw new ServerActionError('getOrdenesReparacion', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener órdenes')
  }
}

export async function getOrdenReparacion(id: string): Promise<OrdenReparacion> {
  await getAuthenticatedContext()

  try {
    const orden = await prisma.ordenReparacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        equipoTipo: { include: { piezas: true } },
        equipos: { include: { equipoTipo: { include: { piezas: true } } } },
        tecnico: true,
        items: { include: { pieza: true, ordenEquipo: { include: { equipoTipo: true } } } },
        materiales: { include: { producto: true } },
        venta: { include: { factura: true } },
      },
    })

    if (!orden) throw new ServerActionError('getOrdenReparacion', 'GET', 404, 'Orden no encontrada')
    return orden as any
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    throw new ServerActionError('getOrdenReparacion', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener orden')
  }
}

export async function addOrdenReparacion(
  data: Partial<OrdenReparacion> & { equipos?: any[] }
): Promise<{ success: boolean; orden: any; recibo: any; message: string }> {
  const ctx = await getAuthenticatedContext()
  const tenantId = requireTenant(ctx)

  const equiposInput = Array.isArray(data.equipos) && data.equipos.length > 0
    ? data.equipos
    : [{
        equipoTipoId: (data as any).equipoTipoId,
        marca: (data as any).marca,
        modelo: (data as any).modelo,
        numeroSerie: (data as any).numeroSerie,
        contrasena: (data as any).contrasena,
        accesorios: (data as any).accesorios,
        problemaReportado: (data as any).problemaReportado,
        fotos: (data as any).fotos || [],
      }]

  const primaryEquipo = equiposInput[0]

  if (!data.clienteId || !primaryEquipo?.equipoTipoId) {
    throw new ServerActionError('addOrdenReparacion', 'POST', 400, 'Cliente y Tipo de Equipo son requeridos')
  }
  if (!primaryEquipo?.marca || !primaryEquipo?.problemaReportado) {
    throw new ServerActionError('addOrdenReparacion', 'POST', 400, 'Marca y problema reportado son requeridos')
  }

  try {
    const [cliente, equipoTipo] = await Promise.all([
      prisma.cliente.findUnique({ where: { clienteId: data.clienteId } }),
      prisma.equipoReparacion.findUnique({ where: { id: primaryEquipo.equipoTipoId } }),
    ])

    if (!cliente) throw new ServerActionError('addOrdenReparacion', 'POST', 404, 'Cliente no encontrado')

    const resultado = await prisma.$transaction(async (tx: any) => {
      const nuevaOrden = await tx.ordenReparacion.create({
        data: {
          tenantId,
          clienteId: data.clienteId,
          equipoTipoId: primaryEquipo.equipoTipoId,
          marca: primaryEquipo.marca,
          modelo: primaryEquipo.modelo || null,
          numeroSerie: primaryEquipo.numeroSerie || null,
          contrasena: primaryEquipo.contrasena || null,
          accesorios: primaryEquipo.accesorios || null,
          problemaReportado: primaryEquipo.problemaReportado,
          prioridad: (data as any).prioridad || 'NORMAL',
          esGarantia: (data as any).esGarantia || false,
          estado: 'RECIBIDO',
          moneda: 'USD',
          tecnicoId: (data as any).tecnicoId || null,
          fotos: (data as any).fotos || [],
          equipos: {
            create: equiposInput.map((equipo: any) => ({
              equipoTipoId: equipo.equipoTipoId,
              marca: equipo.marca,
              modelo: equipo.modelo || null,
              numeroSerie: equipo.numeroSerie || null,
              contrasena: equipo.contrasena || null,
              accesorios: equipo.accesorios || null,
              problemaReportado: equipo.problemaReportado,
              fotos: equipo.fotos ?? [],
            })),
          },
        },
      })

      const equipoInfo = `${equipoTipo?.nombre || 'Equipo'} ${primaryEquipo.marca}${primaryEquipo.modelo ? ` ${primaryEquipo.modelo}` : ''}`
      const fotosTotales = [
        ...((data as any).fotos || []),
        ...equiposInput.flatMap((e: any) => e.fotos || []),
      ]

      const recibo = await tx.reciboOrdenReparacion.create({
        data: {
          ordenId: nuevaOrden.id,
          clienteNombre: cliente.nombre,
          equipoInfo,
          problema: primaryEquipo.problemaReportado,
          estadoInicial: 'RECIBIDO',
          fotosIniciales: fotosTotales,
          observaciones: (data as any).observaciones || null,
        },
      })

      return { orden: nuevaOrden, recibo }
    })

    return { success: true, ...resultado, message: 'Orden creada exitosamente. Recibo generado.' }
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    throw new ServerActionError('addOrdenReparacion', 'POST', 500, error instanceof Error ? error.message : 'Error al crear orden')
  }
}

export async function updateOrdenReparacion(
  id: string,
  data: any
): Promise<OrdenReparacion> {
  await getAuthenticatedContext()

  const { items, materiales, ...generalData } = data

  try {
    await prisma.$transaction(async (tx: any) => {
      const ordenActual = await tx.ordenReparacion.update({
        where: { id },
        data: generalData,
      })

      if (items) {
        if (items.length > 0) {
          const ordenEquipoIds = items.filter((item: any) => item.ordenEquipoId).map((item: any) => item.ordenEquipoId)
          if (ordenEquipoIds.length > 0) {
            const equiposExistentes = await tx.ordenReparacionEquipo.findMany({
              where: { id: { in: ordenEquipoIds }, ordenId: id },
              select: { id: true },
            })
            const existentesSet = new Set(equiposExistentes.map((e: { id: string }) => e.id))
            const invalidos = ordenEquipoIds.filter((eid: string) => !existentesSet.has(eid))
            if (invalidos.length > 0) {
              throw new Error(`Los siguientes equipos no existen en la orden: ${invalidos.join(', ')}`)
            }
          }

          const piezaIds = items.filter((item: any) => item.piezaId).map((item: any) => item.piezaId)
          if (piezaIds.length > 0) {
            const piezasExistentes = await tx.piezaReparacion.findMany({
              where: { id: { in: piezaIds } },
              select: { id: true },
            })
            const existentesSet = new Set(piezasExistentes.map((p: { id: string }) => p.id))
            const invalidos = piezaIds.filter((id: string) => !existentesSet.has(id))
            if (invalidos.length > 0) {
              throw new Error(`Las siguientes piezas no existen en el catálogo: ${invalidos.join(', ')}`)
            }
  }
}

export async function facturarOrdenReparacion(id: string, body: {
  puntoDeVentaId?: string; tipoTarjeta?: string; fechaVencimiento?: string;
  seriePrefijo?: string; cuentaBancariaId?: string; metodoPago?: string;
  terminosPago?: string; tipoVencimiento?: string; tasaCambio?: number; moneda?: string;
}) {
  const ctx = await getAuthenticatedContext()

  const orden = await prisma.ordenReparacion.findUnique({
    where: { id },
    include: { cliente: true, equipos: { include: { equipoTipo: true } } },
  })
  if (!orden) throw new ServerActionError('facturarOrdenReparacion', 'GET', 404, 'Orden no encontrada')
  if (orden.ventaId) throw new ServerActionError('facturarOrdenReparacion', 'POST', 400, 'Esta orden ya ha sido facturada')
  if (orden.estado !== 'TERMINADO' && orden.estado !== 'ENTREGADO') {
    throw new ServerActionError('facturarOrdenReparacion', 'POST', 400, 'Solo se pueden facturar órdenes terminadas o entregadas')
  }

  let puntoDeVentaId = body.puntoDeVentaId
  if (!puntoDeVentaId) {
    const pv = await prisma.puntoDeVenta.findFirst()
    if (!pv) throw new ServerActionError('facturarOrdenReparacion', 'POST', 400, 'Se requiere un Punto de Venta')
    puntoDeVentaId = pv.pvId
  }

  let fechaVencimiento = body.fechaVencimiento
  if (body.tipoVencimiento === 'PLAZO_30') {
    const fecha = new Date(); fecha.setDate(fecha.getDate() + 30)
    fechaVencimiento = fecha.toISOString()
  }

  const monedaOrden = (orden.moneda || 'USD').toUpperCase()
  const monedaFactura = (body.moneda || 'USD').toUpperCase()
  const tasa = body.tasaCambio || 1
  const subtotalOrigen = orden.subtotal ? Number(orden.subtotal) : Number(orden.total)
  const descuentoOrigen = orden.descuento ? Number(orden.descuento) : 0
  const totalOrigen = Number(orden.total)
  let factor = 1
  if (monedaOrden === 'USD' && monedaFactura === 'CUP') factor = tasa
  else if (monedaOrden === 'CUP' && monedaFactura === 'USD') factor = 1 / tasa
  const subtotal = subtotalOrigen * factor
  const descuento = descuentoOrigen * factor
  const total = totalOrigen * factor
  const prefijo = body.seriePrefijo || 'sv'

  const result = await prisma.$transaction(async (tx: any) => {
    let serie = await tx.serieFacturacion.findUnique({ where: { prefijo } })
    if (!serie) {
      serie = await tx.serieFacturacion.create({
        data: { prefijo, descripcion: 'Serie para Servicios de Reparación', consecutivo: 1 },
      })
    }
    const updatedSerie = await tx.serieFacturacion.update({
      where: { serieId: serie.serieId },
      data: { consecutivo: { increment: 1 } },
    })
    const numeroActual = updatedSerie.consecutivo - 1
    const numeroFactura = `${prefijo}-${numeroActual}`
    const equipos = orden.equipos ?? []
    const equipoLabel = equipos.length > 1
      ? `Orden multiple (${equipos.length} equipos)`
      : `${orden.marca} ${orden.modelo || ''}`
    const venta = await tx.venta.create({
      data: {
        clienteId: orden.clienteId, puntoDeVentaId, total, cantidad: 1,
        observaciones: `Facturación de Orden de Reparación #${orden.numeroOrden} - ${equipoLabel}`,
        esVentaUnica: true, ordenReparacion: { connect: { id: orden.id } },
      },
    })
    const factura = await tx.factura.create({
      data: {
        serieId: serie.serieId, numeroConsecutivo: numeroActual, numeroFactura,
        tipoDocumento: 'FACTURA', ventaId: venta.ventaId, clienteId: orden.clienteId,
        subtotal, descuento, cargoTransporte: 0, total,
        tasaCambio: monedaOrden !== monedaFactura ? tasa : null,
        observaciones: venta.observaciones, tipoTarjeta: body.tipoTarjeta || null,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
        metodoPago: body.metodoPago || null, terminosPago: body.terminosPago || null,
        cuentaBancariaId: body.cuentaBancariaId || null,
        estado: 'PENDIENTE', creadoPor: ctx.userId || 'sistema',
      },
    })
    await applyFacturacionCobroWorkflow(tx, {
      ventaId: venta.ventaId, facturaId: factura.idFactura,
      clienteId: orden.clienteId, montoTotal: total,
      usuarioId: ctx.userId || 'sistema', observaciones: venta.observaciones,
      tipoVencimiento: body.tipoVencimiento === 'PLAZO_30' ? 'plazo'
        : body.tipoVencimiento === 'CONTRA_ENTREGA' ? 'contra_pago' : 'fecha',
      fechaVencimiento, cuentaBancariaId: body.cuentaBancariaId,
    })
    if (orden.estado !== 'ENTREGADO') {
      await tx.ordenReparacion.update({ where: { id: orden.id }, data: { estado: 'ENTREGADO' } })
    }
    return { venta, factura }
  })
  return result
}

export async function getTecnicosStats(params?: { startDate?: string; endDate?: string }) {
  const ctx = await getAuthenticatedContext()
  const dateFilter: any = {}
  if (params?.startDate && params?.endDate) {
    dateFilter.createdAt = { gte: new Date(params.startDate), lte: new Date(params.endDate) }
  }
  const tecnicos = await prisma.empleado.findMany({
    where: { OR: [{ cargo: { contains: 'Técnico' } }, { ordenesAsignadas: { some: {} } }] },
    include: {
      ordenesAsignadas: {
        where: dateFilter,
        select: { id: true, estado: true, total: true, items: { select: { precio: true } } },
      },
    },
  })
  return tecnicos.map((tecnico: any) => {
    const totalOrdenes = tecnico.ordenesAsignadas.length
    const ordenesCompletadas = tecnico.ordenesAsignadas.filter((o: any) =>
      o.estado === 'TERMINADO' || o.estado === 'ENTREGADO'
    ).length
    const totalGenerado = tecnico.ordenesAsignadas.reduce((acc: number, curr: any) => acc + Number(curr.total), 0)
    const manoDeObraGenerada = tecnico.ordenesAsignadas.reduce((acc: number, curr: any) => {
      return acc + curr.items.reduce((sum: number, item: any) => sum + Number(item.precio), 0)
    }, 0)
    return {
      id: tecnico.empleadoId, nombre: `${tecnico.nombre} ${tecnico.apellido}`,
      cargo: tecnico.cargo, totalOrdenes, ordenesCompletadas,
      tasaCompletado: totalOrdenes > 0 ? (ordenesCompletadas / totalOrdenes) * 100 : 0,
      totalGenerado, manoDeObraGenerada, comisionEstimada: manoDeObraGenerada * 0.3,
    }
  })
}

        await tx.ordenReparacionItem.deleteMany({ where: { ordenId: id } })
        if (items.length > 0) {
          await tx.ordenReparacionItem.createMany({
            data: items.map((item: any) => ({
              ordenId: id,
              ordenEquipoId: item.ordenEquipoId || null,
              piezaId: item.piezaId || null,
              defectacionId: item.defectacionId || null,
              precio: item.precio,
              observaciones: item.observaciones || null,
              tecnicoId: item.tecnicoId || null,
            })),
          })
        }
      }

      if (materiales) {
        await tx.ordenReparacionMaterial.deleteMany({ where: { ordenId: id } })
        if (materiales.length > 0) {
          const productoIds = materiales.filter((mat: any) => mat.productoId).map((mat: any) => mat.productoId)
          if (productoIds.length > 0) {
            const productosExistentes = await tx.producto.findMany({
              where: { id: { in: productoIds } },
              select: { id: true },
            })
            const existentesSet = new Set(productosExistentes.map((p: { id: string }) => p.id))
            const invalidos = productoIds.filter((id: string) => !existentesSet.has(id))
            if (invalidos.length > 0) {
              throw new Error(`Los siguientes productos no existen en el inventario: ${invalidos.join(', ')}`)
            }
          }

          await tx.ordenReparacionMaterial.createMany({
            data: materiales.map((mat: any) => ({
              ordenId: id,
              productoId: mat.productoId,
              cantidad: mat.cantidad,
              precioUnitario: mat.precioUnitario,
              total: mat.total,
            })),
          })
        }
      }

      const currentItems = await tx.ordenReparacionItem.findMany({ where: { ordenId: id } })
      const currentMaterials = await tx.ordenReparacionMaterial.findMany({ where: { ordenId: id } })
      const totalItems = currentItems.reduce((sum: number, item: { precio: number }) => sum + Number(item.precio), 0)
      const totalMaterials = currentMaterials.reduce((sum: number, mat: { total: number }) => sum + Number(mat.total), 0)
      const subtotal = totalItems + totalMaterials
      let descuento = generalData.descuento !== undefined ? Number(generalData.descuento) : (ordenActual?.descuento ? Number(ordenActual.descuento) : 0)
      if (ordenActual?.esGarantia) descuento = subtotal
      const total = subtotal - descuento

      await tx.ordenReparacion.update({
        where: { id },
        data: { subtotal, descuento, moneda: (items || materiales) ? 'USD' : undefined },
      })
    })

    return await prisma.ordenReparacion.findUnique({
      where: { id },
      include: { items: true, materiales: true },
    }) as any
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    throw new ServerActionError('updateOrdenReparacion', 'PUT', 500, error instanceof Error ? error.message : 'Error al actualizar orden')
  }
}

export async function deleteOrdenReparacion(id: string): Promise<{ success: boolean; id: string }> {
  const ctx = await getAuthenticatedContext()

  if (ctx.tenantRole !== 'admin') {
    throw new ServerActionError('deleteOrdenReparacion', 'DELETE', 403, 'Solo administradores pueden eliminar órdenes')
  }

  try {
    await prisma.ordenReparacion.delete({ where: { id } })
    return { success: true, id }
  } catch (error) {
    throw new ServerActionError('deleteOrdenReparacion', 'DELETE', 500, error instanceof Error ? error.message : 'Error al eliminar orden')
  }
}
