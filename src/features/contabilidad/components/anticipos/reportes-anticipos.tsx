"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Download, FileSpreadsheet, Users, Truck, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAuthToken } from '@/lib/token'

interface ReportesAnticiposProps {
  clientes?: Array<{ clienteId: string; nombre: string }>
  proveedores?: Array<{ vendorId: string; nombre: string }>
}

/**
 * @description Componente de reportes de anticipos con tabs para cliente, proveedor y resumen
 * @param {ReportesAnticiposProps} props - Props del componente
 * @returns {JSX.Element} Reportes de anticipos
 */
export function ReportesAnticipos({
  clientes = [],
  proveedores = [],
}: ReportesAnticiposProps) {
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>("")
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>("")
  const [fechaInicio, setFechaInicio] = useState<string>("")
  const [fechaFin, setFechaFin] = useState<string>("")
  const [clienteFiltro, setClienteFiltro] = useState<string>("all")
  const [proveedorFiltro, setProveedorFiltro] = useState<string>("all")

  // Data fetching
  const [dataReporteCliente, setDataReporteCliente] = useState<any>(null)
  const [loadingReporteCliente, setLoadingReporteCliente] = useState(false)
  const [dataReporteProveedor, setDataReporteProveedor] = useState<any>(null)
  const [loadingReporteProveedor, setLoadingReporteProveedor] = useState(false)
  const [dataResumen, setDataResumen] = useState<any>(null)
  const [loadingResumen, setLoadingResumen] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    if (clienteFiltro !== "all") params.set("clienteId", clienteFiltro)
    if (fechaInicio) params.set("fechaInicio", fechaInicio)
    if (fechaFin) params.set("fechaFin", fechaFin)
    setLoadingReporteCliente(true)
    fetch(`/api/contabilidad/anticipos/reportes/cliente?${params.toString()}`, {
      headers: { Authorization: getAuthToken() },
    })
      .then((r) => r.json())
      .then(setDataReporteCliente)
      .finally(() => setLoadingReporteCliente(false))
  }, [clienteFiltro, fechaInicio, fechaFin])

  useEffect(() => {
    const params = new URLSearchParams()
    if (proveedorFiltro !== "all") params.set("proveedorId", proveedorFiltro)
    if (fechaInicio) params.set("fechaInicio", fechaInicio)
    if (fechaFin) params.set("fechaFin", fechaFin)
    setLoadingReporteProveedor(true)
    fetch(`/api/contabilidad/anticipos/reportes/proveedor?${params.toString()}`, {
      headers: { Authorization: getAuthToken() },
    })
      .then((r) => r.json())
      .then(setDataReporteProveedor)
      .finally(() => setLoadingReporteProveedor(false))
  }, [proveedorFiltro, fechaInicio, fechaFin])

  useEffect(() => {
    setLoadingResumen(true)
    fetch("/api/contabilidad/anticipos/reportes/resumen", {
      headers: { Authorization: getAuthToken() },
    })
      .then((r) => r.json())
      .then(setDataResumen)
      .finally(() => setLoadingResumen(false))
  }, [])

  const exportarCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return

    // Convertir a CSV
    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(","),
      ...data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","))
    ].join("\n")

    // Descargar
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Reportes de Anticipos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="resumen" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cliente" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Por Cliente
            </TabsTrigger>
            <TabsTrigger value="proveedor" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Por Proveedor
            </TabsTrigger>
            <TabsTrigger value="resumen" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Resumen
            </TabsTrigger>
          </TabsList>

          {/* Filtros comunes */}
          <div className="flex flex-wrap gap-4 mt-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin</Label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-[150px]"
              />
            </div>
          </div>

          {/* Reporte por Cliente */}
          <TabsContent value="cliente" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Todos los clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los clientes</SelectItem>
                      {clientes.map((c) => (
                        <SelectItem key={c.clienteId} value={c.clienteId}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loadingReporteCliente ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : dataReporteCliente?.clientes ? (
                <div className="space-y-4">
                  {Array.isArray(dataReporteCliente.clientes) ? (
                    dataReporteCliente.clientes.map((item: any, idx: number) => (
                      <Card key={idx}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center justify-between">
                            {item.cliente?.nombre || "Sin cliente"}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => exportarCSV(item.anticipos, `anticipos_cliente_${item.cliente?.nombre}`)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              CSV
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Contrato</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Saldo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Fecha</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {item.anticipos.map((a: any) => (
                                <TableRow key={a.anticipoId}>
                                  <TableCell className="font-mono text-xs">{a.anticipoId.substring(0, 8)}</TableCell>
                                  <TableCell>{a.numeroContrato || "-"}</TableCell>
                                  <TableCell>{a.moneda} {a.montoOriginal.toLocaleString()}</TableCell>
                                  <TableCell>{a.moneda} {a.saldoDisponible.toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Badge variant={a.estado === "EJECUTADO" ? "default" : "outline"}>
                                      {a.estado}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{new Date(a.fechaReserva).toLocaleDateString("es-ES")}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="mt-4 flex gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Total Original: </span>
                              <span className="font-medium">{item.totales.totalOriginal.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total Ejecutado: </span>
                              <span className="font-medium text-green-600">{item.totales.totalEjecutado.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Pendiente: </span>
                              <span className="font-medium">{item.totales.totalPendiente.toLocaleString()}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        Seleccione un cliente para ver el detalle
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No se encontraron anticipos de cobro
                </div>
              )}
            </div>
          </TabsContent>

          {/* Reporte por Proveedor */}
          <TabsContent value="proveedor" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Select value={proveedorFiltro} onValueChange={setProveedorFiltro}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Todos los proveedores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los proveedores</SelectItem>
                      {proveedores.map((p) => (
                        <SelectItem key={p.vendorId} value={p.vendorId}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loadingReporteProveedor ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : dataReporteProveedor?.proveedores ? (
                <div className="space-y-4">
                  {Array.isArray(dataReporteProveedor.proveedores) ? (
                    dataReporteProveedor.proveedores.map((item: any, idx: number) => (
                      <Card key={idx}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center justify-between">
                            {item.proveedor?.nombre || "Sin proveedor"}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => exportarCSV(item.anticipos, `anticipos_proveedor_${item.proveedor?.nombre}`)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              CSV
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Contrato</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Saldo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Fecha</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {item.anticipos.map((a: any) => (
                                <TableRow key={a.anticipoId}>
                                  <TableCell className="font-mono text-xs">{a.anticipoId.substring(0, 8)}</TableCell>
                                  <TableCell>{a.numeroContrato || "-"}</TableCell>
                                  <TableCell>{a.moneda} {a.montoOriginal.toLocaleString()}</TableCell>
                                  <TableCell>{a.moneda} {a.saldoDisponible.toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Badge variant={a.estado === "EJECUTADO" ? "default" : "outline"}>
                                      {a.estado}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{new Date(a.fechaReserva).toLocaleDateString("es-ES")}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="mt-4 flex gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Total Original: </span>
                              <span className="font-medium">{item.totales.totalOriginal.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total Ejecutado: </span>
                              <span className="font-medium text-green-600">{item.totales.totalEjecutado.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Pendiente: </span>
                              <span className="font-medium">{item.totales.totalPendiente.toLocaleString()}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        Seleccione un proveedor para ver el detalle
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No se encontraron anticipos de pago
                </div>
              )}
            </div>
          </TabsContent>

          {/* Resumen */}
          <TabsContent value="resumen" className="mt-4">
            {loadingResumen ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : dataResumen?.resumen ? (
              <div className="space-y-4">
                {/* Totales por Tipo */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total Pagos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {dataResumen.resumen.porTipo?.PAGO?.toLocaleString() || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total Cobros</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {dataResumen.resumen.porTipo?.COBRO?.toLocaleString() || 0}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Totales por Estado */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Por Estado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4">
                      <div className="flex-1 text-center p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{dataResumen.resumen.porEstado?.RESERVADO || 0}</p>
                        <p className="text-sm text-muted-foreground">Reservados</p>
                      </div>
                      <div className="flex-1 text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{dataResumen.resumen.porEstado?.EJECUTADO || 0}</p>
                        <p className="text-sm text-green-600">Ejecutados</p>
                      </div>
                      <div className="flex-1 text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                        <p className="text-2xl font-bold text-red-600">{dataResumen.resumen.porEstado?.ANULADO || 0}</p>
                        <p className="text-sm text-red-600">Anulados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Totales por Moneda */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Por Moneda</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Moneda</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Pendiente</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(dataResumen.resumen.porMoneda || {}).map(([moneda, valores]: [string, any]) => (
                          <TableRow key={moneda}>
                            <TableCell className="font-medium">{moneda}</TableCell>
                            <TableCell className="text-right">{valores.total?.toLocaleString() || 0}</TableCell>
                            <TableCell className="text-right">{valores.pendiente?.toLocaleString() || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Totales Generales */}
                <Card className="bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Total General</p>
                        <p className="text-3xl font-bold">
                          {dataResumen.resumen.totalesGenerales?.totalAnticipos?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Pendiente Total</p>
                        <p className="text-3xl font-bold text-amber-600">
                          {dataResumen.resumen.totalesGenerales?.totalPendiente?.toLocaleString() || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No hay datos de anticipos
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
