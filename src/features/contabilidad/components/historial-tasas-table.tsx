"use client"

import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, Download, Filter } from "lucide-react"
import { getMonedasAction, getHistorialTasasAction } from "@/features/contabilidad/actions-exchange"
import { format, isValid } from "date-fns"
import { toast } from "sonner"

interface FiltrosHistorial {
  monedaOrigen?: string
  fechaDesde?: string
  fechaHasta?: string
  busqueda?: string
}

type Moneda = {
  esPrincipal?: boolean
  codigo: string
  nombre?: string
  [key: string]: any
}

export function HistorialTasasTable() {
  const [filtros, setFiltros] = useState<FiltrosHistorial>({})
  const [paginaActual, setPaginaActual] = useState(1)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const [monedasData, setMonedasData] = useState<any[]>([])
  const [historialData, setHistorialData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
    getMonedasAction().then(r => { if (r.success) setMonedasData(r.data ?? []) })
  }, [])

  useEffect(() => {
    setIsLoading(true); setError(null)
    getHistorialTasasAction({
      monedaOrigen: filtros.monedaOrigen,
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      busqueda: filtros.busqueda,
      pagina: paginaActual,
      limite: 20,
    }).then(r => {
      if (r.success) { setHistorialData(r.data); setIsLoading(false) }
      else { setError(r.error); setIsLoading(false) }
    }).catch(e => { setError(e); setIsLoading(false) })
  }, [filtros, paginaActual])

  const monedas = Array.isArray(monedasData) ? monedasData : []
  const registros: any[] = Array.isArray(historialData?.tasas) ? historialData.tasas : []
  const historialArray = historialData?.tasas ?? []

  const registrosFiltrados = filtros.monedaOrigen && filtros.monedaOrigen !== "all"
    ? registros.filter((r: any) =>
        String(r?.monedaOrigenId) === String(filtros.monedaOrigen))
    : registros

  const totalPaginas = Math.ceil((historialData?.total || 0) / 20)

  const handleFiltroChange = (campo: keyof FiltrosHistorial, valor: string) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor === 'all' ? undefined : (valor || undefined),
    }))
    setPaginaActual(1)
  }

  const limpiarFiltros = () => {
    setFiltros({})
    setPaginaActual(1)
    setMostrarFiltros(false)
  }

  const exportarHistorial = () => {
    if (registrosFiltrados.length === 0) {
      toast.error("No hay datos para exportar")
      return
    }

    const datosExportar = registrosFiltrados.map((registro: any, index: number) => {
      const tasaAnterior = index < registrosFiltrados.length - 1 ? registrosFiltrados[index + 1].tasa : 0
      const tasaActual = typeof registro.tasa === 'string' ? parseFloat(registro.tasa) : Number(registro.tasa)
      const tasaAnteriorNum = typeof tasaAnterior === 'string' ? parseFloat(tasaAnterior) : Number(tasaAnterior)
      const cambio = tasaAnteriorNum ? ((tasaActual - tasaAnteriorNum) / tasaAnteriorNum * 100) : 0
      
      const fechaVigenciaValor = registro?.fechaVigencia
      const fechaVigenciaDate = new Date(fechaVigenciaValor)
      const fechaEsValida = isValid(fechaVigenciaDate)
      
      return {
        'Fecha': fechaEsValida ? format(fechaVigenciaDate, "dd/MM/yyyy") : "-",
        'Hora': fechaEsValida ? format(fechaVigenciaDate, "HH:mm:ss") : "-",
        'Conversión': `${registro.monedaOrigenId} → ${registro.monedaDestino}`,
        'Tasa Anterior': tasaAnterior ? tasaAnteriorNum.toFixed(4) : "-",
        'Tasa Nueva': tasaActual.toFixed(4),
        'Cambio (%)': tasaAnterior ? `${cambio > 0 ? "+" : ""}${cambio.toFixed(2)}%` : "Inicial",
        'Usuario': registro.creadoPor || "-"
      }
    })

    // Convertir a CSV
    const csvContent = [
      // Headers
      Object.keys(datosExportar[0]).join(','),
      // Data rows
      ...datosExportar.map((row: any) => 
        Object.values(row).map((value: any) => 
          typeof value === 'string' && value.includes(',') ? `"${value}"` : value
        ).join(',')
      )
    ].join('\n')

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    const fechaActual = format(new Date(), "yyyy-MM-dd")
    const nombreArchivo = `historial_tasas_${fechaActual}.csv`
    link.download = nombreArchivo
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    toast.success("Archivo CSV exportado correctamente")
  }

  //console.log('monedas:', monedas);

  const monedasList: Moneda[] = (Array.isArray(monedas) ? monedas : []) as Moneda[]
  const monedasSecundarias = monedasList.filter((m: Moneda) => !m.esPrincipal)

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <p className="text-destructive mb-4">Error al cargar el historial de tasas</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Historial de Tasas de Cambio</h3>
          <p className="text-sm text-muted-foreground">
            Registro completo de cambios en las tasas de conversión
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportarHistorial}
            disabled={(registrosFiltrados.length ) === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {mostrarFiltros && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros de Búsqueda</CardTitle>
            <CardDescription>
              Filtra el historial por moneda, fecha o usuario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm font-medium mb-2 block">Moneda</span>
                <Select
                  value={filtros.monedaOrigen ?? "all"}
                  onValueChange={(value) => handleFiltroChange("monedaOrigen", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las monedas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las monedas</SelectItem>
                    {monedasSecundarias?.map((moneda: Moneda) => (
                      <SelectItem key={moneda.codigo} value={moneda.codigo}>
                        {moneda.codigo} - {moneda.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <span className="text-sm font-medium mb-2 block">Fecha Desde</span>
                <Input
                  type="date"
                  value={filtros.fechaDesde || ""}
                  onChange={(e) => handleFiltroChange("fechaDesde", e.target.value)}
                />
              </div>

              <div>
                <span className="text-sm font-medium mb-2 block">Fecha Hasta</span>
                <Input
                  type="date"
                  value={filtros.fechaHasta || ""}
                  onChange={(e) => handleFiltroChange("fechaHasta", e.target.value)}
                />
              </div>
             
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={limpiarFiltros}>
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y Hora</TableHead>
                <TableHead>Conversión</TableHead>
                <TableHead>Tasa Anterior</TableHead>
                <TableHead>Tasa Nueva</TableHead>
                <TableHead>Cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Cargando historial...
                  </TableCell>
                </TableRow>
              ) : registrosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No se encontraron registros
                  </TableCell>
                </TableRow>
              ) : (
                registrosFiltrados.map((registro: any, index: number) => {
                  const tasaAnterior = index < registrosFiltrados.length - 1 ? registrosFiltrados[index + 1].tasa : 0
                  const tasaActual = typeof registro.tasa === 'string' ? parseFloat(registro.tasa) : Number(registro.tasa)
                  const tasaAnteriorNum = typeof tasaAnterior === 'string' ? parseFloat(tasaAnterior) : Number(tasaAnterior)
                  const cambio = tasaAnteriorNum ?
                    ((tasaActual - tasaAnteriorNum) / tasaAnteriorNum * 100) : 0
                  const fechaVigenciaValor = registro?.fechaVigencia
                  const fechaVigenciaDate = new Date(fechaVigenciaValor)
                  const fechaEsValida = isValid(fechaVigenciaDate)

                  return (
                    <TableRow key={registro.tasaId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {fechaEsValida ? format(fechaVigenciaDate, "dd/MM/yyyy") : "-"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {fechaEsValida ? format(fechaVigenciaDate, "HH:mm:ss") : "-"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {registro.monedaOrigenId} → {registro.monedaDestino}
                        </div>
                      </TableCell>
                      <TableCell>
                        {tasaAnterior ? (
                          <span className="text-muted-foreground">
                            {tasaAnteriorNum.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {tasaActual.toFixed(4)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tasaAnterior ? (
                          <Badge
                            variant={cambio > 0 ? "default" : cambio < 0 ? "destructive" : "secondary"}
                          >
                            {cambio > 0 ? "+" : ""}{cambio.toFixed(2)}%
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inicial</Badge>
                        )}
                      </TableCell>
                      
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {paginaActual} de {totalPaginas}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
              disabled={paginaActual === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))}
              disabled={paginaActual === totalPaginas}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}