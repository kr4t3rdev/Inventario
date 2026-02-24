"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Target,
  AlertCircle,
  DollarSign,
  PieChart,
  BarChart3,
  CheckCircle,
  Eye,
  Download,
} from "lucide-react"
import { useState, useEffect } from "react"
import { format, addMonths } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

interface Presupuesto {
  id: string
  nombre: string
  descripcion?: string
  periodo: string
  tipoPresupuesto: "mensual" | "trimestral" | "semestral" | "anual"
  fechaInicio: string
  fechaFin: string

  // Ingresos proyectados
  ingresosVentas: number
  ingresosOtros: number
  totalIngresos: number

  // Gastos proyectados
  gastosCompras: number
  gastosSalarios: number
  gastosUtilitarios: number
  gastosMermas: number
  gastosMarketing: number
  gastosMantenimiento: number
  gastosOtros: number
  totalGastos: number

  // Resultados
  utilidadBruta: number
  utilidadNeta: number
  margenUtilidad: number

  // Estado y seguimiento
  estado: "borrador" | "activo" | "completado" | "cancelado"
  isActive: boolean
  fechaCreacion: string
  fechaActualizacion: string
  creadoPor: string

  // Datos reales para comparación
  ingresosReales?: number
  gastosReales?: number
  utilidadReal?: number
  porcentajeCompletado?: number

  // Alertas y notificaciones
  alertas?: {
    gastosExcedidos: boolean
    ingresosInsuficientes: boolean
    margenBajo: boolean
  }
}

interface FormularioPresupuesto {
  nombre: string
  descripcion: string
  periodo: string
  tipoPresupuesto: "mensual" | "trimestral" | "semestral" | "anual"
  fechaInicio: string
  fechaFin: string
  ingresosVentas: string
  ingresosOtros: string
  gastosCompras: string
  gastosSalarios: string
  gastosUtilitarios: string
  gastosMermas: string
  gastosMarketing: string
  gastosMantenimiento: string
  gastosOtros: string
}

const TIPOS_PRESUPUESTO = [
  { value: "mensual", label: "Mensual", meses: 1 },
  { value: "trimestral", label: "Trimestral", meses: 3 },
  { value: "semestral", label: "Semestral", meses: 6 },
  { value: "anual", label: "Anual", meses: 12 },
]

const ESTADOS_PRESUPUESTO = {
  borrador: { label: "Borrador", color: "bg-gray-500", variant: "secondary" as const },
  activo: { label: "Activo", color: "bg-green-500", variant: "default" as const },
  completado: { label: "Completado", color: "bg-blue-500", variant: "outline" as const },
  cancelado: { label: "Cancelado", color: "bg-red-500", variant: "destructive" as const },
}

