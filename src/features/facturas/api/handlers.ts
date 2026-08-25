import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { numeroALetras } from '@/lib/number-to-words'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

// ── Color palette (matches print page) ──
const BLACK = rgb(0, 0, 0)
const DARK = rgb(50 / 255, 50 / 255, 50 / 255)
const GRAY = rgb(120 / 255, 120 / 255, 120 / 255)
const LIGHT_GRAY = rgb(220 / 255, 220 / 255, 220 / 255)
const TABLE_HEADER_BG = rgb(200 / 255, 200 / 255, 200 / 255)
const BLUE = rgb(0 / 255, 60 / 255, 180 / 255)
const RED = rgb(180 / 255, 0 / 255, 0 / 255)
const WHITE = rgb(1, 1, 1)
const LIGHT_BLUE_BG = rgb(235 / 255, 245 / 255, 255 / 255)

// ── Layout constants (A4 = 595.28 x 841.89) ──
const ML = 40 // margin left
const MR = 40 // margin right
const CW = 595.28 - ML - MR // content width = 515.28
const LH = 14 // line height (compact)

// ── Prisma include for full factura data ──
const FACTURA_INCLUDE = {
  cliente: {
    select: {
      nombre: true,
      direccion: true,
      telefono: true,
      numeroCuentaCUP: true,
      numeroCuentaUSD: true,
      numeroContrato: true,
    },
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
      oferta: {
        include: {
          items: {
            include: {
              producto: { select: { nombre: true } },
              servicio: { select: { nombre: true } },
            },
          },
        },
      },
      ordenReparacion: {
        select: {
          equipoTipo: { select: { nombre: true } },
          marca: true,
          modelo: true,
        },
      },
    },
  },
} as const

// ── Helpers ──

type Pg = ReturnType<typeof PDFDocument.prototype.addPage>
type Font = ReturnType<typeof PDFDocument.prototype.embedFont> extends Promise<infer T> ? T : never

/** Draw a thin horizontal rule from margin */
function hr(page: Pg, y: number, color: ReturnType<typeof rgb> = GRAY) {
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, color, thickness: 0.5 })
}

/** Draw a bordered rectangle (for table cells) */
function cell(page: Pg, x: number, y: number, w: number, h: number, fill?: ReturnType<typeof rgb>) {
  if (fill) page.drawRectangle({ x, y, width: w, height: h, color: fill })
  page.drawRectangle({ x, y, width: w, height: h, borderColor: BLACK, borderWidth: 0.5 })
}

/** Draw text at x,y (left, center, or right aligned) */
function txt(page: Pg, text: string, x: number, y: number, size: number, font: Font, color: ReturnType<typeof rgb> = BLACK, align: 'left' | 'center' | 'right' = 'left') {
  const tw = font.widthOfTextAtSize(text, size)
  const px = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x
  page.drawText(text, { x: px, y, size, font, color })
}

