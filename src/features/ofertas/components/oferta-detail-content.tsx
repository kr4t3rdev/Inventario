'use client'

/**
 * @description Contenido interactivo para el detalle de una oferta.
 * @param {OfertaDetailContentProps} props - Oferta cargada por el Server Component.
 * @returns {JSX.Element} Vista interactiva del detalle de la oferta.
 */
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, X, FileText, ShoppingCart, Loader2, User, Calendar, Receipt, Printer } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getAnticiposAction } from '@/features/contabilidad/actions-anticipos'
import { usePuntosDeVenta } from '@/features/puntos-venta/hooks/use-puntos-de-venta'
import { facturarOfertaAction, updateOfertaAction } from '@/features/ofertas/actions'
import { formatCurrency } from '@/lib/utils'
import { getAuthToken } from '@/lib/token'
import { getSeriesFacturacionAction } from '@/features/series-facturacion/actions'
import type { Oferta } from '@/app/models/model'

interface OfertaDetailContentProps {
  initialOferta: Oferta | null
}

function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div
      className="border-2 border-primary border-t-transparent rounded-full"
      style={{ width: size, height: size }}
    />
  )
}

/**
 * @description Vista interactiva del detalle de una oferta.
 * @param {OfertaDetailContentProps} props - Oferta inicial precargada.
 * @returns {JSX.Element} Detalle de oferta con acciones.
 */