export function PresupuestoManager() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [presupuestoEditando, setPresupuestoEditando] = useState<Presupuesto | null>(null)
  const [presupuestoDetalle, setPresupuestoDetalle] = useState<Presupuesto | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [tabActiva, setTabActiva] = useState("resumen")

  const [formulario, setFormulario] = useState<FormularioPresupuesto>({
    nombre: "",
    descripcion: "",
    periodo: "",
    tipoPresupuesto: "mensual",
    fechaInicio: "",
    fechaFin: "",
    ingresosVentas: "",
    ingresosOtros: "",
    gastosCompras: "",
    gastosSalarios: "",
    gastosUtilitarios: "",
    gastosMermas: "",
    gastosMarketing: "",
    gastosMantenimiento: "",
    gastosOtros: "",
  })

  useEffect(() => {
    fetchPresupuestos()
  }, [])

  const fetchPresupuestos = async () => {
    try {
      setLoading(true)

      // Simular datos para demostración
      const presupuestosMock: Presupuesto[] = [
        {
          id: "p1",
          nombre: "Presupuesto Enero 2024",
          descripcion: "Presupuesto operativo para el primer mes del año",
          periodo: "2024-01",
          tipoPresupuesto: "mensual",
          fechaInicio: "2024-01-01T00:00:00Z",
          fechaFin: "2024-01-31T23:59:59Z",

          ingresosVentas: 50000,
          ingresosOtros: 2000,
          totalIngresos: 52000,

          gastosCompras: 25000,
          gastosSalarios: 8000,
          gastosUtilitarios: 3000,
          gastosMermas: 2000,
          gastosMarketing: 1500,
          gastosMantenimiento: 800,
          gastosOtros: 700,
          totalGastos: 41000,

          utilidadBruta: 27000,
          utilidadNeta: 11000,
          margenUtilidad: 21.15,

          estado: "activo",
          isActive: true,
          fechaCreacion: "2023-12-15T10:00:00Z",
          fechaActualizacion: "2024-01-01T08:00:00Z",
          creadoPor: "admin",

          ingresosReales: 48000,
          gastosReales: 43000,
          utilidadReal: 5000,
          porcentajeCompletado: 75,

          alertas: {
            gastosExcedidos: true,
            ingresosInsuficientes: true,
            margenBajo: false,
          },
        },
        {
          id: "p2",
          nombre: "Presupuesto Q1 2024",
          descripcion: "Presupuesto trimestral para el primer cuarto del año",
          periodo: "2024-Q1",
          tipoPresupuesto: "trimestral",
          fechaInicio: "2024-01-01T00:00:00Z",
          fechaFin: "2024-03-31T23:59:59Z",

          ingresosVentas: 150000,
          ingresosOtros: 5000,
          totalIngresos: 155000,

          gastosCompras: 75000,
          gastosSalarios: 24000,
          gastosUtilitarios: 9000,
          gastosMermas: 6000,
          gastosMarketing: 4500,
          gastosMantenimiento: 2400,
          gastosOtros: 2100,
          totalGastos: 123000,

          utilidadBruta: 80000,
          utilidadNeta: 32000,
          margenUtilidad: 20.65,

          estado: "completado",
          isActive: false,
          fechaCreacion: "2023-12-01T10:00:00Z",
          fechaActualizacion: "2024-03-31T18:00:00Z",
          creadoPor: "admin",

          ingresosReales: 145000,
          gastosReales: 118000,
          utilidadReal: 27000,
          porcentajeCompletado: 100,
        },
        {
          id: "p3",
          nombre: "Presupuesto Febrero 2024",
          descripcion: "Presupuesto operativo para febrero",
          periodo: "2024-02",
          tipoPresupuesto: "mensual",
          fechaInicio: "2024-02-01T00:00:00Z",
          fechaFin: "2024-02-29T23:59:59Z",

          ingresosVentas: 55000,
          ingresosOtros: 1500,
          totalIngresos: 56500,

          gastosCompras: 28000,
          gastosSalarios: 8500,
          gastosUtilitarios: 3200,
          gastosMermas: 2200,
          gastosMarketing: 2000,
          gastosMantenimiento: 900,
          gastosOtros: 800,
          totalGastos: 45600,

          utilidadBruta: 27000,
          utilidadNeta: 10900,
          margenUtilidad: 19.29,

          estado: "borrador",
          isActive: false,
          fechaCreacion: "2024-01-20T14:00:00Z",
          fechaActualizacion: "2024-01-25T16:30:00Z",
          creadoPor: "admin",
        },
      ]

      setPresupuestos(presupuestosMock)
    } catch (error) {
      console.error("Error al obtener presupuestos:", error)
      toast.error("No se pudieron cargar los presupuestos")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount)
  }

  const calcularVariacion = (presupuestado: number, real: number) => {
    if (!real || presupuestado === 0) return 0
    return ((real - presupuestado) / presupuestado) * 100
  }

  const calcularTotales = (form: FormularioPresupuesto) => {
    const ingresosVentas = Number.parseFloat(form.ingresosVentas) || 0
    const ingresosOtros = Number.parseFloat(form.ingresosOtros) || 0
    const totalIngresos = ingresosVentas + ingresosOtros

    const gastosCompras = Number.parseFloat(form.gastosCompras) || 0
    const gastosSalarios = Number.parseFloat(form.gastosSalarios) || 0
    const gastosUtilitarios = Number.parseFloat(form.gastosUtilitarios) || 0
    const gastosMermas = Number.parseFloat(form.gastosMermas) || 0
    const gastosMarketing = Number.parseFloat(form.gastosMarketing) || 0
    const gastosMantenimiento = Number.parseFloat(form.gastosMantenimiento) || 0
    const gastosOtros = Number.parseFloat(form.gastosOtros) || 0

    const totalGastos =
      gastosCompras +
      gastosSalarios +
      gastosUtilitarios +
      gastosMermas +
      gastosMarketing +
      gastosMantenimiento +
      gastosOtros
    const utilidadBruta = ingresosVentas - gastosCompras
    const utilidadNeta = totalIngresos - totalGastos
    const margenUtilidad = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0

    return {
      totalIngresos,
      totalGastos,
      utilidadBruta,
      utilidadNeta,
      margenUtilidad,
    }
  }

  const handleTipoPresupuestoChange = (tipo: string) => {
    const tipoInfo = TIPOS_PRESUPUESTO.find((t) => t.value === tipo)
    if (tipoInfo && formulario.fechaInicio) {
      const fechaInicio = new Date(formulario.fechaInicio)
      const fechaFin = addMonths(fechaInicio, tipoInfo.meses)
      fechaFin.setDate(fechaFin.getDate() - 1) // Último día del período

      setFormulario((prev) => ({
        ...prev,
        tipoPresupuesto: tipo as any,
        fechaFin: format(fechaFin, "yyyy-MM-dd"),
      }))
    } else {
      setFormulario((prev) => ({
        ...prev,
        tipoPresupuesto: tipo as any,
      }))
    }
  }

  const handleFechaInicioChange = (fecha: string) => {
    const tipoInfo = TIPOS_PRESUPUESTO.find((t) => t.value === formulario.tipoPresupuesto)
    if (tipoInfo && fecha) {
      const fechaInicio = new Date(fecha)
      const fechaFin = addMonths(fechaInicio, tipoInfo.meses)
      fechaFin.setDate(fechaFin.getDate() - 1)

      setFormulario((prev) => ({
        ...prev,
        fechaInicio: fecha,
        fechaFin: format(fechaFin, "yyyy-MM-dd"),
      }))
    } else {
      setFormulario((prev) => ({
        ...prev,
        fechaInicio: fecha,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setGuardando(true)

      const totales = calcularTotales(formulario)

      const nuevoPresupuesto: Presupuesto = {
        id: presupuestoEditando?.id || `p${Date.now()}`,
        nombre: formulario.nombre,
        descripcion: formulario.descripcion,
        periodo: formulario.periodo,
        tipoPresupuesto: formulario.tipoPresupuesto,
        fechaInicio: new Date(formulario.fechaInicio).toISOString(),
        fechaFin: new Date(formulario.fechaFin).toISOString(),

        ingresosVentas: Number.parseFloat(formulario.ingresosVentas) || 0,
        ingresosOtros: Number.parseFloat(formulario.ingresosOtros) || 0,
        totalIngresos: totales.totalIngresos,

        gastosCompras: Number.parseFloat(formulario.gastosCompras) || 0,
        gastosSalarios: Number.parseFloat(formulario.gastosSalarios) || 0,
        gastosUtilitarios: Number.parseFloat(formulario.gastosUtilitarios) || 0,
        gastosMermas: Number.parseFloat(formulario.gastosMermas) || 0,
        gastosMarketing: Number.parseFloat(formulario.gastosMarketing) || 0,
        gastosMantenimiento: Number.parseFloat(formulario.gastosMantenimiento) || 0,
        gastosOtros: Number.parseFloat(formulario.gastosOtros) || 0,
        totalGastos: totales.totalGastos,

        utilidadBruta: totales.utilidadBruta,
        utilidadNeta: totales.utilidadNeta,
        margenUtilidad: totales.margenUtilidad,

        estado: "borrador",
        isActive: false,
        fechaCreacion: presupuestoEditando?.fechaCreacion || new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
        creadoPor: "admin", // En producción, obtener del contexto de usuario
      }

      if (presupuestoEditando) {
        setPresupuestos((prev) => prev.map((p) => (p.id === presupuestoEditando.id ? nuevoPresupuesto : p)))
        toast.success("Los cambios se han guardado correctamente")
      } else {
        setPresupuestos((prev) => [...prev, nuevoPresupuesto])
        toast.success("El nuevo presupuesto se ha creado correctamente")
      }

      resetFormulario()
      setDialogAbierto(false)
    } catch (error) {
      console.error("Error al guardar presupuesto:", error)
      toast.error("No se pudo guardar el presupuesto")
    } finally {
      setGuardando(false)
    }
  }

  const resetFormulario = () => {
    setFormulario({
      nombre: "",
      descripcion: "",
      periodo: "",
      tipoPresupuesto: "mensual",
      fechaInicio: "",
      fechaFin: "",
      ingresosVentas: "",
      ingresosOtros: "",
      gastosCompras: "",
      gastosSalarios: "",
      gastosUtilitarios: "",
      gastosMermas: "",
      gastosMarketing: "",
      gastosMantenimiento: "",
      gastosOtros: "",
    })
    setPresupuestoEditando(null)
  }

  const editarPresupuesto = (presupuesto: Presupuesto) => {
    setFormulario({
      nombre: presupuesto.nombre,
      descripcion: presupuesto.descripcion || "",
      periodo: presupuesto.periodo,
      tipoPresupuesto: presupuesto.tipoPresupuesto,
      fechaInicio: presupuesto.fechaInicio.split("T")[0],
      fechaFin: presupuesto.fechaFin.split("T")[0],
      ingresosVentas: presupuesto.ingresosVentas.toString(),
      ingresosOtros: presupuesto.ingresosOtros.toString(),
      gastosCompras: presupuesto.gastosCompras.toString(),
      gastosSalarios: presupuesto.gastosSalarios.toString(),
      gastosUtilitarios: presupuesto.gastosUtilitarios.toString(),
      gastosMermas: presupuesto.gastosMermas.toString(),
      gastosMarketing: presupuesto.gastosMarketing.toString(),
      gastosMantenimiento: presupuesto.gastosMantenimiento.toString(),
      gastosOtros: presupuesto.gastosOtros.toString(),
    })
    setPresupuestoEditando(presupuesto)
    setDialogAbierto(true)
  }

  const eliminarPresupuesto = async (id: string) => {
    try {
      setPresupuestos((prev) => prev.filter((p) => p.id !== id))
      toast.success("El presupuesto se ha eliminado correctamente")
    } catch (error) {
      console.error("Error al eliminar presupuesto:", error)
      toast.error("No se pudo eliminar el presupuesto")
    }
  }

  const activarPresupuesto = async (id: string) => {
    try {
      setPresupuestos((prev) =>
        prev.map((p) => ({
          ...p,
          isActive: p.id === id,
          estado: p.id === id ? "activo" : p.estado === "activo" ? "completado" : p.estado,
        })),
      )

      toast.success("El presupuesto está ahora activo")
    } catch (error) {
      console.error("Error al activar presupuesto:", error)
      toast.error("No se pudo activar el presupuesto")
    }
  }

  const exportarPresupuesto = (presupuesto: Presupuesto) => {
    // Simular exportación
    toast.info("El archivo se descargará en breve")
  }

  const presupuestoActivo = presupuestos.find((p) => p.isActive)
  const totalesFormulario = calcularTotales(formulario)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Presupuestos</h2>
          <p className="text-muted-foreground">Planifica y controla tus objetivos financieros</p>
        </div>
        <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
          <DialogTrigger asChild>
            <Button onClick={resetFormulario} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Presupuesto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{presupuestoEditando ? "Editar Presupuesto" : "Crear Nuevo Presupuesto"}</DialogTitle>
              <DialogDescription>Define los objetivos financieros para el período seleccionado</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="grid gap-6 py-4">
                {/* Información General */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-primary">Información General</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre del Presupuesto *</Label>
                      <Input
                        id="nombre"
                        value={formulario.nombre}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, nombre: e.target.value }))}
                        placeholder="Ej: Presupuesto Enero 2024"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="periodo">Código del Período *</Label>
                      <Input
                        id="periodo"
                        value={formulario.periodo}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, periodo: e.target.value }))}
                        placeholder="Ej: 2024-01 o 2024-Q1"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Textarea
                      id="descripcion"
                      value={formulario.descripcion}
                      onChange={(e) => setFormulario((prev) => ({ ...prev, descripcion: e.target.value }))}
                      placeholder="Descripción opcional del presupuesto"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipoPresupuesto">Tipo de Presupuesto *</Label>
                      <Select value={formulario.tipoPresupuesto} onValueChange={handleTipoPresupuestoChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_PRESUPUESTO.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fechaInicio">Fecha Inicio *</Label>
                      <Input
                        id="fechaInicio"
                        type="date"
                        value={formulario.fechaInicio}
                        onChange={(e) => handleFechaInicioChange(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fechaFin">Fecha Fin *</Label>
                      <Input
                        id="fechaFin"
                        type="date"
                        value={formulario.fechaFin}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, fechaFin: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Ingresos Proyectados */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-green-600 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Ingresos Proyectados
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ingresosVentas">Ingresos por Ventas (€) *</Label>
                      <Input
                        id="ingresosVentas"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formulario.ingresosVentas}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, ingresosVentas: e.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ingresosOtros">Otros Ingresos (€)</Label>
                      <Input
                        id="ingresosOtros"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formulario.ingresosOtros}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, ingresosOtros: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Gastos Proyectados */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-red-600 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Gastos Proyectados
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gastosCompras">Gastos en Compras (€)</Label>
                      <Input
                        id="gastosCompras"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formulario.gastosCompras}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, gastosCompras: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gastosSalarios">Gastos en Salarios (€)</Label>
                      <Input
                        id="gastosSalarios"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formulario.gastosSalarios}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, gastosSalarios: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gastosUtilitarios">Gastos Utilitarios (€)</Label>
                      <Input
                        id="gastosUtilitarios"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formulario.gastosUtilitarios}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, gastosUtilitarios: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gastosMermas">Gastos por Mermas (€)</Label>
                      <Input
                        id="gastosMermas"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formulario.gastosMermas}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, gastosMermas: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gastosMarketing">Gastos de Marketing (€)</Label>
                      <Input
                        id="gastosMarketing"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formulario.gastosMarketing}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, gastosMarketing: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gastosMantenimiento">Gastos de Mantenimiento (€)</Label>
                      <Input
                        id="gastosMantenimiento"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formulario.gastosMantenimiento}
                        onChange={(e) => setFormulario((prev) => ({ ...prev, gastosMantenimiento: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gastosOtros">Otros Gastos (€)</Label>
                    <Input
                      id="gastosOtros"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formulario.gastosOtros}
                      onChange={(e) => setFormulario((prev) => ({ ...prev, gastosOtros: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Resumen Calculado */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-blue-600 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Resumen Financiero
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-green-50 p-3 rounded-lg">
                      <span className="text-muted-foreground block">Total Ingresos</span>
                      <div className="font-bold text-green-600 text-lg">
                        {formatCurrency(totalesFormulario.totalIngresos)}
                      </div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg">
                      <span className="text-muted-foreground block">Total Gastos</span>
                      <div className="font-bold text-red-600 text-lg">
                        {formatCurrency(totalesFormulario.totalGastos)}
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <span className="text-muted-foreground block">Utilidad Neta</span>
                      <div
                        className={`font-bold text-lg ${totalesFormulario.utilidadNeta >= 0 ? "text-blue-600" : "text-red-600"}`}
                      >
                        {formatCurrency(totalesFormulario.utilidadNeta)}
                      </div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <span className="text-muted-foreground block">Margen (%)</span>
                      <div
                        className={`font-bold text-lg ${totalesFormulario.margenUtilidad >= 0 ? "text-purple-600" : "text-red-600"}`}
                      >
                        {totalesFormulario.margenUtilidad.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogAbierto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardando}>
                  {guardando ? "Guardando..." : presupuestoEditando ? "Actualizar" : "Crear"} Presupuesto
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Presupuesto Activo */}
      {presupuestoActivo && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-600" />
                  {presupuestoActivo.nombre}
                  <Badge variant="default">Activo</Badge>
                </CardTitle>
                <CardDescription>
                  {format(new Date(presupuestoActivo.fechaInicio), "dd/MM/yyyy")} -{" "}
                  {format(new Date(presupuestoActivo.fechaFin), "dd/MM/yyyy")}
                  {presupuestoActivo.descripcion && ` • ${presupuestoActivo.descripcion}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportarPresupuesto(presupuestoActivo)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPresupuestoDetalle(presupuestoActivo)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Alertas */}
            {presupuestoActivo.alertas && (
              <div className="mb-6 space-y-2">
                {presupuestoActivo.alertas.gastosExcedidos && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                    <AlertCircle className="h-4 w-4" />
                    Los gastos han excedido el presupuesto planificado
                  </div>
                )}
                {presupuestoActivo.alertas.ingresosInsuficientes && (
                  <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
                    <AlertCircle className="h-4 w-4" />
                    Los ingresos están por debajo de lo proyectado
                  </div>
                )}
              </div>
            )}

            {/* Métricas Principales */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Ingresos
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {presupuestoActivo.ingresosReales
                      ? `${((presupuestoActivo.ingresosReales / presupuestoActivo.totalIngresos) * 100).toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
                <Progress
                  value={
                    presupuestoActivo.ingresosReales
                      ? Math.min((presupuestoActivo.ingresosReales / presupuestoActivo.totalIngresos) * 100, 100)
                      : 0
                  }
                  className="h-3"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Real: {formatCurrency(presupuestoActivo.ingresosReales || 0)}</span>
                  <span>Meta: {formatCurrency(presupuestoActivo.totalIngresos)}</span>
                </div>
                {presupuestoActivo.ingresosReales && (
                  <div className="text-xs">
                    Variación:
                    <span
                      className={`ml-1 font-medium ${
                        calcularVariacion(presupuestoActivo.totalIngresos, presupuestoActivo.ingresosReales) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {calcularVariacion(presupuestoActivo.totalIngresos, presupuestoActivo.ingresosReales).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    Gastos
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {presupuestoActivo.gastosReales
                      ? `${((presupuestoActivo.gastosReales / presupuestoActivo.totalGastos) * 100).toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
                <Progress
                  value={
                    presupuestoActivo.gastosReales
                      ? Math.min((presupuestoActivo.gastosReales / presupuestoActivo.totalGastos) * 100, 100)
                      : 0
                  }
                  className="h-3"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Real: {formatCurrency(presupuestoActivo.gastosReales || 0)}</span>
                  <span>Límite: {formatCurrency(presupuestoActivo.totalGastos)}</span>
                </div>
                {presupuestoActivo.gastosReales && (
                  <div className="text-xs">
                    Variación:
                    <span
                      className={`ml-1 font-medium ${
                        calcularVariacion(presupuestoActivo.totalGastos, presupuestoActivo.gastosReales) <= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {calcularVariacion(presupuestoActivo.totalGastos, presupuestoActivo.gastosReales).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    Utilidad
                  </span>
                  {presupuestoActivo.utilidadReal && presupuestoActivo.utilidadReal > presupuestoActivo.utilidadNeta ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div className="text-3xl font-bold">
                  <span
                    className={
                      presupuestoActivo.utilidadReal && presupuestoActivo.utilidadReal >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {formatCurrency(presupuestoActivo.utilidadReal || 0)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Meta: {formatCurrency(presupuestoActivo.utilidadNeta)}
                </div>
                {presupuestoActivo.utilidadReal && (
                  <div className="text-xs">
                    Variación:
                    <span
                      className={`ml-1 font-medium ${
                        calcularVariacion(presupuestoActivo.utilidadNeta, presupuestoActivo.utilidadReal) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {calcularVariacion(presupuestoActivo.utilidadNeta, presupuestoActivo.utilidadReal).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Progreso General */}
            {presupuestoActivo.porcentajeCompletado && (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progreso del Período</span>
                  <span className="text-sm text-muted-foreground">
                    {presupuestoActivo.porcentajeCompletado}% completado
                  </span>
                </div>
                <Progress value={presupuestoActivo.porcentajeCompletado} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gestión de Presupuestos */}
      <Card>
        <CardHeader>
          <CardTitle>Todos los Presupuestos</CardTitle>
          <CardDescription>Gestiona y compara todos tus presupuestos</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tabActiva} onValueChange={setTabActiva} className="space-y-4">
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="lista">Lista Completa</TabsTrigger>
              <TabsTrigger value="comparacion">Comparación vs Real</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {presupuestos.map((presupuesto) => (
                  <Card key={presupuesto.id} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{presupuesto.nombre}</CardTitle>
                        <Badge variant={ESTADOS_PRESUPUESTO[presupuesto.estado].variant}>
                          {ESTADOS_PRESUPUESTO[presupuesto.estado].label}
                        </Badge>
                      </div>
                      <CardDescription>
                        {presupuesto.periodo} •{" "}
                        {TIPOS_PRESUPUESTO.find((t) => t.value === presupuesto.tipoPresupuesto)?.label}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Ingresos:</span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(presupuesto.totalIngresos)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Gastos:</span>
                          <span className="font-medium text-red-600">{formatCurrency(presupuesto.totalGastos)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2">
                          <span className="font-medium">Utilidad:</span>
                          <span
                            className={`font-bold ${presupuesto.utilidadNeta >= 0 ? "text-blue-600" : "text-red-600"}`}
                          >
                            {formatCurrency(presupuesto.utilidadNeta)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Margen:</span>
                          <span>{presupuesto.margenUtilidad.toFixed(2)}%</span>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => editarPresupuesto(presupuesto)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPresupuestoDetalle(presupuesto)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        {!presupuesto.isActive && presupuesto.estado === "borrador" && (
                          <Button variant="outline" size="sm" onClick={() => activarPresupuesto(presupuesto.id)}>
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará permanentemente el presupuesto
                                {presupuesto.nombre}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => eliminarPresupuesto(presupuesto.id)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="lista">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead className="text-right">Utilidad</TableHead>
                      <TableHead className="text-right">Margen</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            <span className="ml-2">Cargando presupuestos...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : presupuestos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No hay presupuestos creados
                        </TableCell>
                      </TableRow>
                    ) : (
                      presupuestos.map((presupuesto) => (
                        <TableRow key={presupuesto.id}>
                          <TableCell className="font-medium">
                            <div>
                              {presupuesto.nombre}
                              {presupuesto.isActive && (
                                <Badge variant="default" className="ml-2 text-xs">
                                  Activo
                                </Badge>
                              )}
                            </div>
                            {presupuesto.descripcion && (
                              <div className="text-xs text-muted-foreground mt-1">{presupuesto.descripcion}</div>
                            )}
                          </TableCell>
                          <TableCell>{presupuesto.periodo}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {TIPOS_PRESUPUESTO.find((t) => t.value === presupuesto.tipoPresupuesto)?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(presupuesto.totalIngresos)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatCurrency(presupuesto.totalGastos)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <span className={presupuesto.utilidadNeta >= 0 ? "text-blue-600" : "text-red-600"}>
                              {formatCurrency(presupuesto.utilidadNeta)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={presupuesto.margenUtilidad >= 0 ? "text-green-600" : "text-red-600"}>
                              {presupuesto.margenUtilidad.toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ESTADOS_PRESUPUESTO[presupuesto.estado].variant}>
                              {ESTADOS_PRESUPUESTO[presupuesto.estado].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="icon" onClick={() => editarPresupuesto(presupuesto)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => setPresupuestoDetalle(presupuesto)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!presupuesto.isActive && presupuesto.estado === "borrador" && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => activarPresupuesto(presupuesto.id)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente el presupuesto 
                                      {presupuesto.nombre}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => eliminarPresupuesto(presupuesto.id)}>
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="comparacion">
              <div className="space-y-4">
                {presupuestos
                  .filter((p) => p.ingresosReales || p.gastosReales)
                  .map((presupuesto) => (
                    <Card key={presupuesto.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{presupuesto.nombre}</CardTitle>
                            <CardDescription>
                              Comparación: Presupuestado vs Real • {presupuesto.periodo}
                            </CardDescription>
                          </div>
                          <Badge variant={ESTADOS_PRESUPUESTO[presupuesto.estado].variant}>
                            {ESTADOS_PRESUPUESTO[presupuesto.estado].label}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-6 md:grid-cols-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Ingresos</span>
                              <div className="flex items-center gap-1">
                                {presupuesto.ingresosReales &&
                                presupuesto.ingresosReales > presupuesto.totalIngresos ? (
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-600" />
                                )}
                                <span className="text-xs">
                                  {presupuesto.ingresosReales
                                    ? `${calcularVariacion(presupuesto.totalIngresos, presupuesto.ingresosReales).toFixed(1)}%`
                                    : "0%"}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Presupuestado:</span>
                                <span className="font-medium">{formatCurrency(presupuesto.totalIngresos)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Real:</span>
                                <span className="font-medium text-green-600">
                                  {formatCurrency(presupuesto.ingresosReales || 0)}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Diferencia:</span>
                                <span
                                  className={`font-medium ${
                                    (presupuesto.ingresosReales || 0) - presupuesto.totalIngresos >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {formatCurrency((presupuesto.ingresosReales || 0) - presupuesto.totalIngresos)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Gastos</span>
                              <div className="flex items-center gap-1">
                                {presupuesto.gastosReales && presupuesto.gastosReales > presupuesto.totalGastos ? (
                                  <AlertCircle className="h-4 w-4 text-red-600" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                )}
                                <span className="text-xs">
                                  {presupuesto.gastosReales
                                    ? `${calcularVariacion(presupuesto.totalGastos, presupuesto.gastosReales).toFixed(1)}%`
                                    : "0%"}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Presupuestado:</span>
                                <span className="font-medium">{formatCurrency(presupuesto.totalGastos)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Real:</span>
                                <span className="font-medium text-red-600">
                                  {formatCurrency(presupuesto.gastosReales || 0)}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Diferencia:</span>
                                <span
                                  className={`font-medium ${
                                    (presupuesto.gastosReales || 0) - presupuesto.totalGastos <= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {formatCurrency((presupuesto.gastosReales || 0) - presupuesto.totalGastos)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Utilidad</span>
                              <div className="flex items-center gap-1">
                                {presupuesto.utilidadReal && presupuesto.utilidadReal > presupuesto.utilidadNeta ? (
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-600" />
                                )}
                                <span className="text-xs">
                                  {presupuesto.utilidadReal
                                    ? `${calcularVariacion(presupuesto.utilidadNeta, presupuesto.utilidadReal).toFixed(1)}%`
                                    : "0%"}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Presupuestado:</span>
                                <span className="font-medium">{formatCurrency(presupuesto.utilidadNeta)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Real:</span>
                                <span
                                  className={`font-medium ${(presupuesto.utilidadReal || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                  {formatCurrency(presupuesto.utilidadReal || 0)}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Diferencia:</span>
                                <span
                                  className={`font-medium ${
                                    (presupuesto.utilidadReal || 0) - presupuesto.utilidadNeta >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {formatCurrency((presupuesto.utilidadReal || 0) - presupuesto.utilidadNeta)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                {presupuestos.filter((p) => p.ingresosReales || p.gastosReales).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos reales disponibles para comparación
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog de Detalle del Presupuesto */}
      <Dialog open={!!presupuestoDetalle} onOpenChange={() => setPresupuestoDetalle(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {presupuestoDetalle && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  {presupuestoDetalle.nombre}
                </DialogTitle>
                <DialogDescription>Detalle completo del presupuesto • {presupuestoDetalle.periodo}</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Información General */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>
                    <div className="font-medium capitalize">
                      {TIPOS_PRESUPUESTO.find((t) => t.value === presupuestoDetalle.tipoPresupuesto)?.label}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Estado:</span>
                    <div>
                      <Badge variant={ESTADOS_PRESUPUESTO[presupuestoDetalle.estado].variant}>
                        {ESTADOS_PRESUPUESTO[presupuestoDetalle.estado].label}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fecha Inicio:</span>
                    <div className="font-medium">
                      {format(new Date(presupuestoDetalle.fechaInicio), "dd/MM/yyyy")}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fecha Fin:</span>
                    <div className="font-medium">
                      {format(new Date(presupuestoDetalle.fechaFin), "dd/MM/yyyy")}
                    </div>
                  </div>
                </div>

                {presupuestoDetalle.descripcion && (
                  <div>
                    <span className="text-sm text-muted-foreground">Descripción:</span>
                    <p className="mt-1">{presupuestoDetalle.descripcion}</p>
                  </div>
                )}

                {/* Desglose Detallado */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Ingresos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg text-green-600">Ingresos Proyectados</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span>Ventas:</span>
                        <span className="font-medium">{formatCurrency(presupuestoDetalle.ingresosVentas)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Otros ingresos:</span>
                        <span className="font-medium">{formatCurrency(presupuestoDetalle.ingresosOtros)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 font-bold text-green-600">
                        <span>Total Ingresos:</span>
                        <span>{formatCurrency(presupuestoDetalle.totalIngresos)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Gastos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg text-red-600">Gastos Proyectados</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span>Compras:</span>
                        <span className="font-medium">{formatCurrency(presupuestoDetalle.gastosCompras)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Salarios:</span>
                        <span className="font-medium">{formatCurrency(presupuestoDetalle.gastosSalarios)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Utilitarios:</span>
                        <span className="font-medium">{formatCurrency(presupuestoDetalle.gastosUtilitarios)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mermas:</span>
                        <span className="font-medium">{formatCurrency(presupuestoDetalle.gastosMermas)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Marketing:</span>
                        <span className="font-medium">{formatCurrency(presupuestoDetalle.gastosMarketing)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mantenimiento:</span>
                        <span className="font-medium">{formatCurrency(presupuestoDetalle.gastosMantenimiento)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Otros gastos:</span>
                        <span className="font-medium">{formatCurrency(presupuestoDetalle.gastosOtros)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 font-bold text-red-600">
                        <span>Total Gastos:</span>
                        <span>{formatCurrency(presupuestoDetalle.totalGastos)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Resultados */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Resultados Proyectados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatCurrency(presupuestoDetalle.utilidadBruta)}
                        </div>
                        <div className="text-sm text-muted-foreground">Utilidad Bruta</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(presupuestoDetalle.utilidadNeta)}
                        </div>
                        <div className="text-sm text-muted-foreground">Utilidad Neta</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {presupuestoDetalle.margenUtilidad.toFixed(2)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Margen de Utilidad</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Datos Reales (si existen) */}
                {(presupuestoDetalle.ingresosReales || presupuestoDetalle.gastosReales) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Comparación con Datos Reales</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Ingresos</div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>Presupuestado:</span>
                              <span>{formatCurrency(presupuestoDetalle.totalIngresos)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Real:</span>
                              <span className="text-green-600">
                                {formatCurrency(presupuestoDetalle.ingresosReales || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm font-medium">
                              <span>Variación:</span>
                              <span
                                className={
                                  calcularVariacion(
                                    presupuestoDetalle.totalIngresos,
                                    presupuestoDetalle.ingresosReales || 0,
                                  ) >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {calcularVariacion(
                                  presupuestoDetalle.totalIngresos,
                                  presupuestoDetalle.ingresosReales || 0,
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium">Gastos</div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>Presupuestado:</span>
                              <span>{formatCurrency(presupuestoDetalle.totalGastos)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Real:</span>
                              <span className="text-red-600">
                                {formatCurrency(presupuestoDetalle.gastosReales || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm font-medium">
                              <span>Variación:</span>
                              <span
                                className={
                                  calcularVariacion(
                                    presupuestoDetalle.totalGastos,
                                    presupuestoDetalle.gastosReales || 0,
                                  ) <= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {calcularVariacion(
                                  presupuestoDetalle.totalGastos,
                                  presupuestoDetalle.gastosReales || 0,
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium">Utilidad</div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>Presupuestado:</span>
                              <span>{formatCurrency(presupuestoDetalle.utilidadNeta)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Real:</span>
                              <span
                                className={
                                  presupuestoDetalle.utilidadReal && presupuestoDetalle.utilidadReal >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {formatCurrency(presupuestoDetalle.utilidadReal || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm font-medium">
                              <span>Variación:</span>
                              <span
                                className={
                                  calcularVariacion(
                                    presupuestoDetalle.utilidadNeta,
                                    presupuestoDetalle.utilidadReal || 0,
                                  ) >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {calcularVariacion(
                                  presupuestoDetalle.utilidadNeta,
                                  presupuestoDetalle.utilidadReal || 0,
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Metadatos */}
                <div className="text-xs text-muted-foreground border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span>Creado: </span>
                      {format(new Date(presupuestoDetalle.fechaCreacion), "dd/MM/yyyy HH:mm")}
                      <span> por {presupuestoDetalle.creadoPor}</span>
                    </div>
                    <div>
                      <span>Última actualización: </span>
                      {format(new Date(presupuestoDetalle.fechaActualizacion), "dd/MM/yyyy HH:mm")}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => exportarPresupuesto(presupuestoDetalle)}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
                <Button
                  onClick={() => {
                    setPresupuestoDetalle(null)
                    editarPresupuesto(presupuestoDetalle)
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
