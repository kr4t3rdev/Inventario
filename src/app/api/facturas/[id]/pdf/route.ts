import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/lib/auth-middleware"
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
  codigo?: string
}

function formatCurrency(amount: number, currency = "CUP") {
  return `${amount.toFixed(2)} ${currency}`.trim()
}

function safeText(text: string) {
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

function buildLines(venta: any): InvoiceLine[] {
  if (venta.oferta) {
    const items = venta.oferta.items ?? []
    return items.map((it: any) => {
      const nombre =
        it.producto?.nombre || it.servicio?.nombre || (it.productoId ? "Producto" : it.servicioId ? "Servicio" : "Ítem")
      const cantidad = Number(it.cantidad ?? 0)
      const precioUnitario = Number(it.precioUnitario ?? 0)
      const total = Number(it.total ?? precioUnitario * cantidad)
      return {
        descripcion: nombre,
        cantidad,
        precioUnitario,
        total,
        codigo: it.productoId || it.servicioId || it.id,
      }
    })
  }

  if (venta.items && Array.isArray(venta.items) && venta.items.length > 0) {
    return venta.items.map((it: any) => {
      const cantidad = Number(it.cantidad ?? 0)
      const precioUnitario = Number(
        it.precioUnitario ?? it.producto?.precioVenta ?? (cantidad > 0 ? Number(it.total ?? 0) / cantidad : 0)
      )
      const total = Number(it.total ?? precioUnitario * cantidad)
      return {
        descripcion: it.producto?.nombre || "Producto",
        cantidad,
        precioUnitario,
        total,
        codigo: it.producto?.id || it.productoId || it.id,
      }
    })
  }

  if (venta.producto) {
    const cantidad = Number(venta.cantidad ?? 0)
    const precioUnitario = Number(venta.producto.precioVenta ?? 0)
    const total = Number(venta.total ?? cantidad * precioUnitario)
    return [
      {
        descripcion: venta.producto.nombre,
        cantidad,
        precioUnitario,
        total,
        codigo: venta.producto.id,
      },
    ]
  }

  // Caso para ventas de reparaciones
  if (venta.ordenReparacion) {
    const orden = venta.ordenReparacion
    const equipoTipo = orden.equipoTipo?.nombre || 'Equipo'
    const marca = orden.marca || ''
    const modelo = orden.modelo || ''
    const descripcion = `Reparación ${equipoTipo} ${marca} ${modelo}`.trim()
    const cantidad = Number(venta.cantidad ?? 1)
    const precioUnitario = Number(venta.total ?? 0)
    const total = precioUnitario

    // Líneas adicionales para reparaciones
    const lines: InvoiceLine[] = []

    // Calcular montos para cada tipo de servicio
    const items = orden.items || []

    // Monto para Defectación de Equipos (basado en defectaciones)
    const montoDefectacion = items.reduce((sum: number, item: any) => {
      if (item.defectacion) {
        return sum + Number(item.defectacion.costo || 0)
      }
      return sum
    }, 0)

    // Monto para Mantenimiento (basado en piezas según complejidad)
    const montoMantenimiento = items.reduce((sum: number, item: any) => {
      if (item.pieza && item.complejidad) {
        let costo = 0
        switch (item.complejidad) {
          case 'PEQUENO':
            costo = Number(item.pieza.costoPequeno || 0)
            break
          case 'MEDIANO':
            costo = Number(item.pieza.costoMediano || 0)
            break
          case 'GRANDE':
            costo = Number(item.pieza.costoGrande || 0)
            break
        }
        return sum + costo
      }
      return sum
    }, 0)

    // Monto para Mano de Obra (precio del item menos los otros costos)
    const montoManoObra = items.reduce((sum: number, item: any) => {
      return sum + Number(item.precio || 0)
    }, 0) - montoDefectacion - montoMantenimiento

    // Línea principal con código
    lines.push({ 
      descripcion, 
      cantidad, 
      precioUnitario, 
      total,
      codigo: descripcion.substring(0, 3).toUpperCase()
    })

    // Líneas adicionales al final SIN código
    lines.push({
      descripcion: 'Cargo X Servicio / Defectacion de Equipos',
      cantidad: 1,
      precioUnitario: montoDefectacion,
      total: montoDefectacion,
      codigo: ''
    })

    lines.push({
      descripcion: 'Cargo X Servicio / Mantenimiento',
      cantidad: 1,
      precioUnitario: montoMantenimiento,
      total: montoMantenimiento,
      codigo: ''
    })

    lines.push({
      descripcion: 'Cargo X Servicio / Mano de Obra',
      cantidad: 1,
      precioUnitario: Math.max(0, montoManoObra),
      total: Math.max(0, montoManoObra),
      codigo: ''
    })

    return lines
  }

  const total = Number(venta.total ?? 0)
  return [{ descripcion: "Venta única", cantidad: 1, precioUnitario: total, total }]
}

function computeTotals(venta: any, lines: InvoiceLine[]) {
  if (venta.oferta) {
    return {
      subtotal: Number(venta.oferta.subtotal ?? 0),
      impuestos: Number(venta.oferta.impuestos ?? 0),
      descuento: 0,
      cargoTransporte: 0,
      total: Number(venta.oferta.total ?? venta.total ?? 0),
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + Number(l.total || 0), 0)
  const descuento = Number(venta.descuento ?? 0)
  const total = Number(venta.total ?? Math.max(0, subtotal - descuento))
  return { subtotal, impuestos: 0, descuento, cargoTransporte: 0, total }
}

async function generateInvoicePDF(
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
  const venta = payload.venta
  const factura = payload.factura
  const serie = payload.serie
  const totals = payload.totals
  const lines: InvoiceLine[] = payload.lines
  const currency = payload.currency || 'CUP'
  const tasaCambio = payload.tasaCambio || null

  const invoiceNumber = factura?.numeroFactura || venta?.ventaId || "N/A"
  const invoiceDate = factura?.fechaEmision || venta?.createdAt || new Date()
  
  const blueColor = rgb(0, 0, 0.8) // Approximate blue from image
  const redColor = rgb(1, 0, 0)
  const lightBlueColor = rgb(0.85, 0.92, 1) // Light blue background
  const borderColor = rgb(0, 0, 0)
  
  let y = height - margin

  // --- Header Section ---
  const headerHeight = 80
  
  // Left: Logo (approx 20% width)
  const logoBoxWidth = 120
  const logoWidth = 100
  const logoHeight = 60
  if (logoImage) {
    // Scale logo to fit in the box
    const dims = logoImage.scaleToFit(logoWidth, logoHeight)
    page.drawImage(logoImage, {
      x: margin + (logoBoxWidth - dims.width) / 2,
      y: y - headerHeight + 15,
      width: dims.width,
      height: dims.height,
    })
    
    // Si se desea mostrar el nombre debajo del logo, descomentar:
    // drawCenter(page, safeText(empresa.nombre), margin + 10 + dims.width / 2, y - headerHeight + 5, fontItalic, 10, blueColor)
  } else {
     // Si no hay logo, mostrar nombre de la empresa
     drawCenter(page, safeText(empresa.nombre), margin + logoBoxWidth / 2, y - headerHeight + 40, fontBold, 14, blueColor)
  }

  // Right Top Box: Factura Details
  // The image shows a large header area. Let's replicate the structure.
  
  // Box 1: Left Logo Area
  // Box 2: Center Title/Address Area
  // Box 3: Right Date/Number Area
  
  // Actually, looking closely at the image:
  // Top bar splits into Left (Logo) and Right (Everything else)
  // Then Right splits into Top (Factura Title) and Bottom (Address)
  // And there is a separate small box for No. and Fecha on the far right.
  
  // Let's draw the main boxes borders
  // Top Header Box (Right side)
  const headerBoxX = margin + logoBoxWidth
  const headerBoxWidth = contentWidth - logoBoxWidth
  
  // Title: FACTURA
  drawCenter(page, "FACTURA", headerBoxX + headerBoxWidth / 2, y - 30, fontBold, 36)
  
  // Subtitle
  drawCenter(page, "Información, Comunicaciones y Telecomunicaciones", headerBoxX + headerBoxWidth / 2, y - 45, fontItalic, 10, blueColor)
  
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
  // In the image, it looks like a separate box or just aligned text.
  // "No.: 102" "Fecha: 30/12/2025"
  const dateBoxY = y - 50
  // Vertical line to separate address and date/no
  page.drawLine({
    start: { x: dateBoxX, y: y - 50 },
    end: { x: dateBoxX, y: y - 90 },
    thickness: 1,
    color: borderColor,
  })
  
  drawText(page, "No.:", dateBoxX + 10, addrY, fontRegular, 10)
  drawRight(page, invoiceNumber, margin + contentWidth - 10, addrY, fontBold, 10)
  
  drawText(page, "Fecha:", dateBoxX + 10, addrY - 15, fontRegular, 10)
  drawRight(page, new Date(invoiceDate).toLocaleDateString("es-ES"), margin + contentWidth - 10, addrY - 15, fontBold, 10)

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
  // Two columns
  const col1X = margin
  const col2X = margin + contentWidth / 2 + 20
  const infoY = y
  
  // Left Column: Client
  const cliente = venta.cliente || {}
  let currentY = infoY
  
  drawText(page, "Cliente:", col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.nombre), col1X + 80, currentY, fontBold, 10)
  currentY -= 15
  
  drawText(page, "Dirección:", col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.direccion), col1X + 80, currentY, fontRegular, 10)
  currentY -= 15
  
  // Mostrar solo la cuenta según la moneda de la factura
  if (currency === 'USD') {
    drawText(page, "No. Cuenta USD:", col1X, currentY, fontRegular, 10)
    drawText(page, safeText(cliente.numeroCuentaUSD), col1X + 80, currentY, fontRegular, 10)
    currentY -= 15
  } else {
    drawText(page, "No. Cuenta CUP:", col1X, currentY, fontRegular, 10)
    drawText(page, safeText(cliente.numeroCuentaCUP), col1X + 80, currentY, fontRegular, 10)
    currentY -= 15
  }
  
  currentY -= 30 // Increased Gap from 25 to 30 for more margin before Contract No.
  
  drawText(page, "No. Contrato:", col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.numeroContrato), col1X + 80, currentY, fontRegular, 10)
  currentY -= 15
  
  drawText(page, "Fecha:", col1X, currentY, fontRegular, 10)
  // Assuming contract date or invoice date repeated
  // drawText(page, "", col1X + 80, currentY, fontRegular, 10)
  
  const yLeft = currentY

  // Right Column: Provider
  currentY = infoY
  drawText(page, "Proveedor:", col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(empresa.propietario || "Diosmani Dervilla Aguilar"), margin + contentWidth, currentY, fontBold, 10)
  currentY -= 15
  
  drawText(page, "C. Identidad:", col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(empresa.carnetIdentidad || "78032222262"), margin + contentWidth, currentY, fontRegular, 10)
  currentY -= 15
  
  drawText(page, "NIT:", col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(empresa.nit || "78032222262"), margin + contentWidth, currentY, fontRegular, 10)
  currentY -= 15
  
  drawText(page, "Licencia de Operación:", col2X, currentY, fontRegular, 10)
  drawRight(page, safeText(empresa.licenciaOperacion || "C 023179"), margin + contentWidth, currentY, fontRegular, 10)
  
  y = Math.min(yLeft, currentY) - 30

  // --- Items Table ---
  const tableTopY = y
  const headerHeightTable = 20
  
  // Column Positions
  // Adjusted for better spacing
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
  drawText(page, "CÓDIGO", colCodeX + 5, headerY, fontBold, 9)
  // Align Description Header to Left to match content
  drawText(page, "DESCRIPCIÓN", colDescX + 5, headerY, fontBold, 9)
  drawCenter(page, "CANTIDAD", colQtyX + 25, headerY, fontBold, 9)
  drawCenter(page, "P. UNITARIO", colPriceX + 40, headerY, fontBold, 9)
  drawCenter(page, "IMPORTE", colTotalX + 40, headerY, fontBold, 9)
  
  y -= headerHeightTable
  
  // Rows
  const rowHeight = 18 // Increased row height for better spacing
  let cargoXStarted = false

  for (const line of lines) {
    // Determine code: use explicit codigo if provided, otherwise generate from description
    const code = line.codigo !== undefined ? line.codigo : line.descripcion.substring(0, 3).toUpperCase()

    // Check if this is a "Cargo X" line (no code, special formatting)
    const isCargoX = !code && line.descripcion.startsWith('Cargo X')

    // Add blank space before first Cargo X line (for closure impression)
    if (isCargoX && !cargoXStarted) {
      cargoXStarted = true
      // Add 2 blank rows before Cargo X items
      y -= rowHeight * 2
    }

    // Vertical alignment adjustment (centered in row)
    const textY = y - 4

    if (isCargoX) {
      // For Cargo X lines: show only description (in description column) and importe (total)
      // Description starts at description column (not code column)
      drawText(page, safeText(line.descripcion).slice(0, 50), colDescX + 5, textY, fontRegular, 9)
      // Only show importe (total), no cantidad or precio unitario
      drawRight(page, line.total.toFixed(2), colTotalX + 80, textY, fontRegular, 9)
    } else {
      // Normal line formatting
      // Only draw code if not empty
      if (code) {
        drawText(page, code, colCodeX + 5, textY, fontRegular, 9)
      }
      // Allow slightly longer description
      drawText(page, safeText(line.descripcion).slice(0, 55), colDescX + 5, textY, fontRegular, 9)
      drawCenter(page, String(line.cantidad), colQtyX + 25, textY, fontRegular, 9)
      drawRight(page, line.precioUnitario.toFixed(2), colPriceX + 70, textY, fontRegular, 9)
      drawRight(page, line.total.toFixed(2), colTotalX + 80, textY, fontRegular, 9)
    }

    y -= rowHeight
  }
  
  // Draw vertical lines for table columns
  const minTableBottomY = 280
  const actualTableBottomY = Math.min(y, minTableBottomY)
  
  // Outer border of the table body (transparent fill)
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
  verticalLinesX.forEach(x => {
    page.drawLine({
      start: { x: x, y: tableTopY - headerHeightTable + 5 }, // Start from bottom of header
      end: { x: x, y: actualTableBottomY },
      thickness: 1,
      color: borderColor,
    })
  })
  
  y = actualTableBottomY

  // --- Observations & Totals ---
  // Box split: Left (Observations) approx 65%, Right (Totals) 35%
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
  
  drawText(page, "OBSERVACIONES:", margin + 5, y - 12, fontRegular, 9)
  if (venta.observaciones) {
     drawText(page, safeText(venta.observaciones), margin + 5, y - 24, fontRegular, 9)
  }
  
  // Importe en letras (Bottom of Obs box)
  const importeLetras = numeroALetras(totals.total, { 
    plural: '', singular: '', centPlural: '', centSingular: '' 
  })
  drawText(page, "IMPORTE EN LETRAS:", margin + 5, y - obsHeight + 10, fontRegular, 8)
  drawText(page, safeText(importeLetras), margin + 100, y - obsHeight + 10, fontBold, 8)
  
  // Totals Box
  // Background for Subtotal/Cargo
  page.drawRectangle({
    x: margin + obsWidth,
    y: y - obsHeight + 20, // Leave bottom 20 for Total
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
  
  // Recalculate Total to ensure it includes cargo if not already
  // The 'totals' payload should already be correct, but let's trust it.
  
  totalY = y - obsHeight + 6
  drawRight(page, `TOTAL ${currencyLabel}`, margin + obsWidth + 110, totalY, fontBold, 10)
  drawRight(page, totals.total.toFixed(2), margin + contentWidth - 10, totalY, fontBold, 10, redColor)
  
  // Mostrar tasa de cambio si es CUP
  if (currency === 'CUP' && tasaCambio) {
    totalY -= 12
    drawRight(page, `Tasa: 1 USD = ${tasaCambio} CUP`, margin + contentWidth - 10, totalY, fontItalic, 8, blueColor)
  }
  
  y -= (obsHeight + 20)

  // --- Signatures ---
  // Detectar si es factura de servicio (reparación) o venta
  const esServicio = !!venta.ordenReparacion
  
  // 2 Columns para servicio, 3 columns para venta
  const numCols = esServicio ? 2 : 3
  const sigColWidth = contentWidth / numCols
  const sigY = y - 20
  
  // Col 1: Recibido por (Left) - SIEMPRE presente
  let colY = sigY
  drawText(page, "Recibido por:", margin, colY, fontRegular, 9)
  page.drawLine({ start: { x: margin + 60, y: colY }, end: { x: margin + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 12
  drawCenter(page, "(Nombre y Apellidos)", margin + 60 + (sigColWidth - 70) / 2, colY, fontRegular, 7)
  colY -= 15
  
  drawText(page, "C. Identidad:", margin, colY, fontRegular, 9)
  page.drawLine({ start: { x: margin + 60, y: colY }, end: { x: margin + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 25
  
  drawText(page, "Firma:", margin + 20, colY, fontRegular, 9)
  page.drawLine({ start: { x: margin + 60, y: colY }, end: { x: margin + sigColWidth - 10, y: colY }, thickness: 0.5 })

  if (!esServicio) {
    // Col 2: Transportista (Center) - SOLO para ventas
    colY = sigY
    const col2StartX = margin + sigColWidth
    drawText(page, "Transportista:", col2StartX, colY, fontRegular, 9)
    page.drawLine({ start: { x: col2StartX + 65, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
    colY -= 12
    drawCenter(page, "(Nombre y Apellidos)", col2StartX + 65 + (sigColWidth - 75) / 2, colY, fontRegular, 7)
    colY -= 15
    
    drawText(page, "C.Identidad:", col2StartX, colY, fontRegular, 9)
    page.drawLine({ start: { x: col2StartX + 60, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
    colY -= 15
    
    drawText(page, "No. Licencia:", col2StartX, colY, fontRegular, 9)
    page.drawLine({ start: { x: col2StartX + 60, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
    colY -= 15
    
    drawText(page, "Chapa:", col2StartX, colY, fontRegular, 9)
    page.drawLine({ start: { x: col2StartX + 60, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
    colY -= 15
    
    drawText(page, "Carta Porte:", col2StartX, colY, fontRegular, 9)
    page.drawLine({ start: { x: col2StartX + 60, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
    colY -= 20
    
    drawText(page, "Firma:", col2StartX, colY, fontRegular, 9)
    page.drawLine({ start: { x: col2StartX + 40, y: colY }, end: { x: col2StartX + sigColWidth - 10, y: colY }, thickness: 0.5 })
  }

  // Col 2 (servicio) o Col 3 (venta): Elaborado por (Right) - Alineado con las otras columnas
  colY = sigY
  const elaboradoColX = margin + sigColWidth * (esServicio ? 1 : 2)
  drawText(page, "Elaborado por:", elaboradoColX, colY, fontRegular, 9)
  page.drawLine({ start: { x: elaboradoColX + 75, y: colY }, end: { x: elaboradoColX + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 12
  drawCenter(page, safeText(empresa.propietario || "Diosmani Dervilla Aguilar"), elaboradoColX + 75 + (sigColWidth - 85) / 2, colY, fontBold, 9)
  colY -= 10
  drawCenter(page, "(Nombre y Apellidos)", elaboradoColX + 75 + (sigColWidth - 85) / 2, colY, fontRegular, 7)
  colY -= 20
  
  drawText(page, "C. Identidad:", elaboradoColX, colY, fontRegular, 9)
  page.drawLine({ start: { x: elaboradoColX + 65, y: colY }, end: { x: elaboradoColX + sigColWidth - 10, y: colY }, thickness: 0.5 })
  colY -= 20
  
  drawText(page, "Firma:", elaboradoColX, colY, fontRegular, 9)
  page.drawLine({ start: { x: elaboradoColX + 40, y: colY }, end: { x: elaboradoColX + sigColWidth - 10, y: colY }, thickness: 0.5 })
  
  // --- Footer (Payment Info) ---
  const footerY = 50
  
  page.drawLine({ start: { x: margin, y: footerY + 30 }, end: { x: margin + contentWidth, y: footerY + 30 }, thickness: 1, color: borderColor })
  
  const cb = factura?.cuentaBancaria || empresa.cuentaBancaria
  const isUSD = cb?.moneda === 'USD'
  
  if (isUSD) {
      drawText(page, "Dirija sus pagos en Dolares Americanos a:", margin, footerY + 15, fontRegular, 9)
      drawText(page, "No. Cuenta USD:", margin, footerY, fontRegular, 10)
  } else {
      drawText(page, "Dirija sus pagos en Moneda Nacional a:", margin, footerY + 15, fontRegular, 9)
      drawText(page, "No. Cuenta CUP:", margin, footerY, fontRegular, 10)
  }
  
  const cuentaNumero = cb?.numeroCuenta || "1258070000461016"
  drawText(page, cuentaNumero, margin + 90, footerY, fontBold, 11, blueColor)
  
  drawText(page, "Beneficiario:", margin + 300, footerY, fontRegular, 10)
  drawText(page, (empresa.propietario || "DIOSMANI DERVILLA AGUILAR").toUpperCase(), margin + 370, footerY, fontBold, 10, blueColor)
  
  const emailY = 20
  drawText(page, "Mi dirección electrónica: dervilla@nauta.cu", margin, emailY, fontRegular, 9)
  const emailWidth = fontRegular.widthOfTextAtSize("Mi dirección electrónica: dervilla@nauta.cu", 9)
  page.drawLine({ start: { x: margin, y: emailY - 2 }, end: { x: margin + emailWidth, y: emailY - 2 }, thickness: 0.5 })
}

export const GET = withAuth(async (request: NextRequest, context: any, user: any) => {
  const id = context?.params?.id as string | undefined
  if (!id) {
    return NextResponse.json({ error: "ID de factura requerido" }, { status: 400 })
  }

  let factura = null
  let serie = null
  let venta = null

  // Try to fetch by factura ID first
  factura = await prisma.factura.findUnique({
    where: { idFactura: id },
    select: {
      idFactura: true,
      numeroFactura: true,
      fechaEmision: true,
      subtotal: true,
      impuestos: true,
      descuento: true,
      cargoTransporte: true,
      total: true,
      tasaCambio: true,
      serie: true,
      cuentaBancaria: { select: { moneda: true, numeroCuenta: true } },
      venta: {
        include: {
          cliente: { select: { clienteId: true, nombre: true, direccion: true, numeroCuentaCUP: true, numeroCuentaUSD: true, numeroContrato: true } },
          puntoDeVenta: { select: { pvId: true, nombre: true } },
          producto: { select: { id: true, nombre: true, precioVenta: true } },
          oferta: {
            select: {
              id: true,
              numeroOferta: true,
              subtotal: true,
              impuestos: true,
              total: true,
              items: {
                select: {
                  id: true,
                  cantidad: true,
                  precioUnitario: true,
                  total: true,
                  producto: { select: { nombre: true } },
                  servicio: { select: { nombre: true } },
                  productoId: true,
                  servicioId: true,
                },
              },
            },
          },
          ordenReparacion: {
            select: {
              id: true,
              numeroOrden: true,
              marca: true,
              modelo: true,
              equipoTipo: { select: { nombre: true } },
              items: {
                select: {
                  id: true,
                  precio: true,
                  complejidad: true,
                  defectacion: { select: { defecto: true, costo: true } },
                  pieza: { select: { nombre: true, costoPequeno: true, costoMediano: true, costoGrande: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (factura) {
    serie = factura.serie
    venta = factura.venta
  } else {
    // Try to fetch factura by ventaId
    factura = await prisma.factura.findFirst({
      where: { ventaId: id },
      select: {
        idFactura: true,
        numeroFactura: true,
        fechaEmision: true,
        subtotal: true,
        impuestos: true,
        descuento: true,
        cargoTransporte: true,
        total: true,
        tasaCambio: true,
        serie: true,
        cuentaBancaria: { select: { moneda: true, numeroCuenta: true } },
        venta: {
          include: {
            cliente: { select: { clienteId: true, nombre: true, direccion: true, numeroCuentaCUP: true, numeroCuentaUSD: true, numeroContrato: true } },
            puntoDeVenta: { select: { pvId: true, nombre: true } },
            producto: { select: { id: true, nombre: true, precioVenta: true } },
            oferta: {
              select: {
                id: true,
                numeroOferta: true,
                subtotal: true,
                impuestos: true,
                total: true,
                items: {
                  select: {
                    id: true,
                    cantidad: true,
                    precioUnitario: true,
                    total: true,
                    producto: { select: { nombre: true } },
                    servicio: { select: { nombre: true } },
                    productoId: true,
                    servicioId: true,
                  },
                },
              },
            },
            ordenReparacion: {
              select: {
                id: true,
                numeroOrden: true,
                marca: true,
                modelo: true,
                equipoTipo: { select: { nombre: true } },
                items: {
                  select: {
                    id: true,
                    precio: true,
                    complejidad: true,
                    defectacion: { select: { defecto: true, costo: true } },
                    pieza: { select: { nombre: true, costoPequeno: true, costoMediano: true, costoGrande: true } },
                  },
                },
              },
            },
          },
        },
      },
    })
    if (factura) {
      serie = factura.serie
      venta = factura.venta
    } else {
      // Fallback to venta only (no factura)
      venta = await prisma.venta.findUnique({
        where: { ventaId: id },
        include: {
          cliente: { select: { clienteId: true, nombre: true, direccion: true, numeroCuentaCUP: true, numeroCuentaUSD: true, numeroContrato: true } },
          puntoDeVenta: { select: { pvId: true, nombre: true } },
          producto: { select: { id: true, nombre: true, precioVenta: true } },
          oferta: {
            select: {
              id: true,
              numeroOferta: true,
              subtotal: true,
              impuestos: true,
              total: true,
              items: {
                select: {
                  id: true,
                  cantidad: true,
                  precioUnitario: true,
                  total: true,
                  producto: { select: { nombre: true } },
                  servicio: { select: { nombre: true } },
                  productoId: true,
                  servicioId: true,
                },
              },
            },
          },
          ordenReparacion: {
            select: {
              id: true,
              numeroOrden: true,
              marca: true,
              modelo: true,
              equipoTipo: { select: { nombre: true } },
              items: {
                select: {
                  id: true,
                  precio: true,
                  complejidad: true,
                  defectacion: { select: { defecto: true, costo: true } },
                  pieza: { select: { nombre: true, costoPequeno: true, costoMediano: true, costoGrande: true } },
                },
              },
            },
          },
        },
      })
      if (!venta) {
        return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
      }
    }
  }

  if (!venta) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
  }

  if (!venta.producto && !venta.oferta && !venta.ordenReparacion) {
    const ventaItems = await prisma.ventaItem.findMany({
      where: { ventaId: venta.ventaId },
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            precioVenta: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })
    if (ventaItems.length > 0) {
      ;(venta as any).items = ventaItems
    } else {
      const legacyItems = await prisma.venta.findMany({
        where: { ventaPadreId: venta.ventaId },
        include: {
          producto: {
            select: {
              id: true,
              nombre: true,
              precioVenta: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })
      if (legacyItems.length > 0) {
        ;(venta as any).items = legacyItems
      }
    }
  }

  const miEmpresa = await prisma.miEmpresa.findFirst({
    select: {
      nombre: true,
      direccion: true,
      telefono: true,
      email: true,
      propietario: true,
      carnetIdentidad: true,
      nit: true,
      licenciaOperacion: true,
      logoUrl: true,
      cuentaBancaria: {
        select: { nombreBanco: true, numeroCuenta: true, moneda: true, tipoCuenta: true },
      },
    },
  })

  const empresa = miEmpresa ?? {
    nombre: "Soluciones Dervilla",
    direccion: "Calle Cuba #108",
    telefono: "54234912",
    email: "dervilla@nauta.cu",
    identificacionFiscal: null,
    cuentaBancaria: null,
    propietario: "Diosmani Dervilla Aguilar",
    carnetIdentidad: "78032222262",
    nit: "78032222262",
    licenciaOperacion: "C 023179"
  }

  // Detectar si la factura es en USD
  const cb = factura?.cuentaBancaria || empresa.cuentaBancaria
  const isUSD = cb?.moneda === 'USD'
  
  // Obtener tasa de cambio (si la factura tiene tasa guardada, usarla, si no, buscar la actual)
  let tasaCambio: number = 120 // Valor por defecto
  if (isUSD) {
    if (factura?.tasaCambio) {
      tasaCambio = Number(factura.tasaCambio) || 120
    } else {
      // Buscar tasa actual CUP -> USD (almacenada como USD -> CUP, por eso dividimos)
      const tasaActual = await prisma.tasaCambio.findFirst({
        where: { monedaOrigenId: 'USD', monedaDestino: 'CUP' },
        orderBy: { fechaVigencia: 'desc' }
      })
      if (tasaActual) {
        tasaCambio = Number(tasaActual.tasa) || 120
      }
    }
  }
  
  // Función para convertir CUP a USD
  const toUSD = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return 0
    return isUSD ? amount / tasaCambio : amount
  }

  const lines = buildLines(venta)
  
  // Convertir valores de líneas a USD si es necesario
  const linesUSD = lines.map(line => ({
    ...line,
    precioUnitario: toUSD(line.precioUnitario),
    total: toUSD(line.total)
  }))
  
  // Use factura totals if available, otherwise compute from venta
  const totalsBase = factura ? {
    subtotal: Number(factura.subtotal),
    impuestos: Number(factura.impuestos),
    descuento: Number(factura.descuento),
    cargoTransporte: Number(factura.cargoTransporte || 0),
    total: Number(factura.total),
  } : computeTotals(venta, lines)
  
  // Convertir totales a USD si es necesario
  const totals = {
    subtotal: toUSD(totalsBase.subtotal),
    impuestos: toUSD(totalsBase.impuestos),
    descuento: toUSD(totalsBase.descuento),
    cargoTransporte: toUSD(totalsBase.cargoTransporte),
    total: toUSD(totalsBase.total),
  }

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  
  let logoImage = null
  try {
    let logoBytes: Buffer | null = null
    let isPng = true // Default to PNG

    // 1. Try logo from database (MiEmpresa)
    const dbLogoUrl = (empresa as { logoUrl?: string }).logoUrl
    
    if (dbLogoUrl && typeof dbLogoUrl === 'string') {
        if (dbLogoUrl.startsWith('http')) {
            // Remote URL
            try {
                const res = await fetch(dbLogoUrl)
                if (res.ok) {
                    const arrayBuffer = await res.arrayBuffer()
                    logoBytes = Buffer.from(arrayBuffer)
                    isPng = dbLogoUrl.toLowerCase().endsWith('.png')
                }
            } catch (err) {
                console.error("Error fetching remote logo", err)
            }
        } else {
            // Local path (e.g. "/images/custom-logo.png")
            // Remove leading slash if present to join correctly
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
    console.error("Error loading logo", e)
  }

  // Determinar la moneda de la factura
  const facturaCurrency = isUSD ? 'USD' : 'CUP'

  await generateInvoicePDF(page, fontRegular, fontBold, fontItalic, logoImage, {
    miEmpresa: empresa,
    venta,
    factura,
    serie,
    lines: linesUSD,
    totals,
    currency: facturaCurrency,
    tasaCambio: isUSD ? tasaCambio : null,
  })

  const invoiceNumber = factura?.numeroFactura || venta!.ventaId
  const pdfBytes = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="factura-${invoiceNumber}.pdf"`,
      "Content-Length": pdfBytes.length.toString(),
    },
  })
})
