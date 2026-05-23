
"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { getMiEmpresaAction } from '@/features/mi-empresa/actions'
import { getAuthToken } from "@/lib/token"
import { numeroALetras } from "@/lib/number-to-words"
// import { useTheme } from "next-themes"

interface InvoiceItem {
  id: string
  codigo?: string
  nombre: string
  cantidad: number
  precioUnitario: number
  total: number
  unidad?: string
}

interface MiEmpresaData {
  nombre: string
  direccion: string | null
  telefono: string | null
  email: string | null
  carnetIdentidad: string | null
  nit: string | null
  licenciaOperacion: string | null
  logoUrl: string | null
  propietario: string | null
  cuentaBancaria: null | {
    nombreBanco: string
    numeroCuenta: string
    moneda: string
    tipoCuenta: string
    isActive: boolean
  }
}

interface InvoiceData {
  numeroFactura?: string
  fecha: string
  puntoDeVenta: { id: string; nombre: string } | null
  cliente:
    | { clienteId: string; nombre: string; direccion?: string; numeroCuentaCUP?: string; numeroCuentaUSD?: string; numeroContrato?: string }
    | null
  items: InvoiceItem[]
  subtotal: number
  total: number
  descuento: number
  cargoTransporte: number
  observaciones: string
}

interface LegacyInvoiceData {
  fecha?: string
  puntoDeVenta?: { id: string; nombre: string } | null
  cliente?: { clienteId: string; nombre: string; direccion?: string; numeroCuentaCUP?: string; numeroCuentaUSD?: string; numeroContrato?: string } | null
  items?: InvoiceItem[]
  total?: number
  subtotal?: number
  descuento?: number
  cargoTransporte?: number
  observaciones?: string
}

/**
 * @description Construye los datos de impresión a partir de la factura y su venta relacionada.
 * @param {any} factura - Factura con relaciones de venta, cliente y items.
 * @returns {InvoiceData} Datos normalizados para la vista de impresión.
 */
