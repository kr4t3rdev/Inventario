import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'
import { withAuth } from '@/lib/auth-middleware'
import { Prisma } from '@/generated/prisma'
import {
  applyFacturacionCobroWorkflow,
  reconciliarVentaDirecta
} from '@/features/ventas/services/facturacion-workflow'
import { applyAnticipoAllocations, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { numeroALetras } from '@/lib/number-to-words'
import fs from 'fs'
import path from 'path'

const ofertaItemSchema = z.object({
  productoId: z.string().optional(),
  servicioId: z.string().optional(),
  cantidad: z.number().int().positive(),
  precioUnitario: z.number().nonnegative(),
  total: z.number().nonnegative()
})

const ofertaSchema = z.object({
  clienteId: z.string().min(1, "Cliente requerido"),
  fechaVencimiento: z.string().optional(),
  subtotal: z.number().nonnegative(),
  impuestos: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  observaciones: z.string().optional(),
  items: z.array(ofertaItemSchema).min(1, "Al menos un item requerido")
})

const updateSchema = z.object({
  estado: z.enum(['PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'FACTURADA']).optional(),
  observaciones: z.string().optional()
})

const facturarSchema = z.object({
  puntoDeVentaId: z.string().min(1, "Punto de Venta requerido"),
  empleadoId: z.string().optional(),
  observaciones: z.string().optional(),
  cargoTransporte: z.number().optional(),
  serieId: z.string().optional(),
  cuentaBancariaId: z.string().optional(),
  fechaVencimiento: z.string().nullable().optional(),
  tipoVencimiento: z.string().optional(),
  anticipoCobroId: z.string().optional(),
  formaPagoAnticipo: z.enum(['ANTICIPO_COBRO']).optional(),
  idempotencyKey: z.string().optional()
}).refine(
  (data) => (data.anticipoCobroId ? !!data.idempotencyKey : true),
  {
    message: 'idempotencyKey es obligatorio cuando se ejecuta cobro anticipado',
    path: ['idempotencyKey']
  }
).refine(
  (data) => (data.anticipoCobroId ? data.formaPagoAnticipo === 'ANTICIPO_COBRO' : true),
  {
    message: 'formaPagoAnticipo debe ser ANTICIPO_COBRO cuando se usa anticipo',
    path: ['formaPagoAnticipo']
  }
)

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

  const headerHeight = 90

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

  drawCenter(page, 'OFERTA', headerBoxX + headerBoxWidth / 2, y - 30, fontBold, 36)
  drawCenter(page, 'Información, Comunicaciones y Telecomunicaciones', headerBoxX + headerBoxWidth / 2, y - 45, fontItalic, 10, blueColor)

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

  const col1X = margin
  const col2X = margin + contentWidth / 2 + 20
  const infoY = y

  const cliente = oferta.cliente || {}
  let currentY = infoY

  drawText(page, 'Cliente:', col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.nombre), col1X + 80, currentY, fontBold, 10)
  currentY -= 15
  drawText(page, 'Dirección:', col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.direccion), col1X + 80, currentY, fontRegular, 10)
  currentY -= 15

  if (currency === 'USD') {
    drawText(page, 'No. Cuenta USD:', col1X, currentY, fontRegular, 10)
    drawText(page, safeText(cliente.numeroCuentaUSD), col1X + 80, currentY, fontRegular, 10)
    currentY -= 15
  } else {
    drawText(page, 'No. Cuenta CUP:', col1X, currentY, fontRegular, 10)
    drawText(page, safeText(cliente.numeroCuentaCUP), col1X + 80, currentY, fontRegular, 10)
    currentY -= 15
  }

  currentY -= 30

  drawText(page, 'No. Contrato:', col1X, currentY, fontRegular, 10)
  drawText(page, safeText(cliente.numeroContrato), col1X + 80, currentY, fontRegular, 10)
  currentY -= 15
  drawText(page, 'Fecha:', col1X, currentY, fontRegular, 10)

  const yLeft = currentY

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
  drawText(page, 'CÓDIGO', colCodeX + 5, headerY, fontBold, 9)
  drawText(page, 'DESCRIPCIÓN', colDescX + 5, headerY, fontBold, 9)
  drawCenter(page, 'CANTIDAD', colQtyX + 25, headerY, fontBold, 9)
  drawCenter(page, 'P. UNITARIO', colPriceX + 40, headerY, fontBold, 9)
  drawCenter(page, 'IMPORTE', colTotalX + 40, headerY, fontBold, 9)

  y -= headerHeightTable

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
  verticalLinesX.forEach((x) => {
    page.drawLine({
      start: { x: x, y: tableTopY - headerHeightTable + 5 },
      end: { x: x, y: actualTableBottomY },
      thickness: 1,
      color: borderColor,
    })
  })

  y = actualTableBottomY

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

  drawText(page, 'OBSERVACIONES:', margin + 5, y - 12, fontRegular, 9)
  if (oferta.observaciones) {
    drawText(page, safeText(oferta.observaciones), margin + 5, y - 24, fontRegular, 9)
  }

  const importeLetras = numeroALetras(totals.total, {
    plural: '',
    singular: '',
    centPlural: '',
    centSingular: '',
  })
  drawText(page, 'IMPORTE EN LETRAS:', margin + 5, y - obsHeight + 10, fontRegular, 8)
  drawText(page, safeText(importeLetras), margin + 100, y - obsHeight + 10, fontBold, 8)

  page.drawRectangle({
    x: margin + obsWidth,
    y: y - obsHeight + 20,
    width: totalsWidth,
    height: obsHeight - 20,
    color: lightBlueColor,
    borderColor: borderColor,
    borderWidth: 1,
  })

  const currencyLabel = currency === 'USD' ? 'USD' : 'MN'
  let totalY = y - 15
  drawRight(page, `SUBTOTAL ${currencyLabel}`, margin + obsWidth + 110, totalY, fontRegular, 9)
  drawRight(page, totals.subtotal.toFixed(2), margin + contentWidth - 10, totalY, fontRegular, 9)

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

  const numCols = 3
  const sigColWidth = contentWidth / numCols
  const sigY = y - 20

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

function generateOfferHTML(payload: any) {
  const { miEmpresa, oferta, lines, totals } = payload
  const offerNumber = oferta?.numeroOferta || oferta?.id || "N/A"
  const offerDate = oferta?.createdAt || new Date()
  const fechaStr = new Date(offerDate).toLocaleString("es-ES")
  const empresa = miEmpresa || {}
  const clienteNombre = oferta?.cliente?.nombre ? safeText(oferta.cliente.nombre) : "Sin cliente"
  const subtotal = totals.subtotal || 0
  const impuestos = totals.impuestos || 0
  const descuento = totals.descuento || 0
  const total = totals.total || 0
  const beneficiarioCuenta = empresa.cuentaBancaria
    ? `${empresa.cuentaBancaria.nombreBanco} ${empresa.cuentaBancaria.numeroCuenta} ${empresa.cuentaBancaria.moneda}`
    : ""
  const propietarioNombre = empresa.propietario || empresa.nombre || "Mi Empresa"

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { margin-bottom: 30px; }
    .company-name { font-size: 18px; font-weight: bold; }
    .company-details { font-size: 11px; color: #666; }
    .offer-title { text-align: right; font-size: 22px; font-weight: bold; margin-bottom: 10px; }
    .offer-number { text-align: right; font-size: 12px; }
    .offer-date { text-align: right; font-size: 12px; }
    .section { margin: 20px 0; }
    .section-title { font-weight: bold; font-size: 13px; margin-bottom: 5px; }
    .client-info { font-size: 11px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th { background-color: #f2f2f2; border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; font-weight: bold; }
    .table td { border: 1px solid #ddd; padding: 8px; font-size: 11px; }
    .totals { text-align: right; margin-top: 20px; }
    .total-row { margin: 5px 0; font-size: 12px; }
    .total-final { font-weight: bold; font-size: 14px; }
    .footer { margin-top: 40px; font-size: 10px; color: #888; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <div class="section">
      <div class="section-title">Cliente: ${clienteNombre}</div>
      <div class="client-info">
        ${oferta?.cliente?.direccion ? `<div>Dirección: ${safeText(oferta.cliente.direccion)}</div>` : ''}
        ${oferta?.cliente?.telefono ? `<div>Teléfono: ${safeText(oferta.cliente.telefono)}</div>` : ''}
        ${oferta?.cliente?.numeroCuentaCUP ? `<div>No. Cuenta CUP: ${safeText(oferta.cliente.numeroCuentaCUP)}</div>` : ''}
        ${oferta?.cliente?.numeroCuentaUSD ? `<div>No. Cuenta USD: ${safeText(oferta.cliente.numeroCuentaUSD)}</div>` : ''}
        ${oferta?.cliente?.numeroContrato ? `<div>No. Contrato: ${safeText(oferta.cliente.numeroContrato)}</div>` : ''}
      </div>
    </div>
  </div>
  <div style="position: absolute; top: 20px; right: 20px; text-align: right;">
    <div class="company-name">${safeText(empresa.nombre || "Mi Empresa")}</div>
    ${empresa.direccion ? `<div class="company-details">${safeText(empresa.direccion)}</div>` : ''}
    ${empresa.telefono || empresa.email ? `
      <div class="company-details">
        ${empresa.telefono ? `Tel: ${safeText(empresa.telefono)}` : ''}
        ${empresa.telefono && empresa.email ? ' | ' : ''}
        ${empresa.email ? `Email: ${safeText(empresa.email)}` : ''}
      </div>
    ` : ''}
    ${empresa.carnetIdentidad ? `<div class="company-details">CI: ${safeText(empresa.carnetIdentidad)}</div>` : ''}
    ${empresa.nit ? `<div class="company-details">NIT: ${safeText(empresa.nit)}</div>` : ''}
    ${empresa.licenciaOperacion ? `<div class="company-details">Licencia: ${safeText(empresa.licenciaOperacion)}</div>` : ''}
  </div>
  <div class="offer-title">OFERTA</div>
  <div class="offer-number">No: ${offerNumber}</div>
  <div class="offer-date">Fecha: ${fechaStr}</div>
  <hr style="margin: 20px 0; border: 1px solid #000;">
  ${oferta?.estado ? `<div class="section"><div class="section-title">Estado: ${oferta.estado}</div></div>` : ''}
  ${oferta?.observaciones ? `<div class="section"><div class="section-title">Observaciones: ${safeText(oferta.observaciones)}</div></div>` : ''}
  ${propietarioNombre ? `
    <div class="section">
      <div class="section-title">Proveedor:</div>
      <div>${safeText(propietarioNombre)}</div>
      <div class="section-title" style="margin-top: 10px;">Beneficiario:</div>
      <div>${safeText(propietarioNombre)}</div>
      <div class="section-title" style="margin-top: 10px;">Elaborado por:</div>
      <div>${safeText(propietarioNombre)}</div>
    </div>
  ` : ''}
  ${beneficiarioCuenta ? `
    <div class="section">
      <div class="section-title">Cuenta Bancaria:</div>
      <div>${safeText(beneficiarioCuenta)}</div>
    </div>
  ` : ''}
  <table class="table">
    <thead>
      <tr>
        <th>Descripción</th>
        <th>Cant.</th>
        <th>P.Unit</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${lines.map((line: any) => `
        <tr>
          <td>${safeText(line.descripcion)}</td>
          <td>${line.cantidad}</td>
          <td>${formatCurrency(line.precioUnitario, "")}</td>
          <td>${formatCurrency(line.total, "")}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="total-row">Subtotal: ${formatCurrency(subtotal, "")}</div>
    ${impuestos > 0 ? `<div class="total-row">Impuestos: ${formatCurrency(impuestos, "")}</div>` : ''}
    ${descuento > 0 ? `<div class="total-row">Descuento: -${formatCurrency(descuento, "")}</div>` : ''}
    <div class="total-row total-final">TOTAL: ${formatCurrency(total, "")}</div>
  </div>
  <div class="footer">
    Generado el ${new Date().toLocaleString("es-ES")}
  </div>
</body>
</html>
  `.trim()
}

type OfertaLineExcel = {
  descripcion: string
  cantidad: number
  precioUnitario: number
  total: number
}

function buildLinesExcel(oferta: any): OfertaLineExcel[] {
  const items = oferta.items ?? []
  return items.map((it: any) => {
    const nombre =
      it.producto?.nombre || it.servicio?.nombre || (it.productoId ? "Producto" : it.servicioId ? "Servicio" : "Ítem")
    const cantidad = Number(it.cantidad ?? 0)
    const precioUnitario = Number(it.precioUnitario ?? 0)
    const total = Number(it.total ?? precioUnitario * cantidad)
    return { descripcion: nombre, cantidad, precioUnitario, total }
  })
}

async function crearFacturaParaVenta(
  tx: Prisma.TransactionClient,
  ventaId: string,
  clienteId: string,
  subtotal: number,
  descuento: number,
  impuestos: number,
  cargoTransporte: number,
  total: number,
  observaciones: string | null,
  creadoPor: string,
  serieId?: string,
  fechaVencimiento?: string | null,
  tipoVencimiento?: string,
  cuentaBancariaId?: string,
  anticipoCobroId?: string,
  idempotencyKey?: string
) {
  let serie: any
  if (serieId) {
    serie = await tx.serieFacturacion.findUnique({ where: { serieId } })
    if (!serie || !serie.activa) {
      throw new Error('Serie de facturación no disponible')
    }
  } else {
    serie = await tx.serieFacturacion.findFirst({ where: { esPorDefecto: true } })
    if (!serie) {
      serie = await tx.serieFacturacion.create({
        data: {
          prefijo: "SD",
          descripcion: "Serie por defecto para ventas",
          consecutivo: 1,
          activa: true,
          esPorDefecto: true
        }
      })
    }
  }

  const serieActualizada = await tx.serieFacturacion.update({
    where: { serieId: serie.serieId },
    data: { consecutivo: { increment: 1 } }
  })
  const numeroConsecutivoSerie = serieActualizada.consecutivo - 1

  const factura = await tx.factura.create({
    data: {
      ventaId,
      clienteId,
      serieId: serie.serieId,
      subtotal: Number(subtotal),
      impuestos: Number(impuestos || 0),
      descuento: Number(descuento || 0),
      cargoTransporte: Number(cargoTransporte || 0),
      total: Number(total),
      observaciones,
      creadoPor,
      estado: 'PENDIENTE',
      numeroFactura: `${serie.prefijo}-${numeroConsecutivoSerie}`,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
    },
  })

  if (anticipoCobroId && idempotencyKey) {
    await applyAnticipoAllocations(
      tx,
      [{ anticipoId: anticipoCobroId, montoAplicado: Number(total) }],
      {
        documentoDestinoId: factura.idFactura,
        contexto: 'FACTURA_OFERTA',
        usuarioId: creadoPor,
        idempotencyKey,
        observaciones: observaciones || `Cobro anticipado factura ${factura.idFactura}`,
      }
    )
    await reconciliarVentaDirecta(tx, {
      ventaId,
      montoTotal: Number(total),
      usuarioId: creadoPor,
      observaciones: observaciones || `Cobro anticipado factura ${factura.idFactura}`,
      cuentaBancariaId
    })
    await tx.factura.update({
      where: { idFactura: factura.idFactura },
      data: { estado: 'PAGADA', fechaVencimiento: null }
    })
  } else {
    await applyFacturacionCobroWorkflow(tx, {
      ventaId,
      facturaId: factura.idFactura,
      clienteId,
      montoTotal: Number(total),
      usuarioId: creadoPor,
      observaciones,
      tipoVencimiento,
      fechaVencimiento,
      cuentaBancariaId
    })
  }

  return factura
}

export async function getOfertasHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const whereClause: any = {}
    if (estado) {
      whereClause.estado = estado
    }
    const ofertas = await prisma.oferta.findMany({
      where: whereClause,
      include: {
        cliente: true,
        items: {
          include: {
            producto: true,
            servicio: true
          }
        },
        venta: true
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ ofertas })
  } catch (error) {
    console.error('Error fetching offers:', error)
    return NextResponse.json({ error: 'Error fetching offers' }, { status: 500 })
  }
}

export async function createOfertaHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const body = await request.json()
    const validatedData = ofertaSchema.parse(body)
    const count = await prisma.oferta.count()
    const numeroOferta = `OF-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`
    const oferta = await prisma.oferta.create({
      data: {
        numeroOferta,
        clienteId: validatedData.clienteId,
        fechaVencimiento: validatedData.fechaVencimiento ? new Date(validatedData.fechaVencimiento) : null,
        subtotal: validatedData.subtotal,
        impuestos: validatedData.impuestos,
        total: validatedData.total,
        observaciones: validatedData.observaciones,
        items: {
          create: validatedData.items.map(item => ({
            productoId: item.productoId,
            servicioId: item.servicioId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            total: item.total
          }))
        }
      },
      include: { items: true, cliente: true }
    })
    return NextResponse.json({ oferta }, { status: 201 })
  } catch (error) {
    console.error('Error creating offer:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error creating offer' }, { status: 500 })
  }
}

export async function getOfertaByIdHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params
    const oferta = await prisma.oferta.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: {
          include: {
            producto: { include: { unidad: true } },
            servicio: true
          }
        },
        venta: true
      }
    })
    if (!oferta) {
      return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })
    }
    return NextResponse.json({ oferta })
  } catch (error) {
    console.error('Error fetching offer:', error)
    return NextResponse.json({ error: 'Error fetching offer' }, { status: 500 })
  }
}

