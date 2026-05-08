"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { 
  ArrowLeft, 
  Check, 
  X, 
  FileText, 
  ShoppingCart, 
  Loader2,
  User,
  Calendar,
  Receipt
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { useTransition } from "react"
import { getOfertaByIdAction, updateOfertaAction, facturarOfertaAction } from "@/features/ofertas"
import { getPuntosDeVentaAction } from "@/features/puntos-venta"
import { useGetAnticiposDisponiblesQuery } from "@/features/contabilidad/api/contabilidadApi"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { getAuthToken } from "@/lib/token"

function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div
      className="border-2 border-primary border-t-transparent rounded-full"
      style={{ width: size, height: size }}
    />
  )
}

export default function OfertaDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = params.id as string
  const anticiposFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_ANTICIPOS !== "false"
  const [oferta, setOferta] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [puntosDeVenta, setPuntosDeVenta] = useState<any[]>([])

  useEffect(() => {
    (async () => { setIsLoading(true); const r=await getOfertaByIdAction(id); if(r.success) setOferta(r.data!); setIsLoading(false); })()
    ;(async () => { const r=await getPuntosDeVentaAction(); if(r.success) setPuntosDeVenta(r.data??[]); })()
  }, [id])

  const [isFacturarDialogOpen, setIsFacturarDialogOpen] = useState(false)
  const [selectedPuntoVenta, setSelectedPuntoVenta] = useState<string>("")
  const [cargoTransporte, setCargoTransporte] = useState<number>(0)
  const [series, setSeries] = useState<any[]>([])
  const [selectedSerieId, setSelectedSerieId] = useState<string>("")
  const [tipoVencimiento, setTipoVencimiento] = useState<"fecha" | "plazo" | "contra_pago">("contra_pago")
  const [fechaVencimiento, setFechaVencimiento] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedAnticipoCobroId, setSelectedAnticipoCobroId] = useState<string>("")

  const { data: anticiposCobroDisponibles, isFetching: isLoadingAnticiposCobro } = useGetAnticiposDisponiblesQuery(
    {
      contexto: 'factura',
      clienteId: oferta?.clienteId || undefined,
      moneda: 'CUP'
    },
    {
      skip: !isFacturarDialogOpen || !oferta?.clienteId
    }
  )

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
    const fetchSeries = async () => {
      try {
        const token = getAuthToken()
        const res = await fetch("/api/series-facturacion", {
          headers: token ? { Authorization: token } : undefined,
          cache: "no-store",
        })
         if (!res.ok) throw new Error("Error al cargar series")
         const data = await res.json()
         setSeries(data)
         const defaultSerie = data.find((s: any) => s.esPorDefecto && s.activa)
         if (defaultSerie) setSelectedSerieId(defaultSerie.serieId)
      } catch (error) {
        console.error("Error fetching series:", error)
      }
    }
    fetchSeries()
  }, [])

  const handleUpdateStatus = async (estado: 'ACEPTADA' | 'RECHAZADA') => {
    startTransition(async () => {
      const r=await updateOfertaAction({ ofertaId: id, estado })
      if(r.success) toast.success(`Oferta ${estado.toLowerCase()} exitosamente`)
      else toast.error(r.error?.message||"Error al actualizar la oferta")
    })
  }

  const handleFacturar = async () => {
    if (!selectedPuntoVenta) {
      toast.error("Seleccione un punto de venta")
      return
    }

    startTransition(async () => {
      let fechaVencimientoISO = null;
      if (tipoVencimiento === 'fecha' && fechaVencimiento) {
        fechaVencimientoISO = new Date(fechaVencimiento).toISOString();
      } else if (tipoVencimiento === 'plazo') {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + 30);
        fechaVencimientoISO = fecha.toISOString();
      }

      const r = await facturarOfertaAction({ 
        ofertaId: id, 
        puntoDeVentaId: selectedPuntoVenta,
        observaciones: `Facturación automática de Oferta ${oferta?.numeroOferta}`,
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
          : undefined
      })
      
      if(r.success) {
        toast.success("Oferta facturada exitosamente")
        setIsFacturarDialogOpen(false)
        const ventaId = (r.data as any)?.venta?.ventaId
        if (ventaId) router.push(`/busy/invoice/print?id=${ventaId}`)
        else router.push("/busy/invoice/print")
      } else {
        toast.error(r.error?.message||"Error al facturar la oferta")
      }
    })
  }

    try {
      let fechaVencimientoISO = null;
      if (tipoVencimiento === 'fecha' && fechaVencimiento) {
        fechaVencimientoISO = new Date(fechaVencimiento).toISOString();
      } else if (tipoVencimiento === 'plazo') {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + 30);
        fechaVencimientoISO = fecha.toISOString();
      }

      const respuesta = await facturarOferta({ 
        id, 
        puntoDeVentaId: selectedPuntoVenta,
        observaciones: `Facturación automática de Oferta ${oferta?.numeroOferta}`,
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
          : undefined
      }).unwrap()
      
      toast.success("Oferta facturada exitosamente")
      setIsFacturarDialogOpen(false)
      
      const ventaId = respuesta?.venta?.ventaId
      if (ventaId) {
        router.push(`/busy/invoice/print?id=${ventaId}`)
      } else {
        router.push("/busy/invoice/print")
      }

    } catch (error: any) {
        console.error(error)
      toast.error(error?.data?.error || "Error al facturar la oferta")
    }
  }

  const generatePDF = async () => {
    if (!oferta) return
    
    try {
      const token = getAuthToken()
      const response = await fetch(`/api/ofertas/${oferta.id}/pdf`, {
        headers: {
          Authorization: token || ''
        }
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

  if (isLoading) return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size={40} />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )

  if (error || !oferta) return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4 text-center text-destructive">
          Error al cargar la oferta
        </div>
      </SidebarInset>
    </SidebarProvider>
  )

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
              <div className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Receipt className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Detalle de Oferta {oferta.numeroOferta}</h1>
              </div>
            </div>
            
            <Badge variant={
              oferta.estado === 'ACEPTADA' ? 'default' : 
              oferta.estado === 'RECHAZADA' ? 'destructive' : 
              oferta.estado === 'FACTURADA' ? 'outline' : 'secondary'
            }>
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
                  <span className="font-medium">{oferta.fechaVencimiento ? new Date(oferta.fechaVencimiento).toLocaleDateString() : '-'}</span>
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
                    {oferta.items.map((item, index) => (
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
                <Button variant="destructive" onClick={() => handleUpdateStatus('RECHAZADA')}>
                  <X className="mr-2 h-4 w-4" /> Rechazar
                </Button>
                <Button 
                  onClick={() => handleUpdateStatus('ACEPTADA')}
                  className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                >
                  <Check className="mr-2 h-4 w-4" /> Aceptar
                </Button>
              </>
            )}
            
            {(oferta.estado === 'ACEPTADA' || oferta.estado === 'FACTURADA' || oferta.estado === 'RECHAZADA') && (
              <Button variant="outline" onClick={generatePDF}>
                <FileText className="mr-2 h-4 w-4" /> Descargar PDF
              </Button>
            )}

            {oferta.estado === 'ACEPTADA' && (
              <Button 
                onClick={() => setIsFacturarDialogOpen(true)}
                className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
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
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
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
                  <label className="text-right text-sm font-medium">Serie</label>
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
                          {series.filter((s: any) => s.activa).map((serie: any) => (
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
                      onValueChange={(val) => setTipoVencimiento(val as any)}
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
                    className="col-span-3"
                    value={cargoTransporte}
                    onChange={(e) => setCargoTransporte(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFacturarDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleFacturar} 
                  disabled={isPending}
                  className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Facturando...
                    </>
                  ) : (
                    "Confirmar Facturación"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
