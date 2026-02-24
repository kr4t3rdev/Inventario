"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { 
  Users, 
  FileText, 
  DollarSign, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Search,
  ArrowUpDown,
  Download,
  ChevronsUpDown,
  Check,
  TrendingUp,
  CreditCard
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  PageTransition
} from '@/components/ui/animations';

import { useGetClientesQuery } from "@/lib/redux/services/ClienteApi"
import { useGetCuentasPorCobrarQuery } from "@/lib/redux/services/cuentasPorCobrarApi"
import { useGetFacturasQuery } from "@/lib/redux/services/facturasApi"
import { Cliente, CuentaPorCobrar } from "@/app/models/model"

export default function AnalisisCuentaClientePage() {
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Queries
  const { data: clientes, isLoading: isLoadingClientes } = useGetClientesQuery()
  const { data: cuentas, isLoading: isLoadingCuentas } = useGetCuentasPorCobrarQuery()
  
  // Filter invoices by client if one is selected
  const { data: facturasData, isLoading: isLoadingFacturas } = useGetFacturasQuery(
    { 
      clienteId: selectedClientId, 
      limit: 100 
    }, 
    { skip: !selectedClientId }
  )

  const selectedCliente = useMemo(() => 
    clientes?.find(c => c.clienteId === selectedClientId),
    [clientes, selectedClientId]
  )

  // Process data for the dashboard
  const clientAccounts = useMemo(() => {
    if (!cuentas || !Array.isArray(cuentas) || !selectedClientId) return []
    return cuentas.filter(c => c?.clienteId === selectedClientId)
  }, [cuentas, selectedClientId])

  const stats = useMemo(() => {
    if (!clientAccounts.length) return {
      totalDeuda: 0,
      totalVencido: 0,
      facturasPendientes: 0,
      pagosParciales: 0
    }

    const today = new Date()
    
    return clientAccounts.reduce((acc, curr) => {
      const saldoRaw = curr?.saldoFactura ?? curr?.montoDeuda ?? 0
      const saldo = Number.isFinite(Number(saldoRaw)) ? Number(saldoRaw) : Number(curr?.montoDeuda ?? 0) - Number(curr?.montoPagado ?? 0)
      if (saldo <= 0.01) return acc

      acc.totalDeuda += saldo
      acc.facturasPendientes += 1

      if (curr.estado === 'PARCIAL') {
        acc.pagosParciales += 1
      }

      if (curr.fechaVencimiento && new Date(curr.fechaVencimiento) < today) {
        acc.totalVencido += saldo
      }

      return acc
    }, {
      totalDeuda: 0,
      totalVencido: 0,
      facturasPendientes: 0,
      pagosParciales: 0
    })
  }, [clientAccounts])

  const filteredClientes = useMemo(() => {
    if (!clientes) return []
    if (!searchTerm) return clientes
    const term = searchTerm.toLowerCase()
    return clientes.filter(c => 
      c.nombre.toLowerCase().includes(term) || 
      c.clienteId.includes(term)
    )
  }, [clientes, searchTerm])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount)
  }

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'PAGADA':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Pagada</Badge>
      case 'PENDIENTE':
        return <Badge variant="destructive">Pendiente</Badge>
      case 'PARCIAL':
        return <Badge variant="secondary" className="bg-yellow-500 text-white hover:bg-yellow-600">Parcial</Badge>
      default:
        return <Badge variant="outline">{estado}</Badge>
    }
  }

  const surfaceCardClass = cn(
    'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
    'dark:border-slate-800/60 dark:bg-slate-950/50',
  );

  return (
    <SidebarProvider>
      <SidebarInset className="bg-background">
        <PageTransition className="flex-1 space-y-8 p-4 md:p-8 pt-6">
          <div className="space-y-8">
            <div className="flex items-center justify-between space-y-2">
              <div>
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Análisis de Estado de Cuenta
                </h2>
                <p className="text-muted-foreground">
                  Resumen financiero y movimientos detallados por cliente
                </p>
              </div>
              {selectedClientId && (
                <div className="flex items-center space-x-2">
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Exportar PDF
                  </Button>
                </div>
              )}
            </div>

            <Card className={surfaceCardClass}>
              <CardHeader>
                <CardTitle>Selección de Cliente</CardTitle>
                <CardDescription>Seleccione un cliente para ver su estado de cuenta</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="w-full md:w-[300px]">
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className="w-full justify-between"
                        >
                          {selectedClientId
                            ? clientes?.find((cliente) => cliente.clienteId === selectedClientId)?.nombre
                            : "Seleccione un cliente..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <div className="p-2 border-b">
                           <div className="flex items-center px-3 border rounded-md">
                             <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                             <Input 
                                placeholder="Buscar cliente..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="border-0 focus-visible:ring-0 px-0"
                             />
                           </div>
                        </div>
                        <ScrollArea className="h-[200px]">
                          <div className="p-1">
                            {isLoadingClientes ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">Cargando...</div>
                            ) : filteredClientes.length === 0 ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">No encontrado</div>
                            ) : (
                              filteredClientes.map((cliente) => (
                                <div
                                  key={cliente.clienteId}
                                  className={cn(
                                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                    selectedClientId === cliente.clienteId && "bg-accent text-accent-foreground"
                                  )}
                                  onClick={() => {
                                    setSelectedClientId(cliente.clienteId)
                                    setOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedClientId === cliente.clienteId ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {cliente.nombre}
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {selectedCliente && (
                     <div className="flex flex-col justify-center text-sm text-muted-foreground">
                        <p><strong>ID:</strong> {selectedCliente.clienteId}</p>
                        <p><strong>Teléfono:</strong> {selectedCliente.telefono || 'N/A'}</p>
                     </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {selectedClientId && (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card className={cn(surfaceCardClass, "border-l-4 border-l-blue-500")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Deuda Total
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(stats.totalDeuda)}</div>
                      <p className="text-xs text-muted-foreground">
                        Saldo pendiente actual
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={cn(surfaceCardClass, "border-l-4 border-l-red-500")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Deuda Vencida
                      </CardTitle>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalVencido)}</div>
                      <p className="text-xs text-muted-foreground">
                        Pagos atrasados
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={cn(surfaceCardClass, "border-l-4 border-l-amber-500")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Facturas Pendientes
                      </CardTitle>
                      <FileText className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.facturasPendientes}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.pagosParciales} con pago parcial
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={cn(surfaceCardClass, "border-l-4 border-l-emerald-500")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Última Actividad
                      </CardTitle>
                      <Calendar className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                         {clientAccounts.length > 0 
                           ? (() => {
                             const validDates = clientAccounts
                               .map(c => new Date(c.updatedAt).getTime())
                               .filter(t => !isNaN(t))
                             return validDates.length > 0 
                               ? format(new Date(Math.max(...validDates)), 'dd/MM/yyyy')
                               : '-'
                           })()
                           : '-'
                         }
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Fecha de último movimiento
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="pendientes" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="pendientes">Cuentas por Cobrar</TabsTrigger>
                    <TabsTrigger value="historial">Historial de Facturas</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="pendientes" className="space-y-4">
                    <Card className={surfaceCardClass}>
                      <CardHeader>
                        <CardTitle>Facturas Pendientes de Pago</CardTitle>
                        <CardDescription>
                          Listado de facturas con saldo pendiente
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Factura</TableHead>
                              <TableHead>Emisión</TableHead>
                              <TableHead>Vencimiento</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead className="text-right">Monto Original</TableHead>
                              <TableHead className="text-right">Pagado</TableHead>
                              <TableHead className="text-right">Saldo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clientAccounts
                              .filter(c => {
                                const saldoRaw = c?.saldoFactura ?? c?.montoDeuda ?? 0
                                const saldo = Number.isFinite(Number(saldoRaw)) ? Number(saldoRaw) : Number(c?.montoDeuda ?? 0) - Number(c?.montoPagado ?? 0)
                                return saldo > 0.01
                              })
                              .map((cuenta) => {
                                const saldoRaw = cuenta?.saldoFactura ?? cuenta?.montoDeuda ?? 0
                                const saldo = Number.isFinite(Number(saldoRaw)) ? Number(saldoRaw) : Number(cuenta?.montoDeuda ?? 0) - Number(cuenta?.montoPagado ?? 0)
                                return (
                                  <TableRow key={cuenta.id}>
                                    <TableCell className="font-medium">{cuenta.numeroFactura || cuenta.factura?.numeroFactura || 'N/A'}</TableCell>
                                    <TableCell>{format(new Date(cuenta.createdAt), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>
                                      {cuenta.fechaVencimiento ? (
                                        <span className={new Date(cuenta.fechaVencimiento) < new Date() ? "text-destructive font-medium" : ""}>
                                          {format(new Date(cuenta.fechaVencimiento), 'dd/MM/yyyy')}
                                        </span>
                                      ) : '-'}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(cuenta.estado)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(cuenta.totalFactura ?? cuenta.totalVenta ?? cuenta.montoDeuda)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(cuenta.montoPagado)}</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(saldo)}</TableCell>
                                  </TableRow>
                                )
                            })}
                            {clientAccounts.filter(c => (Number.isFinite(Number(c.saldoFactura)) ? Number(c.saldoFactura) : Number(c.montoDeuda) - Number(c.montoPagado)) > 0.01).length === 0 && (
                               <TableRow>
                                 <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                                   El cliente no tiene facturas pendientes.
                                 </TableCell>
                               </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="historial" className="space-y-4">
                    <Card className={surfaceCardClass}>
                      <CardHeader>
                        <CardTitle>Historial de Facturación</CardTitle>
                        <CardDescription>
                          Todas las facturas emitidas al cliente
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Número</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead className="text-right">Subtotal</TableHead>
                              <TableHead className="text-right">Impuestos</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {isLoadingFacturas ? (
                               <TableRow>
                                 <TableCell colSpan={6} className="text-center py-4">Cargando facturas...</TableCell>
                               </TableRow>
                            ) : facturasData?.facturas.map((factura) => (
                              <TableRow key={factura.idFactura}>
                                <TableCell className="font-medium">{factura.numeroFactura}</TableCell>
                                <TableCell>{format(new Date(factura.fechaEmision), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>{getStatusBadge(factura.estado)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(factura.subtotal)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(factura.impuestos)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(factura.total)}</TableCell>
                              </TableRow>
                            ))}
                            {!isLoadingFacturas && (!facturasData?.facturas || facturasData.facturas.length === 0) && (
                               <TableRow>
                                 <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                   No hay historial de facturas.
                                 </TableCell>
                               </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </PageTransition>
      </SidebarInset>
    </SidebarProvider>
  )
}
