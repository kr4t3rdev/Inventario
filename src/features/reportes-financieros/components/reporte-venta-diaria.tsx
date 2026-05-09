"use client"

import { useState, useMemo } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { useVentas } from "@/features/ventas/hooks/use-ventas"
import { useGetVentaServiciosQuery } from "@/features/venta-servicios/api/ventaServiciosApi"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon, FileIcon as FilePdf, FileText, DollarSign, Package, Calendar } from "lucide-react"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { exportToCsv } from "@/lib/export-utils"
import { flattenVentas } from "@/lib/ventas-utils"
import { cn } from "@/lib/utils"
import { getProductDisplayIdentifier } from "@/lib/product-display-utils"
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts"
import { AnimatedCard, StaggerContainer, StaggerItem } from "@/components/ui/animations"

const surfaceCardClass = cn(
  "relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl",
  "dark:border-slate-800/60 dark:bg-slate-900/10",
)

/**
 * @description Módulo de análisis de venta diaria con métricas, comparación y detalle de transacciones.
 * @returns {JSX.Element} Vista principal del reporte diario de ventas.
 */

export function ReporteVentaDiaria() {
   const shouldReduceMotion = useReducedMotion()
   const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(() => {
     // Usar la fecha local del navegador para evitar problemas de zona horaria
     const now = new Date()
     const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
     return format(localDate, 'yyyy-MM-dd')
   })
   const [vistaPeriodo, setVistaPeriodo] = useState<'dia' | 'semana' | 'mes'>('dia')
   const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
   const [detallesDia, setDetallesDia] = useState<any[]>([])
   const [fechaDetalle, setFechaDetalle] = useState<string>('')

   const { ventas, isLoading: isLoadingVentas } = useVentas()
  const { data: ventaServicios } = useGetVentaServiciosQuery()
  const ventasLineas = useMemo(() => flattenVentas(ventas), [ventas])

  // Helper function para crear fecha local
  const crearFechaLocal = (fechaString: string): Date => {
    // Crear fecha en zona horaria local a partir del string yyyy-MM-dd
    const [year, month, day] = fechaString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Filtrar ventas por fecha seleccionada
  const ventasDelDia = useMemo(() => {
    if (ventasLineas.length === 0) return []

    const fecha = crearFechaLocal(fechaSeleccionada)
    const inicioDia = startOfDay(fecha)
    const finDia = endOfDay(fecha)

    return ventasLineas.filter((venta) => {
      const fechaVenta = new Date(venta.createdAt)
      return fechaVenta >= inicioDia && fechaVenta <= finDia
    })
  }, [ventasLineas, fechaSeleccionada])

  // Filtrar ventas de servicios por fecha seleccionada
  const serviciosDelDia = useMemo(() => {
    if (!ventaServicios) return []

    const fecha = crearFechaLocal(fechaSeleccionada)
    const inicioDia = startOfDay(fecha)
    const finDia = endOfDay(fecha)

    return ventaServicios.filter(servicio => {
      const fechaServicio = new Date(servicio.createdAt || '')
      return fechaServicio >= inicioDia && fechaServicio <= finDia
    })
  }, [ventaServicios, fechaSeleccionada])

  // Calcular estadísticas del día
  const estadisticasDelDia = useMemo(() => {
    const totalVentas = ventasDelDia.length
    const totalServicios = serviciosDelDia.length
    const totalProductosVendidos = ventasDelDia.reduce((sum, venta) => sum + venta.cantidad, 0)
    const ingresosBrutosVentas = ventasDelDia.reduce((sum, venta) => sum + (venta.totalLinea || 0), 0)
    const ingresosBrutosServicios = serviciosDelDia.reduce((sum, servicio) => sum + servicio.total, 0)
    const ingresosBrutos = ingresosBrutosVentas + ingresosBrutosServicios
    const descuentos = ventasDelDia.reduce((sum, venta) => sum + (venta.descuento || 0), 0)
    const ingresosNetos = ingresosBrutos - descuentos
    const costoTotal = ventasDelDia.reduce((sum, venta) => sum + (venta.cantidad * (venta.producto?.precioCosto || 0)), 0)
    const ganancia = ingresosNetos - costoTotal
    const margenGanancia = ingresosNetos > 0 ? (ganancia / ingresosNetos) * 100 : 0

    return {
      totalVentas,
      totalServicios,
      totalProductosVendidos,
      ingresosBrutos,
      descuentos,
      ingresosNetos,
      costoTotal,
      ganancia,
      margenGanancia
    }
  }, [ventasDelDia, serviciosDelDia])

  // Calcular datos para comparación
  const datosComparacion = useMemo(() => {
    if (ventasLineas.length === 0 && !ventaServicios) return null

    const fechaActual = crearFechaLocal(fechaSeleccionada)
    let fechaComparacion: Date
    let label: string

    switch (vistaPeriodo) {
      case 'dia':
        fechaComparacion = subDays(fechaActual, 1)
        label = "Día anterior"
        break
      case 'semana':
        fechaComparacion = subDays(fechaActual, 7)
        label = "Semana anterior"
        break
      case 'mes':
        fechaComparacion = subDays(fechaActual, 30)
        label = "Mes anterior"
        break
    }

    const ventasPeriodoActual = ventasLineas
      .filter((venta) => {
        const fechaVenta = new Date(venta.createdAt)
        return fechaVenta >= startOfDay(fechaActual) && fechaVenta <= endOfDay(fechaActual)
      })

    const ventasPeriodoAnterior = ventasLineas
      .filter((venta) => {
        const fechaVenta = new Date(venta.createdAt)
        return fechaVenta >= startOfDay(fechaComparacion) && fechaVenta <= endOfDay(fechaComparacion)
      })

    const serviciosPeriodoActual = (ventaServicios || []).filter(servicio => {
      const fechaServicio = new Date(servicio.createdAt || '')
      return fechaServicio >= startOfDay(fechaActual) && fechaServicio <= endOfDay(fechaActual)
    })

    const serviciosPeriodoAnterior = (ventaServicios || []).filter(servicio => {
      const fechaServicio = new Date(servicio.createdAt || '')
      return fechaServicio >= startOfDay(fechaComparacion) && fechaServicio <= endOfDay(fechaComparacion)
    })

    const ingresosActualVentas = ventasPeriodoActual.reduce(
      (sum, venta) => sum + (venta.totalLinea || 0) - (venta.descuento || 0),
      0,
    )

    const ingresosActualServicios = serviciosPeriodoActual.reduce((sum, servicio) => sum + servicio.total, 0)
    const ingresosActual = ingresosActualVentas + ingresosActualServicios

    const ingresosAnteriorVentas = ventasPeriodoAnterior.reduce(
      (sum, venta) => sum + (venta.totalLinea || 0) - (venta.descuento || 0),
      0,
    )

    const ingresosAnteriorServicios = serviciosPeriodoAnterior.reduce((sum, servicio) => sum + servicio.total, 0)
    const ingresosAnterior = ingresosAnteriorVentas + ingresosAnteriorServicios

    const productosActual = ventasPeriodoActual.reduce((sum, venta) => sum + venta.cantidad, 0)
    const productosAnterior = ventasPeriodoAnterior.reduce((sum, venta) => sum + venta.cantidad, 0)

    const porcentajeCambioIngresos = ingresosAnterior > 0 ? ((ingresosActual - ingresosAnterior) / ingresosAnterior) * 100 : 0
    const porcentajeCambioProductos = productosAnterior > 0 ? ((productosActual - productosAnterior) / productosAnterior) * 100 : 0

    return {
      label,
      ingresosActual,
      ingresosAnterior,
      productosActual,
      productosAnterior,
      porcentajeCambioIngresos,
      porcentajeCambioProductos,
      fechaComparacion: format(fechaComparacion, 'dd/MM/yyyy')
    }
  }, [ventasLineas, ventaServicios, fechaSeleccionada, vistaPeriodo])

  // Datos para tendencias (últimos 7 días)
  const datosTendencias = useMemo(() => {
    if (ventasLineas.length === 0 && !ventaServicios) return []

    const tendencias = []
    const fechaBase = crearFechaLocal(fechaSeleccionada)
    
    for (let i = 6; i >= 0; i--) {
      const fecha = subDays(fechaBase, i)
      const ventasDia = ventasLineas.filter((venta) => {
        const fechaVenta = new Date(venta.createdAt)
        return fechaVenta >= startOfDay(fecha) && fechaVenta <= endOfDay(fecha)
      })

      const serviciosDia = (ventaServicios || []).filter(servicio => {
        const fechaServicio = new Date(servicio.createdAt || '')
        return fechaServicio >= startOfDay(fecha) && fechaServicio <= endOfDay(fecha)
      })

      const ingresosVentas = ventasDia.reduce(
        (sum, venta) => sum + (venta.totalLinea || 0) - (venta.descuento || 0),
        0,
      )

      const ingresosServicios = serviciosDia.reduce((sum, servicio) => sum + servicio.total, 0)
      const ingresos = ingresosVentas + ingresosServicios

      const productosVendidos = ventasDia.reduce((sum, venta) => sum + venta.cantidad, 0)

      tendencias.push({
        fecha: format(fecha, 'dd/MM'),
        ingresos,
        productos: productosVendidos,
        ventas: ventasDia.length,
        servicios: serviciosDia.length
      })
    }

    return tendencias
  }, [ventasLineas, ventaServicios, fechaSeleccionada])

  const exportarCsv = () => {
    const datosVentas = ventasDelDia.map(venta => ({
      Fecha: format(new Date(venta.createdAt), 'yyyy-MM-dd'),
      Hora: format(new Date(venta.createdAt), 'HH:mm'),
      Tipo: 'Producto',
      Descripcion: getProductDisplayIdentifier({
        id: venta.productoId,
        nombre: venta.producto?.nombre || venta.productoNombre,
        codigoInterno: venta.producto?.codigoInterno || venta.productoCodigoInterno,
      }),
      Cantidad: venta.cantidad,
      PrecioUnitario: venta.precioUnitario || 0,
      TotalBruto: venta.totalLinea || 0,
      Descuento: venta.descuento || 0,
      TotalNeto: (venta.totalLinea || 0) - (venta.descuento || 0),
      PuntoVenta: venta.puntoDeVenta?.nombre || 'N/A',
      Cliente: venta.cliente?.nombre || 'Cliente general'
    }))

    const datosServicios = serviciosDelDia.map(servicio => ({
      Fecha: format(new Date(servicio.createdAt || ''), 'yyyy-MM-dd'),
      Hora: format(new Date(servicio.createdAt || ''), 'HH:mm'),
      Tipo: 'Servicio',
      Descripcion: servicio.servicio?.descripcion || 'Servicio no especificado',
      Cantidad: servicio.cantidad,
      PrecioUnitario: servicio.servicio?.precio || 0,
      TotalBruto: servicio.total,
      Descuento: 0,
      TotalNeto: servicio.total,
      PuntoVenta: 'N/A',
      Cliente: servicio.cliente?.clienteId || 'Cliente general'
    }))

    const datosParaExport = [...datosVentas, ...datosServicios]

    exportToCsv(datosParaExport, `Reporte_Venta_Diaria_${format(crearFechaLocal(fechaSeleccionada), 'yyyy-MM-dd')}`)
  }

  // Función para obtener detalles de ventas de un día específico
  const obtenerDetallesDelDia = (fechaStr: string) => {
    if (ventasLineas.length === 0 && !ventaServicios) return

    // Convertir string de fecha dd/MM a yyyy-MM-dd para comparación
    const [day, month] = fechaStr.split('/')
    const fechaActual = crearFechaLocal(fechaSeleccionada)
    const fechaBuscada = new Date(fechaActual.getFullYear(), parseInt(month) - 1, parseInt(day))
    
    const ventasDia = ventasLineas
      .filter((venta) => {
        const fechaVenta = new Date(venta.createdAt)
        return fechaVenta >= startOfDay(fechaBuscada) && fechaVenta <= endOfDay(fechaBuscada)
      })
      .map((venta) => ({
        ...venta,
        hora: format(new Date(venta.createdAt), 'HH:mm')
      }))

    const serviciosDia = (ventaServicios || [])
      .filter(servicio => {
        const fechaServicio = new Date(servicio.createdAt || '')
        return fechaServicio >= startOfDay(fechaBuscada) && fechaServicio <= endOfDay(fechaBuscada)
      })
      .map(servicio => ({
        ...servicio,
        hora: format(new Date(servicio.createdAt || ''), 'HH:mm')
      }))

    const todosLosItems = [
      ...ventasDia.map(venta => ({
        tipo: 'Producto',
        hora: venta.hora,
        descripcion: getProductDisplayIdentifier({
          id: venta.productoId,
          nombre: venta.producto?.nombre || venta.productoNombre,
          codigoInterno: venta.producto?.codigoInterno || venta.productoCodigoInterno,
        }),
        cantidad: venta.cantidad,
        precioUnitario: venta.precioUnitario || 0,
        descuento: venta.descuento || 0,
        total: (venta.totalLinea || 0) - (venta.descuento || 0),
        puntoVenta: venta.puntoDeVenta?.nombre || 'N/A',
        cliente: venta.cliente?.nombre || 'Cliente general'
      })),
      ...serviciosDia.map(servicio => ({
        tipo: 'Servicio',
        hora: servicio.hora,
        descripcion: servicio.servicio?.descripcion || 'Servicio no especificado',
        cantidad: servicio.cantidad,
        precioUnitario: servicio.servicio?.precio || 0,
        descuento: 0,
        total: servicio.total,
        puntoVenta: 'N/A',
        cliente: servicio.cliente?.clienteId || 'Cliente general'
      }))
    ]

    // Ordenar por hora
    todosLosItems.sort((a, b) => a.hora.localeCompare(b.hora))

    setDetallesDia(todosLosItems)
    setFechaDetalle(format(fechaBuscada, 'dd/MM/yyyy'))
    setIsDetailModalOpen(true)
  }

  // Función para exportar detalles a PDF
  const exportarDetallesPdf = () => {
    const doc = new jsPDF()
    
    // Título
    doc.setFontSize(16)
    doc.text('Desglose de Ventas', 20, 20)
    doc.setFontSize(12)
    doc.text(`Fecha: ${fechaDetalle}`, 20, 30)
    doc.text(`Total de transacciones: ${detallesDia.length}`, 20, 40)
    
    const totalProductos = detallesDia.reduce((sum, item) => sum + item.cantidad, 0)
    const totalVentas = detallesDia.reduce((sum, item) => sum + item.total, 0)
    
    doc.text(`Total productos vendidos: ${totalProductos}`, 20, 50)
    doc.text(`Total ventas: ${totalVentas.toLocaleString()}`, 20, 60)
    
    // Headers de la tabla
    const headers = ['Hora', 'Tipo', 'Descripción', 'Cant.', 'P. Unit.', 'Total']
    const startY = 80
    
    // Configurar ancho de columnas
    const colWidths = [25, 25, 60, 20, 25, 30]
    let x = 20
    let y = startY
    
    // Dibujar headers
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    headers.forEach((header, i) => {
      doc.text(header, x, y)
      x += colWidths[i]
    })

    // Dibujar datos
    doc.setFont('helvetica', 'normal')
    y += 10
    
    detallesDia.forEach((item, index) => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      
      x = 20
      const row = [
        item.hora,
        item.tipo,
        item.descripcion.substring(0, 30) + (item.descripcion.length > 30 ? '...' : ''),
        item.cantidad.toString(),
        `${item.precioUnitario.toFixed(2)}`,
        `${item.total.toFixed(2)}`
      ]
      
      row.forEach((cell, i) => {
        doc.text(cell, x, y)
        x += colWidths[i]
      })
      
      y += 10
    })
    
    // Total final
    y += 10
    doc.setFont('helvetica', 'bold')
    doc.text(`TOTAL: ${totalVentas.toLocaleString()}`, 20, y)
    
    doc.save(`Desglose_Ventas_${fechaDetalle.replace(/\//g, '-')}.pdf`)
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: "easeOut" as const,
      },
    },
  }

  if (isLoadingVentas) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className={surfaceCardClass}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Skeleton className="h-100 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <StaggerContainer
      className="space-y-6 p-6"
    >
      {/* Header con controles */}
      <StaggerItem
        className={cn(
          surfaceCardClass,
          "flex flex-col gap-4 rounded-xl border-dashed p-5 md:flex-row md:items-center md:justify-between",
        )}
      >
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Reportes de Venta Diaria</h2>
            <p className="text-muted-foreground">
              Análisis detallado de ventas del {format(crearFechaLocal(fechaSeleccionada), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
            className={cn(
              "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm",
              "dark:border-slate-700 dark:bg-slate-900",
            )}
          />
          <Button variant="outline" size="sm" onClick={exportarCsv}>
            <FileText className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </StaggerItem>

      {/* Tarjetas de estadísticas */}
      <StaggerItem className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnimatedCard>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-primary")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-sm font-medium">Total de Ventas</CardDescription>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estadisticasDelDia.totalVentas + estadisticasDelDia.totalServicios}</div>
            <p className="text-xs text-muted-foreground">
              {estadisticasDelDia.totalProductosVendidos} productos + {estadisticasDelDia.totalServicios} servicios
            </p>
          </CardContent>
        </Card>
        </AnimatedCard>

        <AnimatedCard>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-chart-2")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-sm font-medium">Ingresos Netos</CardDescription>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${estadisticasDelDia.ingresosNetos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Bruto: ${estadisticasDelDia.ingresosBrutos.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        </AnimatedCard>

        <AnimatedCard>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-accent")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-sm font-medium">Ganancia</CardDescription>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${estadisticasDelDia.ganancia.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Margen: {estadisticasDelDia.margenGanancia.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        </AnimatedCard>

        <AnimatedCard>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-muted")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-sm font-medium">Ticket Promedio</CardDescription>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(estadisticasDelDia.totalVentas + estadisticasDelDia.totalServicios) > 0 ? (estadisticasDelDia.ingresosNetos / (estadisticasDelDia.totalVentas + estadisticasDelDia.totalServicios)).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Por venta/servicio realizado
            </p>
          </CardContent>
        </Card>
        </AnimatedCard>
      </StaggerItem>

      {/* Análisis de tendencias y comparación */}
      <StaggerItem className="grid gap-6 lg:grid-cols-2">
        {/* Gráfico de tendencias */}
        <AnimatedCard>
        <Card className={surfaceCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Tendencias de Ventas (Últimos 7 días)
            </CardTitle>
            <CardDescription>
              Evolución de ingresos y cantidad de productos vendidos
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={datosTendencias} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="fecha" />
                <YAxis />
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ingresos']}
                  labelFormatter={(label) => `Fecha: ${label}`}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="ingresos" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorIngresos)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        </AnimatedCard>

        {/* Comparación de períodos */}
        <AnimatedCard>
        <Card className={surfaceCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUpIcon className="h-5 w-5" />
              Comparación de Períodos
            </CardTitle>
            <CardDescription>
              <Select value={vistaPeriodo} onValueChange={(value: 'dia' | 'semana' | 'mes') => setVistaPeriodo(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Día anterior</SelectItem>
                  <SelectItem value="semana">Semana anterior</SelectItem>
                  <SelectItem value="mes">Mes anterior</SelectItem>
                </SelectContent>
              </Select>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {datosComparacion ? (
              <>
                <div className="flex items-center justify-between rounded-lg border p-3 bg-slate-50/50 dark:bg-slate-900/30">
                  <div>
                    <p className="font-medium">Ingresos</p>
                    <p className="text-sm text-muted-foreground">{datosComparacion.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${datosComparacion.ingresosActual.toLocaleString()}</p>
                    <div className={`text-xs flex items-center gap-1 ${
                      datosComparacion.porcentajeCambioIngresos >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {datosComparacion.porcentajeCambioIngresos >= 0 ? 
                        <TrendingUpIcon className="h-3 w-3" /> : 
                        <TrendingDownIcon className="h-3 w-3" />
                      }
                      {Math.abs(datosComparacion.porcentajeCambioIngresos).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3 bg-slate-50/50 dark:bg-slate-900/30">
                  <div>
                    <p className="font-medium">Productos Vendidos</p>
                    <p className="text-sm text-muted-foreground">{datosComparacion.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{datosComparacion.productosActual}</p>
                    <div className={`text-xs flex items-center gap-1 ${
                      datosComparacion.porcentajeCambioProductos >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {datosComparacion.porcentajeCambioProductos >= 0 ? 
                        <TrendingUpIcon className="h-3 w-3" /> : 
                        <TrendingDownIcon className="h-3 w-3" />
                      }
                      {Math.abs(datosComparacion.porcentajeCambioProductos).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos disponibles para comparación</p>
            )}
          </CardContent>
        </Card>
        </AnimatedCard>
      </StaggerItem>

      {/* Tabla detallada de ventas */}
      <StaggerItem>
        <AnimatedCard>
        <Card className={surfaceCardClass}>
        <CardHeader>
          <CardTitle>Detalle de Ventas del Día</CardTitle>
          <CardDescription>
            Lista completa de todas las transacciones realizadas el {format(crearFechaLocal(fechaSeleccionada), 'dd/MM/yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">Total Neto</TableHead>
                  <TableHead>Punto de Venta</TableHead>
                  <TableHead>Cliente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ventasDelDia.length === 0 && serviciosDelDia.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No hay ventas registradas para esta fecha
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {ventasDelDia.map((venta) => {
                      const totalBruto = venta.totalLinea || 0
                      const totalNeto = totalBruto - (venta.descuento || 0)

                      return (
                        <TableRow key={venta.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">
                            {format(new Date(venta.createdAt), 'HH:mm')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">Producto</Badge>
                          </TableCell>
                          <TableCell>
                            {getProductDisplayIdentifier({
                              id: venta.productoId,
                              nombre: venta.producto?.nombre || venta.productoNombre,
                              codigoInterno: venta.producto?.codigoInterno || venta.productoCodigoInterno,
                            })}
                          </TableCell>
                          <TableCell className="text-right">{venta.cantidad}</TableCell>
                          <TableCell className="text-right">${(venta.precioUnitario || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right">${totalBruto.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {venta.descuento ? (
                              <Badge variant="destructive">${venta.descuento.toFixed(2)}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">${totalNeto.toFixed(2)}</TableCell>
                          <TableCell>{venta.puntoDeVenta?.nombre || 'N/A'}</TableCell>
                          <TableCell>{venta.cliente?.nombre || 'Cliente general'}</TableCell>
                        </TableRow>
                      )
                    })}
                    {serviciosDelDia.map((servicio) => (
                      <TableRow key={servicio.ventaServicioId} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">
                          {format(new Date(servicio.createdAt || ''), 'HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Servicio</Badge>
                        </TableCell>
                        <TableCell>{servicio.servicio?.descripcion || 'Servicio no especificado'}</TableCell>
                        <TableCell className="text-right">{servicio.cantidad}</TableCell>
                        <TableCell className="text-right">${(servicio.servicio?.precio || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">${servicio.total.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell className="text-right font-medium">${servicio.total.toFixed(2)}</TableCell>
                        <TableCell>N/A</TableCell>
                        <TableCell>{servicio.cliente?.clienteId || 'Cliente general'}</TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </AnimatedCard>
      </StaggerItem>

      {/* Modal de desglose de ventas por día */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden bg-white/95 backdrop-blur-xl dark:bg-slate-950/95">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Desglose de Ventas del {fechaDetalle}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportarDetallesPdf}
                disabled={detallesDia.length === 0}
              >
                <FilePdf className="mr-1 h-3.5 w-3.5" />
                Exportar PDF
              </Button>
            </DialogTitle>
            <DialogDescription>
              Detalle completo de productos y servicios vendidos en la fecha seleccionada
            </DialogDescription>
          </DialogHeader>
          
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card className={surfaceCardClass}>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{detallesDia.length}</div>
                  <div className="text-sm text-muted-foreground">Transacciones</div>
                </div>
              </CardContent>
            </Card>
            <Card className={surfaceCardClass}>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {detallesDia.reduce((sum, item) => sum + item.cantidad, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Productos Vendidos</div>
                </div>
              </CardContent>
            </Card>
            <Card className={surfaceCardClass}>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-sky-600">
                    ${detallesDia.reduce((sum, item) => sum + item.total, 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Total de Ventas</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de detalles */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto border rounded">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-100/95 backdrop-blur dark:bg-slate-900/95">
                  <TableRow>
                    <TableHead className="w-20">Hora</TableHead>
                    <TableHead className="w-24">Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right w-20">Cantidad</TableHead>
                    <TableHead className="text-right w-24">Precio Unit.</TableHead>
                    <TableHead className="text-right w-24">Descuento</TableHead>
                    <TableHead className="text-right w-24">Total</TableHead>
                    <TableHead className="w-32">Punto de Venta</TableHead>
                    <TableHead className="w-32">Cliente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detallesDia.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No hay ventas registradas para esta fecha
                      </TableCell>
                    </TableRow>
                  ) : (
                    detallesDia.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.hora}</TableCell>
                        <TableCell>
                          <Badge variant={item.tipo === 'Producto' ? 'outline' : 'secondary'}>
                            {item.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={item.descripcion}>
                          {item.descripcion}
                        </TableCell>
                        <TableCell className="text-right">{item.cantidad}</TableCell>
                        <TableCell className="text-right">${item.precioUnitario.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          {item.descuento > 0 ? (
                            <Badge variant="destructive">${item.descuento.toFixed(2)}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">${item.total.toFixed(2)}</TableCell>
                        <TableCell className="text-sm">{item.puntoVenta}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate" title={item.cliente}>
                          {item.cliente}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Footer con totales */}
          {detallesDia.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-end">
                <div className="space-y-2 text-right">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Total de productos:</span>{" "}
                    {detallesDia.reduce((sum, item) => sum + item.cantidad, 0)}
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    <span>Total de ventas:</span>{" "}
                    ${detallesDia.reduce((sum, item) => sum + item.total, 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </StaggerContainer>
  )
}
