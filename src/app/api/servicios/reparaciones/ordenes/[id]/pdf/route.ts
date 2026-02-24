import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/lib/auth-middleware"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { numeroALetras } from "@/lib/number-to-words"
import fs from "fs"
import path from "path"

export const runtime = "nodejs"

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

async function generateOrdenPDF(
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

  // Header Box
  const headerBoxX = margin + logoBoxWidth
  const headerBoxWidth = contentWidth - logoBoxWidth
  
  drawCenter(page, "TICKET DE SERVICIO TÉCNICO", headerBoxX + headerBoxWidth / 2, y - 30, fontBold, 24)
  drawCenter(page, "Orden de Reparación", headerBoxX + headerBoxWidth / 2, y - 50, fontItalic, 12, blueColor)
  
  // Address Line
  page.drawLine({
    start: { x: headerBoxX, y: y - 55 },
    end: { x: margin + contentWidth, y: y - 55 },
    thickness: 1,
    color: borderColor,
  })
  
  const addrY = y - 70
  const dateBoxX = margin + contentWidth - 120
  const addressCenterX = headerBoxX + (dateBoxX - headerBoxX) / 2
  
  if (empresa.direccion) {
      drawCenter(page, safeText(empresa.direccion), addressCenterX, addrY, fontRegular, 9)
  }
  if (empresa.telefono) {
      drawCenter(page, `Tel: ${safeText(empresa.telefono)}`, addressCenterX, addrY - 12, fontRegular, 9)
  }
  
  // Date/No Box
  const dateBoxY = y - 55
  page.drawLine({
    start: { x: dateBoxX, y: dateBoxY },
    end: { x: dateBoxX, y: y - 90 },
    thickness: 1,
    color: borderColor,
  })
  
  drawText(page, "Orden No.:", dateBoxX + 10, addrY, fontRegular, 10)
  drawRight(page, `${orden.numeroOrden}`, margin + contentWidth - 10, addrY, fontBold, 12, redColor)
  
  drawText(page, "Fecha:", dateBoxX + 10, addrY - 15, fontRegular, 10)
  drawRight(page, new Date(orden.fechaRecepcion).toLocaleDateString("es-ES"), margin + contentWidth - 10, addrY - 15, fontBold, 10)

  // Header Border
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

  y -= 110

  // --- Client Info ---
  drawText(page, "DATOS DEL CLIENTE", margin, y, fontBold, 11, blueColor)
  page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: margin + 120, y: y - 2 }, thickness: 1, color: blueColor })
  y -= 20

  const cliente = orden.cliente || {}
  
  drawText(page, "Cliente:", margin, y, fontBold, 10)
  drawText(page, safeText(cliente.nombre), margin + 80, y, fontRegular, 10)
  
  drawText(page, "Teléfono:", margin + 300, y, fontBold, 10)
  drawText(page, safeText(cliente.telefono), margin + 360, y, fontRegular, 10)
  y -= 15
  
  drawText(page, "Dirección:", margin, y, fontBold, 10)
  drawText(page, safeText(cliente.direccion), margin + 80, y, fontRegular, 10)
  y -= 25

  // --- Equipment Info ---
  drawText(page, "DATOS DEL EQUIPO", margin, y, fontBold, 11, blueColor)
  page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: margin + 120, y: y - 2 }, thickness: 1, color: blueColor })
  y -= 20
  
  const boxHeight = 100
  page.drawRectangle({
    x: margin,
    y: y - boxHeight,
    width: contentWidth,
    height: boxHeight,
    borderWidth: 1,
    borderColor: borderColor,
    color: rgb(0.98, 0.98, 0.98)
  })

  let eqY = y - 15
  
  drawText(page, "Tipo:", margin + 10, eqY, fontBold, 10)
  drawText(page, safeText(orden.equipoTipo?.nombre), margin + 80, eqY, fontRegular, 10)
  
  drawText(page, "Marca:", margin + 250, eqY, fontBold, 10)
  drawText(page, safeText(orden.marca), margin + 300, eqY, fontRegular, 10)
  
  drawText(page, "Modelo:", margin + 400, eqY, fontBold, 10)
  drawText(page, safeText(orden.modelo), margin + 450, eqY, fontRegular, 10)
  eqY -= 20
  
  drawText(page, "No. Serie:", margin + 10, eqY, fontBold, 10)
  drawText(page, safeText(orden.numeroSerie), margin + 80, eqY, fontRegular, 10)
  
  drawText(page, "Accesorios:", margin + 250, eqY, fontBold, 10)
  drawText(page, safeText(orden.accesorios), margin + 325, eqY, fontRegular, 10)
  eqY -= 20
  
  drawText(page, "Problema:", margin + 10, eqY, fontBold, 10)
  // Wrap text for problem if needed (simple implementation)
  const problema = safeText(orden.problemaReportado)
  drawText(page, problema.substring(0, 90) + (problema.length > 90 ? "..." : ""), margin + 80, eqY, fontRegular, 10)
  if (problema.length > 90) {
      eqY -= 12
      drawText(page, problema.substring(90, 180), margin + 80, eqY, fontRegular, 10)
  }
  
  y -= (boxHeight + 25)

  // --- Status & Cost (If applicable) ---
  // Only show if diagnostics exists or cost is calculated
  if (orden.items.length > 0 || orden.total > 0) {
      drawText(page, "DETALLES DE SERVICIO Y COSTOS", margin, y, fontBold, 11, blueColor)
      page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: margin + 180, y: y - 2 }, thickness: 1, color: blueColor })
      y -= 20
      
      // Simple table header
      drawRectangle(page, margin, y - 20, contentWidth, 20, lightBlueColor, borderColor)
      drawText(page, "DESCRIPCIÓN", margin + 10, y - 14, fontBold, 9)
      drawRight(page, "PRECIO", margin + contentWidth - 10, y - 14, fontBold, 9)
      y -= 20
      
      let subtotal = 0
      
      // Items (Mano de obra)
      for (const item of orden.items) {
          const desc = `${item.pieza?.nombre || 'Servicio'} (${item.complejidad})`
          drawText(page, desc, margin + 10, y - 14, fontRegular, 9)
          drawRight(page, Number(item.precio).toFixed(2), margin + contentWidth - 10, y - 14, fontRegular, 9)
          y -= 18
          subtotal += Number(item.precio)
      }
      
      // Materials
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
      // Just a placeholder line
      y -= 20
  }

  // --- Terms & Footer ---
  const terminosY = 120
  page.drawLine({ start: { x: margin, y: terminosY }, end: { x: margin + contentWidth, y: terminosY }, thickness: 1, color: borderColor })
  
  drawText(page, "TÉRMINOS Y CONDICIONES:", margin, terminosY - 15, fontBold, 8)
  drawText(page, "1. La empresa no se hace responsable por equipos no recogidos después de 30 días de notificado.", margin, terminosY - 25, fontRegular, 7)
  drawText(page, "2. La garantía solo cubre la mano de obra y piezas reemplazadas por 30 días.", margin, terminosY - 35, fontRegular, 7)
  drawText(page, "3. Es obligatorio presentar este ticket para retirar el equipo.", margin, terminosY - 45, fontRegular, 7)
  
  // Signatures
  const sigY = 50
  
  drawText(page, "Recibido por (Taller):", margin + 50, sigY + 10, fontRegular, 8)
  page.drawLine({ start: { x: margin + 30, y: sigY }, end: { x: margin + 180, y: sigY }, thickness: 1 })
  
  drawText(page, "Firma del Cliente (Conforme):", margin + 350, sigY + 10, fontRegular, 8)
  page.drawLine({ start: { x: margin + 330, y: sigY }, end: { x: margin + 480, y: sigY }, thickness: 1 })

}

