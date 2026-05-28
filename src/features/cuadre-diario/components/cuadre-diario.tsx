"use client"

import { useState, useCallback, useEffect } from "react"
import { LazyMotion, m as motion, useReducedMotion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DollarSign,
  CreditCard,
  Banknote,
  TrendingUp,
  TrendingDown,
  Calendar as CalendarIcon,
  Search,
  RefreshCw,
  FileText,
  AlertCircle,
} from "lucide-react"
import { exportToPdf } from "@/lib/export-utils"
import { getCuadreDiarioAction } from "@/features/cuadre-diario/actions"
import { cn } from "@/lib/utils"

const METODO_PAGO_MAP: Record<string, { label: string; className: string }> = {
  efectivo: {
    label: "Efectivo",
    className:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
  tarjeta: {
    label: "Tarjeta",
    className:
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  transferencia: {
    label: "Transferencia",
    className:
      "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
  },
  credito: {
    label: "Crédito",
    className:
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  },
}

const surfaceCardClass = cn(
  "relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl",
  "dark:border-slate-800/60 dark:bg-slate-900/10",
)

interface CuadreDiarioFinancieroProps {
  fecha?: Date
  onFechaChange?: (fecha: Date) => void
}

export function CuadreDiarioFinanciero({
  fecha: initialFecha,
  onFechaChange,
}: CuadreDiarioFinancieroProps) {
  const shouldReduceMotion = useReducedMotion()
  const [fecha, setFecha] = useState<Date>(initialFecha || new Date())
  const [busqueda, setBusqueda] = useState("")
  const [metodoPagoFiltro, setMetodoPagoFiltro] = useState("todos")

  const formatoFecha = useCallback((date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }, [])

  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any>(null)

  const loadData = useCallback(async (f: Date) => {
    setIsLoading(true)
    const r = await getCuadreDiarioAction(formatoFecha(f))
    if (r.success) setData(r.data)
    else setError(r.error)
    setIsLoading(false)
  }, [formatoFecha])

  useEffect(() => { loadData(fecha) }, [fecha, loadData])

  const handleFechaChange = (date: Date | undefined) => {
    if (date) {
      setFecha(date)
      onFechaChange?.(date)
    }
  }

  const formatCurrency = (amount: number, currency: string = "CUP") => {
    const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "CUP"
    return `${symbol} ${amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className={surfaceCardClass}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className={surfaceCardClass}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card
        className={cn(
          surfaceCardClass,
          "border-red-200 bg-red-50/80 dark:border-red-900/60 dark:bg-red-900/20",
        )}
      >
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">Error al cargar el cuadre diario</p>
            </div>
            <Button onClick={() => loadData(fecha)} variant="destructive" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  const { resumen, ventas, gastos, resumenMetodosPago, totales, turnosDelDia } = data

  const ventasFiltradas = ventas.filter((venta: any) => {
    const coincideBusqueda =
      venta.cliente.toLowerCase().includes(busqueda.toLowerCase()) ||
      venta.id.toLowerCase().includes(busqueda.toLowerCase())
    const coincideMetodo =
      metodoPagoFiltro === "todos" || venta.metodoPago === metodoPagoFiltro
    return coincideBusqueda && coincideMetodo
  })

  const getMetodoPagoBadge = (metodo: string) => {
    const config = METODO_PAGO_MAP[metodo] || METODO_PAGO_MAP.efectivo
    return <Badge className={config.className}>{config.label}</Badge>
  }

  const getMovimientoIcon = (tipo: string) => {
    if (tipo === "entrada" || tipo === "venta" || tipo === "servicio") {
      return <TrendingUp className="h-4 w-4 text-green-600" />
    }
    return <TrendingDown className="h-4 w-4 text-red-600" />
  }

  const getMovimientoTipo = (tipo: string) => {
    switch (tipo) {
      case "entrada":
      case "venta":
      case "servicio":
        return "entrada"
      default:
        return "salida"
    }
  }

  const handleExportPdf = () => {
    const title = `Cuadre_Diario_${resumen.fecha}`

    const resumenData = [
      {
        fecha: resumen.fecha,
        totalVentas: formatCurrency(resumen.totalVentas),
        totalServicios: formatCurrency(resumen.totalServicios),
        totalIngresos: formatCurrency(resumen.totalIngresos),
        totalGastos: formatCurrency(resumen.totalGastos),
        diferencia: formatCurrency(resumen.diferencia),
      },
    ]

  // @ts-expect-error - ventas items have dynamic fields from Prisma
    const ventasData = ventas.map((v) => ({
      id: v.id.slice(-8),
      hora: v.horaFormateada,
      cliente: v.cliente,
      producto: v.producto,
      cantidad: v.cantidad,
      tipo: v.esServicio ? "Servicio" : "Venta",
      metodoPago: v.metodoPago,
      total: formatCurrency(v.total),
    }))

  // @ts-expect-error - gastos items have dynamic fields from Prisma
    const gastosData = gastos.map((g) => ({
      hora: g.horaFormateada,
      tipo: g.tipo,
      descripcion: g.descripcion,
      referencia: g.referencia,
      monto: formatCurrency(g.monto),
    }))

    const categorias = [
      { nombre: "Resumen", data: resumenData },
      { nombre: "Ventas y Servicios", data: ventasData },
      { nombre: "Movimientos de Caja", data: gastosData },
    ]

    exportToPdf(ventasData, categorias, title)
  }

  const totalEntradas = gastos
    .filter(
  // @ts-expect-error - tipo field may not be in type
      (g) => g.tipo === "entrada" || g.tipo === "venta" || g.tipo === "servicio",
    )
    .reduce((acc: any, g: any) => acc + g.monto, 0)

  const totalSalidas = gastos
    .filter(
  // @ts-expect-error - tipo not in GastoFormateado type
      (g) => g.tipo !== "entrada" && g.tipo !== "venta" && g.tipo !== "servicio",
    )
    .reduce((acc: any, g: any) => acc + g.monto, 0)

  return (
    <motion.div
      className="space-y-6 p-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={itemVariants}
        className={cn(
          surfaceCardClass,
          "flex flex-col gap-4 rounded-xl border-dashed p-5 sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <div>
          <h2 className="text-2xl font-bold">Cuadre Diario Financiero</h2>
          <p className="text-muted-foreground">
            Resumen de operaciones financieras del{" "}
            {fecha.toLocaleDateString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {fecha.toLocaleDateString("es-ES", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={fecha}
                onSelect={handleFechaChange}
                className="rounded-md border"
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            onClick={() => loadData(fecha)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPdf}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-chart-2")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(resumen.totalIngresos)}
            </div>
            <Badge
              className="mt-2.5 flex flex-col border-green-700 text-xs text-green-600 dark:text-green-400"
              variant="outline"
            >
              <p> Ventas: {formatCurrency(resumen.totalVentas)}</p>
              <p> Servicios: {formatCurrency(resumen.totalServicios)}</p>
            </Badge>
          </CardContent>
        </Card>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-destructive")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(resumen.totalGastos)}
            </div>
            <Badge
              className="mt-2.5 flex flex-col border-red-700 text-xs text-red-500 dark:text-red-400"
              variant="outline"
            >
              <p> DE: {formatCurrency(resumen.totalGastosDE)}</p>
              <p> Compras: {formatCurrency(resumen.totalGastosCompra)}</p>
              <p> Salarios: {formatCurrency(resumen.totalGastosSalarios)}</p>
            </Badge>
          </CardContent>
        </Card>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-accent")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Diferencia Neta</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${resumen.diferencia >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatCurrency(resumen.diferencia)}
            </div>
            <Badge
              className={`border border-green-600 text-xs ${resumen.variacionPorcentual >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} dark:border-green-700`}
              variant="outline"
            >
              {resumen.variacionPorcentual >= 0 ? "+" : ""}
              {resumen.variacionPorcentual.toFixed(1)}% vs ayer
            </Badge>
          </CardContent>
        </Card>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-primary")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {ventas.length}
            </div>
            <Badge
              className="mt-2.5 flex flex-col border-yellow-600 text-xs text-yellow-600 dark:text-yellow-400"
              variant="outline"
            >
              <p>{gastos.length} movimientos de caja</p>
            </Badge>
          </CardContent>
        </Card>
        {totales && (
          <Card className={cn(surfaceCardClass, "border-l-4 border-l-chart-5")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldos de Caja</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">
                  {formatCurrency(totales.efectivoFinal)}
                </span>
                <span className="text-xs text-muted-foreground">final</span>
              </div>
              <Badge
                className="mt-2.5 flex flex-col border-chart-5 text-xs"
                variant="outline"
              >
                <p>Inicial: {formatCurrency(totales.efectivoInicial)}</p>
                <p className={totales.efectivoFinal >= totales.efectivoInicial ? "text-green-600" : "text-red-600"}>
                  Dif: {formatCurrency(totales.efectivoFinal - totales.efectivoInicial)}
                </p>
              </Badge>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <motion.div variants={itemVariants}>
        <Tabs defaultValue="ventas" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-xl bg-slate-100/80 p-1 md:grid-cols-4 dark:bg-slate-900/70">
            <TabsTrigger value="ventas">
              Ventas y Servicios ({ventas.length})
            </TabsTrigger>
            <TabsTrigger value="movimientos">
              Movimientos de Caja ({gastos.length})
            </TabsTrigger>
            <TabsTrigger value="metodos">Métodos de Pago</TabsTrigger>
            {turnosDelDia && turnosDelDia.length > 0 && (
              <TabsTrigger value="turnos">
                Turnos ({turnosDelDia.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="ventas" className="space-y-4">
            <Card className={surfaceCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Detalle de Ventas y Servicios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por cliente o ID..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select
                    value={metodoPagoFiltro}
                    onValueChange={setMetodoPagoFiltro}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Método de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los métodos</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="credito">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-slate-50/80 dark:bg-slate-900/50">
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Producto/Servicio</TableHead>
                        <TableHead className="text-center">Cant</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Método Pago</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ventasFiltradas.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="py-8 text-center text-muted-foreground"
                          >
                            No se encontraron ventas para este día
                          </TableCell>
                        </TableRow>
                      ) : (
  // @ts-expect-error - ventasFiltradas items typed loosely
                        ventasFiltradas.map((venta) => (
                          <TableRow key={venta.id}>
                            <TableCell className="font-mono text-xs">
                              {venta.id.slice(-8)}
                            </TableCell>
                            <TableCell>{venta.horaFormateada}</TableCell>
                            <TableCell>{venta.cliente}</TableCell>
                            <TableCell
                              className="max-w-[200px] truncate"
                              title={venta.producto}
                            >
                              {venta.producto}
                            </TableCell>
                            <TableCell className="text-center">
                              {venta.cantidad}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  venta.esServicio ? "secondary" : "outline"
                                }
                              >
                                {venta.esServicio ? "Servicio" : "Venta"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getMetodoPagoBadge(venta.metodoPago)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(venta.total)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {ventasFiltradas.length} de {ventas.length}{" "}
                    transacciones
                  </p>
                  <div className="text-right">
                    <p className="text-sm font-medium">Total mostrado:</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(
                        ventasFiltradas.reduce((acc: any, v: any) => acc + v.total, 0),
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movimientos" className="space-y-4">
            <Card className={surfaceCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  Movimientos de Caja
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-slate-50/80 dark:bg-slate-900/50">
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Referencia</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gastos.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-8 text-center text-muted-foreground"
                          >
                            No se encontraron movimientos para este día
                          </TableCell>
                        </TableRow>
                      ) : (
  // @ts-expect-error - gastos items typed loosely from action
                        gastos.map((movimiento) => (
                          <TableRow key={movimiento.id}>
                            <TableCell>{movimiento.horaFormateada}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getMovimientoIcon(
                                  getMovimientoTipo(movimiento.tipo),
                                )}
                                <span className="capitalize">
                                  {movimiento.tipo.replace("_", " ")}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{movimiento.descripcion}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {movimiento.referencia}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${getMovimientoTipo(movimiento.tipo) === "entrada" ? "text-green-600" : "text-red-600"}`}
                            >
                              {getMovimientoTipo(movimiento.tipo) === "entrada"
                                ? "+"
                                : "-"}
                              {formatCurrency(movimiento.monto)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-emerald-50/90 p-4 dark:bg-emerald-900/20">
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      Total Entradas
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(totalEntradas)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-red-50/90 p-4 dark:bg-red-900/20">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      Total Salidas
                    </p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(totalSalidas)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metodos" className="space-y-4">
            <Card className={surfaceCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Resumen por Método de Pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-slate-50/80 dark:bg-slate-900/50">
                      <TableRow>
                        <TableHead>Método de Pago</TableHead>
                        <TableHead className="text-right">Transacciones</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Porcentaje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumenMetodosPago.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-8 text-center text-muted-foreground"
                          >
                            No hay datos de métodos de pago
                          </TableCell>
                        </TableRow>
                      ) : (
  // @ts-expect-error - resumenMetodosPago is Record not Array
                        resumenMetodosPago.map((metodo) => (
                          <TableRow key={metodo.metodo}>
                            <TableCell className="font-medium">
                              {metodo.metodo}
                            </TableCell>
                            <TableCell className="text-right">
                              {metodo.cantidad}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(metodo.total)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">
                                {metodo.porcentaje.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 rounded-lg bg-slate-50/80 p-4 dark:bg-slate-900/60">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Gran Total</span>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(
                        resumenMetodosPago.reduce((acc: any, m: any) => acc + m.total, 0),
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {turnosDelDia && turnosDelDia.length > 0 && (
          <TabsContent value="turnos" className="space-y-4">
            <Card className={surfaceCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  Turnos del Día
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-slate-50/80 dark:bg-slate-900/50">
                      <TableRow>
                        <TableHead>PV</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Fondo Inicial</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                        <TableHead className="text-right">Arqueo</TableHead>
                        <TableHead className="text-right">Diferencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {turnosDelDia.map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.puntoDeVenta}</TableCell>
                          <TableCell>
                            <Badge variant={t.estado === 'ABIERTO' ? 'default' : 'secondary'}>
                              {t.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(t.fondoInicialCup)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {t.totalVentas}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {t.tieneArqueo
                              ? formatCurrency(t.arqueo?.totalEfectivoCup ?? 0)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {t.tieneArqueo ? (
                              <span className={t.arqueo?.diferenciaCup >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(t.arqueo?.diferenciaCup ?? 0)}
                              </span>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 rounded-lg bg-slate-50/80 p-4 dark:bg-slate-900/60">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total fondos iniciales</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(turnosDelDia.reduce((s: number, t: any) => s + t.fondoInicialCup, 0))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}
        </Tabs>
      </motion.div>
    </motion.div>
  )
}
