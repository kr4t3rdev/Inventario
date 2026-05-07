import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAuthGet, withAuthPost, withAuth, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'
import { applyFacturacionCobroWorkflow } from '@/lib/services/facturacion-ventas-workflow'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { numeroALetras } from '@/lib/number-to-words'
import fs from 'fs'
import path from 'path'

const servicioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  precio: z.coerce.number().int().positive('El precio debe ser mayor a 0'),
})

const patchServicioSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().max(500).optional(),
  precio: z.coerce.number().int().nonnegative().optional(),
})

function safeText(text: string | null | undefined) {
  return (text || '').replace(/\s+/g, ' ').trim()
}

function drawText(page: any, text: string, x: number, y: number, font: any, size: number, color?: any) {
  page.drawText(text, { x, y, size, font, color: color ?? rgb(0, 0, 0) })
}

function drawRight(page: any, text: string, rightX: number, y: number, font: any, size: number, color?: any) {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: rightX - width, y, size, font, color: color ?? rgb(0, 0, 0) })
}

function drawCenter(page: any, text: string, centerX: number, y: number, font: any, size: number, color?: any) {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: centerX - width / 2, y, size, font, color: color ?? rgb(0, 0, 0) })
}

function drawRectangle(page: any, x: number, y: number, w: number, h: number, color: any, border: any) {
  page.drawRectangle({
    x, y, width: w, height: h,
    color: color,
    borderColor: border,
    borderWidth: 1,
  })
}

type InvoiceLine = {
  descripcion: string
  cantidad: number
  precioUnitario: number
  total: number
}

function buildLines(orden: any): InvoiceLine[] {
  const lines: InvoiceLine[] = []
  if (orden.items) {
    orden.items.forEach((item: any) => {
      lines.push({
        descripcion: `${item.pieza?.nombre || 'Servicio'} (${item.complejidad})`,
        cantidad: 1,
        precioUnitario: Number(item.precio),
        total: Number(item.precio),
      })
    })
  }
  if (orden.materiales) {
    orden.materiales.forEach((mat: any) => {
      lines.push({
        descripcion: mat.producto?.nombre || 'Material',
        cantidad: Number(mat.cantidad),
        precioUnitario: Number(mat.precioUnitario),
        total: Number(mat.total),
      })
    })
  }
  return lines
}

