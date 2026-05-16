import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

const ORANGE = rgb(249 / 255, 115 / 255, 22 / 255)
const DARK = rgb(30 / 255, 30 / 255, 30 / 255)
const GRAY = rgb(100 / 255, 100 / 255, 100 / 255)
const LIGHT_GRAY = rgb(240 / 255, 240 / 255, 240 / 255)
const WHITE = rgb(1, 1, 1)

const FACTURA_INCLUDE = {
  cliente: {
    select: { nombre: true, direccion: true, telefono: true },
  },
  serie: {
    select: { prefijo: true, descripcion: true },
  },
  venta: {
    include: {
      items: {
        include: {
          producto: { select: { nombre: true, codigoInterno: true } },
        },
      },
      producto: { select: { nombre: true } },
      puntoDeVenta: { select: { nombre: true } },
    },
  },
} as const

/**
 * @description Genera un PDF con los detalles de una factura.
 * @param {NextRequest} _request - Request (no usado).
 * @param {{ params: Promise<{ id: string }> }} context - Contexto con el ID de la factura.
 * @param {AuthenticatedUser} _user - Usuario autenticado.
 * @returns {Promise<NextResponse>} PDF de la factura.
 */
export async function generatePdfHandler(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
  _user: AuthenticatedUser
): Promise<NextResponse> {
  try {
    const { id } = await context.params

    const factura = await prisma.factura.findUnique({
      where: { idFactura: id },
      include: FACTURA_INCLUDE,
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
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
    page.drawText('FACTURA', {
      x: marginLeft, y: y + 40, size: 18, font: fontBold, color: WHITE,
    })
    page.drawText(`${factura.serie.prefijo}-${factura.numeroFactura}`, {
      x: marginLeft, y: y + 22, size: 10, font: fontRegular, color: WHITE,
    })

    y -= 20
    y -= 25

    // Cliente info
    page.drawText('Cliente:', { x: marginLeft, y, size: 11, font: fontBold, color: DARK })
    y -= 16
    page.drawText(factura.cliente.nombre, { x: marginLeft + 10, y, size: 10, font: fontRegular, color: DARK })
    y -= 14
    if (factura.cliente.direccion) {
      page.drawText(factura.cliente.direccion, { x: marginLeft + 10, y, size: 10, font: fontRegular, color: GRAY })
      y -= 14
    }
    if (factura.cliente.telefono) {
      page.drawText(`Tel: ${factura.cliente.telefono}`, { x: marginLeft + 10, y, size: 10, font: fontRegular, color: GRAY })
      y -= 14
    }

    // Fechas y estado
    y -= 6
    page.drawText(`Fecha de emisión: ${new Date(factura.fechaEmision).toLocaleDateString('es-ES')}`, {
      x: marginLeft + 250, y: y + 30, size: 10, font: fontRegular, color: GRAY,
    })
    if (factura.fechaVencimiento) {
      page.drawText(`Vence: ${new Date(factura.fechaVencimiento).toLocaleDateString('es-ES')}`, {
        x: marginLeft + 250, y: y + 16, size: 10, font: fontRegular, color: GRAY,
      })
    }
    page.drawText(`Estado: ${factura.estado}`, {
      x: marginLeft + 250, y: y + 2, size: 10, font: fontBold, color: ORANGE,
    })

    y -= 20

    // Table Header
    y -= 30
    const colX = [marginLeft, marginLeft + 200, marginLeft + 290, marginLeft + 360, marginLeft + 430]
    const pageWidthRemaining = 495.28

    page.drawRectangle({ x: marginLeft, y: y - 4, width: pageWidth, height: 22, color: LIGHT_GRAY })

    const headers = ['Producto / Servicio', 'Cantidad', 'P. Unitario', 'Total', '']
    headers.forEach((h, i) => {
      page.drawText(h, { x: colX[i] + 4, y: y + 2, size: 8, font: fontBold, color: DARK })
    })

    y -= lineHeight

    // Collect items from venta (items array) or single producto
    const items = factura.venta?.items?.length
      ? factura.venta.items.map((i: any) => ({
          nombre: i.producto?.nombre || '(sin nombre)',
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          total: i.total,
        }))
      : factura.venta?.producto
        ? [{
            nombre: factura.venta.producto.nombre,
            cantidad: factura.venta.cantidad,
            precioUnitario: factura.venta.total ? Math.round(factura.venta.total / factura.venta.cantidad) : 0,
            total: factura.venta.total || 0,
          }]
        : []

    // Table Rows
    for (const item of items) {
      if (y < 60) {
        const newPage = pdfDoc.addPage([595.28, 841.89])
        y = 800
      }

      if (items.indexOf(item) % 2 === 0) {
        page.drawRectangle({ x: marginLeft, y: y - 4, width: pageWidth, height: lineHeight, color: rgb(0.98, 0.98, 0.98) })
      }

      page.drawText(item.nombre.slice(0, 30), { x: colX[0] + 4, y, size: 8, font: fontRegular, color: DARK })
      page.drawText(`${item.cantidad}`, { x: colX[1] + 4, y, size: 8, font: fontRegular, color: DARK })
      page.drawText(`$${Number(item.precioUnitario).toLocaleString('es-ES')}`, { x: colX[2] + 4, y, size: 8, font: fontRegular, color: DARK })
      page.drawText(`$${Number(item.total).toLocaleString('es-ES')}`, { x: colX[3] + 4, y, size: 8, font: fontRegular, color: DARK })

      y -= lineHeight
    }

    // Punto de venta
    y -= 6
    if (factura.venta?.puntoDeVenta?.nombre) {
      page.drawText(`Punto de Venta: ${factura.venta.puntoDeVenta.nombre}`, {
        x: marginLeft, y, size: 9, font: fontRegular, color: GRAY,
      })
      y -= 16
    }

    // Totals
    y -= 10
    page.drawLine({ start: { x: marginLeft, y }, end: { x: marginLeft + pageWidth, y }, color: GRAY, thickness: 0.5 })
    y -= 16

    page.drawText(`Subtotal: $${Number(factura.subtotal).toLocaleString('es-ES')}`, {
      x: marginLeft + 350, y, size: 10, font: fontRegular, color: DARK,
    })
    y -= 14

    if (Number(factura.descuento) > 0) {
      page.drawText(`Descuento: -$${Number(factura.descuento).toLocaleString('es-ES')}`, {
        x: marginLeft + 350, y, size: 10, font: fontRegular, color: GRAY,
      })
      y -= 14
    }

    page.drawText(`Impuestos: $${Number(factura.impuestos).toLocaleString('es-ES')}`, {
      x: marginLeft + 350, y, size: 10, font: fontRegular, color: GRAY,
    })
    y -= 14

    if (Number(factura.cargoTransporte) > 0) {
      page.drawText(`Cargo Transporte: $${Number(factura.cargoTransporte).toLocaleString('es-ES')}`, {
        x: marginLeft + 350, y, size: 10, font: fontRegular, color: GRAY,
      })
      y -= 14
    }

    page.drawRectangle({ x: marginLeft + 340, y: y - 4, width: 155, height: 22, color: ORANGE })
    page.drawText(`TOTAL: $${Number(factura.total).toLocaleString('es-ES')}`, {
      x: marginLeft + 350, y: y + 4, size: 11, font: fontBold, color: WHITE,
    })

    // Observaciones
    if (factura.observaciones) {
      y -= 30
      page.drawText('Observaciones:', { x: marginLeft, y, size: 10, font: fontBold, color: DARK })
      y -= 14
      page.drawText(factura.observaciones, { x: marginLeft + 10, y, size: 9, font: fontRegular, color: GRAY })
    }

    // Footer
    page.drawText(`Generado el ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
      x: marginLeft, y: 40, size: 8, font: fontRegular, color: GRAY,
    })

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="factura-${factura.serie.prefijo}-${factura.numeroFactura}.pdf"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generando PDF de factura:', error)
    return NextResponse.json({ error: 'Error generando PDF de factura' }, { status: 500 })
  }
}

/**
 * @description Genera un archivo CSV (compatible con Excel) con los datos de una factura.
 * @param {NextRequest} _request - Request (no usado).
 * @param {{ params: Promise<{ id: string }> }} context - Contexto con el ID de la factura.
 * @param {AuthenticatedUser} _user - Usuario autenticado.
 * @returns {Promise<NextResponse>} CSV descargable.
 */
export async function generateExcelHandler(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
  _user: AuthenticatedUser
): Promise<NextResponse> {
  try {
    const { id } = await context.params

    const factura = await prisma.factura.findUnique({
      where: { idFactura: id },
      include: FACTURA_INCLUDE,
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    const rows: string[] = [
      `"Factura No.","${factura.serie.prefijo}-${factura.numeroFactura}"`,
      `"Cliente","${factura.cliente.nombre}"`,
      `"Fecha Emisión","${new Date(factura.fechaEmision).toLocaleDateString('es-ES')}"`,
      `"Estado","${factura.estado}"`,
      '',
      '"Producto","Cantidad","Precio Unitario","Total"',
    ]

    const items = factura.venta?.items?.length
      ? factura.venta.items.map((i: any) => ({
          nombre: i.producto?.nombre || '(sin nombre)',
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          total: i.total,
        }))
      : factura.venta?.producto
        ? [{
            nombre: factura.venta.producto.nombre,
            cantidad: factura.venta.cantidad,
            precioUnitario: factura.venta.total ? Math.round(factura.venta.total / factura.venta.cantidad) : 0,
            total: factura.venta.total || 0,
          }]
        : []

    for (const item of items) {
      rows.push(`"${item.nombre}",${item.cantidad},${Number(item.precioUnitario).toFixed(2)},${Number(item.total).toFixed(2)}`)
    }

    rows.push('')
    rows.push(`"Subtotal",,,${Number(factura.subtotal).toFixed(2)}`)

    if (Number(factura.descuento) > 0) {
      rows.push(`"Descuento",,,${Number(factura.descuento).toFixed(2)}`)
    }

    rows.push(`"Impuestos",,,${Number(factura.impuestos).toFixed(2)}`)

    if (Number(factura.cargoTransporte) > 0) {
      rows.push(`"Cargo Transporte",,,${Number(factura.cargoTransporte).toFixed(2)}`)
    }

    rows.push(`"Total",,,${Number(factura.total).toFixed(2)}`)

    if (factura.observaciones) {
      rows.push('')
      rows.push(`"Observaciones","${factura.observaciones}"`)
    }

    const csvContent = '\uFEFF' + rows.join('\r\n') // BOM UTF-8 for Excel compatibility

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="factura-${factura.serie.prefijo}-${factura.numeroFactura}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error generando exportación de factura:', error)
    return NextResponse.json({ error: 'Error generando exportación' }, { status: 500 })
  }
}