function drawRectangle(page: any, x: number, y: number, w: number, h: number, color: any, border: any) {
    page.drawRectangle({
        x, y, width: w, height: h,
        color: color,
        borderColor: border,
        borderWidth: 1
    })
}

export const GET = withAuth(async (request: NextRequest, context: any, user: any) => {
  const id = context?.params?.id as string | undefined
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

  if (!miEmpresa) {
    return NextResponse.json({ error: "Configuración de empresa no encontrada" }, { status: 500 })
  }

  // Create PDF
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const page = pdfDoc.addPage()
  
  // Try to load logo
  let logoImage = null
  if (miEmpresa.logoUrl) {
    try {
      const publicPath = path.join(process.cwd(), "public")
      const logoPath = path.join(publicPath, miEmpresa.logoUrl)
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath)
        if (miEmpresa.logoUrl.endsWith(".png")) {
          logoImage = await pdfDoc.embedPng(logoBytes)
        } else if (miEmpresa.logoUrl.endsWith(".jpg") || miEmpresa.logoUrl.endsWith(".jpeg")) {
          logoImage = await pdfDoc.embedJpg(logoBytes)
        }
      }
    } catch (e) {
      console.error("Error loading logo:", e)
    }
  }

  await generateOrdenPDF(page, fontRegular, fontBold, fontItalic, logoImage, {
    miEmpresa,
    orden
  })

  const pdfBytes = await pdfDoc.save()

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="orden-${orden.numeroOrden}.pdf"`,
    },
  })
})