async function generateCotizacionPDF(
  page: any,
  fontRegular: any,
  fontBold: any,
  fontItalic: any,
  logoImage: any,
  payload: any,
) {
  const { width, height } = page.getSize()
  const margin = 30
  const contentWidth = width - margin * 2
  const empresa = payload.miEmpresa
  const orden = payload.orden
  const lines: InvoiceLine[] = payload.lines
  const blueColor = rgb(0, 0, 0.8)
  const redColor = rgb(1, 0, 0)
  const lightBlueColor = rgb(0.85, 0.92, 1)
  const borderColor = rgb(0, 0, 0)
  let y = height - margin
  const headerHeight = 80
  const logoBoxWidth = 120
  const logoWidth = 100
  const logoHeight = 60
  if (logoImage) {
    const dims = logoImage.scaleToFit(logoWidth, logoHeight)
    page.drawImage(logoImage, {
      x: margin + (logoBoxWidth - dims.width) / 2,
      y: y - headerHeight + 15,
      width: dims.width,
      height: dims.height,
    })
  } else {
    drawCenter(page, safeText(empresa.nombre), margin + logoBoxWidth / 2, y - headerHeight + 40, fontBold, 14, blueColor)
  }
  const headerBoxX = margin + logoBoxWidth
  const headerBoxWidth = contentWidth - logoBoxWidth
  drawCenter(page, 'COTIZACIÓN', headerBoxX + headerBoxWidth / 2, y - 30, fontBold, 36)
  drawCenter(page, 'Servicio Técnico y Reparaciones', headerBoxX + headerBoxWidth / 2, y - 45, fontItalic, 10, blueColor)
  page.drawLine({
    start: { x: headerBoxX, y: y - 50 },
    end: { x: margin + contentWidth, y: y - 50 },
    thickness: 1,
    color: borderColor,
  })
  const addrY = y - 65
  const dateBoxX = margin + contentWidth - 120
  const addressCenterX = headerBoxX + (dateBoxX - headerBoxX) / 2
  if (empresa.direccion) drawCenter(page, safeText(empresa.direccion), addressCenterX, addrY, fontRegular, 9)
  if (empresa.telefono) drawCenter(page, `Tel: ${safeText(empresa.telefono)}`, addressCenterX, addrY - 12, fontRegular, 9)
  page.drawLine({
    start: { x: dateBoxX, y: y - 50 },
    end: { x: dateBoxX, y: y - 90 },
    thickness: 1,
    color: borderColor,
  })
  drawText(page, 'Cotización:', dateBoxX + 10, addrY, fontRegular, 10)
  drawRight(page, String(orden.numeroOrden), margin + contentWidth - 10, addrY, fontBold, 10)
  drawText(page, 'Fecha:', dateBoxX + 10, addrY - 15, fontRegular, 10)
  drawRight(page, new Date().toLocaleDateString('es-ES'), margin + contentWidth - 10, addrY - 15, fontBold, 10)
  page.drawRectangle({
    x: margin, y: y - 90, width: contentWidth, height: 90,
    borderWidth: 1, borderColor: borderColor,
  })
  page.drawLine({
    start: { x: margin + logoBoxWidth, y: y },
    end: { x: margin + logoBoxWidth, y: y - 90 },
    thickness: 1, color: borderColor,
  })
  y -= 100
  const col1X = margin
  const col2X = margin + contentWidth / 2 + 20
  const infoY = y
  const cliente = orden.cliente || {}
  let currentY = infoY
  drawText(page, 'Cliente:', col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.nombre), col1X + 80, currentY, fontBold, 10)
  currentY -= 15
  drawText(page, 'Dirección:', col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.direccion), col1X + 80, currentY, fontRegular, 10)
  currentY -= 15
  drawText(page, 'Teléfono:', col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.telefono), col1X + 80, currentY, fontRegular, 10)
  currentY -= 15
  const yLeft = currentY
  currentY = infoY
  drawText(page, 'Equipo:', col2X, currentY, fontRegular, 10)
  drawRight(page, `${safeText(orden.equipoTipo?.nombre)} - ${safeText(orden.marca)}`, margin + contentWidth, currentY, fontBold, 10)
  currentY -= 15
  drawText(page, 'Modelo:', col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(orden.modelo), margin + contentWidth, currentY, fontRegular, 10)
  currentY -= 15
  drawText(page, 'Serie:', col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(orden.numeroSerie), margin + contentWidth, currentY, fontRegular, 10)
  currentY -= 15
  y = Math.min(yLeft, currentY) - 30
  const tableTopY = y
  const headerHeightTable = 20
  const colCodeX = margin
  const colDescX = margin + 55
  const colQtyX = margin + 310
  const colPriceX = margin + 370
  const colTotalX = margin + 450
  const tableWidth = contentWidth
  page.drawRectangle({
    x: margin, y: tableTopY - headerHeightTable + 5,
    width: tableWidth, height: headerHeightTable,
    color: lightBlueColor, borderColor: borderColor, borderWidth: 1,
  })
  const headerY = tableTopY - headerHeightTable + 11
  drawText(page, 'TIPO', colCodeX + 5, headerY, fontBold, 9)
  drawText(page, 'DESCRIPCIÓN', colDescX + 5, headerY, fontBold, 9)
  drawCenter(page, 'CANTIDAD', colQtyX + 25, headerY, fontBold, 9)
  drawCenter(page, 'PRECIO', colPriceX + 40, headerY, fontBold, 9)
  drawCenter(page, 'IMPORTE', colTotalX + 40, headerY, fontBold, 9)
  y -= headerHeightTable
  const rowHeight = 18
  for (const line of lines) {
    const textY = y - 4
    drawText(page, 'ITEM', colCodeX + 5, textY, fontRegular, 9)
    drawText(page, safeText(line.descripcion).slice(0, 55), colDescX + 5, textY, fontRegular, 9)
    drawCenter(page, String(line.cantidad), colQtyX + 25, textY, fontRegular, 9)
    drawRight(page, line.precioUnitario.toFixed(2), colPriceX + 70, textY, fontRegular, 9)
    drawRight(page, line.total.toFixed(2), colTotalX + 80, textY, fontRegular, 9)
    y -= rowHeight
  }
  const minTableBottomY = 280
  const actualTableBottomY = Math.min(y, minTableBottomY)
  page.drawRectangle({
    x: margin, y: actualTableBottomY,
    width: tableWidth, height: tableTopY - actualTableBottomY - headerHeightTable + 5,
    borderWidth: 1, borderColor: borderColor, color: undefined,
  })
  const verticalLinesX = [colDescX, colQtyX, colPriceX, colTotalX]
  verticalLinesX.forEach((x) => {
    page.drawLine({
      start: { x: x, y: tableTopY - headerHeightTable + 5 },
      end: { x: x, y: actualTableBottomY },
      thickness: 1, color: borderColor,
    })
  })
  y = actualTableBottomY
  const obsWidth = contentWidth * 0.65
  const totalsWidth = contentWidth * 0.35
  const obsHeight = 60
  page.drawRectangle({
    x: margin, y: y - obsHeight, width: obsWidth, height: obsHeight,
    borderWidth: 1, borderColor: borderColor,
  })
  drawText(page, 'OBSERVACIONES:', margin + 5, y - 12, fontRegular, 9)
  if (orden.problemaReportado) drawText(page, `Problema: ${safeText(orden.problemaReportado).slice(0, 80)}...`, margin + 5, y - 24, fontRegular, 9)
  if (orden.diagnosticoTecnico) drawText(page, `Diagnóstico: ${safeText(orden.diagnosticoTecnico).slice(0, 80)}...`, margin + 5, y - 36, fontRegular, 9)
  const importeLetras = numeroALetras(payload.total, { plural: '', singular: '', centPlural: '', centSingular: '' })
  drawText(page, 'TOTAL EN LETRAS:', margin + 5, y - obsHeight + 10, fontRegular, 8)
  drawText(page, safeText(importeLetras), margin + 100, y - obsHeight + 10, fontBold, 8)
  page.drawRectangle({
    x: margin + obsWidth, y: y - obsHeight + 20,
    width: totalsWidth, height: obsHeight - 20,
    color: lightBlueColor, borderColor: borderColor, borderWidth: 1,
  })
  let totalY = y - 15
  drawRight(page, 'SUBTOTAL', margin + obsWidth + 110, totalY, fontRegular, 9)
  drawRight(page, payload.subtotal.toFixed(2), margin + contentWidth - 10, totalY, fontRegular, 9)
  if (payload.descuento > 0) {
    totalY -= 15
    drawRight(page, 'DESCUENTO', margin + obsWidth + 110, totalY, fontRegular, 9)
    drawRight(page, payload.descuento.toFixed(2), margin + contentWidth - 10, totalY, fontRegular, 9)
  }
  page.drawRectangle({
    x: margin + obsWidth, y: y - obsHeight,
    width: totalsWidth, height: 20,
    borderColor: borderColor, borderWidth: 1,
  })
  totalY = y - obsHeight + 6
  drawRight(page, 'TOTAL', margin + obsWidth + 110, totalY, fontBold, 10)
  drawRight(page, payload.total.toFixed(2), margin + contentWidth - 10, totalY, fontBold, 10, redColor)
  y -= (obsHeight + 20)
  const footerY = 50
  page.drawLine({ start: { x: margin, y: footerY + 30 }, end: { x: margin + contentWidth, y: footerY + 30 }, thickness: 1, color: borderColor })
  drawText(page, 'Esta cotización es válida por 15 días.', margin, footerY + 15, fontRegular, 9)
  const emailY = 20
  drawText(page, `Emitido por: ${safeText(empresa.nombre)}`, margin, emailY, fontRegular, 9)
}

