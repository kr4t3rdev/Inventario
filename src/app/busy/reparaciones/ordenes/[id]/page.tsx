'use client'

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { getAuthToken } from "@/lib/token"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useGetOrdenQuery, useUpdateOrdenMutation, useFacturarOrdenMutation } from "@/lib/redux/services/ordenesReparacionApi"
import { getProductosAction } from "@/features/productos"
import { useGetCuentasBancariasQuery, useGetNextSerieNumberQuery } from "@/lib/redux/services/configuracionApi"
import { useGetDefectacionesQuery } from "@/lib/redux/services/reparacionesApi"
import { formatCurrency, cn } from "@/lib/utils"
import { ArrowLeft, Plus, Save, Trash2, Printer, CheckCircle, FileText, CalendarIcon } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { ComplejidadReparacion } from "@/app/models/model"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, addDays } from "date-fns"
import { es } from "date-fns/locale"

interface ItemTemp {
  ordenEquipoId?: string
  equipoTipoId?: string
  defectacionId?: string
  piezaId?: string
  nombrePieza: string
  cantidad?: number
  precio: number
  observaciones: string
  complejidad?: any
}

interface OrdenEquipoTemp {
  id: string
  equipoTipoId: string
  equipoTipo?: {
    nombre?: string
    piezas?: any[]
  }
  marca: string
  modelo?: string | null
  numeroSerie?: string | null
  contrasena?: string | null
  accesorios?: string | null
  problemaReportado: string
  isVirtual?: boolean
}

interface MaterialTemp {
  productoId: string
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  total: number
}

// Valores por defecto si no hay piezas seleccionadas
const DEFAULT_COMPLEXITY_LIMITS = {
  PEQUENO: 2500,
  MEDIANO: 7500,
  GRANDE: 15000
}

/**
 * @description Calcula los límites de complejidad sumando los topes por equipo dentro de la orden.
 * @param {OrdenEquipoTemp[]} equipos - Equipos incluidos en la orden.
 * @param {number} usdToCupRate - Tasa USD -> CUP.
 * @returns {{ PEQUENO: number; MEDIANO: number; GRANDE: number }} Límites en CUP.
 */
function calculateComplexityLimits(
  equipos: OrdenEquipoTemp[],
  usdToCupRate: number
): { PEQUENO: number; MEDIANO: number; GRANDE: number } {
  if (!equipos.length) {
    return DEFAULT_COMPLEXITY_LIMITS
  }

  return equipos.reduce(
    (acc, equipo) => {
      const piezas = equipo.equipoTipo?.piezas ?? []
      if (!piezas.length) {
        acc.PEQUENO += DEFAULT_COMPLEXITY_LIMITS.PEQUENO
        acc.MEDIANO += DEFAULT_COMPLEXITY_LIMITS.MEDIANO
        acc.GRANDE += DEFAULT_COMPLEXITY_LIMITS.GRANDE
        return acc
      }

      const maxPequeno = Math.max(...piezas.map((p: any) => Number(p.costoPequeno) || 0))
      const maxMediano = Math.max(...piezas.map((p: any) => Number(p.costoMediano) || 0))
      const maxGrande = Math.max(...piezas.map((p: any) => Number(p.costoGrande) || 0))

      acc.PEQUENO += maxPequeno > 0 ? maxPequeno * usdToCupRate : DEFAULT_COMPLEXITY_LIMITS.PEQUENO
      acc.MEDIANO += maxMediano > 0 ? maxMediano * usdToCupRate : DEFAULT_COMPLEXITY_LIMITS.MEDIANO
      acc.GRANDE += maxGrande > 0 ? maxGrande * usdToCupRate : DEFAULT_COMPLEXITY_LIMITS.GRANDE
      return acc
    },
    { PEQUENO: 0, MEDIANO: 0, GRANDE: 0 }
  )
}

