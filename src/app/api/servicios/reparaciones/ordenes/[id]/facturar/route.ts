import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthPost } from "@/lib/auth-middleware"
import { applyFacturacionCobroWorkflow } from "@/lib/services/facturacion-ventas-workflow"

export const POST = withAuthPost(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user: any) => {
  try {
    const { id } = await params
    const body = await request.json()
    const { 
      puntoDeVentaId, 
      tipoTarjeta, 
      fechaVencimiento: fechaVencimientoBody, 
      seriePrefijo, 
      cuentaBancariaId, 
      metodoPago, 
      terminosPago, 
      tipoVencimiento,
      tasaCambio,
      moneda 
    } = body

    let fechaVencimiento = fechaVencimientoBody;
    if (tipoVencimiento === 'PLAZO_30') {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + 30);
      fechaVencimiento = fecha.toISOString();
    }

    if (!puntoDeVentaId) {
      const pv = await prisma.puntoDeVenta.findFirst()
      if (!pv) {
        return NextResponse.json({ error: "Se requiere un Punto de Venta y no hay ninguno registrado" }, { status: 400 })
      }
      body.puntoDeVentaId = pv.pvId
    }

    const orden = await prisma.ordenReparacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        equipos: {
          include: {
            equipoTipo: true
          }
        }
      }
    })

    if (!orden) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 })
    }

    if (orden.ventaId) {
      return NextResponse.json({ error: "Esta orden ya ha sido facturada" }, { status: 400 })
    }

    if (orden.estado !== 'TERMINADO' && orden.estado !== 'ENTREGADO') {
      return NextResponse.json({ error: "Solo se pueden facturar órdenes terminadas o entregadas" }, { status: 400 })
    }

    // Determinar monedas y tasa de cambio
    const monedaOrden = (orden.moneda || 'USD').toUpperCase()
    const monedaFactura = moneda?.toUpperCase() || 'USD'
    const tasa = tasaCambio ? Number(tasaCambio) : 1
    
    // Obtener montos originales de la orden
    const subtotalOrigen = orden.subtotal ? Number(orden.subtotal) : Number(orden.total)
    const descuentoOrigen = orden.descuento ? Number(orden.descuento) : 0
    const totalOrigen = Number(orden.total)

    // Calcular factor de conversión
    let factor = 1
    if (monedaOrden === 'USD' && monedaFactura === 'CUP') {
      // USD -> CUP: multiplicar por tasa
      factor = tasa
    } else if (monedaOrden === 'CUP' && monedaFactura === 'USD') {
      // CUP -> USD: dividir por tasa
      factor = 1 / tasa
    }
    // Si son iguales, factor = 1 (sin conversión)

    // Aplicar conversión
    const subtotal = subtotalOrigen * factor
    const descuento = descuentoOrigen * factor
    const total = totalOrigen * factor

    const prefijo = seriePrefijo || "sv"

    const result = await prisma.$transaction(async (tx: any) => {
      let serie = await tx.serieFacturacion.findUnique({ where: { prefijo } })
      
      if (!serie) {
        serie = await tx.serieFacturacion.create({
          data: {
             prefijo,
             descripcion: "Serie para Servicios de Reparación",
             consecutivo: 1
          }
        })
      }

      const updatedSerie = await tx.serieFacturacion.update({
        where: { serieId: serie.serieId },
        data: { consecutivo: { increment: 1 } }
      })
      
      const numeroActual = updatedSerie.consecutivo - 1
      const numeroFactura = `${prefijo}-${numeroActual}`

      const equipos = orden.equipos ?? []
      const equipoLabel = equipos.length > 1
        ? `Orden multiple (${equipos.length} equipos)`
        : `${orden.marca} ${orden.modelo || ''}`

      const venta = await tx.venta.create({
        data: {
          clienteId: orden.clienteId,
          puntoDeVentaId: body.puntoDeVentaId,
          total: total,
          cantidad: 1,
          observaciones: `Facturación de Orden de Reparación #${orden.numeroOrden} - ${equipoLabel}`,
          esVentaUnica: true,
          ordenReparacion: {
            connect: { id: orden.id }
          }
        }
      })

      const factura = await tx.factura.create({
        data: {
          serieId: serie.serieId,
          numeroConsecutivo: numeroActual,
          numeroFactura: numeroFactura,
          tipoDocumento: 'FACTURA',
          ventaId: venta.ventaId,
          clienteId: orden.clienteId,
          subtotal: subtotal,
          descuento: descuento,
          cargoTransporte: 0,
          total: total,
          tasaCambio: monedaOrden !== monedaFactura ? tasa : null,
          observaciones: venta.observaciones,
          tipoTarjeta: tipoTarjeta || null,
          fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
          metodoPago: metodoPago || null,
          terminosPago: terminosPago || null,
          cuentaBancariaId: cuentaBancariaId || null,
          estado: 'PENDIENTE',
          creadoPor: user?.userId || 'sistema',
        }
      })

      await applyFacturacionCobroWorkflow(tx, {
        ventaId: venta.ventaId,
        facturaId: factura.idFactura,
        clienteId: orden.clienteId,
        montoTotal: total,
        usuarioId: user?.userId || 'sistema',
        observaciones: venta.observaciones,
        tipoVencimiento: tipoVencimiento === 'PLAZO_30' ? 'plazo' : tipoVencimiento === 'CONTRA_ENTREGA' ? 'contra_pago' : 'fecha',
        fechaVencimiento: fechaVencimiento,
        cuentaBancariaId
      })

      if (orden.estado !== 'ENTREGADO') {
        await tx.ordenReparacion.update({
          where: { id: orden.id },
          data: { estado: 'ENTREGADO' }
        })
      }

      return { venta, factura }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error al facturar orden:", error)
    return NextResponse.json({ error: "Error al procesar la facturación" }, { status: 500 })
  }
})