/** Format number with 2 decimals and locale */
function fmt(n: number | string | bigint): string {
  return Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Draw a bordered section box */
function sectionBox(page: Pg, yTop: number, yBottom: number) {
  page.drawRectangle({ x: ML, y: yBottom, width: CW, height: yTop - yBottom, borderColor: BLACK, borderWidth: 0.5 })
}

// ── Main handler ──

export async function generatePdfHandler(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: AuthenticatedUser
): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const tenantId = user.tenantId

    // 1. Fetch factura + relations
    const factura = await prisma.factura.findUnique({
      where: { idFactura: id },
      include: FACTURA_INCLUDE,
    })
    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // 2. Fetch MiEmpresa data (includes CuentaBancaria)
    const miEmpresa = tenantId
      ? await prisma.miEmpresa.findFirst({
          where: { tenantId },
          include: { cuentaBancaria: true },
        })
      : null

    const empresa = {
      nombre: miEmpresa?.nombre || 'Soluciones Dervilla',
      propietario: miEmpresa?.propietario || 'Diosmani Dervilla Aguilar',
      direccion: miEmpresa?.direccion || 'Calle Cuba #108, Camalote, Nuevitas, Camaguey',
      telefono: miEmpresa?.telefono || '54234912',
      email: miEmpresa?.email || 'dervilla@nauta.cu',
      carnetIdentidad: miEmpresa?.carnetIdentidad || '78032222262',
      nit: miEmpresa?.nit || '78032222262',
      licenciaOperacion: miEmpresa?.licenciaOperacion || 'C 023179',
      logoUrl: miEmpresa?.logoUrl || null,
      cuentaBancaria: miEmpresa?.cuentaBancaria || null,
      beneficiario: miEmpresa?.propietario || 'DIOSMANI DERVILLA AGUILAR',
    }
    const empresaCuenta = empresa.cuentaBancaria?.numeroCuenta || '1258070000461016'

    // 3. Build invoice items (matches buildInvoiceDataFromFactura in print page)
    const venta = factura.venta
    let items: Array<{ codigo: string; nombre: string; cantidad: number; precioUnitario: number; total: number }> = []

    if (venta?.oferta?.items?.length) {
      items = venta.oferta.items.map((it: any) => ({
        codigo: it.productoId || it.servicioId || it.id,
        nombre: it.producto?.nombre || it.servicio?.nombre || 'Ítem',
        cantidad: Number(it.cantidad ?? 0),
        precioUnitario: Number(it.precioUnitario ?? 0),
        total: Number(it.total ?? 0),
      }))
    } else if (venta?.items?.length) {
      items = venta.items.map((it: any) => {
        const cantidad = Number(it.cantidad ?? 0)
        const precioUnitario = Number(it.precioUnitario ?? it.producto?.precioVenta ?? (cantidad > 0 ? Number(it.total ?? 0) / cantidad : 0))
        const total = Number(it.total ?? precioUnitario * cantidad)
        return {
          codigo: it.producto?.codigoInterno || it.productoId || it.id,
          nombre: it.producto?.nombre || 'Producto',
          cantidad,
          precioUnitario,
          total,
        }
      })
    } else if (venta?.producto) {
      const producto = venta.producto as any
      const cantidad = Number(venta.cantidad ?? 0)
      const precioUnitario = Number(producto.precioVenta ?? 0)
      const total = Number(venta.total ?? precioUnitario * cantidad)
      items = [{
        codigo: producto.id,
        nombre: producto.nombre,
        cantidad,
        precioUnitario,
        total,
      }]
    } else if (venta?.ordenReparacion) {
      const or = venta.ordenReparacion
      const equipoTipo = (or as any).equipoTipo?.nombre || 'Equipo'
      const marca = or.marca || ''
      const modelo = or.modelo || ''
      const descripcion = `Reparación ${equipoTipo} ${marca} ${modelo}`.trim()
      const total = Number(factura?.total ?? venta?.total ?? 0)
      items = [{
        codigo: (or as any).id || '',
        nombre: descripcion,
        cantidad: 1,
        precioUnitario: total,
        total,
      }]
    } else {
      const total = Number(factura?.total ?? venta?.total ?? 0)
      items = [{
        codigo: factura?.idFactura || venta?.ventaId || '',
        nombre: 'Venta única',
        cantidad: 1,
        precioUnitario: total,
        total,
      }]
    }

    const subtotal = Number(factura.subtotal ?? factura.total ?? 0)
    const cargoTransporte = Number(factura.cargoTransporte ?? 0)
    const total = Number(factura.total ?? subtotal + cargoTransporte)
    const fechaStr = new Date(factura.fechaEmision).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const importeLetras = numeroALetras(total, { plural: 'PESOS', singular: 'PESO', centPlural: 'CENTAVOS', centSingular: 'CENTAVO' })

    // ── PDF document ──
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89])
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    let y = 0 // will be set per section
    const rowH = 16 // table row height

    // Helper: draw a border around a full-width section

    // ═══════════════════════════════════════════
    // SECTION 1: HEADER (logo + title + info)
    // ═══════════════════════════════════════════
    y = 800
    const headerH = 96
    const logoWidth = CW / 3
    const titleWidth = CW - logoWidth

    // Outer border
    page.drawRectangle({ x: ML, y: y - headerH, width: CW, height: headerH, borderColor: BLACK, borderWidth: 0.5 })

    // Logo column (left 1/3)
    page.drawLine({ start: { x: ML + logoWidth, y: y - headerH }, end: { x: ML + logoWidth, y }, color: BLACK, thickness: 0.5 })

    if (empresa.logoUrl) {
      // We can't embed external images easily in pdf-lib without downloading them.
      // Fallback: show company name as text in the logo area
      txt(page, empresa.nombre, ML + 10, y - headerH / 2 - 6, 11, fontBold, BLUE)
    } else {
      txt(page, empresa.nombre, ML + 10, y - headerH / 2 - 6, 11, fontBold, BLUE)
    }

    // Title area (right 2/3)
    page.drawLine({ start: { x: ML + logoWidth, y: y - 36 }, end: { x: ML + CW, y: y - 36 }, color: BLACK, thickness: 0.5 })

    // FACTURA title
    txt(page, 'FACTURA', ML + logoWidth + 20, y - 28, 24, fontBold, BLACK)
    txt(page, 'Información, Comunicaciones y Telecomunicaciones', ML + logoWidth + 20, y - 42, 8, fontRegular, DARK)

    // Address + Number row
    const addrX = ML + logoWidth + 10
    const numFieldW = 140

    // Left side: address & tel
    // Right side: No. / Fecha
    // We'll draw both inline

    const addrY = y - 54
    const addrLines = empresa.direccion.split('\n')
    txt(page, addrLines[0], addrX, addrY, 7, fontRegular, DARK)
    if (addrLines[1]) txt(page, addrLines[1], addrX, addrY - 10, 7, fontRegular, DARK)
    txt(page, `Tel: ${empresa.telefono}`, addrX, addrY - 20, 7, fontRegular, DARK)

    // Right side: No. and Fecha
    const rightX = ML + CW - 10
    const numeroFactura = `${factura.serie.prefijo}-${factura.numeroFactura}`
    txt(page, 'No.:', rightX - 80, addrY - 32, 7, fontBold, BLACK, 'right')
    txt(page, numeroFactura, rightX, addrY - 32, 7, fontBold, BLACK, 'right')
    txt(page, 'Fecha:', rightX - 80, addrY - 44, 7, fontBold, BLACK, 'right')
    txt(page, fechaStr, rightX, addrY - 44, 7, fontBold, BLACK, 'right')

    // Update y to bottom of header
    y = y - headerH

    // ═══════════════════════════════════════════
    // SECTION 2: CLIENT / PROVEEDOR INFO
    // ═══════════════════════════════════════════
    const clientH = 96
    y -= 2
    sectionBox(page, y, y - clientH)

    const cliente = factura.cliente
    const cx1 = ML + 8
    const cx2 = ML + CW / 2 + 10
    const labelW = 70
    const fieldW = CW / 2 - labelW - 20

    // Left column: Cliente info
    let cy = y - 14
    const drawField = (label: string, value: string, colX: number, colY: number) => {
      txt(page, `${label}:`, colX, colY, 7, fontBold, BLACK)
      txt(page, value || '', colX + labelW, colY, 7, fontRegular, DARK)
      return colY - 12
    }

    cy = drawField('Cliente', cliente.nombre || '', cx1, cy)
    cy = drawField('Dirección', cliente.direccion || '', cx1, cy)
    cy = drawField('No. Cuenta CUP', cliente.numeroCuentaCUP || '', cx1, cy)
    cy = drawField('No. Cuenta USD', cliente.numeroCuentaUSD || '', cx1, cy)
    cy = drawField('No. Contrato', cliente.numeroContrato || '', cx1, cy)
    drawField('Fecha', fechaStr, cx1, cy)

    // Right column: Proveedor info
    let cyR = y - 14
    cyR = drawField('Proveedor', empresa.propietario, cx2, cyR)
    cyR = drawField('C. Identidad', empresa.carnetIdentidad, cx2, cyR)
    cyR = drawField('NIT', empresa.nit, cx2, cyR)
    cyR = drawField('Lic. Operación', empresa.licenciaOperacion, cx2, cyR)

    // Vertical divider between columns
    page.drawLine({ start: { x: ML + CW / 2, y: y - 2 }, end: { x: ML + CW / 2, y: y - clientH + 2 }, color: BLACK, thickness: 0.5 })

    y = y - clientH - 2

    // ═══════════════════════════════════════════
    // SECTION 3: PRODUCTS TABLE
    // ═══════════════════════════════════════════
    y -= 2

    // Calculate how many empty rows we need
    const maxTotalRows = 9
    const emptyRows = Math.max(0, Math.min(4, maxTotalRows - items.length))
    const totalRows = items.length + emptyRows
    const tableBodyH = totalRows * rowH + rowH // + header row

    // Table outer border (will be extended to bottom of section later)
    const tableTopY = y

    // Table header
    const colW = [CW * 0.12, CW * 0.48, CW * 0.10, CW * 0.15, CW * 0.15]
    const colXs: number[] = []
    let cxAcc = ML
    for (let i = 0; i < colW.length; i++) {
      colXs.push(cxAcc)
      cxAcc += colW[i]
    }

    // Draw header background and cells
    page.drawRectangle({ x: ML, y: y - rowH, width: CW, height: rowH, color: TABLE_HEADER_BG })
    const headers = ['CÓDIGO', 'DESCRIPCIÓN', 'CANTIDAD', 'P. UNITARIO MN', 'IMPORTE MN']
    headers.forEach((h, i) => {
      const align = i === 0 || i === 2 ? 'center' : i >= 3 ? 'right' : 'left'
      cell(page, colXs[i], y - rowH, colW[i], rowH, TABLE_HEADER_BG)
      const textX = align === 'center' ? colXs[i] + colW[i] / 2 : align === 'right' ? colXs[i] + colW[i] - 4 : colXs[i] + 4
      const textAlign = align === 'center' ? 'center' as const : 'right' as const
      if (align === 'center') {
        txt(page, h, textX - fontBold.widthOfTextAtSize(h, 7) / 2, y - rowH + 4, 7, fontBold, BLACK)
      } else {
        txt(page, h, textX, y - rowH + 4, 7, fontBold, BLACK)
      }
    })
    y -= rowH

    // Data rows
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      y -= rowH

      // Draw row cells
      const vals = [
        { text: item.codigo.slice(-8), align: 'center' as const },
        { text: item.nombre.slice(0, 40), align: 'left' as const },
        { text: item.cantidad.toString(), align: 'center' as const },
        { text: `$${fmt(item.precioUnitario)}`, align: 'right' as const },
        { text: `$${fmt(item.total)}`, align: 'right' as const },
      ]
      vals.forEach((v, vi) => {
        cell(page, colXs[vi], y, colW[vi], rowH)
        const px = v.align === 'center'
          ? colXs[vi] + colW[vi] / 2 - fontRegular.widthOfTextAtSize(v.text, 7) / 2
          : v.align === 'right'
            ? colXs[vi] + colW[vi] - 4
            : colXs[vi] + 4
        txt(page, v.text, px, y + 4, 7, fontRegular, BLACK, v.align)
      })
    }

    // Empty rows
    for (let i = 0; i < emptyRows; i++) {
      y -= rowH
      const vals = ['', '', '', '', '']
      vals.forEach((_, vi) => {
        cell(page, colXs[vi], y, colW[vi], rowH)
      })
    }

    // Apply outer border to table
    const tableBottomY = y
    page.drawRectangle({ x: ML, y: tableBottomY, width: CW, height: tableTopY - tableBottomY, borderColor: BLACK, borderWidth: 0.5 })

    // ═══════════════════════════════════════════
    // SECTION 4: OBSERVACIONES + TOTALES
    // ═══════════════════════════════════════════
    const totH = 72
    y -= 2
    const totTopY = y
    sectionBox(page, y, y - totH)

    // Left: Observaciones
    const obsX = ML + 8
    txt(page, 'OBSERVACIONES:', obsX, y - 14, 7, fontBold, BLACK)
    if (factura.observaciones) {
      const obsText = factura.observaciones.length > 80
        ? factura.observaciones.slice(0, 80) + '...'
        : factura.observaciones
      txt(page, obsText, obsX + 4, y - 26, 6, fontRegular, DARK)
    }
    txt(page, 'IMPORTE EN LETRAS:', obsX, y - 42, 7, fontBold, BLACK)
    txt(page, importeLetras.slice(0, 60).toUpperCase(), obsX + 4, y - 54, 6, fontRegular, DARK)

    // Right: Totals
    const totX = ML + CW - 10
    const totalRightW = CW / 3

    // Subtotals area background
    page.drawRectangle({ x: ML + CW * 2 / 3, y: y - totH + 2, width: CW / 3, height: totH - 4, color: LIGHT_BLUE_BG })
    page.drawLine({ start: { x: ML + CW * 2 / 3, y: y - 2 }, end: { x: ML + CW * 2 / 3, y: y - totH + 2 }, color: BLACK, thickness: 0.5 })

    txt(page, 'SUBTOTAL MN', totX - totalRightW + 4, y - 14, 7, fontRegular, DARK)
    txt(page, `$${fmt(subtotal)}`, totX - 4, y - 14, 7, fontRegular, DARK, 'right')

    txt(page, 'CARGO X TRANSPORTE MN', totX - totalRightW + 4, y - 28, 7, fontRegular, DARK)
    txt(page, cargoTransporte > 0 ? `$${fmt(cargoTransporte)}` : '', totX - 4, y - 28, 7, fontRegular, DARK, 'right')

    // Total row with separator
    hr(page, y - 36, LIGHT_GRAY)
    txt(page, 'TOTAL MN', totX - totalRightW + 4, y - 48, 8, fontBold, BLACK)
    txt(page, `$${fmt(total)}`, totX - 4, y - 48, 8, fontBold, RED, 'right')

    y = y - totH - 2

    // ═══════════════════════════════════════════
    // SECTION 5: SIGNATURES (3 columns)
    // ═══════════════════════════════════════════
    const sigH = 96
    y -= 2
    const sigTopY = y
    sectionBox(page, y, y - sigH)
    const sigColW = CW / 3

    // Vertical dividers
    for (let i = 1; i < 3; i++) {
      page.drawLine({ start: { x: ML + sigColW * i, y: y - 2 }, end: { x: ML + sigColW * i, y: y - sigH + 2 }, color: BLACK, thickness: 0.5 })
    }

    // Column 1: Recibido por
    let sy = y - 14
    txt(page, 'Recibido por:', ML + 8, sy, 7, fontBold, BLACK)
    page.drawLine({ start: { x: ML + 70, y: sy + 1 }, end: { x: ML + sigColW - 8, y: sy + 1 }, color: BLACK, thickness: 0.5 })
    sy -= 10
    txt(page, '(Nombre y Apellidos)', ML + 8, sy, 6, fontRegular, GRAY)
    sy -= 12
    txt(page, 'C. Identidad:', ML + 8, sy, 7, fontBold, BLACK)
    page.drawLine({ start: { x: ML + 72, y: sy + 1 }, end: { x: ML + sigColW - 8, y: sy + 1 }, color: BLACK, thickness: 0.5 })
    sy -= 14
    page.drawLine({ start: { x: ML + 8, y: sy }, end: { x: ML + sigColW - 8, y: sy }, color: BLACK, thickness: 0.5 })
    txt(page, 'Firma:', ML + 8, sy + 3, 7, fontBold, BLACK)

    // Column 2: Transportista
    sy = y - 14
    const sx2 = ML + sigColW + 8
    txt(page, 'Transportista:', sx2, sy, 7, fontBold, BLACK)
    txt(page, '(Nombre y Apellidos)', sx2 + 60, sy, 6, fontRegular, GRAY)
    sy -= 10
    page.drawLine({ start: { x: sx2, y: sy + 1 }, end: { x: ML + sigColW * 2 - 8, y: sy + 1 }, color: BLACK, thickness: 0.5 })
    const transpFields = ['C.Identidad:', 'No. Licencia:', 'Chapa:', 'Carta Porte:']
    for (const f of transpFields) {
      sy -= 12
      txt(page, f, sx2, sy, 7, fontBold, BLACK)
      page.drawLine({ start: { x: sx2 + 60, y: sy + 1 }, end: { x: ML + sigColW * 2 - 8, y: sy + 1 }, color: BLACK, thickness: 0.5 })
    }
    sy -= 12
    page.drawLine({ start: { x: sx2, y: sy }, end: { x: ML + sigColW * 2 - 8, y: sy }, color: BLACK, thickness: 0.5 })
    txt(page, 'Firma:', sx2, sy + 3, 7, fontBold, BLACK)

    // Column 3: Elaborado por
    sy = y - 14
    const sx3 = ML + sigColW * 2 + 8
    txt(page, 'Elaborado por:', sx3, sy, 7, fontBold, BLACK)
    txt(page, empresa.propietario.toUpperCase(), sx3, sy - 10, 7, fontBold, BLACK)
    txt(page, '(Nombre y Apellidos)', sx3, sy - 20, 6, fontRegular, GRAY)
    sy = y - sigH + 14
    page.drawLine({ start: { x: sx3, y: sy }, end: { x: ML + CW - 8, y: sy }, color: BLACK, thickness: 0.5 })
    txt(page, 'Firma:', sx3, sy + 3, 7, fontBold, BLACK)

    y = y - sigH - 2

    // ═══════════════════════════════════════════
    // SECTION 6: FOOTER (payment info)
    // ═══════════════════════════════════════════
    const footerH = 56
    y -= 2
    const footerTopY = y
    sectionBox(page, y, y - footerH)

    const fx = ML + 8
    txt(page, 'Dirija sus pagos en Moneda Nacional a:', fx, y - 14, 7, fontBold, BLACK)
    txt(page, 'No. Cuenta CUP:', fx, y - 26, 7, fontBold, BLACK)
    txt(page, empresaCuenta, fx + 80, y - 26, 7, fontBold, BLUE)
    txt(page, `Mi dirección electrónica: ${empresa.email}`, fx, y - 38, 6, fontRegular, DARK)

    // Right side: Beneficiario
    const benX = ML + CW - 10
    txt(page, 'Beneficiario:', benX - 120, y - 14, 7, fontBold, BLACK, 'right')
    txt(page, empresa.beneficiario.toUpperCase(), benX, y - 14, 7, fontBold, BLUE, 'right')

    y = y - footerH

    // ═══════════════════════════════════════════
    // Save & return
    // ═══════════════════════════════════════════
    const pdfBytes = await pdfDoc.save()
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="factura-${numeroFactura}.pdf"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generando PDF de factura:', error)
    return NextResponse.json({ error: 'Error generando PDF de factura' }, { status: 500 })
  }
}

// ── CSV export (unchanged) ──

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

    const csvContent = '\uFEFF' + rows.join('\r\n')

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