async function generateOrdenPDF(
  page: any,
  fontRegular: any,
  fontBold: any,
  fontItalic: any,
  logoImage: any,
  payload: any,
) {
  const { width, height } = page.getSize()
  const margin = 30
  const contentWidth = width - margin * 2
  const empresa = payload.miEmpresa
  const orden = payload.orden
  const blueColor = rgb(0, 0, 0.8)
  const redColor = rgb(1, 0, 0)
  const lightBlueColor = rgb(0.85, 0.92, 1)
  const borderColor = rgb(0, 0, 0)
  let y = height - margin
  const headerHeight = 80
  const logoBoxWidth = 120
  const logoWidth = 100
  const logoHeight = 60
  if (logoImage) {
    const dims = logoImage.scaleToFit(logoWidth, logoHeight)
    page.drawImage(logoImage, {
      x: margin + (logoBoxWidth - dims.width) / 2,
      y: y - headerHeight + 15,
      width: dims.width,
      height: dims.height,
    })
  } else {
    drawCenter(page, safeText(empresa.nombre), margin + logoBoxWidth / 2, y - headerHeight + 40, fontBold, 14, blueColor)
  }
  const headerBoxX = margin + logoBoxWidth
  const headerBoxWidth = contentWidth - logoBoxWidth
  drawCenter(page, 'TICKET DE SERVICIO TÉCNICO', headerBoxX + headerBoxWidth / 2, y - 30, fontBold, 24)
  drawCenter(page, 'Orden de Reparación', headerBoxX + headerBoxWidth / 2, y - 50, fontItalic, 12, blueColor)
  page.drawLine({
    start: { x: headerBoxX, y: y - 55 },
    end: { x: margin + contentWidth, y: y - 55 },
    thickness: 1, color: borderColor,
  })
  const addrY = y - 70
  const dateBoxX = margin + contentWidth - 120
  const addressCenterX = headerBoxX + (dateBoxX - headerBoxX) / 2
  if (empresa.direccion) drawCenter(page, safeText(empresa.direccion), addressCenterX, addrY, fontRegular, 9)
  if (empresa.telefono) drawCenter(page, `Tel: ${safeText(empresa.telefono)}`, addressCenterX, addrY - 12, fontRegular, 9)
  page.drawLine({
    start: { x: dateBoxX, y: y - 55 },
    end: { x: dateBoxX, y: y - 90 },
    thickness: 1, color: borderColor,
  })
  drawText(page, 'Orden No.:', dateBoxX + 10, addrY, fontRegular, 10)
  drawRight(page, `${orden.numeroOrden}`, margin + contentWidth - 10, addrY, fontBold, 12, redColor)
  drawText(page, 'Fecha:', dateBoxX + 10, addrY - 15, fontRegular, 10)
  drawRight(page, new Date(orden.fechaRecepcion).toLocaleDateString('es-ES'), margin + contentWidth - 10, addrY - 15, fontBold, 10)
  page.drawRectangle({
    x: margin, y: y - 90, width: contentWidth, height: 90,
    borderWidth: 1, borderColor: borderColor,
  })
  page.drawLine({
    start: { x: margin + logoBoxWidth, y: y },
    end: { x: margin + logoBoxWidth, y: y - 90 },
    thickness: 1, color: borderColor,
  })
  y -= 110
  drawText(page, 'DATOS DEL CLIENTE', margin, y, fontBold, 11, blueColor)
  page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: margin + 120, y: y - 2 }, thickness: 1, color: blueColor })
  y -= 20
  const cliente = orden.cliente || {}
  drawText(page, 'Cliente:', margin, y, fontBold, 10)
  drawText(page, safeText(cliente.nombre), margin + 80, y, fontRegular, 10)
  drawText(page, 'Teléfono:', margin + 300, y, fontBold, 10)
  drawText(page, safeText(cliente.telefono), margin + 360, y, fontRegular, 10)
  y -= 15
  drawText(page, 'Dirección:', margin, y, fontBold, 10)
  drawText(page, safeText(cliente.direccion), margin + 80, y, fontRegular, 10)
  y -= 25
  drawText(page, 'DATOS DEL EQUIPO', margin, y, fontBold, 11, blueColor)
  page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: margin + 120, y: y - 2 }, thickness: 1, color: blueColor })
  y -= 20
  const boxHeight = 100
  page.drawRectangle({
    x: margin, y: y - boxHeight, width: contentWidth, height: boxHeight,
    borderWidth: 1, borderColor: borderColor, color: rgb(0.98, 0.98, 0.98),
  })
  let eqY = y - 15
  drawText(page, 'Tipo:', margin + 10, eqY, fontBold, 10)
  drawText(page, safeText(orden.equipoTipo?.nombre), margin + 80, eqY, fontRegular, 10)
  drawText(page, 'Marca:', margin + 250, eqY, fontBold, 10)
  drawText(page, safeText(orden.marca), margin + 300, eqY, fontRegular, 10)
  drawText(page, 'Modelo:', margin + 400, eqY, fontBold, 10)
  drawText(page, safeText(orden.modelo), margin + 450, eqY, fontRegular, 10)
  eqY -= 20
  drawText(page, 'No. Serie:', margin + 10, eqY, fontBold, 10)
  drawText(page, safeText(orden.numeroSerie), margin + 80, eqY, fontRegular, 10)
  drawText(page, 'Accesorios:', margin + 250, eqY, fontBold, 10)
  drawText(page, safeText(orden.accesorios), margin + 325, eqY, fontRegular, 10)
  eqY -= 20
  drawText(page, 'Problema:', margin + 10, eqY, fontBold, 10)
  const problema = safeText(orden.problemaReportado)
  drawText(page, problema.substring(0, 90) + (problema.length > 90 ? '...' : ''), margin + 80, eqY, fontRegular, 10)
  if (problema.length > 90) {
    eqY -= 12
    drawText(page, problema.substring(90, 180), margin + 80, eqY, fontRegular, 10)
  }
  y -= (boxHeight + 25)
  if (orden.items.length > 0 || orden.total > 0) {
    drawText(page, 'DETALLES DE SERVICIO Y COSTOS', margin, y, fontBold, 11, blueColor)
    page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: margin + 180, y: y - 2 }, thickness: 1, color: blueColor })
    y -= 20
    drawRectangle(page, margin, y - 20, contentWidth, 20, lightBlueColor, borderColor)
    drawText(page, 'DESCRIPCIÓN', margin + 10, y - 14, fontBold, 9)
    drawRight(page, 'PRECIO', margin + contentWidth - 10, y - 14, fontBold, 9)
    y -= 20
    let subtotal = 0
    for (const item of orden.items) {
      const desc = `${item.pieza?.nombre || 'Servicio'} (${item.complejidad})`
      drawText(page, desc, margin + 10, y - 14, fontRegular, 9)
      drawRight(page, Number(item.precio).toFixed(2), margin + contentWidth - 10, y - 14, fontRegular, 9)
      y -= 18
      subtotal += Number(item.precio)
    }
    for (const mat of orden.materiales) {
      const desc = `${mat.producto?.nombre || 'Material'} (x${mat.cantidad})`
      drawText(page, desc, margin + 10, y - 14, fontRegular, 9)
      drawRight(page, Number(mat.costo).toFixed(2), margin + contentWidth - 10, y - 14, fontRegular, 9)
      y -= 18
      subtotal += Number(mat.costo)
    }
    y -= 10
    drawRight(page, `TOTAL: ${orden.total}`, margin + contentWidth - 10, y, fontBold, 12)
    y -= 30
  } else {
    y -= 20
  }
  const terminosY = 120
  page.drawLine({ start: { x: margin, y: terminosY }, end: { x: margin + contentWidth, y: terminosY }, thickness: 1, color: borderColor })
  drawText(page, 'TÉRMINOS Y CONDICIONES:', margin, terminosY - 15, fontBold, 8)
  drawText(page, '1. La empresa no se hace responsable por equipos no recogidos después de 30 días de notificado.', margin, terminosY - 25, fontRegular, 7)
  drawText(page, '2. La garantía solo cubre la mano de obra y piezas reemplazadas por 30 días.', margin, terminosY - 35, fontRegular, 7)
  drawText(page, '3. Es obligatorio presentar este ticket para retirar el equipo.', margin, terminosY - 45, fontRegular, 7)
  const sigY = 50
  drawText(page, 'Recibido por (Taller):', margin + 50, sigY + 10, fontRegular, 8)
  page.drawLine({ start: { x: margin + 30, y: sigY }, end: { x: margin + 180, y: sigY }, thickness: 1 })
  drawText(page, 'Firma del Cliente (Conforme):', margin + 350, sigY + 10, fontRegular, 8)
  page.drawLine({ start: { x: margin + 330, y: sigY }, end: { x: margin + 480, y: sigY }, thickness: 1 })
}