export async function updateOfertaHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const body = await request.json()
    const validatedData = updateSchema.parse(body)
    const oferta = await prisma.oferta.update({
      where: { id },
      data: validatedData,
      include: { items: true, cliente: true }
    })
    return NextResponse.json({ oferta })
  } catch (error) {
    console.error('Error updating offer:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error updating offer' }, { status: 500 })
  }
}

export async function deleteOfertaHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const oferta = await prisma.oferta.findUnique({ where: { id } })
    if (!oferta) {
      return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })
    }
    if (oferta.estado === 'FACTURADA') {
      return NextResponse.json({ error: 'No se puede eliminar una oferta facturada' }, { status: 400 })
    }
    await prisma.oferta.delete({ where: { id } })
    return NextResponse.json({ message: 'Oferta eliminada exitosamente' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting offer:', error)
    return NextResponse.json({ error: 'Error eliminando oferta' }, { status: 500 })
  }
}

export async function facturarOfertaHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const body = await request.json()
    const validatedData = facturarSchema.parse(body)
    const oferta = await prisma.oferta.findUnique({
      where: { id },
      include: { items: true }
    })
    if (!oferta) {
      return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })
    }
    if (oferta.estado === 'FACTURADA') {
      return NextResponse.json({ error: 'Esta oferta ya ha sido facturada' }, { status: 400 })
    }
    if (oferta.estado !== 'ACEPTADA') {
      return NextResponse.json({ error: 'Solo se pueden facturar ofertas aceptadas' }, { status: 400 })
    }
    const cargoTransporteOferta = validatedData.cargoTransporte || 0
    const totalVentaConTransporte = Number(oferta.total) + cargoTransporteOferta
    const result = await prisma.$transaction(async (tx: any) => {
      const itemsVenta = oferta.items
        .filter((item: any) => item.productoId)
        .map((item: any) => ({
          productoId: item.productoId,
          cantidad: Number(item.cantidad),
          precioUnitario: Number(item.precioUnitario),
          total: Number(item.total),
        }))
      const venta = await tx.venta.create({
        data: {
          ofertaId: oferta.id,
          clienteId: oferta.clienteId,
          puntoDeVentaId: validatedData.puntoDeVentaId,
          empleadoId: validatedData.empleadoId,
          cantidad: oferta.items.reduce((sum: number, item: { cantidad: number }) => sum + item.cantidad, 0),
          total: totalVentaConTransporte,
          observaciones: validatedData.observaciones || `Facturación de Oferta ${oferta.numeroOferta}`,
          esVentaUnica: true,
          ...(itemsVenta.length > 0 ? { items: { create: itemsVenta } } : {})
        }
      })
      await tx.oferta.update({
        where: { id: oferta.id },
        data: { estado: 'FACTURADA' }
      })
      if (oferta.clienteId && user.userId) {
        const subtotalOferta = Number(oferta.subtotal)
        const descuentoOferta = 0
        const impuestosOferta = Number(oferta.impuestos || 0)
        const cargoTransporteFinal = validatedData.cargoTransporte || 0
        const totalOferta = Number(oferta.total) + cargoTransporteFinal
        await crearFacturaParaVenta(
          tx,
          venta.ventaId,
          oferta.clienteId,
          subtotalOferta,
          descuentoOferta,
          impuestosOferta,
          cargoTransporteFinal,
          totalOferta,
          validatedData.observaciones || null,
          user.userId,
          validatedData.serieId,
          validatedData.fechaVencimiento,
          validatedData.tipoVencimiento,
          validatedData.cuentaBancariaId,
          validatedData.anticipoCobroId,
          validatedData.idempotencyKey
        )
      }
      return venta
    })
    return NextResponse.json({ message: 'Oferta facturada exitosamente', venta: result }, { status: 201 })
  } catch (error) {
    console.error('Error facturando oferta:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (isAnticipoWorkflowError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    const errorMessage = error instanceof Error ? error.message : ''
    const shouldReturnBadRequest =
      errorMessage.includes('Serie de facturación no disponible') ||
      errorMessage.includes('No hay tipos de pago activos') ||
      errorMessage.includes('No hay cuentas bancarias activas') ||
      errorMessage.includes('La fecha de vencimiento es obligatoria') ||
      errorMessage.includes('Fecha de vencimiento inválida') ||
      errorMessage.includes('El monto total de la factura debe ser mayor que cero')
    if (shouldReturnBadRequest) {
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error facturando oferta' }, { status: 500 })
  }
}

export const getOfertaPdfHandler = withAuth(async (request: NextRequest, context: any, user: any) => {
  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'ID de oferta requerido' }, { status: 400 })
  }
  const oferta = await prisma.oferta.findUnique({
    where: { id },
    include: {
      cliente: true,
      items: {
        include: { producto: true, servicio: true }
      }
    }
  })
  if (!oferta) {
    return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })
  }
  const miEmpresa = await prisma.miEmpresa.findFirst({
    include: { cuentaBancaria: true }
  })
  const empresa = miEmpresa ?? ({
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
    if (!logoBytes) {
      const defaultLogoPath = path.join(process.cwd(), 'public', 'images', 'logo.png')
      if (fs.existsSync(defaultLogoPath)) {
        logoBytes = fs.readFileSync(defaultLogoPath)
        isPng = defaultLogoPath.toLowerCase().endsWith('.png')
      }
    }
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

export const getOfertaExcelHandler = withAuth(async (request: NextRequest, context: any, user: any) => {
  const id = context?.params?.id as string | undefined
  if (!id) {
    return NextResponse.json({ error: "ID de oferta requerido" }, { status: 400 })
  }
  const oferta = await prisma.oferta.findUnique({
    where: { id },
    include: {
      cliente: {
        select: {
          clienteId: true, nombre: true, direccion: true, telefono: true,
          numeroCuentaCUP: true, numeroCuentaUSD: true, numeroContrato: true,
        }
      },
      items: {
        include: {
          producto: { select: { nombre: true } },
          servicio: { select: { nombre: true } },
        }
      }
    }
  })
  if (!oferta) {
    return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 })
  }
  const miEmpresa = await prisma.miEmpresa.findFirst({
    include: {
      cuentaBancaria: {
        select: { nombreBanco: true, numeroCuenta: true, moneda: true, tipoCuenta: true },
      },
    },
  })
  const empresa = miEmpresa ?? {
    nombre: "Mi Empresa", direccion: null, telefono: null, email: null,
    carnetIdentidad: null, nit: null, licenciaOperacion: null,
    propietario: null, cuentaBancaria: null,
  }
  const lines = buildLinesExcel(oferta)
  const totals = {
    subtotal: Number(oferta.subtotal ?? 0),
    impuestos: Number(oferta.impuestos ?? 0),
    descuento: 0,
    total: Number(oferta.total ?? 0),
  }
  const offerNumber = oferta.numeroOferta || oferta.id
  const html = generateOfferHTML({ miEmpresa: empresa, oferta, lines, totals })
  return new NextResponse(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="oferta-${offerNumber}.xls"`,
    },
  })
})
