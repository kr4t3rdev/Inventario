'use client'

import { useMemo, useState } from 'react'
import { RefreshCw, ChevronLeft, ChevronRight, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { CuentaPorPagar } from '@/app/models/model'
import { useGetCuentasPorPagarQuery } from '@/lib/redux/services/cuentasPorPagarApi'
import { PagarCuentaPorPagarDialog } from '@/components/contabilidad/pagar-cuenta-por-pagar-dialog'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ResumenTotales {
  totalDeuda: number
  totalPagado: number
  saldoPendiente: number
}

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-950/50',
);

/**
 * @description Tabla para visualizar y pagar cuentas por pagar.
 * @returns {JSX.Element} Tabla con filtros, resumen y acciones
 */
export function CuentasPorPagarTable() {
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState<string>('all')
  const [tipo, setTipo] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [selectedCuenta, setSelectedCuenta] = useState<CuentaPorPagar | null>(null)
  const [openPago, setOpenPago] = useState(false)

  const { data, isLoading, error, refetch } = useGetCuentasPorPagarQuery({
    search: search || undefined,
    estado: estado !== 'all' ? estado : undefined,
    tipo: tipo !== 'all' ? tipo : undefined,
    page,
    limit
  })

  const cuentas = useMemo(() => data?.cuentas ?? [], [data])
  const pagination = data?.pagination
  const showError = Boolean(error) && !isLoading && !data
  const showEmpty = !isLoading && !showError && cuentas.length === 0

  const resumen = useMemo<ResumenTotales>(() => {
    return cuentas.reduce(
      (acc, cuenta) => {
        acc.totalDeuda += Number(cuenta.montoDeuda || 0)
        acc.totalPagado += Number(cuenta.montoPagado || 0)
        acc.saldoPendiente += Number(cuenta.saldoPendiente || 0)
        return acc
      },
      { totalDeuda: 0, totalPagado: 0, saldoPendiente: 0 }
    )
  }, [cuentas])

  const agingStyles: Record<string, { label: string; className: string }> = {
    '0-30': { label: '0-30 días', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    '31-60': { label: '31-60 días', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    '61-90': { label: '61-90 días', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
    '90+': { label: '90+ días', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' }
  }

  const formatter = useMemo(
    () => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  )

  const handleOpenPago = (cuenta: CuentaPorPagar) => {
    if (!cuenta.cuentaPorPagarId) {
      toast.error(
        'Esta factura no tiene cuenta por pagar asociada. Actualice los datos antes de registrar pagos.'
      )
      return
    }
    if (cuenta.tipo === 'compra' && !cuenta.gastoCompraId) {
      toast.error(
        'Esta compra no tiene un gasto asociado. Actualice los datos antes de registrar pagos.'
      )
      return
    }
    if (cuenta.tipo === 'servicio' && !cuenta.gastosDEId) {
      toast.error(
        'Este servicio no tiene un gasto asociado. Actualice los datos antes de registrar pagos.'
      )
      return
    }
    setSelectedCuenta(cuenta)
    setOpenPago(true)
  }

  const totalPages = pagination?.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-primary")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deuda total</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              <AnimatedNumber value={resumen.totalDeuda} currency="CUP" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total de facturas entrantes</p>
          </CardContent>
        </Card>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-chart-2")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pagado</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              <AnimatedNumber value={resumen.totalPagado} currency="CUP" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pagos aplicados</p>
          </CardContent>
        </Card>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-accent")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo pendiente</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              <AnimatedNumber value={resumen.saldoPendiente} currency="CUP" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Por pagar</p>
          </CardContent>
        </Card>
      </div>

      <Card className={cn(surfaceCardClass)}>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Cuentas por pagar</CardTitle>
              <CardDescription>
                Controla facturas entrantes de compras y servicios
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Input
              placeholder="Buscar por factura o proveedor"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="bg-background/50"
            />
            <Select
              value={tipo}
              onValueChange={(value) => {
                setTipo(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="compra">Compras</SelectItem>
                <SelectItem value="servicio">Servicios</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={estado}
              onValueChange={(value) => {
                setEstado(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="PARCIAL">Parcial</SelectItem>
                <SelectItem value="PAGADA">Pagada</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(limit)}
              onValueChange={(value) => {
                setLimit(Number(value))
                setPage(1)
              }}
            >
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Filas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 filas</SelectItem>
                <SelectItem value="20">20 filas</SelectItem>
                <SelectItem value="50">50 filas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Factura</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Antigüedad</TableHead>
                  <TableHead className="text-right">Deuda</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      {Array.from({ length: 9 }).map((__, cellIndex) => (
                        <TableCell key={`skeleton-cell-${cellIndex}`}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}

                {showEmpty && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                        <p>No hay cuentas por pagar registradas.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                <AnimatePresence mode="wait">
                  {!isLoading && cuentas.map((cuenta, index) => {
                    const aging = agingStyles[cuenta.rangoAntiguedad ?? '0-30'] || agingStyles['0-30']
                    const proveedor = cuenta.proveedorNombre || cuenta.vendor?.nombre || 'Sin proveedor'
                    const saldoPendiente = Number(cuenta.saldoPendiente || 0)

                    return (
                      <motion.tr
                        key={`${cuenta.numeroFactura}-${cuenta.tipo}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="group border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                      >
                        <TableCell className="font-medium">{cuenta.numeroFactura}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{proveedor}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900">
                            {cuenta.tipo === 'compra' ? 'Compra' : 'Servicio'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge className={cn("w-fit", aging.className)}>{aging.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {cuenta.diasTranscurridos ?? 0} días
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {cuenta.moneda} {formatter.format(Number(cuenta.montoDeuda || 0))}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                          {cuenta.moneda} {formatter.format(Number(cuenta.montoPagado || 0))}
                        </TableCell>
                        <TableCell className="text-right font-bold text-rose-600 dark:text-rose-400">
                          {cuenta.moneda} {formatter.format(saldoPendiente)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={cuenta.estado === 'PAGADA' ? 'secondary' : 'outline'}>
                            {cuenta.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={saldoPendiente <= 0 ? "ghost" : "default"}
                            className={cn(
                              saldoPendiente > 0 && "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20"
                            )}
                            disabled={saldoPendiente <= 0}
                            onClick={() => handleOpenPago(cuenta)}
                          >
                            Pagar
                          </Button>
                        </TableCell>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>

          {showError && (
            <div className="p-4 text-sm text-destructive">
              Error al cargar las cuentas por pagar. Intente nuevamente.
            </div>
          )}

          <div className="flex items-center justify-between px-6 py-4 border-t">
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                aria-label="Página anterior"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                aria-label="Página siguiente"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PagarCuentaPorPagarDialog
        cuenta={selectedCuenta}
        open={openPago}
        onOpenChange={setOpenPago}
        onSuccess={() => {
          setSelectedCuenta(null)
          refetch()
        }}
      />
    </div>
  )
}
