import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { authenticateUser } from '@/lib/auth-middleware'
import { canAccessAccountingItem } from '@/lib/plan-access'

// Ensure Node.js runtime for compatibility with pdf generation
export const runtime = 'nodejs'

// GET /api/contabilidad/transferencias/comprobante/[id] - Generate and download PDF voucher
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    if (user.role !== 'admin' && !canAccessAccountingItem(user, 'Transferencias Bancarias')) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'ID de transferencia requerido' },
        { status: 400 }
      )
    }

    // Get transfer details
    const transferencia = await prisma.transferenciaBancaria.findUnique({
      where: { transferenciaId: id },
      include: {
        cuentaOrigen: {
          select: {
            nombreBanco: true,
            numeroCuenta: true,
            tipoCuenta: true,
            moneda: true
          }
        },
        cuentaDestino: {
          select: {
            nombreBanco: true,
            numeroCuenta: true,
            tipoCuenta: true,
            moneda: true
          }
        }
      }
    })

    if (!transferencia) {
      return NextResponse.json(
        { error: 'Transferencia no encontrada' },
        { status: 404 }
      )
    }

    // Add validation for related accounts to prevent crashes
    if (!transferencia.cuentaOrigen || !transferencia.cuentaDestino) {
      return NextResponse.json(
        { error: 'La transferencia tiene datos de cuenta incompletos y no se puede generar el comprobante.' },
        { status: 404 }
      )
    }

    // Create PDF with pdf-lib
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4 size in points
    const { width } = page.getSize()
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    generateVoucherPDF(page, fontRegular, fontBold, transferencia)

    const pdfBytes = await pdfDoc.save()

    // Return PDF as response
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="comprobante-${transferencia.numeroComprobante}.pdf"`,
        'Content-Length': pdfBytes.length.toString()
      }
    })

  } catch (error) {
    console.error('Error generating PDF voucher:', error)
    return NextResponse.json(
      { error: 'Error generando comprobante PDF' },
      { status: 500 }
    )
  }
}

function generateVoucherPDF(page: any, fontRegular: any, fontBold: any, transferencia: any) {
  const { height } = page.getSize()
  let y = height - 60
  const left = 50
  const right = 545
  const centerX = (left + right) / 2

  // Title
  page.drawText('COMPROBANTE DE TRANSFERENCIA BANCARIA', {
    x: centerX - (fontBold.widthOfTextAtSize('COMPROBANTE DE TRANSFERENCIA BANCARIA', 18) / 2),
    y,
    size: 18,
    font: fontBold,
  })
  y -= 20

  // Voucher number and date (right aligned)
  const lines = [
    `Comprobante No: ${transferencia.numeroComprobante}`,
    `Fecha: ${new Date(transferencia.fechaTransferencia).toLocaleDateString('es-ES')}`,
    `Hora: ${new Date(transferencia.fechaTransferencia).toLocaleTimeString('es-ES')}`,
  ]
  lines.forEach((text) => {
    const textWidth = fontRegular.widthOfTextAtSize(text, 11)
    page.drawText(text, { x: right - textWidth, y, size: 11, font: fontRegular })
    y -= 14
  })
  y -= 10

  // Section: Cuenta Origen
  page.drawText('CUENTA ORIGEN:', { x: left, y, size: 13, font: fontBold })
  y -= 16
  const origenLines = [
    `Banco: ${transferencia.cuentaOrigen.nombreBanco}`,
    `Número de Cuenta: ${transferencia.cuentaOrigen.numeroCuenta}`,
    `Tipo de Cuenta: ${transferencia.cuentaOrigen.tipoCuenta}`,
    `Moneda: ${transferencia.cuentaOrigen.moneda}`,
  ]
  origenLines.forEach((text) => {
    page.drawText(text, { x: left + 20, y, size: 11, font: fontRegular })
    y -= 14
  })
  y -= 6

  // Section: Cuenta Destino
  page.drawText('CUENTA DESTINO:', { x: left, y, size: 13, font: fontBold })
  y -= 16
  const destinoLines = [
    `Banco: ${transferencia.cuentaDestino.nombreBanco}`,
    `Número de Cuenta: ${transferencia.cuentaDestino.numeroCuenta}`,
    `Tipo de Cuenta: ${transferencia.cuentaDestino.tipoCuenta}`,
    `Moneda: ${transferencia.cuentaDestino.moneda}`,
  ]
  destinoLines.forEach((text) => {
    page.drawText(text, { x: left + 20, y, size: 11, font: fontRegular })
    y -= 14
  })
  y -= 6

  // Section: Detalles
  page.drawText('DETALLES DE LA TRANSFERENCIA:', { x: left, y, size: 13, font: fontBold })
  y -= 16
  const detalles: string[] = [
    `Monto Origen: ${Number(transferencia.montoOrigen).toFixed(2)} ${transferencia.monedaOrigen}`,
  ]
  if (transferencia.monedaOrigen !== transferencia.monedaDestino) {
    detalles.push(
      `Tasa de Cambio: ${Number(transferencia.tasaCambio).toFixed(4)}`,
      `Monto Destino: ${Number(transferencia.montoDestino).toFixed(2)} ${transferencia.monedaDestino}`,
    )
  }
  detalles.push(`Motivo: ${transferencia.motivo}`)
  if (transferencia.descripcion) {
    detalles.push(`Descripción: ${transferencia.descripcion}`)
  }
  detalles.push(`Realizado por: ${transferencia.realizadoPor}`)

  detalles.forEach((text) => {
    page.drawText(text, { x: left + 20, y, size: 11, font: fontRegular })
    y -= 14
  })
  y -= 8

  // Separator line
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, color: rgb(0, 0, 0), thickness: 1 })
  y -= 12

  // Footer
  const footer1 = 'Este comprobante es válido como constancia de la transferencia bancaria realizada.'
  const footer2 = `Generado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`
  const f1w = fontRegular.widthOfTextAtSize(footer1, 10)
  const f2w = fontRegular.widthOfTextAtSize(footer2, 10)
  page.drawText(footer1, { x: centerX - f1w / 2, y, size: 10, font: fontRegular })
  y -= 14
  page.drawText(footer2, { x: centerX - f2w / 2, y, size: 10, font: fontRegular })

  // Border
  page.drawRectangle({ x: 30, y: 30, width: 550, height: 750, borderWidth: 1, borderColor: rgb(0, 0, 0) })
}