function buildInvoiceDataFromFactura(factura: any): InvoiceData {
  const venta = factura?.venta || null
  const cliente = factura?.cliente || venta?.cliente || null
  const fecha = factura?.fechaEmision || venta?.createdAt || new Date().toISOString()

  let items: InvoiceItem[] = []

  if (venta?.oferta?.items?.length) {
    items = venta.oferta.items.map((it: any) => ({
      id: it.id,
      codigo: it.productoId || it.servicioId || it.id,
      nombre: it.producto?.nombre || it.servicio?.nombre || (it.productoId ? "Producto" : it.servicioId ? "Servicio" : "Ítem"),
      cantidad: Number(it.cantidad ?? 0),
      precioUnitario: Number(it.precioUnitario ?? 0),
      total: Number(it.total ?? 0),
      unidad: "",
    }))
  } else if (venta?.items?.length) {
    items = venta.items.map((it: any) => {
      const cantidad = Number(it.cantidad ?? 0)
      const precioUnitario = Number(
        it.precioUnitario ?? it.producto?.precioVenta ?? (cantidad > 0 ? Number(it.total ?? 0) / cantidad : 0)
      )
      const total = Number(it.total ?? precioUnitario * cantidad)
      return {
        id: it.producto?.id || it.productoId || it.id,
        codigo: it.producto?.id || it.productoId || it.id,
        nombre: it.producto?.nombre || "Producto",
        cantidad,
        precioUnitario,
        total,
        unidad: it.producto?.unidad?.simbolo || "",
      }
    })
  } else if (venta?.producto) {
    const cantidad = Number(venta.cantidad ?? 0)
    const precioUnitario = Number(venta.producto.precioVenta ?? 0)
    const total = Number(venta.total ?? precioUnitario * cantidad)
    items = [
      {
        id: venta.producto.id,
        codigo: venta.producto.id,
        nombre: venta.producto.nombre,
        cantidad,
        precioUnitario,
        total,
        unidad: "",
      },
    ]
  } else if (venta?.ordenReparacion) {
    const equipoTipo = venta.ordenReparacion.equipoTipo?.nombre || "Equipo"
    const marca = venta.ordenReparacion.marca || ""
    const modelo = venta.ordenReparacion.modelo || ""
    const descripcion = `Reparación ${equipoTipo} ${marca} ${modelo}`.trim()
    const total = Number(factura?.total ?? venta?.total ?? 0)
    items = [
      {
        id: venta.ordenReparacion.id,
        codigo: venta.ordenReparacion.id,
        nombre: descripcion,
        cantidad: 1,
        precioUnitario: total,
        total,
        unidad: "",
      },
    ]
  } else {
    const total = Number(factura?.total ?? venta?.total ?? 0)
    items = [
      {
        id: factura?.idFactura || venta?.ventaId || "venta-unica",
        codigo: factura?.idFactura || venta?.ventaId || "venta-unica",
        nombre: "Venta única",
        cantidad: 1,
        precioUnitario: total,
        total,
        unidad: "",
      },
    ]
  }

  return {
    numeroFactura: factura?.numeroFactura || venta?.ventaId || "S/N",
    fecha,
    puntoDeVenta: venta?.puntoDeVenta ? { id: venta.puntoDeVenta.pvId, nombre: venta.puntoDeVenta.nombre } : null,
    cliente: cliente
      ? {
          clienteId: cliente.clienteId,
          nombre: cliente.nombre,
          direccion: cliente.direccion,
          numeroCuentaCUP: cliente.numeroCuentaCUP,
          numeroCuentaUSD: cliente.numeroCuentaUSD,
          numeroContrato: cliente.numeroContrato,
        }
      : null,
    items,
    subtotal: Number(factura?.subtotal ?? factura?.total ?? 0),
    total: Number(factura?.total ?? venta?.total ?? 0),
    descuento: Number(factura?.descuento ?? venta?.descuento ?? 0),
    cargoTransporte: Number(factura?.cargoTransporte ?? 0),
    observaciones: factura?.observaciones || venta?.observaciones || "",
  }
}

/**
 * @description Normaliza el payload legado del sessionStorage a la estructura actual de impresión.
 * @param {LegacyInvoiceData} data - Datos antiguos de impresión.
 * @returns {InvoiceData | null} Datos normalizados o null si son inválidos.
 */
function normalizeLegacyInvoiceData(data: LegacyInvoiceData): InvoiceData | null {
  if (!data || !data.fecha) return null
  const cargoTransporte = Number(data.cargoTransporte ?? 0)
  const subtotal = Number(data.subtotal ?? data.total ?? 0)
  const total = Number(data.total ?? 0) + cargoTransporte
  return {
    numeroFactura: undefined,
    fecha: data.fecha,
    puntoDeVenta: data.puntoDeVenta ?? null,
    cliente: data.cliente ?? null,
    items: data.items ?? [],
    subtotal,
    total,
    descuento: Number(data.descuento ?? 0),
    cargoTransporte,
    observaciones: data.observaciones ?? "",
  }
}

function InvoicePrintContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invoiceId = searchParams.get("id")
  // const { resolvedTheme } = useTheme() // Theme ignored for print view
  const [loaded, setLoaded] = useState(false)
  const [miEmpresa, setMiEmpresa] = useState<MiEmpresaData | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(true)
  const token = getAuthToken()

  useEffect(() => {
    const loadInvoice = async () => {

      if (invoiceId) {
        try {
          const res = await fetch(`/api/facturas/${invoiceId}`, {
            headers: token ? { Authorization: token } : undefined,
            cache: "no-store",
          })
          if (!res.ok) {
            throw new Error(`No se pudo cargar la factura (${res.status})`)
          }
          const factura = await res.json()
          setInvoiceData(buildInvoiceDataFromFactura(factura))
        } catch (error) {
          console.error("Error cargando factura:", error)
          setInvoiceData(null)
        } finally {
          setIsLoadingInvoice(false)
        }
        return
      }

      if (typeof window !== "undefined") {
        try {
          const raw = sessionStorage.getItem("invoiceData")
          const parsed = raw ? (JSON.parse(raw) as LegacyInvoiceData) : null
          setInvoiceData(normalizeLegacyInvoiceData(parsed || {}))
        } catch (e) {
          setInvoiceData(null)
        }
      }
      setIsLoadingInvoice(false)
    }

    loadInvoice()
  }, [invoiceId])

  useEffect(() => {
    if (!invoiceData) return
    setLoaded(true)
    const t = setTimeout(() => {
      window.print()
    }, 500)
    return () => clearTimeout(t)
  }, [invoiceData])

  useEffect(() => {
    if (!isLoadingInvoice && !invoiceData) {
      router.replace("/busy/sales")
    }
  }, [isLoadingInvoice, invoiceData, router])

  useEffect(() => {
    getMiEmpresaAction()
      .then((r) => {
        if (r.success) setMiEmpresa(r.data as unknown as MiEmpresaData)
      })
      .catch(() => {})
  }, [])

  if (!invoiceData) {
    return null
  }

  const fecha = new Date(invoiceData.fecha)
  const fechaStr = fecha.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  // Datos de la empresa (fallback a los de la foto si no hay datos en DB para que se vea bien)
  const empresaNombre = miEmpresa?.nombre || "Soluciones Dervilla"
  const empresaPropietario = miEmpresa?.propietario || "Diosmani Dervilla Aguilar"
  const empresaDireccion = miEmpresa?.direccion || "Calle Cuba #108\nCamalote, Nuevitas, Camaguey"
  const empresaTel = miEmpresa?.telefono || "54234912"
  const empresaCI = miEmpresa?.carnetIdentidad || "78032222262"
  const empresaNIT = miEmpresa?.nit || "78032222262"
  const empresaLicencia = miEmpresa?.licenciaOperacion || "C 023179"
  const empresaEmail = miEmpresa?.email || "dervilla@nauta.cu"
  const empresaCuenta = miEmpresa?.cuentaBancaria?.numeroCuenta || "1258070000461016"
  const empresaBeneficiario = miEmpresa?.propietario || "DIOSMANI DERVILLA AGUILAR"

  // Cálculos
  const subtotal = Number(invoiceData.subtotal ?? invoiceData.total ?? 0)
  const cargo = Number(invoiceData.cargoTransporte ?? 0)
  const total = Number(invoiceData.total ?? subtotal + cargo)
  const importeLetras = numeroALetras(total, { plural: 'PESOS', singular: 'PESO', centPlural: 'CENTAVOS', centSingular: 'CENTAVO' })

  // Fixed styles for print view (always white background)
  const getBorderClass = () => 'border-black'
  const getTextClass = () => 'text-black'
  const getBgClass = () => 'bg-white'
  const getTableHeaderClass = () => 'bg-gray-200 text-black'
  const getTotalColorClass = () => 'text-red-600'
  const getBlueColorClass = () => 'text-blue-800'
  const getGrayTextClass = () => 'text-gray-500'
  const getDottedBorderClass = () => 'border-gray-400'
  const getLightBgClass = () => 'bg-blue-50'
  const getLightBorderClass = () => 'border-blue-200'

  return (
    <div className="min-h-screen text-sm font-sans bg-white text-black">
      <div className={`max-w-[210mm] mx-auto p-4 print:p-6 print:max-w-none ${getBgClass()} ${getTextClass()}`}>
        
        {/* HEADER */}
        <div className={`flex mb-1 ${getBorderClass()} border`}>
          {/* Logo Section */}
          <div className={`w-1/3 p-2 flex flex-col items-center justify-center border-r ${getBorderClass()} relative`}>
              {miEmpresa?.logoUrl ? (
                <Image src={miEmpresa.logoUrl} alt="Logo" width={80} height={80} className="h-20 w-auto object-contain" unoptimized />
              ) : (
                <span className="font-bold italic font-serif text-lg text-blue-800">{empresaNombre}</span>
              )}
          </div>
          
          {/* Title and Address Section */}
          <div className="w-2/3 flex flex-col">
            <div className={`flex-1 flex flex-col items-center justify-center border-b ${getBorderClass()} py-2`}>
                <h1 className="text-4xl font-serif font-bold tracking-wider">FACTURA</h1>
                <p className="italic font-serif text-sm">Información, Comunicaciones y Telecomunicaciones</p>
            </div>
            <div className="flex text-xs">
                <div className={`w-2/3 p-2 text-center border-r ${getBorderClass()} flex flex-col justify-center`}>
                    <p>{empresaDireccion}</p>
                    <p>Tel: {empresaTel}</p>
                </div>
                <div className={`w-1/3 p-2 flex flex-col justify-center font-bold ${getTextClass()}`}>
                    <div className="flex justify-between">
                        <span>No.:</span>
                        <span>{invoiceData.numeroFactura || "S/N"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Fecha:</span>
                        <span>{fechaStr}</span>
                    </div>
                </div>
            </div>
          </div>
        </div>

        {/* INFO CLIENTE / PROVEEDOR */}
        <div className={`flex mb-1 p-2 border-t-0 ${getBorderClass()} border`}>
            <div className="w-1/2 pr-4 space-y-0.5">
                <div className="grid grid-cols-[100px_1fr]">
                    <span className="font-medium">Cliente:</span>
                    <span className={`border-b border-dotted ${getDottedBorderClass()}`}>{invoiceData.cliente?.nombre || ""}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr]">
                    <span className="font-medium">Dirección:</span>
                    <span className={`border-b border-dotted ${getDottedBorderClass()}`}>{invoiceData.cliente?.direccion || ""}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr]">
                    <span className="font-medium">No. Cuenta CUP:</span>
                    <span className={`border-b border-dotted ${getDottedBorderClass()}`}>{invoiceData.cliente?.numeroCuentaCUP || ""}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr]">
                    <span className="font-medium">No. Cuenta USD:</span>
                    <span className={`border-b border-dotted ${getDottedBorderClass()}`}>{invoiceData.cliente?.numeroCuentaUSD || ""}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr]">
                    <span className="font-medium">No. Contrato:</span>
                    <span className={`border-b border-dotted ${getDottedBorderClass()}`}>{invoiceData.cliente?.numeroContrato || ""}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr]">
                    <span className="font-medium">Fecha:</span>
                    <span className={`border-b border-dotted ${getDottedBorderClass()}`}>{fechaStr}</span>
                </div>
            </div>
            <div className={`w-1/2 pl-4 text-right space-y-0.5 ${getTextClass()}`}>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                    <span className="font-medium">Proveedor:</span>
                    <span className="font-bold">{empresaPropietario}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                    <span className="font-medium">C. Identidad:</span>
                    <span>{empresaCI}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                    <span className="font-medium">NIT:</span>
                    <span>{empresaNIT}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                    <span className="font-medium">Licencia de Operación:</span>
                    <span>{empresaLicencia}</span>
                </div>
            </div>
        </div>

        {/* TABLA PRODUCTOS */}
        <div className={`mb-1 min-h-100 relative border-t-0 ${getBorderClass()} border`}>
            <table className="w-full text-xs">
                <thead className={`font-bold uppercase border-b ${getBorderClass()} ${getTableHeaderClass()}`}>
                    <tr>
                        <th className={`w-[10%] border-r py-1 px-3 text-center ${getBorderClass()}`}>CÓDIGO</th>
                        <th className={`w-[50%] border-r py-1 px-3 text-left ${getBorderClass()}`}>DESCRIPCIÓN</th>
                        <th className={`w-[10%] border-r py-1 px-3 text-center ${getBorderClass()}`}>CANTIDAD</th>
                        <th className={`w-[15%] border-r py-1 px-3 text-center ${getBorderClass()}`}>P. UNITARIO MN</th>
                        <th className={`w-[15%] py-1 px-3 text-center ${getTextClass()}`}>IMPORTE MN</th>
                    </tr>
                </thead>
                <tbody className={getTextClass()}>
                    {invoiceData.items.map((item) => (
                        <tr key={item.id} className="border-b border-gray-200 last:border-b-0">
                            <td className={`border-r py-1 px-3 text-center align-middle ${getBorderClass()} break-all`}>
                                {item.codigo || item.id}
                            </td>
                            <td className={`border-r py-1 px-3 text-left align-middle ${getBorderClass()}`}>{item.nombre}</td>
                            <td className={`border-r py-1 px-3 text-center align-middle ${getBorderClass()}`}>{item.cantidad}</td>
                            <td className={`border-r py-1 px-3 text-right align-middle ${getBorderClass()}`}>{item.precioUnitario.toFixed(2)}</td>
                            <td className={`py-1 px-3 text-right align-middle ${getTextClass()}`}>{item.total.toFixed(2)}</td>
                        </tr>
                    ))}
                    {/* Empty rows to fill space - limited to avoid overflow */}
                    {Array.from({ length: Math.max(0, Math.min(6, 8 - invoiceData.items.length)) }).map((_, i) => (
                         <tr key={`empty-${i}`}>
                            <td className={`border-r py-1 px-3 ${getBorderClass()}`}>&nbsp;</td>
                            <td className={`border-r py-1 px-3 ${getBorderClass()}`}>&nbsp;</td>
                            <td className={`border-r py-1 px-3 ${getBorderClass()}`}>&nbsp;</td>
                            <td className={`border-r py-1 px-3 ${getBorderClass()}`}>&nbsp;</td>
                            <td className={`py-1 px-3 ${getTextClass()}`}>&nbsp;</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {/* Vertical lines for empty space are handled by borders in empty rows or absolute div overlay if needed. 
                The current approach with empty rows keeps the grid lines. */}
        </div>

        {/* OBSERVACIONES Y TOTALES */}
        <div className={`flex mb-1 border-t-0 ${getBorderClass()} border`} style={{ pageBreakInside: 'avoid' }}>
            <div className={`w-2/3 p-2 flex flex-col justify-between border-r ${getBorderClass()}`}>
                <div>
                    <span className="font-bold uppercase block text-xs mb-1">OBSERVACIONES:</span>
                    <p className="text-xs">{invoiceData.observaciones}</p>
                </div>
                <div className="mt-2 text-xs">
                    <span className="font-bold uppercase mr-2">IMPORTE EN LETRAS:</span>
                    <span className="uppercase">{importeLetras}</span>
                </div>
            </div>
            <div className={`w-1/3 flex flex-col ${getLightBgClass()}`}>
                <div className="flex justify-between items-center px-2 py-1">
                    <span className="text-xs font-medium">SUBTOTAL MN</span>
                    <span className="text-sm">{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1">
                    <span className="text-xs font-medium">CARGO X TRANSPORTE MN</span>
                    <span className="text-sm">{invoiceData.cargoTransporte > 0 ? invoiceData.cargoTransporte.toFixed(2) : ""}</span>
                </div>
                <div className={`flex justify-between items-center px-2 py-1 mt-auto border-t ${getLightBorderClass()}`}>
                    <span className="text-xs font-bold">TOTAL MN</span>
                    <span className={`text-base font-bold ${getTotalColorClass()}`}>{total.toFixed(2)}</span>
                </div>
            </div>
        </div>

        {/* FIRMAS Y FORMULARIO TRANSPORTE */}
        <div className={`p-2 text-xs mb-1 border-t-0 ${getBorderClass()} border`} style={{ pageBreakInside: 'avoid' }}>
            <div className="grid grid-cols-3 gap-4">
                {/* Recibido por */}
                <div className="flex flex-col justify-between">
                    <div>
                        <div className="grid grid-cols-[80px_1fr] gap-2 mb-1">
                            <span>Recibido por:</span>
                            <div className={`h-4 border-b ${getBorderClass()}`}></div>
                        </div>
                        <div className={`text-right text-[10px] mb-1 ${getGrayTextClass()}`}>(Nombre y Apellidos)</div>
                        <div className="grid grid-cols-[80px_1fr] gap-2 mb-1">
                            <span>C. Identidad:</span>
                            <div className={`h-4 border-b ${getBorderClass()}`}></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 mt-1">
                        <span>Firma:</span>
                        <div className={`h-4 border-b ${getBorderClass()}`}></div>
                    </div>
                </div>

                {/* Transportista */}
                <div className="flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-end mb-1">
                            <span>Transportista:</span>
                            <span className={`text-[10px] ${getGrayTextClass()}`}>(Nombre y Apellidos)</span>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] gap-2 mb-1">
                            <span>C.Identidad:</span>
                            <div className={`h-4 border-b ${getBorderClass()}`}></div>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] gap-2 mb-1">
                            <span>No. Licencia:</span>
                            <div className={`h-4 border-b ${getBorderClass()}`}></div>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] gap-2 mb-1">
                            <span>Chapa:</span>
                            <div className={`h-4 border-b ${getBorderClass()}`}></div>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] gap-2 mb-1">
                            <span>Carta Porte:</span>
                            <div className={`h-4 border-b ${getBorderClass()}`}></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 mt-1">
                        <span>Firma:</span>
                        <div className={`h-4 border-b ${getBorderClass()}`}></div>
                    </div>
                </div>

                {/* Elaborado por */}
                <div className="flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-1">
                            <span>Elaborado por:</span>
                            <div className="text-right">
                                <span className="font-bold block">{empresaPropietario}</span>
                                <span className={`text-[10px] ${getGrayTextClass()}`}>(Nombre y Apellidos)</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-[50px_1fr] gap-2 mt-1">
                        <span>Firma:</span>
                        <div className={`h-4 border-b ${getBorderClass()}`}></div>
                    </div>
                </div>
            </div>
        </div>

        {/* FOOTER */}
        <div className={`p-2 text-xs flex justify-between items-end border-t-0 ${getBorderClass()} border`} style={{ pageBreakInside: 'avoid' }}>
            <div>
                <p className="font-medium">Dirija sus pagos en Moneda Nacional a:</p>
                <div className="flex gap-4 mt-1">
                    <span className="font-medium">No. Cuenta CUP:</span>
                    <span className={`font-bold ${getBlueColorClass()}`}>{empresaCuenta}</span>
                </div>
                <div className="mt-1">
                     <span className="">Mi dirección electrónica: {empresaEmail}</span>
                </div>
            </div>
            <div className="text-right">
                <div className="flex gap-2">
                     <span className="font-medium">Beneficiario:</span>
                     <span className={`font-bold uppercase ${getBlueColorClass()}`}>{empresaBeneficiario || empresaPropietario}</span>
                </div>
            </div>
        </div>

      </div>

      {/* Botones Flotantes (No Print) */}
      <div className="fixed bottom-6 right-6 flex gap-2 print:hidden">
        <Button variant="secondary" onClick={() => router.back()}>
          Volver
        </Button>
        <Button onClick={() => window.print()} disabled={!loaded}>
          Imprimir / Guardar PDF
        </Button>
      </div>

      <style jsx global>{`
        /* Force white background on all parent containers for invoice page */
        body, main, [data-sidebar="inset"], .sidebar-inset {
          background: white !important;
        }

        /* Hide breadcrumb navigation in screen + print on invoice page */
        nav[aria-label="breadcrumb"] {
          display: none !important;
        }

        @media print {
          @page {
            margin: 0mm !important;
            size: A4 portrait;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, nav, aside, [data-sidebar] {
            display: none !important;
          }
          .print\\:hidden { display: none; }
          
          /* Ensure invoice content fits on one page */
          .min-h-screen {
            min-height: auto !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  )
}

export default function InvoicePrintPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Cargando factura...</p>
        </div>
      </div>
    }>
      <InvoicePrintContent />
    </Suspense>
  )
}