export const getServiciosHandler = withAuthGet(async (request: NextRequest, _context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user)
    const Servicio = await prisma.servicios.findMany({
      where: { tenantId },
      orderBy: { precio: 'desc' },
    })
    return NextResponse.json(Servicio)
  } catch (error) {
    console.error('Error al obtener Servicio:', error)
    return NextResponse.json({ error: 'Error al obtener Servicio' }, { status: 500 })
  }
})

export const createServicioHandler = withAuthPost(async (request: NextRequest, _context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user)
    const body = await request.json()
    const data = servicioSchema.parse(body)
    if (user.role === 'dependiente') {
      return NextResponse.json({
        error: 'Acceso restringido',
        message: 'Los dependientes no pueden crear servicios',
      }, { status: 403 })
    }
    const servicio = await prisma.servicios.create({
      data: {
        tenantId,
        nombre: data.nombre,
        descripcion: data.descripcion,
        precio: data.precio,
      },
    })
    return NextResponse.json(servicio)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos de entrada inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error al crear el Servicio:', error)
    return NextResponse.json({ error: 'Error al crear el Servicio' }, { status: 500 })
  }
})

export const getServicioByIdHandler = withAuth(async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params
    const servicio = await prisma.servicios.findUnique({ where: { servicioId: id } })
    if (!servicio) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }
    return NextResponse.json(servicio)
  } catch (error) {
    console.error('Error al obtener Servicio:', error)
    return NextResponse.json({ error: 'Error al obtener Servicio' }, { status: 500 })
  }
})

