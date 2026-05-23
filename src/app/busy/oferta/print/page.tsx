"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { getMiEmpresaAction } from '@/features/mi-empresa/actions'
import { getAuthToken } from "@/lib/token"
import { numeroALetras } from "@/lib/number-to-words"

interface OfertaPrintItem {
  id: string
  nombre: string
  cantidad: number
  precioUnitario: number
  total: number
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

interface OfertaPrintData {
  numeroOferta: string
  fechaEmision: string
  fechaVencimiento: string | null
  estado: string
  cliente: { clienteId: string; nombre: string; direccion?: string } | null
  items: OfertaPrintItem[]
  subtotal: number
  impuestos: number
  total: number
  observaciones: string
}

function buildPrintDataFromOferta(oferta: any): OfertaPrintData {
  const items: OfertaPrintItem[] = (oferta.items || []).map((it: any) => ({
    id: it.id,
    nombre: it.producto?.nombre || it.servicio?.nombre || (it.productoId ? "Producto" : it.servicioId ? "Servicio" : "Ítem"),
    cantidad: Number(it.cantidad ?? 0),
    precioUnitario: Number(it.precioUnitario ?? 0),
    total: Number(it.total ?? 0),
  }))

  return {
    numeroOferta: oferta.numeroOferta || "S/N",
    fechaEmision: oferta.fechaEmision,
    fechaVencimiento: oferta.fechaVencimiento || null,
    estado: oferta.estado,
    cliente: oferta.cliente
      ? {
          clienteId: oferta.cliente.clienteId,
          nombre: oferta.cliente.nombre,
          direccion: oferta.cliente.direccion,
        }
      : null,
    items,
    subtotal: Number(oferta.subtotal ?? 0),
    impuestos: Number(oferta.impuestos ?? 0),
    total: Number(oferta.total ?? 0),
    observaciones: oferta.observaciones || "",
  }
}

function OfertaPrintContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ofertaId = searchParams.get("id")
  const [loaded, setLoaded] = useState(false)
  const [miEmpresa, setMiEmpresa] = useState<MiEmpresaData | null>(null)
  const [printData, setPrintData] = useState<OfertaPrintData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const token = getAuthToken()

