import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { ActionError } from '@/lib/server-actions'
import { withAuthGet, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requirePermission, requireTenant } from '@/lib/services/tenant-scope'

export const runtime = 'nodejs'

/**
 * @description Genera y descarga un comprobante PDF para un préstamo cash.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} context - Contexto con params de ruta.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {NextResponse} PDF del comprobante con 2 copias (cliente e interna).
 */
export const GET = withAuthGet(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: AuthenticatedUser
) => {
  try {
    const tenantId = requireTenant(user)
    requirePermission(user, 'financiero.contabilidad.acceder', 'descargar comprobantes de préstamos cash')
    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: 'ID de préstamo requerido' },
        { status: 400 }
      )
    }

    const prestamo = await prisma.prestamoCash.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        cliente: true,
        cuentaPorCobrar: true,
      }
    })

    if (!prestamo) {
      return NextResponse.json(
        { error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    generateComprobantePDF(page, fontRegular, fontBold, prestamo)

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="comprobante-PREST-${prestamo.idNumerico}.pdf"`,
        'Content-Length': pdfBytes.length.toString()
      }
    })
  } catch (error) {
    if (error instanceof ActionError && ['FORBIDDEN', 'TENANT_REQUIRED'].includes(error.code)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 })
    }
    console.error('Error generating loan voucher PDF:', error)
    return NextResponse.json(
      { error: 'Error generando comprobante PDF' },
      { status: 500 }
    )
  }
})

function formatCurrency(amount: number, moneda: string): string {
  return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`
}

function generateComprobantePDF(page: any, fontRegular: any, fontBold: any, prestamo: any) {
  const { height } = page.getSize()
  const left = 50
  const right = 545
  const centerX = (left + right) / 2
  const montoCapital = Number(prestamo.montoCapital)
  const montoDeuda = Number(prestamo.cuentaPorCobrar.montoDeuda)
  const moneda = prestamo.moneda || 'CUP'
  const tasaCambio = prestamo.tasaCambioAlCrear ? Number(prestamo.tasaCambioAlCrear) : null
  const esForeignCurrency = moneda !== 'CUP' && tasaCambio

  // === COPIA CLIENTE (mitad superior) ===
  let y = height - 50

  // Border for client copy
  page.drawRectangle({
    x: 30, y: height / 2 + 10, width: 535, height: height / 2 - 30,
    borderWidth: 1, borderColor: rgb(0, 0, 0),
  })

  // Title
  const titleClient = 'COMPROBANTE DE PRÉSTAMO — Copia Cliente'
  page.drawText(titleClient, {
    x: centerX - (fontBold.widthOfTextAtSize(titleClient, 14) / 2),
    y,
    size: 14,
    font: fontBold,
  })
  y -= 24

  // Comprobante number & date
  const headerLines = [
    `Comprobante No: PREST-${prestamo.idNumerico}`,
    `Fecha: ${new Date(prestamo.fechaOtorgamiento).toLocaleDateString('es-ES')}`,
  ]
  headerLines.forEach((text) => {
    const textWidth = fontRegular.widthOfTextAtSize(text, 11)
    page.drawText(text, { x: right - textWidth, y, size: 11, font: fontRegular })
    y -= 14
  })
  y -= 8

  // Client section
  page.drawText('DATOS DEL CLIENTE:', { x: left, y, size: 12, font: fontBold })
  y -= 16
  page.drawText(`Nombre: ${prestamo.cliente?.nombre || 'Desconocido'}`, {
    x: left + 20, y, size: 11, font: fontRegular
  })
  y -= 20

  // Loan details
  page.drawText('DETALLES DEL PRÉSTAMO:', { x: left, y, size: 12, font: fontBold })
  y -= 16
  const clientDetails: string[] = [
    `Monto Solicitado (Capital): ${formatCurrency(montoCapital, moneda)}`,
    `Monto a Pagar: ${formatCurrency(montoDeuda, moneda)}`,
  ]
  if (esForeignCurrency) {
    clientDetails.push(`Tasa de Cambio: ${tasaCambio} CUP/${moneda}`)
  }
  if (prestamo.fechaVencimiento) {
    clientDetails.push(`Fecha de Vencimiento: ${new Date(prestamo.fechaVencimiento).toLocaleDateString('es-ES')}`)
  }
  clientDetails.forEach((text) => {
    page.drawText(text, { x: left + 20, y, size: 11, font: fontRegular })
    y -= 14
  })
  y -= 6

  // Separator
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, color: rgb(0, 0, 0), thickness: 1 })
  y -= 10

  // Footer client copy
  const footerClient = 'Este comprobante es válido como constancia del préstamo otorgado.'
  const fcw = fontRegular.widthOfTextAtSize(footerClient, 9)
  page.drawText(footerClient, { x: centerX - fcw / 2, y, size: 9, font: fontRegular })

  // === LÍNEA DE CORTE ===
  const cutY = height / 2
  const dashLength = 10
  const gapLength = 5
  let dashX = left
  while (dashX < right) {
    const endX = Math.min(dashX + dashLength, right)
    page.drawLine({
      start: { x: dashX, y: cutY },
      end: { x: endX, y: cutY },
      color: rgb(0.5, 0.5, 0.5),
      thickness: 0.5,
    })
    dashX = endX + gapLength
  }
  // Scissors indicator
  const scissorsText = '--- Cortar aqui ---'
  const stw = fontRegular.widthOfTextAtSize(scissorsText, 8)
  page.drawText(scissorsText, {
    x: centerX - stw / 2, y: cutY + 4, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5)
  })

  // === COPIA INTERNA (mitad inferior) ===
  y = cutY - 30

  // Border for internal copy
  page.drawRectangle({
    x: 30, y: 20, width: 535, height: cutY - 40,
    borderWidth: 1, borderColor: rgb(0, 0, 0),
  })

  const titleInternal = 'COMPROBANTE DE PRÉSTAMO — Copia Interna'
  page.drawText(titleInternal, {
    x: centerX - (fontBold.widthOfTextAtSize(titleInternal, 14) / 2),
    y,
    size: 14,
    font: fontBold,
  })
  y -= 24

  // Same header
  headerLines.forEach((text) => {
    const textWidth = fontRegular.widthOfTextAtSize(text, 11)
    page.drawText(text, { x: right - textWidth, y, size: 11, font: fontRegular })
    y -= 14
  })
  y -= 8

  // Client section (internal)
  page.drawText('DATOS DEL CLIENTE:', { x: left, y, size: 12, font: fontBold })
  y -= 16
  page.drawText(`Nombre: ${prestamo.cliente?.nombre || 'Desconocido'}`, {
    x: left + 20, y, size: 11, font: fontRegular
  })
  y -= 20

  // Loan details (internal)
  page.drawText('DETALLES DEL PRÉSTAMO:', { x: left, y, size: 12, font: fontBold })
  y -= 16
  clientDetails.forEach((text) => {
    page.drawText(text, { x: left + 20, y, size: 11, font: fontRegular })
    y -= 14
  })
  y -= 6

  // Observaciones — ONLY in internal copy
  page.drawText('OBSERVACIONES:', { x: left, y, size: 12, font: fontBold })
  y -= 16
  const obs = prestamo.observaciones || 'Sin observaciones'
  // Wrap long text manually
  const maxLineWidth = right - left - 20
  const words = obs.split(' ')
  let currentLine = ''
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (fontRegular.widthOfTextAtSize(testLine, 11) > maxLineWidth) {
      page.drawText(currentLine, { x: left + 20, y, size: 11, font: fontRegular })
      y -= 14
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    page.drawText(currentLine, { x: left + 20, y, size: 11, font: fontRegular })
    y -= 14
  }
  y -= 6

  // Separator
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, color: rgb(0, 0, 0), thickness: 1 })
  y -= 10

  // Footer + generation date
  const footerInternal = 'Copia interna — uso exclusivo del prestamista.'
  const fiw = fontRegular.widthOfTextAtSize(footerInternal, 9)
  page.drawText(footerInternal, { x: centerX - fiw / 2, y, size: 9, font: fontRegular })
  y -= 12

  const genDate = `Generado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`
  const gdw = fontRegular.widthOfTextAtSize(genDate, 9)
  page.drawText(genDate, { x: centerX - gdw / 2, y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) })
}