export const updateServicioHandler = withAuth(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params
    const payload = patchServicioSchema.parse(await request.json())
    const servicioExistente = await prisma.servicios.findUnique({ where: { servicioId: id } })
    if (!servicioExistente) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }
    const data: { nombre?: string; descripcion?: string; precio?: number } = {}
    if (payload.nombre !== undefined) data.nombre = payload.nombre
    if (payload.descripcion !== undefined) data.descripcion = payload.descripcion
    if (payload.precio !== undefined) data.precio = payload.precio
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }
    const servicio = await prisma.servicios.update({ where: { servicioId: id }, data })
    return NextResponse.json(servicio)
  } catch (error) {
    console.error('Error al actualizar el Servicio:', error)
    return NextResponse.json({ error: 'Error al actualizar el Servicio' }, { status: 500 })
  }
})

export const deleteServicioHandler = withAuth(async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params
    const servicioExistente = await prisma.servicios.findUnique({ where: { servicioId: id } })
    if (!servicioExistente) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }
    await prisma.servicios.delete({ where: { servicioId: id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al eliminar el Servicio:', error)
    return NextResponse.json({ error: 'Error al eliminar el Servicio' }, { status: 500 })
  }
})

export const facturarOrdenReparacionHandler = withAuthPost(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user: any) => {
  try {
    const { id } = await params
    const body = await request.json()
    const { puntoDeVentaId, tipoTarjeta, fechaVencimiento: fechaVencimientoBody, seriePrefijo, cuentaBancariaId, metodoPago, terminosPago, tipoVencimiento, tasaCambio, moneda } = body
    let fechaVencimiento = fechaVencimientoBody
    if (tipoVencimiento === 'PLAZO_30') {
      const fecha = new Date()
      fecha.setDate(fecha.getDate() + 30)
      fechaVencimiento = fecha.toISOString()
    }
    if (!puntoDeVentaId) {
      const pv = await prisma.puntoDeVenta.findFirst()
      if (!pv) {
        return NextResponse.json({ error: 'Se requiere un Punto de Venta y no hay ninguno registrado' }, { status: 400 })
      }
      body.puntoDeVentaId = pv.pvId
    }
    const orden = await prisma.ordenReparacion.findUnique({
      where: { id },
      include: { cliente: true, equipos: { include: { equipoTipo: true } } },
    })
    if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    if (orden.ventaId) return NextResponse.json({ error: 'Esta orden ya ha sido facturada' }, { status: 400 })
    if (orden.estado !== 'TERMINADO' && orden.estado !== 'ENTREGADO') {
      return NextResponse.json({ error: 'Solo se pueden facturar órdenes terminadas o entregadas' }, { status: 400 })
    }
    const monedaOrden = (orden.moneda || 'USD').toUpperCase()
    const monedaFactura = moneda?.toUpperCase() || 'USD'
    const tasa = tasaCambio ? Number(tasaCambio) : 1
    const subtotalOrigen = orden.subtotal ? Number(orden.subtotal) : Number(orden.total)
    const descuentoOrigen = orden.descuento ? Number(orden.descuento) : 0
    const totalOrigen = Number(orden.total)
    let factor = 1
    if (monedaOrden === 'USD' && monedaFactura === 'CUP') factor = tasa
    else if (monedaOrden === 'CUP' && monedaFactura === 'USD') factor = 1 / tasa
    const subtotal = subtotalOrigen * factor
    const descuento = descuentoOrigen * factor
    const total = totalOrigen * factor
    const prefijo = seriePrefijo || 'sv'
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
          clienteId: orden.clienteId,
          puntoDeVentaId: body.puntoDeVentaId,
          total,
          cantidad: 1,
          observaciones: `Facturación de Orden de Reparación #${orden.numeroOrden} - ${equipoLabel}`,
          esVentaUnica: true,
          ordenReparacion: { connect: { id: orden.id } },
        },
      })
      const factura = await tx.factura.create({
        data: {
          serieId: serie.serieId, numeroConsecutivo: numeroActual, numeroFactura,
          tipoDocumento: 'FACTURA', ventaId: venta.ventaId, clienteId: orden.clienteId,
          subtotal, descuento, cargoTransporte: 0, total,
          tasaCambio: monedaOrden !== monedaFactura ? tasa : null,
          observaciones: venta.observaciones,
          tipoTarjeta: tipoTarjeta || null,
          fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
          metodoPago: metodoPago || null, terminosPago: terminosPago || null,
          cuentaBancariaId: cuentaBancariaId || null,
          estado: 'PENDIENTE', creadoPor: user?.userId || 'sistema',
        },
      })
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: venta.ventaId, facturaId: factura.idFactura,
        clienteId: orden.clienteId, montoTotal: total,
        usuarioId: user?.userId || 'sistema',
        observaciones: venta.observaciones,
        tipoVencimiento: tipoVencimiento === 'PLAZO_30' ? 'plazo' : tipoVencimiento === 'CONTRA_ENTREGA' ? 'contra_pago' : 'fecha',
        fechaVencimiento, cuentaBancariaId,
      })
      if (orden.estado !== 'ENTREGADO') {
        await tx.ordenReparacion.update({
          where: { id: orden.id },
          data: { estado: 'ENTREGADO' },
        })
      }
      return { venta, factura }
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error al facturar orden:', error)
    return NextResponse.json({ error: 'Error al procesar la facturación' }, { status: 500 })
  }
})

