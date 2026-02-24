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

function generateInvoiceHTML(payload: any) {
  const { miEmpresa, venta, factura, serie, lines, totals } = payload
  
  const invoiceNumber = factura?.numeroFactura || venta?.ventaId || "N/A"
  const invoiceDate = factura?.fechaEmision || venta?.createdAt || new Date()
  const fechaStr = new Date(invoiceDate).toLocaleString("es-ES")
  
  const empresa = miEmpresa || {}
  const clienteNombre = venta?.cliente?.nombre ? safeText(venta.cliente.nombre) : "Sin cliente"
  
  const subtotal = totals.subtotal || 0
  const impuestos = totals.impuestos || 0
  const descuento = totals.descuento || 0
  const total = totals.total || 0
  
  const puntoVenta = venta?.puntoDeVenta?.nombre || ""
  
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
    .invoice-title { text-align: right; font-size: 22px; font-weight: bold; margin-bottom: 10px; }
    .invoice-number { text-align: right; font-size: 12px; }
    .invoice-date { text-align: right; font-size: 12px; }
    .section { margin: 20px 0; }
    .section-title { font-weight: bold; font-size: 13px; margin-bottom: 5px; }
    .client-info { font-size: 11px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th { background-color: #f2f2f2; border: 1px solid #000; padding: 10px; text-align: center; font-size: 11px; font-weight: bold; vertical-align: middle; }
    .table td { border: 1px solid #000; padding: 8px 10px; font-size: 11px; vertical-align: middle; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .totals { text-align: right; margin-top: 20px; }
    .total-row { margin: 5px 0; font-size: 12px; }
    .total-final { font-weight: bold; font-size: 14px; }
    .footer { margin-top: 40px; font-size: 10px; color: #888; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
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
  
  <div class="invoice-title">FACTURA</div>
  <div class="invoice-number">No: ${invoiceNumber}</div>
  <div class="invoice-date">Fecha: ${fechaStr}</div>
  
  <hr style="margin: 20px 0; border: 1px solid #000;">
  
  <div class="section">
    <div class="section-title">Cliente: ${clienteNombre}</div>
    <div class="client-info">
      ${venta?.cliente?.direccion ? `<div>Dirección: ${safeText(venta.cliente.direccion)}</div>` : ''}
      ${venta?.cliente?.numeroCuentaCUP ? `<div>No. Cuenta CUP: ${safeText(venta.cliente.numeroCuentaCUP)}</div>` : ''}
      ${venta?.cliente?.numeroCuentaUSD ? `<div>No. Cuenta USD: ${safeText(venta.cliente.numeroCuentaUSD)}</div>` : ''}
      ${venta?.cliente?.numeroContrato ? `<div>No. Contrato: ${safeText(venta.cliente.numeroContrato)}</div>` : ''}
    </div>
    ${puntoVenta ? `<div style="margin-top: 5px;">Punto de venta: ${safeText(puntoVenta)}</div>` : ''}
  </div>
  
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
        <th style="width: 10%;">CÓDIGO</th>
        <th style="width: 50%;">DESCRIPCIÓN</th>
        <th style="width: 10%;">CANTIDAD</th>
        <th style="width: 15%;">P. UNITARIO</th>
        <th style="width: 15%;">IMPORTE</th>
      </tr>
    </thead>
    <tbody>
      ${lines.map((line: any) => {
        const code = line.codigo ?? "";
        return `
        <tr>
          <td class="text-center">${code}</td>
          <td class="text-left">${safeText(line.descripcion)}</td>
          <td class="text-center">${line.cantidad}</td>
          <td class="text-right">${formatCurrency(line.precioUnitario, "")}</td>
          <td class="text-right">${formatCurrency(line.total, "")}</td>
        </tr>
      `}).join('')}
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

type InvoiceLine = {
  descripcion: string
  cantidad: number
  precioUnitario: number
  total: number
  codigo?: string
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

  const total = Number(venta.total ?? 0)
  return [{ descripcion: "Venta única", cantidad: 1, precioUnitario: total, total }]
}

function computeTotals(venta: any, lines: InvoiceLine[]) {
  if (venta.oferta) {
    return {
      subtotal: Number(venta.oferta.subtotal ?? 0),
      impuestos: Number(venta.oferta.impuestos ?? 0),
      descuento: 0,
      total: Number(venta.oferta.total ?? venta.total ?? 0),
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + Number(l.total || 0), 0)
  const descuento = Number(venta.descuento ?? 0)
  const total = Number(venta.total ?? Math.max(0, subtotal - descuento))
  return { subtotal, impuestos: 0, descuento, total }
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
    include: {
      serie: true,
      venta: {
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
          ordenReparacion: { select: { id: true, numeroOrden: true } },
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
      include: {
        serie: true,
        venta: {
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
            ordenReparacion: { select: { id: true, numeroOrden: true } },
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
          ordenReparacion: { select: { id: true, numeroOrden: true } },
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

  const lines = buildLines(venta!)
  // Use factura totals if available, otherwise compute from venta
  const totals = factura ? {
    subtotal: Number(factura.subtotal),
    impuestos: Number(factura.impuestos),
    descuento: Number(factura.descuento),
    total: Number(factura.total),
  } : computeTotals(venta!, lines)

  const invoiceNumber = factura?.numeroFactura || venta!.ventaId
  
  const html = generateInvoiceHTML({
    miEmpresa: empresa,
    venta: venta!,
    factura,
    serie,
    lines,
    totals,
  })

  return new NextResponse(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="factura-${invoiceNumber}.xls"`,
    },
  })
})
