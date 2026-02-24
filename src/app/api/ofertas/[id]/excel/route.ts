import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/lib/auth-middleware"

export const runtime = "nodejs"

function formatCurrency(amount: number, currency = "CUP") {
  return `${amount.toFixed(2)} ${currency}`
}

function safeText(text: string) {
  return (text || "").replace(/\s+/g, " ").trim()
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
  
  const html = `
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
  <!-- DATOS DEL CLIENTE A LA IZQUIERDA -->
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
  
  <!-- DATOS DE LA EMPRESA A LA DERECHA -->
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
  `
  
  return html.trim()
}

type OfertaLine = {
  descripcion: string
  cantidad: number
  precioUnitario: number
  total: number
}

function buildLines(oferta: any): OfertaLine[] {
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

export const GET = withAuth(async (request: NextRequest, context: any, user: any) => {
  const id = context?.params?.id as string | undefined
  if (!id) {
    return NextResponse.json({ error: "ID de oferta requerido" }, { status: 400 })
  }

  const oferta = await prisma.oferta.findUnique({
    where: { id },
    include: {
      cliente: {
        select: {
          clienteId: true,
          nombre: true,
          direccion: true,
          telefono: true,
          numeroCuentaCUP: true,
          numeroCuentaUSD: true,
          numeroContrato: true,
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
    nombre: "Mi Empresa",
    direccion: null,
    telefono: null,
    email: null,
    carnetIdentidad: null,
    nit: null,
    licenciaOperacion: null,
    propietario: null,
    cuentaBancaria: null,
  }

  const lines = buildLines(oferta)
  const totals = {
    subtotal: Number(oferta.subtotal ?? 0),
    impuestos: Number(oferta.impuestos ?? 0),
    descuento: 0,
    total: Number(oferta.total ?? 0),
  }

  const offerNumber = oferta.numeroOferta || oferta.id
  
  const html = generateOfferHTML({
    miEmpresa: empresa,
    oferta,
    lines,
    totals,
  })

  return new NextResponse(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="oferta-${offerNumber}.xls"`,
    },
  })
})