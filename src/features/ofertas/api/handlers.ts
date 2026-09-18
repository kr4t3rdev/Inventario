import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { authenticateUser } from '@/lib/auth-middleware'

const ORANGE = rgb(249 / 255, 115 / 255, 22 / 255)
const DARK = rgb(30 / 255, 30 / 255, 30 / 255)
const GRAY = rgb(100 / 255, 100 / 255, 100 / 255)
const LIGHT_GRAY = rgb(240 / 255, 240 / 255, 240 / 255)
const WHITE = rgb(1, 1, 1)

/**
 * @description Genera un PDF con los detalles de una oferta.
 * @param {NextRequest} _request - Request (no usado).
 * @param {{ params: Promise<{ id: string }> }} context - Contexto con el ID de la oferta.
 * @returns {Promise<NextResponse>} PDF de la oferta.
 */
export async function getOfertaPdfHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as NextResponse
    const tenantId = authResult.user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 })
    const { id } = await context.params

    const oferta = await prisma.oferta.findFirst({
      where: { id, tenantId },
      include: {
        cliente: true,
        items: {
          include: {
            producto: { select: { nombre: true, codigoInterno: true } },
            servicio: { select: { nombre: true } },
          },
        },
      },
    })

    if (!oferta) {
      return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })
    }

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    let y = 800
    const marginLeft = 50
    const pageWidth = 495.28
    const lineHeight = 18

    // Header
    page.drawRectangle({
      x: 0, y: y + 20, width: 595.28, height: 50,
      color: ORANGE,
    })
    page.drawText('OFERTA', {
      x: marginLeft, y: y + 40, size: 18, font: fontBold, color: WHITE,
    })
    page.drawText(`No. ${oferta.numeroOferta}`, {
      x: marginLeft, y: y + 22, size: 10, font: fontRegular, color: WHITE,
    })

    y -= 20
    y -= 25

    // Cliente info
    page.drawText('Cliente:', { x: marginLeft, y, size: 11, font: fontBold, color: DARK })
    y -= 16
    page.drawText(oferta.cliente.nombre, { x: marginLeft + 10, y, size: 10, font: fontRegular, color: DARK })
    y -= 14
    if (oferta.cliente.direccion) {
      page.drawText(oferta.cliente.direccion, { x: marginLeft + 10, y, size: 10, font: fontRegular, color: GRAY })
      y -= 14
    }
    if (oferta.cliente.telefono) {
      page.drawText(`Tel: ${oferta.cliente.telefono}`, { x: marginLeft + 10, y, size: 10, font: fontRegular, color: GRAY })
      y -= 14
    }

    // Fechas
    y -= 6
    page.drawText(`Fecha de emisión: ${new Date(oferta.fechaEmision).toLocaleDateString('es-ES')}`, {
      x: marginLeft + 250, y: y + 30, size: 10, font: fontRegular, color: GRAY,
    })
    if (oferta.fechaVencimiento) {
      page.drawText(`Vence: ${new Date(oferta.fechaVencimiento).toLocaleDateString('es-ES')}`, {
        x: marginLeft + 250, y: y + 16, size: 10, font: fontRegular, color: GRAY,
      })
    }
    page.drawText(`Estado: ${oferta.estado}`, {
      x: marginLeft + 250, y: y + 2, size: 10, font: fontBold, color: ORANGE,
    })

    y -= 20

    // Table Header
    y -= 30
    const colX = [marginLeft, marginLeft + 200, marginLeft + 290, marginLeft + 360, marginLeft + 430]
    const colWidths = [195, 85, 65, 65, 55]

    page.drawRectangle({ x: marginLeft, y: y - 4, width: pageWidth, height: 22, color: LIGHT_GRAY })

    const headers = ['Producto / Servicio', 'Cantidad', 'P. Unitario', 'Total', '']
    headers.forEach((h, i) => {
      page.drawText(h, { x: colX[i] + 4, y: y + 2, size: 8, font: fontBold, color: DARK })
    })

    y -= lineHeight

    // Table Rows
    for (const item of oferta.items) {
      if (y < 60) {
        const newPage = pdfDoc.addPage([595.28, 841.89])
        y = 800
      }

      const nombre = item.producto?.nombre || item.servicio?.nombre || '(sin nombre)'

      if (oferta.items.indexOf(item) % 2 === 0) {
        page.drawRectangle({ x: marginLeft, y: y - 4, width: pageWidth, height: lineHeight, color: rgb(0.98, 0.98, 0.98) })
      }

      page.drawText(nombre.slice(0, 30), { x: colX[0] + 4, y, size: 8, font: fontRegular, color: DARK })
      page.drawText(`${item.cantidad}`, { x: colX[1] + 4, y, size: 8, font: fontRegular, color: DARK })
      page.drawText(`$${Number(item.precioUnitario).toLocaleString('es-ES')}`, { x: colX[2] + 4, y, size: 8, font: fontRegular, color: DARK })
      page.drawText(`$${Number(item.total).toLocaleString('es-ES')}`, { x: colX[3] + 4, y, size: 8, font: fontRegular, color: DARK })

      y -= lineHeight
    }

    // Totals
    y -= 10
    page.drawLine({ start: { x: marginLeft, y }, end: { x: marginLeft + pageWidth, y }, color: GRAY, thickness: 0.5 })
    y -= 16

    page.drawText(`Subtotal: $${Number(oferta.subtotal).toLocaleString('es-ES')}`, {
      x: marginLeft + 350, y, size: 10, font: fontRegular, color: DARK,
    })
    y -= 14
    page.drawText(`Impuestos: $${Number(oferta.impuestos).toLocaleString('es-ES')}`, {
      x: marginLeft + 350, y, size: 10, font: fontRegular, color: GRAY,
    })
    y -= 14

    page.drawRectangle({ x: marginLeft + 340, y: y - 4, width: 155, height: 22, color: ORANGE })
    page.drawText(`TOTAL: $${Number(oferta.total).toLocaleString('es-ES')}`, {
      x: marginLeft + 350, y: y + 4, size: 11, font: fontBold, color: WHITE,
    })

    // Observaciones
    if (oferta.observaciones) {
      y -= 30
      page.drawText('Observaciones:', { x: marginLeft, y, size: 10, font: fontBold, color: DARK })
      y -= 14
      page.drawText(oferta.observaciones, { x: marginLeft + 10, y, size: 9, font: fontRegular, color: GRAY })
    }

    // Footer
    page.drawText(`Generado el ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
      x: marginLeft, y: 40, size: 8, font: fontRegular, color: GRAY,
    })

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="oferta-${oferta.numeroOferta}.pdf"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generando PDF de oferta:', error)
    return NextResponse.json({ error: 'Error generando PDF de oferta' }, { status: 500 })
  }
}

/**
 * @description Genera un archivo CSV (compatible con Excel) con los datos de una oferta.
 * @param {NextRequest} _request - Request (no usado).
 * @param {{ params: Promise<{ id: string }> }} context - Contexto con el ID de la oferta.
 * @returns {Promise<NextResponse>} CSV descargable.
 */
export async function getOfertaExcelHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as NextResponse
    const tenantId = authResult.user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 })
    const { id } = await context.params

    const oferta = await prisma.oferta.findFirst({
      where: { id, tenantId },
      include: {
        cliente: true,
        items: {
          include: {
            producto: { select: { nombre: true, codigoInterno: true } },
            servicio: { select: { nombre: true } },
          },
        },
      },
    })

    if (!oferta) {
      return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })
    }

    const rows: string[] = [
      // Header info
      `"Oferta No.","${oferta.numeroOferta}"`,
      `"Cliente","${oferta.cliente.nombre}"`,
      `"Fecha Emisión","${new Date(oferta.fechaEmision).toLocaleDateString('es-ES')}"`,
      `"Estado","${oferta.estado}"`,
      '',
      '"Producto","Cantidad","Precio Unitario","Total"',
    ]

    for (const item of oferta.items) {
      const nombre = item.producto?.nombre || item.servicio?.nombre || '(sin nombre)'
      rows.push(`"${nombre}",${item.cantidad},${Number(item.precioUnitario).toFixed(2)},${Number(item.total).toFixed(2)}`)
    }

    rows.push('')
    rows.push(`"Subtotal",,,${Number(oferta.subtotal).toFixed(2)}`)
    rows.push(`"Impuestos",,,${Number(oferta.impuestos).toFixed(2)}`)
    rows.push(`"Total",,,${Number(oferta.total).toFixed(2)}`)

    if (oferta.observaciones) {
      rows.push('')
      rows.push(`"Observaciones","${oferta.observaciones}"`)
    }

    const csvContent = '\uFEFF' + rows.join('\r\n') // BOM UTF-8 for Excel compatibility

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="oferta-${oferta.numeroOferta}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error generando exportación de oferta:', error)
    return NextResponse.json({ error: 'Error generando exportación' }, { status: 500 })
  }
}