export const getOrdenReparacionPdfHandler = withAuth(async (request: NextRequest, context: any, user: any) => {
  const id = context?.params?.id as string | undefined
  if (!id) {
    return NextResponse.json({ error: 'ID de orden requerido' }, { status: 400 })
  }
  const orden = await prisma.ordenReparacion.findUnique({
    where: { id },
    include: {
      cliente: true, equipoTipo: true, tecnico: true,
      items: { include: { pieza: true } },
      materiales: { include: { producto: true } },
    },
  })
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  const miEmpresa = await prisma.miEmpresa.findFirst({ include: { cuentaBancaria: true } })
  if (!miEmpresa) return NextResponse.json({ error: 'Configuración de empresa no encontrada' }, { status: 500 })
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const page = pdfDoc.addPage()
  let logoImage = null
  if (miEmpresa.logoUrl) {
    try {
      const publicPath = path.join(process.cwd(), 'public')
      const logoPath = path.join(publicPath, miEmpresa.logoUrl)
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath)
        if (miEmpresa.logoUrl.endsWith('.png')) logoImage = await pdfDoc.embedPng(logoBytes)
        else if (miEmpresa.logoUrl.endsWith('.jpg') || miEmpresa.logoUrl.endsWith('.jpeg')) logoImage = await pdfDoc.embedJpg(logoBytes)
      }
    } catch (e) {
      console.error('Error loading logo:', e)
    }
  }
  await generateOrdenPDF(page, fontRegular, fontBold, fontItalic, logoImage, { miEmpresa, orden })
  const pdfBytes = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="orden-${orden.numeroOrden}.pdf"`,
    },
  })
})

export const getCotizacionPdfHandler = withAuthGet(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID de orden requerido' }, { status: 400 })
  const orden = await prisma.ordenReparacion.findUnique({
    where: { id },
    include: {
      cliente: true, equipoTipo: true, tecnico: true,
      items: { include: { pieza: true } },
      materiales: { include: { producto: true } },
    },
  })
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  const miEmpresa = await prisma.miEmpresa.findFirst({ include: { cuentaBancaria: true } })
  const empresa = miEmpresa ?? {
    nombre: 'Soluciones Dervilla',
    direccion: 'Calle Cuba #108',
    telefono: '54234912',
    email: 'dervilla@nauta.cu',
  }
  const lines = buildLines(orden)
  const subtotal = Number(orden.subtotal) || lines.reduce((acc, line) => acc + line.total, 0)
  const descuento = Number(orden.descuento) || 0
  const total = Number(orden.total) || (subtotal - descuento)
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const page = pdfDoc.addPage([595.28, 841.89])
  let logoImage = null
  if (miEmpresa?.logoUrl) {
    try {
      const publicPath = path.join(process.cwd(), 'public')
      const relativePath = miEmpresa.logoUrl.startsWith('/') ? miEmpresa.logoUrl.slice(1) : miEmpresa.logoUrl
      const logoPath = path.join(publicPath, relativePath)
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath)
        if (logoPath.toLowerCase().endsWith('.png')) logoImage = await pdfDoc.embedPng(logoBytes)
        else if (logoPath.toLowerCase().endsWith('.jpg') || logoPath.toLowerCase().endsWith('.jpeg')) logoImage = await pdfDoc.embedJpg(logoBytes)
      }
    } catch (e) {
      console.error('Error loading logo:', e)
    }
  }
  await generateCotizacionPDF(page, fontRegular, fontBold, fontItalic, logoImage, {
    miEmpresa: empresa, orden, lines, subtotal, descuento, total,
  })
  const pdfBytes = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cotizacion-${orden.numeroOrden}.pdf"`,
      'Content-Length': pdfBytes.length.toString(),
    },
  })
})