export function OfertaDetailContent({ initialOferta }: OfertaDetailContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { puntosDeVenta } = usePuntosDeVenta()
  const [oferta, setOferta] = useState<Oferta | null>(initialOferta)
  const [isPending, startTransition] = useTransition()
  const [isFacturarDialogOpen, setIsFacturarDialogOpen] = useState(false)
  const [selectedPuntoVenta, setSelectedPuntoVenta] = useState<string>('')
  const [cargoTransporte, setCargoTransporte] = useState<number>(0)
  const [series, setSeries] = useState<any[]>([])
  const [selectedSerieId, setSelectedSerieId] = useState<string>('')
  const [tipoVencimiento, setTipoVencimiento] = useState<'fecha' | 'plazo' | 'contra_pago'>('contra_pago')
  const [fechaVencimiento, setFechaVencimiento] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedAnticipoCobroId, setSelectedAnticipoCobroId] = useState<string>('')

  const anticiposFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_ANTICIPOS !== 'false'

  const [anticiposCobroDisponibles, setAnticiposCobroDisponibles] = useState<{ anticipos: any[] } | undefined>(undefined)
  const [isLoadingAnticiposCobro, setIsLoadingAnticiposCobro] = useState(false)

  useEffect(() => {
    if (!isFacturarDialogOpen || !oferta?.clienteId) {
      setAnticiposCobroDisponibles(undefined)
      return
    }

    let cancelled = false
    setIsLoadingAnticiposCobro(true)
    getAnticiposAction({ clienteId: oferta.clienteId, moneda: 'CUP' }).then((res) => {
      if (!cancelled && res.success) {
        setAnticiposCobroDisponibles(res.data)
      }
    }).finally(() => {
      if (!cancelled) setIsLoadingAnticiposCobro(false)
    })
    return () => { cancelled = true }
  }, [isFacturarDialogOpen, oferta?.clienteId])

  useEffect(() => {
    setOferta(initialOferta)
  }, [initialOferta])

  useEffect(() => {
    if (!anticiposFeatureEnabled) {
      return
    }

    const anticipoFromQuery = searchParams.get('anticipoCobroId')
    if (anticipoFromQuery) {
      setSelectedAnticipoCobroId(anticipoFromQuery)
    }
  }, [searchParams, anticiposFeatureEnabled])

  useEffect(() => {
    getSeriesFacturacionAction()
      .then((r) => {
        if (r.success) setSeries(r.data ?? []);
      })
      .catch((error) => console.error('Error cargando series:', error));
  }, [])

  const handleUpdateStatus = (estado: 'ACEPTADA' | 'RECHAZADA') => {
    if (!oferta) return

    startTransition(async () => {
      const result = await updateOfertaAction({ ofertaId: oferta.id, estado })

      if (result.success) {
        toast.success(`Oferta ${estado.toLowerCase()} exitosamente`)
        if (result.data) {
          setOferta(result.data as Oferta)
        }
      } else {
        toast.error(result.error?.message || 'Error al actualizar la oferta')
      }
    })
  }

  const handleFacturar = () => {
    if (!oferta) return

    if (!selectedPuntoVenta) {
      toast.error('Seleccione un punto de venta')
      return
    }

    startTransition(async () => {
      let fechaVencimientoISO: string | null = null
      if (tipoVencimiento === 'fecha' && fechaVencimiento) {
        fechaVencimientoISO = new Date(fechaVencimiento).toISOString()
      } else if (tipoVencimiento === 'plazo') {
        const fecha = new Date()
        fecha.setDate(fecha.getDate() + 30)
        fechaVencimientoISO = fecha.toISOString()
      }

      const result = await facturarOfertaAction({
        ofertaId: oferta.id,
        puntoDeVentaId: selectedPuntoVenta,
        observaciones: `Facturación automática de Oferta ${oferta.numeroOferta}`,
        cargoTransporte: Number(cargoTransporte),
        serieId: selectedSerieId,
        fechaVencimiento: fechaVencimientoISO,
        tipoVencimiento,
        formaPagoAnticipo: selectedAnticipoCobroId ? 'ANTICIPO_COBRO' : undefined,
        anticipoCobroId: selectedAnticipoCobroId || undefined,
        idempotencyKey: selectedAnticipoCobroId
          ? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`)
          : undefined,
      })

      if (result.success) {
        toast.success('Oferta facturada exitosamente')
        setIsFacturarDialogOpen(false)

        const ventaId = (result.data as any)?.ventaId ?? (result.data as any)?.venta?.ventaId
        if (ventaId) {
          router.push(`/busy/invoice/print?id=${ventaId}`)
        } else {
          router.push('/busy/invoice/print')
        }
      } else {
        toast.error(result.error?.message || 'Error al facturar la oferta')
      }
    })
  }

  const generatePDF = async () => {
    if (!oferta) return

    try {
      const token = getAuthToken()
      const response = await fetch(`/api/ofertas/${oferta.id}/pdf`, {
        headers: token ? { Authorization: token } : undefined,
      })

      if (!response.ok) {
        throw new Error('Error al descargar PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `Oferta_${oferta.numeroOferta}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setTimeout(() => window.URL.revokeObjectURL(url), 100)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      toast.error('Error al descargar el PDF')
    }
  }

  if (!oferta) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4 text-center text-destructive">
            Error al cargar la oferta
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4 space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/busy/ofertas">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <Receipt className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Detalle de Oferta {oferta.numeroOferta}</h1>
              </div>
            </div>

            <Badge
              variant={
                oferta.estado === 'ACEPTADA'
                  ? 'default'
                  : oferta.estado === 'RECHAZADA'
                    ? 'destructive'
                    : oferta.estado === 'FACTURADA'
                      ? 'outline'
                      : 'secondary'
              }
            >
              {oferta.estado}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-dashed overflow-hidden">
              <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-primary" />
                  Información del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium text-lg">{oferta.cliente?.nombre}</p>
              </CardContent>
            </Card>

            <Card className="border-dashed overflow-hidden">
              <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  Detalles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha Emisión:</span>
                  <span className="font-medium">{new Date(oferta.fechaEmision).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vencimiento:</span>
                  <span className="font-medium">
                    {oferta.fechaVencimiento ? new Date(oferta.fechaVencimiento).toLocaleDateString() : '-'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-dashed overflow-hidden">
            <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-primary" />
                Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Producto / Servicio</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio Unitario</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {oferta.items.map((item) => (
                      <TableRow
                        key={item.id}
                        className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                      >
                        <TableCell>{item.producto?.nombre || item.servicio?.nombre}</TableCell>
                        <TableCell className="text-right">{item.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell colSpan={3} className="text-right">Total</TableCell>
                      <TableCell className="text-right text-lg">{formatCurrency(oferta.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4 flex-wrap">
            {oferta.estado === 'PENDIENTE' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleUpdateStatus('RECHAZADA')}
                  disabled={isPending}
                >
                  <X className="mr-2 h-4 w-4" />
                  Rechazar
                </Button>
                <Button
                  onClick={() => handleUpdateStatus('ACEPTADA')}
                  disabled={isPending}
                  className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90"
                >
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Aceptar
                </Button>
              </>
            )}

            <Button variant="outline" asChild disabled={isPending}>
              <Link href={`/busy/oferta/print?id=${oferta.id}`}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Link>
            </Button>

            {(oferta.estado === 'ACEPTADA' || oferta.estado === 'FACTURADA' || oferta.estado === 'RECHAZADA') && (
              <Button variant="outline" onClick={generatePDF} disabled={isPending}>
                <FileText className="mr-2 h-4 w-4" /> Descargar PDF
              </Button>
            )}

            {oferta.estado === 'ACEPTADA' && (
              <Button
                onClick={() => setIsFacturarDialogOpen(true)}
                disabled={isPending}
                className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90"
              >
                <ShoppingCart className="mr-2 h-4 w-4" /> Facturar
              </Button>
            )}

            {oferta.estado === 'FACTURADA' && oferta.ventaId && (
              <Button variant='outline' asChild>
                <Link href={`/busy/sales/editar/${oferta.ventaId}`}>
                  Ver Factura (Venta)
                </Link>
              </Button>
            )}
          </div>

          <Dialog open={isFacturarDialogOpen} onOpenChange={setIsFacturarDialogOpen}>
            <DialogContent className="sm:max-w-125">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                    <ShoppingCart className="h-5 w-5 text-white" />
                  </div>
                  <DialogTitle>Facturar Oferta</DialogTitle>
                </div>
                <DialogDescription>
                  Se creará una venta basada en esta oferta. Seleccione el punto de venta.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="pv" className="text-right text-sm font-medium">
                    Punto de Venta
                  </label>
                  <Select value={selectedPuntoVenta} onValueChange={setSelectedPuntoVenta}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Seleccione punto de venta" />
                    </SelectTrigger>
                    <SelectContent>
                      {puntosDeVenta?.map((pv) => (
                        <SelectItem key={pv.pvId} value={pv.pvId}>
                          {pv.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-right text-sm font-medium">Serie</span>
                  <div className="col-span-3">
                    {series.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 border rounded-md bg-muted/50">
                        <LoadingSpinner size={16} />
                        Cargando series...
                      </div>
                    ) : (
                      <Select value={selectedSerieId} onValueChange={setSelectedSerieId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una serie" />
                        </SelectTrigger>
                        <SelectContent>
                          {series.filter((serie: any) => serie.activa).map((serie: any) => (
                            <SelectItem key={serie.serieId} value={serie.serieId}>
                              {serie.prefijo} - {serie.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right mt-2 text-sm font-medium">
                    Vencimiento
                  </Label>
                  <div className="col-span-3 space-y-3 border p-3 rounded-md bg-card">
                    <RadioGroup
                      value={tipoVencimiento}
                      onValueChange={(val) => setTipoVencimiento(val as 'fecha' | 'plazo' | 'contra_pago')}
                      className="flex flex-col space-y-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fecha" id="v-fecha" />
                        <Label htmlFor="v-fecha" className="font-normal cursor-pointer">Fecha concreta</Label>
                      </div>

                      {tipoVencimiento === 'fecha' && (
                        <div className="ml-6 mt-1 mb-2">
                          <Input
                            type="date"
                            value={fechaVencimiento}
                            onChange={(e) => setFechaVencimiento(e.target.value)}
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Se agregará a Cuentas por Cobrar</p>
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="plazo" id="v-plazo" />
                        <Label htmlFor="v-plazo" className="font-normal cursor-pointer">Plazo de 30 días</Label>
                      </div>

                      {tipoVencimiento === 'plazo' && (
                        <p className="text-xs text-muted-foreground ml-6">
                          Se agregará a Cuentas por Cobrar con vencimiento a 30 días
                        </p>
                      )}

                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="contra_pago" id="v-contra" />
                        <Label htmlFor="v-contra" className="font-normal cursor-pointer">Contra pago (Pago directo)</Label>
                      </div>

                      {tipoVencimiento === 'contra_pago' && (
                        <p className="text-xs text-muted-foreground ml-6">
                          Se registra conciliación completa y cierre total de la factura
                        </p>
                      )}
                    </RadioGroup>
                  </div>
                </div>

                {anticiposFeatureEnabled && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm font-medium">
                      Cobro anticipado
                    </label>
                    <div className="col-span-3">
                      <Select
                        value={selectedAnticipoCobroId || '__none__'}
                        onValueChange={(value) => {
                          const nextValue = value === '__none__' ? '' : value
                          setSelectedAnticipoCobroId(nextValue)
                          if (nextValue) {
                            setTipoVencimiento('contra_pago')
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sin anticipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin anticipo</SelectItem>
                          {(anticiposCobroDisponibles?.anticipos || []).map((anticipo) => (
                            <SelectItem key={anticipo.anticipoId} value={anticipo.anticipoId}>
                              {`${anticipo.anticipoId.slice(0, 8)} · Saldo ${Number(anticipo.saldoDisponible).toFixed(2)} ${anticipo.moneda}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isLoadingAnticiposCobro ? 'Cargando anticipos...' : 'Opcional: ejecuta cobro anticipado al facturar'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right text-sm font-medium">
                    Cargo Transp.
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cargoTransporte}
                    onChange={(e) => setCargoTransporte(Number(e.target.value) || 0)}
                    className="col-span-3"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsFacturarDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleFacturar} disabled={isPending}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                  Facturar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