export default function OrdenDetail({ params }: { params: Promise<{ id: string }> }) {
  // Fallback para obtener el id de la orden sin depender del hook 'use' no disponible en este entorno
  let ordId: string = ''
  if (typeof window !== 'undefined') {
    const m = window.location.pathname.match(/ordenes\/([^\/]+)/)
    ordId = m?.[1] ?? ''
  }
  const router = useRouter()
  const { data: orden, isLoading, refetch } = useGetOrdenQuery(ordId)
  // Defectaciones DB catalog
  const { data: defectacionesCatalogData } = useGetDefectacionesQuery()
  const defectacionesCatalog = defectacionesCatalogData ?? []

  // Carga la tasa de conversión de catálogo (USD -> Moneda Nacional) al abrir la orden
  useEffect(() => {
    let cancelled = false
    const loadCurrency = async () => {
      try {
        // Usar la API de exchange existente para obtener la tasa USD -> CUP (Moneda Nacional)
        const token = sessionStorage.getItem('token')
        const res = await fetch('/api/exchange?from=USD&to=CUP', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (res.status === 401) {
          throw new Error('Sesión expirada')
        }
        if (res.ok) {
          const data = await res.json()
          const rate = Number(data?.rate) || 1
          if (!cancelled) setExchangeRate(rate)
        }
      } catch {
        // ignore
      }
    }
    loadCurrency()
    return () => { cancelled = true }
  }, [])
  
  const [updateOrden, { isLoading: isUpdating }] = useUpdateOrdenMutation()
  const [facturarOrden, { isLoading: isFacturing }] = useFacturarOrdenMutation()
  const [productos, setProductos] = useState<any[]>([])
  const { data: cuentasBancariasData, isLoading: isLoadingCuentas, error: errorCuentas } = useGetCuentasBancariasQuery()

  useEffect(() => {
    getProductosAction().then(r => {
      if (r.success) setProductos(r.data ?? [])
    })
  }, [])

  // Normalizar cuentas bancarias a un array, soportando respuestas de diferentes formas
  const cuentasBancarias: any[] = Array.isArray(cuentasBancariasData)
    ? cuentasBancariasData
    : (cuentasBancariasData as any)?.cuentas ?? []
  // Estados locales para edición
  const [estado, setEstado] = useState<string>("")
  const [complejidad, setComplejidad] = useState<ComplejidadReparacion | null>(null)
  const [diagnostico, setDiagnostico] = useState("")
  const [fotos, setFotos] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  
  // Items (Mano de obra / Piezas de reparación)
  const [items, setItems] = useState<ItemTemp[]>([])
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [newItem, setNewItem] = useState<Partial<ItemTemp>>({})

  // Materiales (Repuestos de inventario)
  const [materiales, setMateriales] = useState<MaterialTemp[]>([])
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false)
  const [newMaterial, setNewMaterial] = useState<{ productoId: string, cantidad: number }>({ productoId: "", cantidad: 1 })

  // Estados locales para facturación
  const [isFacturarDialogOpen, setIsFacturarDialogOpen] = useState(false)
  const [isTasaDialogOpen, setIsTasaDialogOpen] = useState(false)
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const [customTasa, setCustomTasa] = useState<number>(1)
  const usdToCupRate = exchangeRate ?? 1
  const [selectedCuentaMoneda, setSelectedCuentaMoneda] = useState<string>("USD")
  const [facturaParams, setFacturaParams] = useState<{
    tipoTarjeta: string
    fechaVencimiento?: Date
    seriePrefijo: string
    cuentaBancariaId: string
    fechaVencimientoOption: string
  }>({
    tipoTarjeta: "MN",
    fechaVencimiento: undefined,
    seriePrefijo: "SR-",
    cuentaBancariaId: "",
    fechaVencimientoOption: "CONCRETA"
  })

  const { data: nextSerie } = useGetNextSerieNumberQuery(facturaParams.seriePrefijo, {
    skip: !isFacturarDialogOpen
  })

  const ordenEquipos: OrdenEquipoTemp[] = orden?.equipos?.length
    ? (orden.equipos as OrdenEquipoTemp[]).map((equipo) => ({ ...equipo, isVirtual: false }))
    : orden
      ? [{
          id: '__legacy__',
          equipoTipoId: orden.equipoTipoId,
          equipoTipo: orden.equipoTipo,
          marca: orden.marca,
          modelo: orden.modelo,
          numeroSerie: orden.numeroSerie,
          contrasena: orden.contrasena,
          accesorios: orden.accesorios,
          problemaReportado: orden.problemaReportado,
          isVirtual: true
        }]
      : []
  const ordenEquipoIds = new Set((orden?.equipos ?? []).map((equipo: any) => equipo.id))

  // Inicializar estado local cuando carga la orden
  useEffect(() => {
    if (orden) {
      setEstado(orden.estado)
      setDiagnostico(orden.diagnosticoTecnico || "")
      setFotos(orden.fotos || [])
      
      if (orden.items) {
        setItems(orden.items.map(i => ({
          ordenEquipoId: i.ordenEquipoId || undefined,
          equipoTipoId: i.ordenEquipo?.equipoTipoId || orden.equipoTipoId,
          piezaId: i.piezaId || undefined,
          defectacionId: i.defectacionId || undefined,
          nombrePieza: i.defectacion?.defecto || i.pieza?.nombre || "Servicio desconocido",
          precio: Number(i.precio),
          observaciones: i.observaciones || ""
        })))
      }
      
      if (orden.complejidad) {
        setComplejidad(orden.complejidad)
      }

      if (orden.materiales) {
        setMateriales(orden.materiales.map(m => ({
          productoId: m.productoId,
          nombreProducto: m.producto?.nombre || "Producto desconocido",
          cantidad: m.cantidad,
          precioUnitario: Number(m.precioUnitario),
          total: Number(m.total)
        })))
      }
    }
  }, [orden])

  // Efecto para sincronizar complejidad desde items
  useEffect(() => {
    if (items.length > 0) {
      // Buscar la complejidad más alta entre los items
      const complejidades = items.map(item => item.complejidad).filter(Boolean) as ComplejidadReparacion[]
      if (complejidades.length > 0) {
        const prioridad: Record<ComplejidadReparacion, number> = { 'PEQUENO': 1, 'MEDIANO': 2, 'GRANDE': 3 }
        const maxComplejidad = complejidades.reduce((max, curr) => 
          prioridad[curr] > prioridad[max] ? curr : max
        , 'PEQUENO' as ComplejidadReparacion)
        if (maxComplejidad !== complejidad) {
          console.log('Sincronizando complejidad desde items:', maxComplejidad)
          setComplejidad(maxComplejidad)
        }
      }
    }
  }, [items, complejidad])

  // Cargar defectoaciones desde DB - RTK Query (defectaciones catalogadas)
  // useEffect(() => { ... }, []) - Removed

  // Handlers para Items (Defectación por equipo) - versión nueva DB-backed
  const handleAddItem = () => {
    const ordenEquipoId = (newItem as any).ordenEquipoId as string | undefined
    const defectacionId = (newItem as any).defectacionId
    const piezaId = (newItem as any).piezaId
    
    if (!defectacionId && !piezaId) {
      toast.error("Seleccione una pieza o defectación")
      return
    }

    const selectedEquipo = ordenEquipos.find((e) => e.id === ordenEquipoId) ?? ordenEquipos[0]
    const piezasDisponibles = selectedEquipo?.equipoTipo?.piezas ?? []
    const defectacion = defectacionesCatalog.find(d => d.id === defectacionId)
    const pieza = piezasDisponibles.find((p: any) => p.id === piezaId)
    
    // Usar el costo del catálogo de defectaciones directamente
    const precio = defectacion?.costo ?? 0
    let nombrePieza = pieza?.nombre || defectacion?.defecto || 'Reparación'
    
    // Si hay pieza seleccionada, agregar el nombre al inicio
    if (pieza && defectacion?.defecto) {
      nombrePieza = `${pieza.nombre} - ${defectacion.defecto}`
    }

    setItems([...items, {
      ordenEquipoId: ordenEquipoId || undefined,
      equipoTipoId: selectedEquipo?.equipoTipoId || orden?.equipoTipoId,
      defectacionId,
      piezaId: piezaId || undefined,
      cantidad: 1,
      nombrePieza,
      complejidad: complejidad, // Usar la complejidad global de la orden
      precio,
      observaciones: (newItem as any).observaciones || ''
    }])
    setIsAddItemOpen(false)
    setNewItem({})
  }

  const handleRemoveItem = (index: number) => {
    const newItems = [...items]
    newItems.splice(index, 1)
    setItems(newItems)
  }

  // Handlers para Fotos
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', e.target.files[0])

      try {
      const token = sessionStorage.getItem('token');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      })
      
      if (!res.ok) throw new Error('Error subiendo imagen')
      
      const data = await res.json()
      setFotos([...fotos, data.url])
      toast.success("Foto subida")
    } catch (error) {
      console.error(error)
      toast.error("Error al subir la foto")
    } finally {
      setIsUploading(false)
      // Limpiar input
      e.target.value = ''
    }
  }

  const handleRemovePhoto = (index: number) => {
    const newFotos = [...fotos]
    newFotos.splice(index, 1)
    setFotos(newFotos)
  }

  // Handlers para Materiales
  const handleAddMaterial = () => {
    if (!newMaterial.productoId || newMaterial.cantidad <= 0) return

    const producto = productos?.find(p => p.id === newMaterial.productoId)
    if (!producto) return

    if (!exchangeRate || exchangeRate <= 0) {
      toast.error("Tasa de cambio no disponible. Intente de nuevo.")
      return
    }

    // Verificar si ya existe para sumar cantidad o agregar nuevo
    // Por simplicidad agregamos como línea nueva
    const precioCup = Number(producto.precioVenta) || 0
    const precioUnitarioUsd = precioCup / usdToCupRate
    const total = precioUnitarioUsd * newMaterial.cantidad

    setMateriales([...materiales, {
      productoId: producto.id,
      nombreProducto: producto.nombre,
      cantidad: newMaterial.cantidad,
      precioUnitario: precioUnitarioUsd,
      total
    }])
    setIsAddMaterialOpen(false)
    setNewMaterial({ productoId: "", cantidad: 1 })
  }

  const handleRemoveMaterial = (index: number) => {
    const newMats = [...materiales]
    newMats.splice(index, 1)
    setMateriales(newMats)
  }

  // Facturar Orden (Abrir Dialog)
  const handleFacturarClick = () => {
    setIsFacturarDialogOpen(true)
  }

  // Confirmar Facturación - Paso 1: Validar y mostrar diálogo de tasa si es CUP
  const confirmFacturar = async () => {
    // Validaciones
    if (!facturaParams.cuentaBancariaId) {
      toast.error("Debe seleccionar una cuenta bancaria/moneda")
      return
    }

    if (facturaParams.fechaVencimientoOption === "CONCRETA" && !facturaParams.fechaVencimiento) {
      toast.error("Debe seleccionar una fecha de vencimiento")
      return
    }

    // Si la moneda es CUP, mostrar diálogo de tasa de cambio
    if (selectedCuentaMoneda === "CUP") {
      setIsFacturarDialogOpen(false)
      setIsTasaDialogOpen(true)
      return
    }

    // Si es USD, facturar directamente (tasa = 1)
    await ejecutarFacturacion(1)
  }

  // Confirmar Facturación - Paso 2: Ejecutar con tasa de cambio
  const ejecutarFacturacion = async (tasaCambio: number) => {
    try {
      let fechaVenc = facturaParams.fechaVencimiento
      let terminos = "CONTADO"
      let metodo = "EFECTIVO"

      if (facturaParams.fechaVencimientoOption === "PLAZO_30") {
        const d = new Date()
        d.setDate(d.getDate() + 30)
        fechaVenc = d
        terminos = "CREDITO_30"
      } else if (facturaParams.fechaVencimientoOption === "CONTRA_ENTREGA") {
        fechaVenc = undefined
        terminos = "CONTRA_ENTREGA"
        metodo = "EFECTIVO"
      } else {
        terminos = "FECHA_CONCRETA"
      }

      // Los montos siempre se calculan en USD (catálogo)
      // La conversión se hace en el servidor si tasaCambio > 1

      await facturarOrden({
        id: ordId,
        tipoTarjeta: facturaParams.tipoTarjeta,
        fechaVencimiento: fechaVenc ? fechaVenc.toISOString() : undefined,
        seriePrefijo: facturaParams.seriePrefijo,
        cuentaBancariaId: facturaParams.cuentaBancariaId,
        metodoPago: metodo,
        terminosPago: terminos,
        tipoVencimiento: facturaParams.fechaVencimientoOption,
        tasaCambio: tasaCambio,
        moneda: selectedCuentaMoneda
      }).unwrap()

      toast.success("Orden facturada correctamente")
      setIsFacturarDialogOpen(false)
      setIsTasaDialogOpen(false)
      refetch()
    } catch (error) {
      console.error("Error al facturar:", error)
      toast.error("Error al facturar la orden")
    }
  }

  // Guardar Cambios
  const handleSave = async () => {
    try {
      await updateOrden({
        id: ordId,
        estado: estado as any,
        complejidad,
        diagnosticoTecnico: diagnostico,
        items: items.map(i => ({
          ordenEquipoId: i.ordenEquipoId && ordenEquipoIds.has(i.ordenEquipoId) ? i.ordenEquipoId : null,
          piezaId: i.piezaId,
          defectacionId: i.defectacionId,
          precio: i.precio,
          observaciones: i.observaciones
        })),
        materiales: materiales.map(m => ({
          productoId: m.productoId,
          cantidad: m.cantidad,
          precioUnitario: m.precioUnitario,
          total: m.total
        }))
      }).unwrap()
      
      toast.success("Orden actualizada correctamente")
      refetch()
    } catch (error) {
      toast.error("Error al actualizar la orden")
    }
  }

  // Ver Factura (con token)
  const handleViewFactura = async (facturaId: string) => {
    try {
      const token = getAuthToken()
      const loadingToast = toast.loading("Generando PDF...")
      
      const response = await fetch(`/api/facturas/${facturaId}/pdf`, {
        headers: {
          'Authorization': token
        }
      })
      
      toast.dismiss(loadingToast)

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Sesión expirada. Por favor inicie sesión nuevamente.")
          return
        }
        throw new Error('Error al descargar factura')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (error) {
      console.error(error)
      toast.error("Error al abrir la factura")
    }
  }

  const handleViewOrdenPDF = async () => {
    if (!orden) return
    
    const token = getAuthToken()
    if (!token) {
      toast.error("No hay sesión activa")
      return
    }

    try {
      const loadingToast = toast.loading("Generando PDF de Orden...")
      
      const response = await fetch(`/api/servicios/reparaciones/ordenes/${ordId}/pdf`, {
        headers: {
          'Authorization': token
        }
      })
      
      toast.dismiss(loadingToast)

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Sesión expirada. Por favor inicie sesión nuevamente.")
          return
        }
        throw new Error('Error al descargar PDF')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (error) {
      console.error(error)
      toast.error("Error al abrir el PDF de la orden")
    }
  }

  const handleViewCotizacion = async () => {
    if (!orden) return

    const token = getAuthToken()
    if (!token) {
      toast.error("No hay sesión activa")
      return
    }

    try {
      const loadingToast = toast.loading("Generando Cotización...")
      
       const response = await fetch(`/api/servicios/reparaciones/ordenes/${ordId}/cotizacion/pdf`, {
        headers: {
          'Authorization': token
        }
      })
      
      toast.dismiss(loadingToast)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("Error response:", errorData)
        
        if (response.status === 401) {
          toast.error("Sesión expirada. Por favor inicie sesión nuevamente.")
          return
        }
        throw new Error(errorData.message || 'Error al descargar cotización')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (error) {
      console.error(error)
      toast.error("Error al abrir la cotización")
    }
  }

  if (isLoading || !orden) return <div className="p-8 text-center">Cargando orden...</div>

  const primaryEquipoId = ordenEquipos[0]?.id
  const selectedOrdenEquipoId = (newItem as any).ordenEquipoId ?? primaryEquipoId
  const selectedEquipo = ordenEquipos.find((e) => e.id === selectedOrdenEquipoId) ?? ordenEquipos[0]
  const selectedPiezas = selectedEquipo?.equipoTipo?.piezas ?? []
  const piezasUsadas = new Set(
    items
      .filter((item) => {
        const itemEquipoId = item.ordenEquipoId ?? primaryEquipoId
        return itemEquipoId && itemEquipoId === selectedOrdenEquipoId
      })
      .map((item) => item.piezaId)
      .filter((id): id is string => Boolean(id))
  )
  const availablePiezas = selectedPiezas.filter((pieza: any) => {
    const piezaId = pieza?.id
    if (!piezaId) return false
    if ((newItem as any).piezaId === piezaId) return true
    return !piezasUsadas.has(piezaId)
  })

  const totalManoObraUsd = items.reduce((acc, item) => acc + Number(item.precio), 0)
  const totalMaterialesUsd = materiales.reduce((acc, item) => acc + Number(item.total), 0)
  const subTotalUsd = totalManoObraUsd + totalMaterialesUsd
  const subTotalCup = subTotalUsd * usdToCupRate
  const totalManoObraCup = totalManoObraUsd * usdToCupRate
  const totalMaterialesCup = totalMaterialesUsd * usdToCupRate
  const grandTotalCup = orden?.esGarantia ? 0 : subTotalCup
  const headerEquipoLabel = ordenEquipos.length > 1
    ? `Orden múltiple (${ordenEquipos.length} equipos)`
    : `${ordenEquipos[0]?.equipoTipo?.nombre || orden.equipoTipo?.nombre || 'Equipo'} - ${ordenEquipos[0]?.marca || orden.marca}`

  // Calcular límites de complejidad basados en las piezas seleccionadas
  const complexityLimits = calculateComplexityLimits(ordenEquipos, usdToCupRate)

  return (
    <motion.div 
      className="container mx-auto py-6 px-4 space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div 
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className="flex items-center gap-4">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/busy/reparaciones/ordenes">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Orden #{orden.numeroOrden}</h1>
                <Badge variant="outline">{orden.estado}</Badge>
                {orden.esGarantia && <Badge variant="default" className="bg-green-600">GARANTÍA</Badge>}
            </div>
            <p className="text-muted-foreground">{headerEquipoLabel}</p>
          </div>
        </div>
        <div className="flex gap-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" onClick={handleViewOrdenPDF}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" onClick={handleViewCotizacion}>
                  <FileText className="mr-2 h-4 w-4" /> Cotización
              </Button>
            </motion.div>
            {!orden.ventaId ? (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  variant="secondary" 
                  onClick={handleFacturarClick} 
                  disabled={isFacturing}
                  className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg disabled:opacity-50"
                >
                    <FileText className="mr-2 h-4 w-4" /> Facturar
                </Button>
              </motion.div>
            ) : (
               <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                 <Button variant="outline" onClick={() => {
                   if (orden.venta?.factura?.idFactura) {
                     handleViewFactura(orden.venta.factura.idFactura)
                   } else {
                     toast.error("No se encontró la factura asociada")
                   }
                 }}>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Ver Factura
                 </Button>
               </motion.div>
            )}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                onClick={handleSave} 
                disabled={isUpdating}
                className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg disabled:opacity-50"
              >
                  <Save className="mr-2 h-4 w-4" /> Guardar Cambios
              </Button>
            </motion.div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Info General y Diagnóstico */}
        <div className="space-y-6 lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>Información del Equipo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <span className="text-muted-foreground">Cliente:</span>
                        <span className="font-medium text-right">{orden.cliente?.nombre}</span>
                    </div>
                    <div className="space-y-3">
                      {ordenEquipos.map((equipo, idx) => (
                        <div key={equipo.id} className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Equipo {idx + 1}</span>
                            <span>{equipo.equipoTipo?.nombre || 'Equipo'}</span>
                          </div>
                          <div className="mt-1 font-medium">
                            {equipo.marca} {equipo.modelo || ''}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Serie: {equipo.numeroSerie || '-'} • Accesorios: {equipo.accesorios || '-'}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Problema: {equipo.problemaReportado || '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Estado y Diagnóstico</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Estado Actual</Label>
                        <Select value={estado} onValueChange={setEstado}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="RECIBIDO">Recibido</SelectItem>
                                <SelectItem value="EN_DIAGNOSTICO">En Diagnóstico</SelectItem>
                                <SelectItem value="ESPERANDO_APROBACION">Esperando Aprobación</SelectItem>
                                <SelectItem value="EN_REPARACION">En Reparación</SelectItem>
                                <SelectItem value="ESPERANDO_REPUESTOS">Esperando Repuestos</SelectItem>
                                <SelectItem value="TERMINADO">Terminado</SelectItem>
                                <SelectItem value="ENTREGADO">Entregado</SelectItem>
                                <SelectItem value="CANCELADO">Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Diagnóstico Técnico</Label>
                        <Textarea 
                            className="min-h-[150px]"
                            placeholder="Detalles técnicos de la revisión..."
                            value={diagnostico}
                            onChange={(e) => setDiagnostico(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Columna Derecha: Defectación y Materiales */}
        <div className="space-y-6 lg:col-span-2">
            
            {/* Sección de Mano de Obra / Piezas */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Defectación (Mano de Obra)</CardTitle>
                    <Dialog
                        open={isAddItemOpen}
                        onOpenChange={(open) => {
                          if (open) {
                            const defaultEquipo = ordenEquipos[0]
                            setNewItem({
                              ordenEquipoId: defaultEquipo?.id,
                              defectacionId: undefined,
                              piezaId: undefined,
                              observaciones: ""
                            })
                          }
                          setIsAddItemOpen(open)
                        }}
                    >
                        <DialogTrigger asChild>
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                              <Button 
                                size="sm"
                                className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg"
                              >
                                <Plus className="mr-2 h-4 w-4"/> Agregar Defecto
                              </Button>
                            </motion.div>
                        </DialogTrigger>
                    <DialogContent className="sm:max-w-[720px]">
                            <DialogHeader>
                                <DialogTitle>Agregar Defecto / Reparación</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Equipo a reparar</Label>
                                        <Select
                                            value={(newItem as any).ordenEquipoId || (ordenEquipos[0]?.id ?? "__none__")}
                                            onValueChange={(val) => {
                                              const nextId = val === "__none__" ? undefined : val
                                              setNewItem((prev) => ({
                                                ...(prev as any),
                                                ordenEquipoId: nextId,
                                                piezaId: undefined
                                              }))
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Seleccionar equipo..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {ordenEquipos.map((equipo) => (
                                                <SelectItem key={equipo.id} value={equipo.id}>
                                                  {equipo.equipoTipo?.nombre || "Equipo"} - {equipo.marca}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="rounded-md border bg-muted/30 p-3 text-xs">
                                          <div className="font-semibold">{selectedEquipo?.equipoTipo?.nombre || "Equipo"}</div>
                                          <div className="text-muted-foreground">
                                            {selectedEquipo?.marca} {selectedEquipo?.modelo || ""} {selectedEquipo?.numeroSerie ? `• ${selectedEquipo.numeroSerie}` : ""}
                                          </div>
                                          <div className="text-muted-foreground mt-1">
                                            {selectedEquipo?.problemaReportado || "Sin problema reportado"}
                                          </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Reparaciones disponibles</Label>
                                        <div className="rounded-md border bg-muted/30 p-3 text-xs max-h-28 overflow-auto">
                                          {selectedPiezas.length === 0 ? (
                                            <div className="text-muted-foreground">No hay piezas configuradas para este equipo.</div>
                                          ) : (
                                            <div className="space-y-2">
                                              {selectedPiezas.map((pieza: any) => (
                                                <div key={pieza.id} className="flex items-center justify-between gap-2">
                                                  <span className="font-medium">{pieza.nombre}</span>
                                                  <span className="text-[11px] text-muted-foreground">
                                                    P:{formatCurrency(Number(pieza.costoPequeno || 0) * usdToCupRate)} M:{formatCurrency(Number(pieza.costoMediano || 0) * usdToCupRate)} G:{formatCurrency(Number(pieza.costoGrande || 0) * usdToCupRate)}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Defectación de Equipo (opcional)</Label>
                                        <Select
                                            value={(newItem as any).defectacionId || "__none__"}
                                            onValueChange={(val) => {
                                              const defectacionId = val === "__none__" ? undefined : val
                                              setNewItem((prev) => ({ ...(prev as any), defectacionId }))
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Seleccionar defectación..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="__none__">Sin defectación</SelectItem>
                                              {defectacionesCatalog.map((d) => (
                                                <SelectItem key={d.id} value={d.id}>{d.defecto}</SelectItem>
                                              ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Pieza del Equipo</Label>
                                        <Select 
                                            value={(newItem as any).piezaId || '__none__'}
                                            onValueChange={(val) => {
                                              const piezaId = val === '__none__' ? undefined : val
                                              setNewItem((prev) => ({ 
                                                ...(prev as any), 
                                                piezaId
                                              }))
                                              
                                              if (piezaId) {
                                                const pieza = selectedPiezas.find((p: any) => p.id === piezaId)
                                                if (pieza) {
                                                  const costoPequeno = Number(pieza.costoPequeno) || 0
                                                  const costoMediano = Number(pieza.costoMediano) || 0
                                                  const costoGrande = Number(pieza.costoGrande) || 0
                                                  
                                                  let nuevaComplejidad: 'PEQUENO' | 'MEDIANO' | 'GRANDE' = 'PEQUENO'
                                                  if (costoGrande > 0 && costoGrande >= costoMediano && costoGrande >= costoPequeno) {
                                                    nuevaComplejidad = 'GRANDE'
                                                  } else if (costoMediano > 0 && costoMediano >= costoPequeno) {
                                                    nuevaComplejidad = 'MEDIANO'
                                                  } else {
                                                    nuevaComplejidad = 'PEQUENO'
                                                  }
                                                  
                                                  setComplejidad(nuevaComplejidad)
                                                }
                                              }
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Seleccionar pieza..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="__none__">Sin pieza específica</SelectItem>
                                              {availablePiezas.length === 0 && (
                                                <SelectItem value="__empty__" disabled>
                                                  No hay piezas disponibles
                                                </SelectItem>
                                              )}
                                              {availablePiezas.map((pieza: any) => {
                                                const costoPequeno = Number(pieza.costoPequeno) || 0
                                                const costoMediano = Number(pieza.costoMediano) || 0
                                                const costoGrande = Number(pieza.costoGrande) || 0
                                                return (
                                                  <SelectItem key={pieza.id} value={pieza.id}>
                                                    <div className="flex items-center justify-between w-full">
                                                      <span>{pieza.nombre}</span>
                                                      <span className="text-xs text-muted-foreground ml-4">
                                                        P:{formatCurrency(costoPequeno * usdToCupRate)} M:{formatCurrency(costoMediano * usdToCupRate)} G:{formatCurrency(costoGrande * usdToCupRate)}
                                                      </span>
                                                    </div>
                                                  </SelectItem>
                                                )
                                              })}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            Al seleccionar una pieza, se actualizará automáticamente la complejidad de la reparación según el tipo de pieza.
                                        </p>
                                    </div>
                                </div>

                                {(newItem as any).piezaId && selectedPiezas.length > 0 && (() => {
                                  const pieza = selectedPiezas.find((p: any) => p.id === (newItem as any).piezaId)
                                  if (!pieza) return null
                                  
                                  const costoPequeno = Number(pieza.costoPequeno) || 0
                                  const costoMediano = Number(pieza.costoMediano) || 0
                                  const costoGrande = Number(pieza.costoGrande) || 0
                                  const costoPequenoCup = costoPequeno * usdToCupRate
                                  const costoMedianoCup = costoMediano * usdToCupRate
                                  const costoGrandeCup = costoGrande * usdToCupRate
                                  
                                  let complejidadCalculada = 'PEQUENO'
                                  let colorClass = 'text-green-600'
                                  if (costoGrande > 0 && costoGrande >= costoMediano && costoGrande >= costoPequeno) {
                                    complejidadCalculada = 'GRANDE'
                                    colorClass = 'text-red-600'
                                  } else if (costoMediano > 0 && costoMediano >= costoPequeno) {
                                    complejidadCalculada = 'MEDIANO'
                                    colorClass = 'text-yellow-600'
                                  }
                                  
                                  return (
                                    <div className="rounded-md border bg-muted/30 p-3 text-xs">
                                      <p className="font-medium">{pieza.nombre}</p>
                                      <div className="flex flex-wrap gap-3 mt-1 text-xs">
                                        <span className={costoPequeno > 0 ? 'text-green-600' : 'text-gray-400'}>
                                          Pequeño: {formatCurrency(costoPequenoCup)}
                                        </span>
                                        <span className={costoMediano > 0 ? 'text-yellow-600' : 'text-gray-400'}>
                                          Mediano: {formatCurrency(costoMedianoCup)}
                                        </span>
                                        <span className={costoGrande > 0 ? 'text-red-600' : 'text-gray-400'}>
                                          Grande: {formatCurrency(costoGrandeCup)}
                                        </span>
                                      </div>
                                      <p className={`mt-1 font-semibold ${colorClass}`}>
                                        Complejidad asignada: {complejidadCalculada}
                                      </p>
                                    </div>
                                  )
                                })()}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Costo</Label>
                                        <div className="text-lg font-semibold text-primary">
                                          {(() => {
                                            const did = (newItem as any).defectacionId
                                            const found = defectacionesCatalog.find(d => d.id === did)
                                            const costoCup = (Number(found?.costo) || 0) * usdToCupRate
                                            return formatCurrency(costoCup)
                                          })()}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Observaciones</Label>
                                        <Input 
                                            placeholder="Detalle específico..."
                                            value={newItem.observaciones || ""}
                                            onChange={(e) => setNewItem({...newItem, observaciones: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>Cancelar</Button>
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                  <Button 
                                    onClick={handleAddItem}
                                    className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg"
                                  >
                                    Agregar
                                  </Button>
                                </motion.div>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Codigo</TableHead>
                                <TableHead>Descripcion</TableHead>
                                <TableHead className="text-right">Cant</TableHead>
                                <TableHead className="text-right">Unitario</TableHead>
                                <TableHead className="text-right">Importe</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                                        No se han agregado reparaciones.
                                    </TableCell>
                                </TableRow>
                            )}
                            {items.map((item, idx) => {
                              const code = item.defectacionId ?? item.piezaId ?? ''
                              const unitValue = item.precio * usdToCupRate
                              const cant = item.cantidad ?? 1
                              const importe = unitValue * cant
                              const equipoRef = ordenEquipos.find((e) => e.id === item.ordenEquipoId) ?? ordenEquipos[0]
                              const equipoLabel = equipoRef
                                ? `${equipoRef.equipoTipo?.nombre || 'Equipo'} - ${equipoRef.marca}`
                                : null
                              
                              return (
                                <TableRow key={idx}>
                                  <TableCell className="font-mono text-xs">{code.slice(-8)}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{item.nombrePieza}</span>
                                      {equipoLabel && (
                                        <span className="text-xs text-muted-foreground">Equipo: {equipoLabel}</span>
                                      )}
                                      {item.observaciones && (
                                        <span className="text-xs text-muted-foreground">{item.observaciones}</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">{cant}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(unitValue)}</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(importe)}</TableCell>
                                  <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(idx)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Sección de Materiales / Repuestos */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Materiales y Repuestos</CardTitle>
                    <Dialog open={isAddMaterialOpen} onOpenChange={setIsAddMaterialOpen}>
                        <DialogTrigger asChild>
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                              <Button 
                                size="sm"
                                className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg"
                              >
                                <Plus className="mr-2 h-4 w-4"/> Agregar Material
                              </Button>
                            </motion.div>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Agregar Material del Inventario</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Producto</Label>
                                    <Select 
                                        onValueChange={(val) => setNewMaterial({...newMaterial, productoId: val})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Buscar producto..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {productos?.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.nombre} ({formatCurrency(p.precioVenta)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Cantidad</Label>
                                    <Input 
                                        type="number" 
                                        min="1"
                                        value={newMaterial.cantidad}
                                        onChange={(e) => setNewMaterial({...newMaterial, cantidad: parseInt(e.target.value) || 1})}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddMaterialOpen(false)}>Cancelar</Button>
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                  <Button 
                                    onClick={handleAddMaterial}
                                    className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg"
                                  >
                                    Agregar
                                  </Button>
                                </motion.div>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-right">Cant.</TableHead>
                                <TableHead className="text-right">Unitario</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {materiales.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                                        No se han agregado materiales.
                                    </TableCell>
                                </TableRow>
                            )}
                            {materiales.map((mat, idx) => {
                              const unitValue = mat.precioUnitario * usdToCupRate
                              const totalValue = mat.total * usdToCupRate

                              return (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium">{mat.nombreProducto}</TableCell>
                                    <TableCell className="text-right">{mat.cantidad}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(unitValue)}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(totalValue)}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveMaterial(idx)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                              )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Totales */}
            <Card className="bg-muted/30">
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Columna Izquierda: Complejidad y Límites */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-sm font-semibold">Complejidad de Reparación</Label>
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                                        complejidad === 'GRANDE' ? 'bg-red-100 text-red-700' :
                                        complejidad === 'MEDIANO' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-green-100 text-green-700'
                                    }`}>
                                        {complejidad || 'PEQUENO'}
                                    </span>
                                </div>
                                <Select 
                                    value={complejidad || 'PEQUENO'} 
                                    onValueChange={(val) => {
                                        console.log('Cambiando complejidad manualmente a:', val)
                                        setComplejidad(val as ComplejidadReparacion)
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Seleccionar complejidad..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PEQUENO">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                <span>Pequeño (hasta {formatCurrency(complexityLimits.PEQUENO)})</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="MEDIANO">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                                <span>Mediano (hasta {formatCurrency(complexityLimits.MEDIANO)})</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="GRANDE">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                <span>Grande (hasta {formatCurrency(complexityLimits.GRANDE)})</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    La complejidad se actualiza automáticamente según la pieza seleccionada, o puede cambiarse manualmente.
                                </p>
                            </div>
                            
                            {/* Alerta si excede el límite */}
                            {grandTotalCup > complexityLimits[complejidad || 'PEQUENO'] && (
                                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm">
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-500">⚠️</span>
                                        <div>
                                            <p className="font-semibold text-red-700">Total excede el límite</p>
                                            <p className="text-red-600">
                                                El total de {formatCurrency(grandTotalCup)} supera el límite de {formatCurrency(complexityLimits[complejidad || 'PEQUENO'])} para reparaciones {complejidad?.toLowerCase() || 'pequeño'}s.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Progreso hacia el límite */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Uso del límite:</span>
                                    <span>{Math.round((grandTotalCup / complexityLimits[complejidad || 'PEQUENO']) * 100)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all ${
                                            grandTotalCup > complexityLimits[complejidad || 'PEQUENO'] 
                                                ? 'bg-red-500' 
                                                : grandTotalCup > complexityLimits[complejidad || 'PEQUENO'] * 0.8 
                                                    ? 'bg-yellow-500' 
                                                    : 'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min((grandTotalCup / complexityLimits[complejidad || 'PEQUENO']) * 100, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Límite máximo: {formatCurrency(complexityLimits[complejidad || 'PEQUENO'])}
                                </p>
                            </div>
                        </div>
                        
                        {/* Columna Derecha: Totales */}
                        <div className="flex flex-col gap-2 items-end justify-center">
                            <div className="flex justify-between w-full max-w-xs">
                                <span className="text-muted-foreground">Mano de Obra:</span>
                                <span>{formatCurrency(totalManoObraCup)}</span>
                            </div>
                            <div className="flex justify-between w-full max-w-xs">
                                <span className="text-muted-foreground">Materiales:</span>
                                <span>{formatCurrency(totalMaterialesCup)}</span>
                            </div>
                            {orden.esGarantia && (
                                 <div className="flex justify-between w-full max-w-xs text-green-600">
                                    <span>Descuento (Garantía):</span>
                                    <span>-{formatCurrency(subTotalCup)}</span>
                                </div>
                            )}
                            <div className="h-px w-full max-w-xs bg-border my-2"></div>
                            <div className="flex justify-between w-full max-w-xs text-lg font-bold">
                                <span>Total Estimado:</span>
                                <span className={grandTotalCup > complexityLimits[complejidad || 'PEQUENO'] ? 'text-red-600' : ''}>
                                    {formatCurrency(grandTotalCup)}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      {/* Dialog de Facturación */}
      <Dialog open={isFacturarDialogOpen} onOpenChange={setIsFacturarDialogOpen}>
          <DialogContent className="max-w-md">
              <DialogHeader>
                  <DialogTitle>Generar Factura de Servicio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  {/* Serie */}
                  <div className="space-y-2">
                      <Label>Serie de Facturación</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={facturaParams.seriePrefijo} 
                          onChange={(e) => setFacturaParams({...facturaParams, seriePrefijo: e.target.value})}
                          className="w-24"
                          placeholder="Prefijo"
                        />
                        <div className="flex items-center px-3 border rounded-md bg-muted text-muted-foreground flex-1">
                          Próximo: {nextSerie?.preview || "Calculando..."}
                        </div>
                      </div>
                      {/* <p className="text-xs text-muted-foreground">El número consecutivo se asignará automáticamente.</p> */}
                  </div>

                  {/* Moneda / Cuenta Bancaria */}
                  <div className="space-y-2">
                      <Label>Moneda / Cuenta Bancaria</Label>
                      <Select 
                          value={facturaParams.cuentaBancariaId} 
                          onValueChange={(val) => {
                            const cuenta = cuentasBancarias.find((c: any) => c.cuentaId === val)
                            const moneda = cuenta?.moneda || "USD"
                            setSelectedCuentaMoneda(moneda)
                            setFacturaParams({...facturaParams, cuentaBancariaId: val})
                            
                            // Si es CUP, cargar tasa de cambio automáticamente
                            if (moneda === "CUP" && !exchangeRate) {
                              const loadExchangeRate = async () => {
                                try {
                                  const token = sessionStorage.getItem('token')
                                  const res = await fetch('/api/exchange?from=USD&to=CUP', {
                                    headers: { Authorization: `Bearer ${token}` },
                                  })
                                  if (res.ok) {
                                    const data = await res.json()
                                    const rate = Number(data?.rate) || 1
                                    setExchangeRate(rate)
                                    setCustomTasa(rate)
                                  }
                                } catch {
                                  // Si falla, usar 1 como default
                                  setCustomTasa(1)
                                }
                              }
                              loadExchangeRate()
                            }
                          }}
                      >
                          <SelectTrigger>
                              <SelectValue placeholder="Seleccione cuenta..." />
                          </SelectTrigger>
                          <SelectContent>
                              {Array.isArray(cuentasBancarias) && cuentasBancarias.length > 0 ? cuentasBancarias.map((cuenta: any) => (
                                <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                                  {cuenta.moneda} - {cuenta.nombreBanco} ({cuenta.numeroCuenta})
                                </SelectItem>
                              )) : null}
                          </SelectContent>
                      </Select>
                  </div>

                  {/* Fecha de Vencimiento Options */}
                  <div className="space-y-3">
                      <Label>Términos de Pago</Label>
                      <RadioGroup 
                        value={facturaParams.fechaVencimientoOption} 
                        onValueChange={(val) => setFacturaParams({...facturaParams, fechaVencimientoOption: val})}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="CONCRETA" id="r1" />
                          <Label htmlFor="r1">Fecha Concreta (Cuentas por Cobrar)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="PLAZO_30" id="r2" />
                          <Label htmlFor="r2">Plazo 30 días (Cuentas por Cobrar)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="CONTRA_ENTREGA" id="r3" />
                          <Label htmlFor="r3">Contra Entrega (Reconciliación de Ventas)</Label>
                        </div>
                      </RadioGroup>
                  </div>

                  {/* Date Picker if not Contra Entrega */}
                  {facturaParams.fechaVencimientoOption === "CONCRETA" && (
                     <div className="space-y-2 pl-6">
                        <Label>Fecha de Vencimiento</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !facturaParams.fechaVencimiento && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {facturaParams.fechaVencimiento ? format(facturaParams.fechaVencimiento, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={facturaParams.fechaVencimiento}
                              onSelect={(date) => date && setFacturaParams({...facturaParams, fechaVencimiento: date})}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                     </div>
                  )}
                  {facturaParams.fechaVencimientoOption === "PLAZO_30" && (
                    <div className="pl-6 text-sm text-muted-foreground">
                       Vence: {format(addDays(new Date(), 30), "PPP", { locale: es })}
                    </div>
                  )}
              </div>
               <DialogFooter>
                   <Button variant="outline" onClick={() => setIsFacturarDialogOpen(false)}>Cancelar</Button>
                   <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                     <Button 
                       onClick={confirmFacturar} 
                       disabled={isFacturing}
                       className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg disabled:opacity-50"
                     >
                         {isFacturing ? "Generando..." : "Generar Factura"}
                     </Button>
                   </motion.div>
               </DialogFooter>
           </DialogContent>
       </Dialog>

      
      
    </motion.div>
  )
}
