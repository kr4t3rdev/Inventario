import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet } from "@/lib/auth-middleware"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { numeroALetras } from "@/lib/number-to-words"
import fs from "fs"
import path from "path"

export const runtime = "nodejs"

type InvoiceLine = {
  descripcion: string
  cantidad: number
  precioUnitario: number
  total: number
}

function safeText(text: string | null | undefined) {
  return (text || "").replace(/\s+/g, " ").trim()
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

function buildLines(orden: any): InvoiceLine[] {
  const lines: InvoiceLine[] = []

  // Items (Mano de Obra / Piezas)
  if (orden.items) {
    orden.items.forEach((item: any) => {
      lines.push({
        descripcion: `${item.pieza?.nombre || 'Servicio'} (${item.complejidad})`,
        cantidad: 1,
        precioUnitario: Number(item.precio),
        total: Number(item.precio)
      })
    })
  }

  // Materiales (Repuestos)
  if (orden.materiales) {
    orden.materiales.forEach((mat: any) => {
      lines.push({
        descripcion: mat.producto?.nombre || 'Material',
        cantidad: Number(mat.cantidad),
        precioUnitario: Number(mat.precioUnitario),
        total: Number(mat.total)
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
  payload: any
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

  // --- Header Section ---
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

  // Header Box (Right side)
  const headerBoxX = margin + logoBoxWidth
  const headerBoxWidth = contentWidth - logoBoxWidth
  
  drawCenter(page, "COTIZACIÓN", headerBoxX + headerBoxWidth / 2, y - 30, fontBold, 36)
  drawCenter(page, "Servicio Técnico y Reparaciones", headerBoxX + headerBoxWidth / 2, y - 45, fontItalic, 10, blueColor)
  
  page.drawLine({
    start: { x: headerBoxX, y: y - 50 },
    end: { x: margin + contentWidth, y: y - 50 },
    thickness: 1,
    color: borderColor,
  })
  
  const addrY = y - 65
  const dateBoxX = margin + contentWidth - 120
  const addressCenterX = headerBoxX + (dateBoxX - headerBoxX) / 2
  
  if (empresa.direccion) {
      drawCenter(page, safeText(empresa.direccion), addressCenterX, addrY, fontRegular, 9)
  }
  if (empresa.telefono) {
      drawCenter(page, `Tel: ${safeText(empresa.telefono)}`, addressCenterX, addrY - 12, fontRegular, 9)
  }
  
  // Date/No Box
  const dateBoxY = y - 50
  page.drawLine({
    start: { x: dateBoxX, y: y - 50 },
    end: { x: dateBoxX, y: y - 90 },
    thickness: 1,
    color: borderColor,
  })
  
  drawText(page, "Cotización:", dateBoxX + 10, addrY, fontRegular, 10)
  drawRight(page, String(orden.numeroOrden), margin + contentWidth - 10, addrY, fontBold, 10)
  
  drawText(page, "Fecha:", dateBoxX + 10, addrY - 15, fontRegular, 10)
  drawRight(page, new Date().toLocaleDateString("es-ES"), margin + contentWidth - 10, addrY - 15, fontBold, 10)

  // Header Border
  page.drawRectangle({
    x: margin,
    y: y - 90,
    width: contentWidth,
    height: 90,
    borderWidth: 1,
    borderColor: borderColor,
  })
  
  page.drawLine({
    start: { x: margin + logoBoxWidth, y: y },
    end: { x: margin + logoBoxWidth, y: y - 90 },
    thickness: 1,
    color: borderColor,
  })

  y -= 100

  // --- Client & Info ---
  const col1X = margin
  const col2X = margin + contentWidth / 2 + 20
  const infoY = y
  
  // Left Column: Client
  const cliente = orden.cliente || {}
  let currentY = infoY
  
  drawText(page, "Cliente:", col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.nombre), col1X + 80, currentY, fontBold, 10)
  currentY -= 15
  
  drawText(page, "Dirección:", col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.direccion), col1X + 80, currentY, fontRegular, 10)
  currentY -= 15

  drawText(page, "Teléfono:", col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.telefono), col1X + 80, currentY, fontRegular, 10)
  currentY -= 15
  
  const yLeft = currentY

  // Right Column: Equipment
  currentY = infoY
  drawText(page, "Equipo:", col2X, currentY, fontRegular, 10)
  drawRight(page, `${safeText(orden.equipoTipo?.nombre)} - ${safeText(orden.marca)}`, margin + contentWidth, currentY, fontBold, 10)
  currentY -= 15
  
  drawText(page, "Modelo:", col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(orden.modelo), margin + contentWidth, currentY, fontRegular, 10)
  currentY -= 15
  
  drawText(page, "Serie:", col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(orden.numeroSerie), margin + contentWidth, currentY, fontRegular, 10)
  currentY -= 15

  y = Math.min(yLeft, currentY) - 30

  // --- Items Table ---
  const tableTopY = y
  const headerHeightTable = 20
  
  const colCodeX = margin
  const colDescX = margin + 55
  const colQtyX = margin + 310
  const colPriceX = margin + 370
  const colTotalX = margin + 450
  const tableWidth = contentWidth
  
  page.drawRectangle({
    x: margin,
    y: tableTopY - headerHeightTable + 5,
    width: tableWidth,
    height: headerHeightTable,
    color: lightBlueColor,
    borderColor: borderColor,
    borderWidth: 1,
  })
  
  const headerY = tableTopY - headerHeightTable + 11
  drawText(page, "TIPO", colCodeX + 5, headerY, fontBold, 9)
  drawText(page, "DESCRIPCIÓN", colDescX + 5, headerY, fontBold, 9)
  drawCenter(page, "CANTIDAD", colQtyX + 25, headerY, fontBold, 9)
  drawCenter(page, "PRECIO", colPriceX + 40, headerY, fontBold, 9)
  drawCenter(page, "IMPORTE", colTotalX + 40, headerY, fontBold, 9)
  
  y -= headerHeightTable
  
  const rowHeight = 18
  for (const line of lines) {
    const textY = y - 4 

    drawText(page, "ITEM", colCodeX + 5, textY, fontRegular, 9)
    drawText(page, safeText(line.descripcion).slice(0, 55), colDescX + 5, textY, fontRegular, 9)
    drawCenter(page, String(line.cantidad), colQtyX + 25, textY, fontRegular, 9)
    drawRight(page, line.precioUnitario.toFixed(2), colPriceX + 70, textY, fontRegular, 9)
    drawRight(page, line.total.toFixed(2), colTotalX + 80, textY, fontRegular, 9)
    
    y -= rowHeight
  }
  
  const minTableBottomY = 280
  const actualTableBottomY = Math.min(y, minTableBottomY)
  
  page.drawRectangle({
      x: margin,
      y: actualTableBottomY,
      width: tableWidth,
      height: tableTopY - actualTableBottomY - headerHeightTable + 5,
      borderWidth: 1,
      borderColor: borderColor,
      color: undefined, 
  })

  const verticalLinesX = [colDescX, colQtyX, colPriceX, colTotalX]
  verticalLinesX.forEach(x => {
    page.drawLine({
      start: { x: x, y: tableTopY - headerHeightTable + 5 },
      end: { x: x, y: actualTableBottomY },
      thickness: 1,
      color: borderColor,
    })
  })
  
  y = actualTableBottomY

  // --- Totals ---
  const obsWidth = contentWidth * 0.65
  const totalsWidth = contentWidth * 0.35
  const obsHeight = 60
  
  page.drawRectangle({
    x: margin,
    y: y - obsHeight,
    width: obsWidth,
    height: obsHeight,
    borderWidth: 1,
    borderColor: borderColor,
  })
  
  drawText(page, "OBSERVACIONES:", margin + 5, y - 12, fontRegular, 9)
  if (orden.problemaReportado) {
     drawText(page, `Problema: ${safeText(orden.problemaReportado).slice(0, 80)}...`, margin + 5, y - 24, fontRegular, 9)
  }
  if (orden.diagnosticoTecnico) {
     drawText(page, `Diagnóstico: ${safeText(orden.diagnosticoTecnico).slice(0, 80)}...`, margin + 5, y - 36, fontRegular, 9)
  }
  
  const importeLetras = numeroALetras(payload.total, { 
    plural: '', singular: '', centPlural: '', centSingular: '' 
  })
  drawText(page, "TOTAL EN LETRAS:", margin + 5, y - obsHeight + 10, fontRegular, 8)
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
  
  let totalY = y - 15
  drawRight(page, "SUBTOTAL", margin + obsWidth + 110, totalY, fontRegular, 9)
  drawRight(page, payload.subtotal.toFixed(2), margin + contentWidth - 10, totalY, fontRegular, 9)
  
  if (payload.descuento > 0) {
    totalY -= 15
    drawRight(page, "DESCUENTO", margin + obsWidth + 110, totalY, fontRegular, 9)
    drawRight(page, payload.descuento.toFixed(2), margin + contentWidth - 10, totalY, fontRegular, 9)
  }
  
  // Total Row
  page.drawRectangle({
    x: margin + obsWidth,
    y: y - obsHeight,
    width: totalsWidth,
    height: 20,
    borderColor: borderColor,
    borderWidth: 1,
  })
  
  totalY = y - obsHeight + 6
  drawRight(page, "TOTAL", margin + obsWidth + 110, totalY, fontBold, 10)
  drawRight(page, payload.total.toFixed(2), margin + contentWidth - 10, totalY, fontBold, 10, redColor)
  
  y -= (obsHeight + 20)

  // --- Footer ---
  const footerY = 50
  
  page.drawLine({ start: { x: margin, y: footerY + 30 }, end: { x: margin + contentWidth, y: footerY + 30 }, thickness: 1, color: borderColor })
  
  drawText(page, "Esta cotización es válida por 15 días.", margin, footerY + 15, fontRegular, 9)
  
  const emailY = 20
  drawText(page, `Emitido por: ${safeText(empresa.nombre)}`, margin, emailY, fontRegular, 9)
}

export const GET = withAuthGet(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "ID de orden requerido" }, { status: 400 })
  }

  const orden = await prisma.ordenReparacion.findUnique({
    where: { id },
    include: {
      cliente: true,
      equipoTipo: true,
      tecnico: true,
      items: {
        include: { pieza: true }
      },
      materiales: {
        include: { producto: true }
      }
    }
  })

  if (!orden) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 })
  }

  const miEmpresa = await prisma.miEmpresa.findFirst({
    include: { cuentaBancaria: true }
  })

  const empresa = miEmpresa ?? {
    nombre: "Soluciones Dervilla",
    direccion: "Calle Cuba #108",
    telefono: "54234912",
    email: "dervilla@nauta.cu"
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
        const publicPath = path.join(process.cwd(), "public")
        // Handle leading slash
        const relativePath = miEmpresa.logoUrl.startsWith('/') ? miEmpresa.logoUrl.slice(1) : miEmpresa.logoUrl
        const logoPath = path.join(publicPath, relativePath)
        
        if (fs.existsSync(logoPath)) {
            const logoBytes = fs.readFileSync(logoPath)
            if (logoPath.toLowerCase().endsWith(".png")) {
                logoImage = await pdfDoc.embedPng(logoBytes)
            } else if (logoPath.toLowerCase().endsWith(".jpg") || logoPath.toLowerCase().endsWith(".jpeg")) {
                logoImage = await pdfDoc.embedJpg(logoBytes)
            }
        }
    } catch (e) {
        console.error("Error loading logo:", e)
    }
  }

  await generateCotizacionPDF(page, fontRegular, fontBold, fontItalic, logoImage, {
    miEmpresa: empresa,
    orden,
    lines,
    subtotal,
    descuento,
    total
  })

  const pdfBytes = await pdfDoc.save()

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cotizacion-${orden.numeroOrden}.pdf"`,
      "Content-Length": pdfBytes.length.toString(),
    },
  })
})