export const getTecnicosStatsHandler = withAuthGet(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const dateFilter: any = {}
    if (startDate && endDate) {
      dateFilter.createdAt = { gte: new Date(startDate), lte: new Date(endDate) }
    }
    const tecnicos = await prisma.empleado.findMany({
      where: {
        OR: [
          { cargo: { contains: 'Técnico' } },
          { ordenesAsignadas: { some: {} } },
        ],
      },
      include: {
        ordenesAsignadas: {
          where: dateFilter,
          select: { id: true, estado: true, total: true, items: { select: { precio: true } } },
        },
      },
    })
    const stats = tecnicos.map((tecnico: any) => {
      const totalOrdenes = tecnico.ordenesAsignadas.length
      const ordenesCompletadas = tecnico.ordenesAsignadas.filter((o: any) =>
        o.estado === 'TERMINADO' || o.estado === 'ENTREGADO'
      ).length
      const totalGenerado = tecnico.ordenesAsignadas.reduce((acc: number, curr: any) => acc + Number(curr.total), 0)
      const manoDeObraGenerada = tecnico.ordenesAsignadas.reduce((acc: number, curr: any) => {
        const totalItems = curr.items.reduce((sum: number, item: any) => sum + Number(item.precio), 0)
        return acc + totalItems
      }, 0)
      return {
        id: tecnico.empleadoId,
        nombre: `${tecnico.nombre} ${tecnico.apellido}`,
        cargo: tecnico.cargo,
        totalOrdenes,
        ordenesCompletadas,
        tasaCompletado: totalOrdenes > 0 ? (ordenesCompletadas / totalOrdenes) * 100 : 0,
        totalGenerado,
        manoDeObraGenerada,
        comisionEstimada: manoDeObraGenerada * 0.3,
      }
    })
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error al obtener estadísticas de técnicos:', error)
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 })
  }
})
