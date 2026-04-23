import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { numeroALetras } from '@/lib/number-to-words'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

type OfertaLine = {
  codigo: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  total: number
}

function formatCurrency(amount: number, currency = 'CUP') {
  return `${amount.toFixed(2)} ${currency}`.trim()
}

function safeText(text: string) {
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

function buildLines(oferta: any): OfertaLine[] {
  const items = oferta.items ?? []
  return items.map((it: any, index: number) => {
    const nombre =
      it.producto?.nombre ||
      it.servicio?.nombre ||
      (it.productoId ? 'Producto' : it.servicioId ? 'Servicio' : 'Ítem')
    const cantidad = Number(it.cantidad ?? 0)
    const precioUnitario = Number(it.precioUnitario ?? 0)
    const total = Number(it.total ?? precioUnitario * cantidad)
    const codigo = String(index + 1)
    return { codigo, descripcion: nombre, cantidad, precioUnitario, total }
  })
}

async function generateOfferPDF(
  page: any,
  fontRegular: any,
  fontBold: any,
  fontItalic: any,
  logoImage: any,
  payload: any
) {
  const { width, height } = page.getSize()
  const margin = 30
  const contentWidth = width - margin * 2

  const empresa = payload.miEmpresa
  const oferta = payload.oferta
  const totals = payload.totals
  const lines: OfertaLine[] = payload.lines
  const currency = payload.currency || 'CUP'

  const offerNumber = oferta?.numeroOferta || oferta?.id || 'N/A'
  const offerDate = oferta?.createdAt ? new Date(oferta.createdAt) : new Date()

  const blueColor = rgb(0, 0, 0.8)
  const redColor = rgb(1, 0, 0)
  const lightBlueColor = rgb(0.85, 0.92, 1)
  const borderColor = rgb(0, 0, 0)

  let y = height - margin

  // --- Header Section ---
  const headerHeight = 90

  // Left: Logo (approx 20% width)
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

  // Right Top Box: Oferta Details
  const headerBoxX = margin + logoBoxWidth
  const headerBoxWidth = contentWidth - logoBoxWidth

  // Title: OFERTA
  drawCenter(page, 'OFERTA', headerBoxX + headerBoxWidth / 2, y - 30, fontBold, 36)

  // Subtitle
  drawCenter(page, 'Información, Comunicaciones y Telecomunicaciones', headerBoxX + headerBoxWidth / 2, y - 45, fontItalic, 10, blueColor)

  // Address Line
  page.drawLine({
    start: { x: headerBoxX, y: y - 50 },
    end: { x: margin + contentWidth, y: y - 50 },
    thickness: 1,
    color: borderColor,
  })

  // Address Details
  const addrY = y - 65
  const dateBoxX = margin + contentWidth - 120
  const addressCenterX = headerBoxX + (dateBoxX - headerBoxX) / 2

  if (empresa.direccion) {
    drawCenter(page, safeText(empresa.direccion), addressCenterX, addrY, fontRegular, 9)
  }
  if (empresa.telefono) {
    drawCenter(page, `Tel: ${safeText(empresa.telefono)}`, addressCenterX, addrY - 12, fontRegular, 9)
  }

  // Number and Date Box (Right side of address area)
  const dateBoxY = y - 50
  page.drawLine({
    start: { x: dateBoxX, y: y - 50 },
    end: { x: dateBoxX, y: y - 90 },
    thickness: 1,
    color: borderColor,
  })

  drawText(page, 'No.:', dateBoxX + 10, addrY, fontRegular, 10)
  drawRight(page, offerNumber, margin + contentWidth - 10, addrY, fontBold, 10)

  drawText(page, 'Fecha:', dateBoxX + 10, addrY - 15, fontRegular, 10)
  drawRight(page, offerDate.toLocaleDateString('es-ES'), margin + contentWidth - 10, addrY - 15, fontBold, 10)

  // Draw main header border
  page.drawRectangle({
    x: margin,
    y: y - 90,
    width: contentWidth,
    height: 90,
    borderWidth: 1,
    borderColor: borderColor,
  })

  // Vertical line for logo
  page.drawLine({
    start: { x: margin + logoBoxWidth, y: y },
    end: { x: margin + logoBoxWidth, y: y - 90 },
    thickness: 1,
    color: borderColor,
  })

  y -= 100

  // --- Client & Provider Info ---
  const col1X = margin
  const col2X = margin + contentWidth / 2 + 20
  const infoY = y

  // Left Column: Client
  const cliente = oferta.cliente || {}
  let currentY = infoY

  drawText(page, 'Cliente:', col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.nombre), col1X + 80, currentY, fontBold, 10)
  currentY -= 15

  drawText(page, 'Dirección:', col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.direccion), col1X + 80, currentY, fontRegular, 10)
  currentY -= 15

  // Mostrar solo la cuenta según la moneda de la oferta
  if (currency === 'USD') {
    drawText(page, 'No. Cuenta USD:', col1X, currentY, fontRegular, 10)
    drawText(page, safeText(cliente.numeroCuentaUSD), col1X + 80, currentY, fontRegular, 10)
    currentY -= 15
  } else {
    drawText(page, 'No. Cuenta CUP:', col1X, currentY, fontRegular, 10)
    drawText(page, safeText(cliente.numeroCuentaCUP), col1X + 80, currentY, fontRegular, 10)
    currentY -= 15
  }

  currentY -= 30 // Increased Gap for more margin before Contract No.

  drawText(page, 'No. Contrato:', col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.numeroContrato), col1X + 80, currentY, fontRegular, 10)
  currentY -= 15

  drawText(page, 'Fecha:', col1X, currentY, fontRegular, 10)

  const yLeft = currentY

  // Right Column: Provider
  currentY = infoY
  drawText(page, 'Proveedor:', col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(empresa.propietario || ''), margin + contentWidth, currentY, fontBold, 10)
  currentY -= 15

  drawText(page, 'C. Identidad:', col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(empresa.carnetIdentidad || ''), margin + contentWidth, currentY, fontRegular, 10)
  currentY -= 15

  drawText(page, 'NIT:', col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(empresa.nit || ''), margin + contentWidth, currentY, fontRegular, 10)
  currentY -= 15

  drawText(page, 'Licencia de Operación:', col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(empresa.licenciaOperacion || ''), margin + contentWidth, currentY, fontRegular, 10)

  y = Math.min(yLeft, currentY) - 30

  // --- Items Table ---
  const tableTopY = y
  const headerHeightTable = 20

  // Column Positions
  const colCodeX = margin
  const colDescX = margin + 55
  const colQtyX = margin + 310
  const colPriceX = margin + 370
  const colTotalX = margin + 450
  const tableWidth = contentWidth

  // Draw Header Background
  page.drawRectangle({
    x: margin,
    y: tableTopY - headerHeightTable + 5,
    width: tableWidth,
    height: headerHeightTable,
    color: lightBlueColor,
    borderColor: borderColor,
    borderWidth: 1,
  })

  // Headers
  const headerY = tableTopY - headerHeightTable + 11
  drawText(page, 'CÓDIGO', colCodeX + 5, headerY, fontBold, 9)
  drawText(page, 'DESCRIPCIÓN', colDescX + 5, headerY, fontBold, 9)
  drawCenter(page, 'CANTIDAD', colQtyX + 25, headerY, fontBold, 9)
  drawCenter(page, 'P. UNITARIO', colPriceX + 40, headerY, fontBold, 9)
  drawCenter(page, 'IMPORTE', colTotalX + 40, headerY, fontBold, 9)

  y -= headerHeightTable

  // Rows
  const rowHeight = 18

  for (const line of lines) {
    const textY = y - 4

    drawText(page, safeText(line.codigo), colCodeX + 5, textY, fontRegular, 9)
    drawText(page, safeText(line.descripcion).slice(0, 55), colDescX + 5, textY, fontRegular, 9)
    drawCenter(page, String(line.cantidad), colQtyX + 25, textY, fontRegular, 9)
    drawRight(page, line.precioUnitario.toFixed(2), colPriceX + 70, textY, fontRegular, 9)
    drawRight(page, line.total.toFixed(2), colTotalX + 80, textY, fontRegular, 9)

    y -= rowHeight
  }

  // Draw vertical lines for table columns
  const minTableBottomY = 280
  const actualTableBottomY = Math.min(y, minTableBottomY)

  // Outer border of the table body
  page.drawRectangle({
    x: margin,
    y: actualTableBottomY,
    width: tableWidth,
    height: tableTopY - actualTableBottomY - headerHeightTable + 5,
    borderWidth: 1,
    borderColor: borderColor,
    color: undefined,
  })

  // Vertical Lines
  const verticalLinesX = [colDescX, colQtyX, colPriceX, colTotalX]
  verticalLinesX.forEach((x) => {
    page.drawLine({
      start: { x: x, y: tableTopY - headerHeightTable + 5 },
      end: { x: x, y: actualTableBottomY },
      thickness: 1,
      color: borderColor,
    })
  })

  y = actualTableBottomY

  // --- Observations & Totals ---
  const obsWidth = contentWidth * 0.65
  const totalsWidth = contentWidth * 0.35
  const obsHeight = 60

  // Observations Box
  page.drawRectangle({
    x: margin,
    y: y - obsHeight,
    width: obsWidth,
    height: obsHeight,
    borderWidth: 1,
    borderColor: borderColor,
  })

  drawText(page, 'OBSERVACIONES:', margin + 5, y - 12, fontRegular, 9)
  if (oferta.observaciones) {
    drawText(page, safeText(oferta.observaciones), margin + 5, y - 24, fontRegular, 9)
  }

  // Importe en letras (Bottom of Obs box)
  const importeLetras = numeroALetras(totals.total, {
    plural: '',
    singular: '',
    centPlural: '',
    centSingular: '',
  })
  drawText(page, 'IMPORTE EN LETRAS:', margin + 5, y - obsHeight + 10, fontRegular, 8)
  drawText(page, safeText(importeLetras), margin + 100, y - obsHeight + 10, fontBold, 8)

  // Totals Box
  page.drawRectangle({
    x: margin + obsWidth,
    y: y - obsHeight + 20,
    width: totalsWidth,
    height: obsHeight - 20,
    color: lightBlueColor,
    borderColor: borderColor,
    borderWidth: 1,
  })

  // Labels and Values
  const currencyLabel = currency === 'USD' ? 'USD' : 'MN'
  let totalY = y - 15
  drawRight(page, `SUBTOTAL ${currencyLabel}`, margin + obsWidth + 110, totalY, fontRegular, 9)
  drawRight(page, totals.subtotal.toFixed(2), margin + contentWidth - 10, totalY, fontRegular, 9)

  // Total Row (White background)
  page.drawRectangle({
    x: margin + obsWidth,
    y: y - obsHeight,
    width: totalsWidth,
    height: 20,
    borderColor: borderColor,
    borderWidth: 1,
  })

  totalY = y - obsHeight + 6
  drawRight(page, `TOTAL ${currencyLabel}`, margin + obsWidth + 110, totalY, fontBold, 10)
  drawRight(page, totals.total.toFixed(2), margin + contentWidth - 10, totalY, fontBold, 10, redColor)

  y -= obsHeight + 20

  // --- Signatures ---
  // Ofertas siempre muestran las 3 columnas (Recibido, Transportista, Elaborado)
  const numCols = 3
  const sigColWidth = contentWidth / numCols
  const sigY = y - 20

  // Col 1: Recibido por (Left)
  let colY = sigY
  drawText(page, 'Recibido por:', margin, colY, fontRegular, 9)
  page.drawLine({ start: { x: margin + 60, y: colY }, end: { x: margin + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 12
  drawCenter(page, '(Nombre y Apellidos)', margin + 60 + (sigColWidth - 70) / 2, colY, fontRegular, 7)
  colY -= 15

  drawText(page, 'C. Identidad:', margin, colY, fontRegular, 9)
  page.drawLine({ start: { x: margin + 60, y: colY }, end: { x: margin + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 25

  drawText(page, 'Firma:', margin + 20, colY, fontRegular, 9)
  page.drawLine({ start: { x: margin + 60, y: colY }, end: { x: margin + sigColWidth - 10, y: colY }, thickness: 0.5 })

  // Col 2: Transportista (Center)
  colY = sigY
  const col2StartX = margin + sigColWidth
  drawText(page, 'Transportista:', col2StartX, colY, fontRegular, 9)
  page.drawLine({ start: { x: col2StartX + 65, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 12
  drawCenter(page, '(Nombre y Apellidos)', col2StartX + 65 + (sigColWidth - 75) / 2, colY, fontRegular, 7)
  colY -= 15

  drawText(page, 'C.Identidad:', col2StartX, colY, fontRegular, 9)
  page.drawLine({ start: { x: col2StartX + 60, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 15

  drawText(page, 'No. Licencia:', col2StartX, colY, fontRegular, 9)
  page.drawLine({ start: { x: col2StartX + 60, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 15

  drawText(page, 'Chapa:', col2StartX, colY, fontRegular, 9)
  page.drawLine({ start: { x: col2StartX + 60, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 15

  drawText(page, 'Carta Porte:', col2StartX, colY, fontRegular, 9)
  page.drawLine({ start: { x: col2StartX + 60, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 20

  drawText(page, 'Firma:', col2StartX, colY, fontRegular, 9)
  page.drawLine({ start: { x: col2StartX + 40, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })

  // Col 3: Elaborado por (Right) - Alineado con las otras columnas
  colY = sigY
  const col3StartX = margin + sigColWidth * 2
  drawText(page, 'Elaborado por:', col3StartX, colY, fontRegular, 9)
  page.drawLine({ start: { x: col3StartX + 75, y: colY }, end: { x: col3StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 12
  drawCenter(page, safeText(empresa.propietario || ''), col3StartX + 75 + (sigColWidth - 85) / 2, colY, fontBold, 9)
  colY -= 10
  drawCenter(page, '(Nombre y Apellidos)', col3StartX + 75 + (sigColWidth - 85) / 2, colY, fontRegular, 7)
  colY -= 20

  drawText(page, 'C. Identidad:', col3StartX, colY, fontRegular, 9)
  page.drawLine({ start: { x: col3StartX + 65, y: colY }, end: { x: col3StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 20

  drawText(page, 'Firma:', col3StartX, colY, fontRegular, 9)
  page.drawLine({ start: { x: col3StartX + 40, y: colY }, end: { x: col3StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })

  // --- Footer (Payment Info) ---
  const footerY = 50

  page.drawLine({ start: { x: margin, y: footerY + 30 }, end: { x: margin + contentWidth, y: footerY + 30 }, thickness: 1, color: borderColor })

  const cb = empresa.cuentaBancaria
  const isUSD = cb?.moneda === 'USD'

  if (isUSD) {
    drawText(page, 'Dirija sus pagos en Dolares Americanos a:', margin, footerY + 15, fontRegular, 9)
    drawText(page, 'No. Cuenta USD:', margin, footerY, fontRegular, 10)
  } else {
    drawText(page, 'Dirija sus pagos en Moneda Nacional a:', margin, footerY + 15, fontRegular, 9)
    drawText(page, 'No. Cuenta CUP:', margin, footerY, fontRegular, 10)
  }

  const cuentaNumero = cb?.numeroCuenta || ''
  if (cuentaNumero) {
    drawText(page, cuentaNumero, margin + 90, footerY, fontBold, 11, blueColor)
  }

  drawText(page, 'Beneficiario:', margin + 300, footerY, fontRegular, 10)
  drawText(page, safeText(empresa.propietario || '').toUpperCase(), margin + 370, footerY, fontBold, 10, blueColor)

  const emailY = 20
  if (empresa.email) {
    const emailText = `Mi dirección electrónica: ${safeText(empresa.email)}`
    drawText(page, emailText, margin, emailY, fontRegular, 9)
    const emailWidth = fontRegular.widthOfTextAtSize(emailText, 9)
    page.drawLine({ start: { x: margin, y: emailY - 2 }, end: { x: margin + emailWidth, y: emailY - 2 }, thickness: 0.5 })
  }
}

export const GET = withAuth(async (request: NextRequest, context: any, user: any) => {
  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'ID de oferta requerido' }, { status: 400 })
  }

  const oferta = await prisma.oferta.findUnique({
    where: { id },
    include: {
      cliente: true,
      items: {
        include: {
          producto: true,
          servicio: true,
        },
      },
    },
  })

  if (!oferta) {
    return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })
  }

  const miEmpresa = await prisma.miEmpresa.findFirst({
    include: {
      cuentaBancaria: true,
    },
  })

  const empresa =
    miEmpresa ??
    ({
      nombre: 'Mi Empresa',
      propietario: null,
      direccion: null,
      telefono: null,
      email: null,
      carnetIdentidad: null,
      nit: null,
      licenciaOperacion: null,
      logoUrl: null,
      cuentaBancaria: null,
    } as const)

  const lines = buildLines(oferta)
  const totals = {
    subtotal: Number(oferta.subtotal ?? 0),
    total: Number(oferta.total ?? 0),
  }

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  let logoImage = null
  try {
    let logoBytes: Buffer | null = null
    let isPng = true

    // 1. Try logo from database (MiEmpresa)
    const dbLogoUrl = (empresa as { logoUrl?: string }).logoUrl

    if (dbLogoUrl && typeof dbLogoUrl === 'string') {
      if (dbLogoUrl.startsWith('http')) {
        try {
          const res = await fetch(dbLogoUrl)
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer()
            logoBytes = Buffer.from(arrayBuffer)
            isPng = dbLogoUrl.toLowerCase().endsWith('.png')
          }
        } catch (err) {
          console.error('Error fetching remote logo', err)
        }
      } else {
        const relativePath = dbLogoUrl.startsWith('/') ? dbLogoUrl.slice(1) : dbLogoUrl
        const localPath = path.join(process.cwd(), 'public', relativePath)
        if (fs.existsSync(localPath)) {
          logoBytes = fs.readFileSync(localPath)
          isPng = localPath.toLowerCase().endsWith('.png')
        }
      }
    }

    // 2. Fallback to default logo.png
    if (!logoBytes) {
      const defaultLogoPath = path.join(process.cwd(), 'public', 'images', 'logo.png')
      if (fs.existsSync(defaultLogoPath)) {
        logoBytes = fs.readFileSync(defaultLogoPath)
        isPng = defaultLogoPath.toLowerCase().endsWith('.png')
      }
    }

    // 3. Embed image
    if (logoBytes) {
      if (isPng) {
        logoImage = await pdfDoc.embedPng(logoBytes)
      } else {
        logoImage = await pdfDoc.embedJpg(logoBytes)
      }
    }
  } catch (e) {
    console.error('Error loading logo', e)
  }

  // Las ofertas por defecto son en CUP, pero podemos extenderlo si es necesario
  const currency = 'CUP'

  await generateOfferPDF(page, fontRegular, fontBold, fontItalic, logoImage, {
    miEmpresa: empresa,
    oferta,
    lines,
    totals,
    currency,
  })

  const offerNumber = oferta.numeroOferta || oferta.id
  const pdfBytes = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="oferta-${offerNumber}.pdf"`,
      'Content-Length': pdfBytes.length.toString(),
    },
  })
})