  useEffect(() => {
    const loadOferta = async () => {
      if (!ofertaId) {
        setIsLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/ofertas/${ofertaId}`, {
          headers: token ? { Authorization: token } : undefined,
          cache: "no-store",
        })
        if (!res.ok) {
          throw new Error(`No se pudo cargar la oferta (${res.status})`)
        }
        const oferta = await res.json()
        setPrintData(buildPrintDataFromOferta(oferta))
      } catch (error) {
        console.error("Error cargando oferta:", error)
        setPrintData(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadOferta()
  }, [ofertaId])

  useEffect(() => {
    if (!printData) return
    setLoaded(true)
    const t = setTimeout(() => {
      window.print()
    }, 500)
    return () => clearTimeout(t)
  }, [printData])

  useEffect(() => {
    if (!isLoading && !printData) {
      router.replace("/busy/ofertas")
    }
  }, [isLoading, printData, router])

  useEffect(() => {
    getMiEmpresaAction()
      .then((r) => {
        if (r.success) setMiEmpresa(r.data as MiEmpresaData)
      })
      .catch(() => {})
  }, [])

  if (!printData) {
    return null
  }

  const fechaEmision = new Date(printData.fechaEmision)
  const fechaStr = fechaEmision.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

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

  const subtotal = Number(printData.subtotal ?? 0)
  const impuestos = Number(printData.impuestos ?? 0)
  const total = Number(printData.total ?? subtotal + impuestos)
  const importeLetras = numeroALetras(total, { plural: 'PESOS', singular: 'PESO', centPlural: 'CENTAVOS', centSingular: 'CENTAVO' })

  const getBorderClass = () => 'border-black'
  const getTextClass = () => 'text-black'
  const getTableHeaderClass = () => 'bg-gray-200 text-black'
  const getTotalColorClass = () => 'text-red-600'
  const getBlueColorClass = () => 'text-blue-800'
  const getGrayTextClass = () => 'text-gray-500'
  const getDottedBorderClass = () => 'border-gray-400'
  const getLightBgClass = () => 'bg-orange-50'
  const getLightBorderClass = () => 'border-orange-200'

  return (
    <div className="min-h-screen text-sm font-sans bg-white text-black">
      <div className={`max-w-[210mm] mx-auto p-4 print:p-6 print:max-w-none bg-white text-black`}>

        {/* HEADER */}
        <div className="flex mb-1 border border-black">
          <div className="w-1/3 p-2 flex flex-col items-center justify-center border-r border-black relative">
            {miEmpresa?.logoUrl ? (
              <Image src={miEmpresa.logoUrl} alt="Logo" width={80} height={80} className="h-20 w-auto object-contain" unoptimized />
            ) : (
              <span className="font-bold italic font-serif text-lg text-blue-800">{empresaNombre}</span>
            )}
          </div>

          <div className="w-2/3 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center border-b border-black py-2">
              <h1 className="text-4xl font-serif font-bold tracking-wider">OFERTA</h1>
              <p className="italic font-serif text-sm">Información, Comunicaciones y Telecomunicaciones</p>
            </div>
            <div className="flex text-xs">
              <div className="w-2/3 p-2 text-center border-r border-black flex flex-col justify-center">
                <p>{empresaDireccion}</p>
                <p>Tel: {empresaTel}</p>
              </div>
              <div className="w-1/3 p-2 flex flex-col justify-center font-bold text-black">
                <div className="flex justify-between">
                  <span>No.:</span>
                  <span>{printData.numeroOferta}</span>
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
        <div className="flex mb-1 p-2 border-t-0 border border-black">
          <div className="w-1/2 pr-4 space-y-0.5">
            <div className="grid grid-cols-[100px_1fr]">
              <span className="font-medium">Cliente:</span>
              <span className={`border-b border-dotted ${getDottedBorderClass()}`}>{printData.cliente?.nombre || ""}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr]">
              <span className="font-medium">Dirección:</span>
              <span className={`border-b border-dotted ${getDottedBorderClass()}`}>{printData.cliente?.direccion || ""}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr]">
              <span className="font-medium">Fecha Emisión:</span>
              <span className={`border-b border-dotted ${getDottedBorderClass()}`}>{fechaStr}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr]">
              <span className="font-medium">Vencimiento:</span>
              <span className={`border-b border-dotted ${getDottedBorderClass()}`}>
                {printData.fechaVencimiento ? new Date(printData.fechaVencimiento).toLocaleDateString("es-ES") : "-"}
              </span>
            </div>
            <div className="grid grid-cols-[100px_1fr]">
              <span className="font-medium">Estado:</span>
              <span className={`border-b border-dotted ${getDottedBorderClass()} font-bold`}>{printData.estado}</span>
            </div>
          </div>
          <div className="w-1/2 pl-4 text-right space-y-0.5 text-black">
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
        <div className="mb-1 min-h-80 relative border-t-0 border border-black">
          <table className="w-full text-xs">
            <thead className={`font-bold uppercase border-b border-black ${getTableHeaderClass()}`}>
              <tr>
                <th className="w-[60%] border-r py-1 px-3 text-left border-black">DESCRIPCIÓN</th>
                <th className="w-[12%] border-r py-1 px-3 text-center border-black">CANTIDAD</th>
                <th className="w-[14%] border-r py-1 px-3 text-center border-black">P. UNITARIO MN</th>
                <th className="w-[14%] py-1 px-3 text-center text-black">IMPORTE MN</th>
              </tr>
            </thead>
            <tbody className="text-black">
              {printData.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-200 last:border-b-0">
                  <td className="border-r py-1 px-3 text-left align-middle border-black">{item.nombre}</td>
                  <td className="border-r py-1 px-3 text-center align-middle border-black">{item.cantidad}</td>
                  <td className="border-r py-1 px-3 text-right align-middle border-black">{item.precioUnitario.toFixed(2)}</td>
                  <td className="py-1 px-3 text-right align-middle text-black">{item.total.toFixed(2)}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, Math.min(6, 8 - printData.items.length)) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border-r py-1 px-3 border-black">&nbsp;</td>
                  <td className="border-r py-1 px-3 border-black">&nbsp;</td>
                  <td className="border-r py-1 px-3 border-black">&nbsp;</td>
                  <td className="py-1 px-3 text-black">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* OBSERVACIONES Y TOTALES */}
        <div className="flex mb-1 border-t-0 border border-black" style={{ pageBreakInside: 'avoid' }}>
          <div className="w-2/3 p-2 flex flex-col justify-between border-r border-black">
            <div>
              <span className="font-bold uppercase block text-xs mb-1">OBSERVACIONES:</span>
              <p className="text-xs">{printData.observaciones}</p>
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
              <span className="text-xs font-medium">IMPUESTOS MN</span>
              <span className="text-sm">{impuestos > 0 ? impuestos.toFixed(2) : "0.00"}</span>
            </div>
            <div className={`flex justify-between items-center px-2 py-1 mt-auto border-t ${getLightBorderClass()}`}>
              <span className="text-xs font-bold">TOTAL MN</span>
              <span className={`text-base font-bold ${getTotalColorClass()}`}>{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* FIRMAS */}
        <div className="p-2 text-xs mb-1 border-t-0 border border-black" style={{ pageBreakInside: 'avoid' }}>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col justify-between">
              <div>
                <div className="grid grid-cols-[80px_1fr] gap-2 mb-1">
                  <span>Recibido por:</span>
                  <div className="h-4 border-b border-black"></div>
                </div>
                <div className={`text-right text-[10px] mb-1 ${getGrayTextClass()}`}>(Nombre y Apellidos)</div>
                <div className="grid grid-cols-[80px_1fr] gap-2 mb-1">
                  <span>C. Identidad:</span>
                  <div className="h-4 border-b border-black"></div>
                </div>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-2 mt-1">
                <span>Firma:</span>
                <div className="h-4 border-b border-black"></div>
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-end mb-1">
                  <span>Entregado por:</span>
                  <span className={`text-[10px] ${getGrayTextClass()}`}>(Nombre y Apellidos)</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 mb-1">
                  <span>C.Identidad:</span>
                  <div className="h-4 border-b border-black"></div>
                </div>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-2 mt-1">
                <span>Firma:</span>
                <div className="h-4 border-b border-black"></div>
              </div>
            </div>

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
                <div className="h-4 border-b border-black"></div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-2 text-xs flex justify-between items-end border-t-0 border border-black" style={{ pageBreakInside: 'avoid' }}>
          <div>
            <p className="font-medium">Dirija sus pagos en Moneda Nacional a:</p>
            <div className="flex gap-4 mt-1">
              <span className="font-medium">No. Cuenta CUP:</span>
              <span className={`font-bold ${getBlueColorClass()}`}>{empresaCuenta}</span>
            </div>
            <div className="mt-1">
              <span>Mi dirección electrónica: {empresaEmail}</span>
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
        body, main, [data-sidebar="inset"], .sidebar-inset {
          background: white !important;
        }

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

          .min-h-screen {
            min-height: auto !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  )
}

export default function OfertaPrintPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Cargando oferta...</p>
        </div>
      </div>
    }>
      <OfertaPrintContent />
    </Suspense>
  )
}
