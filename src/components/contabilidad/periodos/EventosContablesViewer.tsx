'use client'

import { useState } from 'react'
import { useGetEventosContablesQuery } from '@/lib/redux/services/contabilidadApi'
import { ORIGEN_TIPO, NATURALEZA, ESTADO_EVENTO } from '@/lib/services/evento-contable-service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Loader2, Filter, ArrowUpCircle, ArrowDownCircle, AlertCircle } from 'lucide-react'

const NATURALEZA_LABELS: Record<string, { label: string; className: string }> = {
  INGRESO: { label: 'Ingreso', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  EGRESO: { label: 'Egreso', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  ACTIVO: { label: 'Activo', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  PASIVO: { label: 'Pasivo', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  PATRIMONIO: { label: 'Patrimonio', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  RESULTADO: { label: 'Resultado', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
}

const ORIGEN_LABELS: Record<string, string> = {
  VENTA: 'Venta',
  VENTA_SERVICIO: 'Venta Servicio',
  GASTO_DE: 'Gasto DE',
  GASTO_COMPRA: 'Gasto Compra',
  PAGO_SALARIO: 'Pago Salario',
  COBRO_VENTA: 'Cobro Venta',
  COBRO_SERVICIO: 'Cobro Servicio',
  PAGO_GASTO: 'Pago Gasto',
  TRANSFERENCIA_BANCARIA: 'Transferencia Bancaria',
  TRANSFERENCIA_INVENTARIO: 'Transferencia Inventario',
  AJUSTE_BANCARIO: 'Ajuste Bancario',
  RECONCILIACION_VENTA: 'Reconciliación Venta',
  RECONCILIACION_SERVICIO: 'Reconciliación Servicio',
  RECONCILIACION_GASTO: 'Reconciliación Gasto',
  AJUSTE_CONTABLE: 'Ajuste Contable',
}

const ESTADO_LABELS: Record<string, { label: string; className: string }> = {
  CONFIRMADO: { label: 'Confirmado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  PENDIENTE: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  ANULADO: { label: 'Anulado', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function formatCurrency(amount: number | null | undefined, moneda?: string) {
  if (amount == null) return '-'
  return new Intl.NumberFormat('es-CU', {
    style: 'currency',
    currency: moneda ?? 'CUP',
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

function getEventoKey(evento: any) {
  return evento.eventoId ?? evento.eventoContableId ?? evento.id
}

function getLineaKey(linea: any) {
  return linea.lineaId ?? linea.eventoContableLineaId ?? linea.id
}

function getLineaDebito(linea: any) {
  if (linea.debito != null) return Number(linea.debito)
  return linea.tipoLinea === 'DEBITO' ? Number(linea.monto ?? 0) : 0
}

function getLineaCredito(linea: any) {
  if (linea.credito != null) return Number(linea.credito)
  return linea.tipoLinea === 'CREDITO' ? Number(linea.monto ?? 0) : 0
}

function getLineaTipo(linea: any) {
  if (getLineaDebito(linea) > 0) return 'Débito'
  if (getLineaCredito(linea) > 0) return 'Crédito'
  return '-'
}

/**
 * @description Visor de eventos contables del subledger con filtros y detalle de líneas
 * @returns {JSX.Element} Tabla de eventos con líneas de doble partida
 */
export function EventosContablesViewer() {
  const [filtroOrigen, setFiltroOrigen] = useState<string>('all')
  const [filtroNaturaleza, setFiltroNaturaleza] = useState<string>('all')
  const [filtroEstado, setFiltroEstado] = useState<string>('all')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const { data, isLoading, isError } = useGetEventosContablesQuery({
    origenTipo: filtroOrigen !== 'all' ? filtroOrigen : undefined,
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta || undefined,
    limite: 100,
  })

  const rawData = data as any
  const eventos: any[] = Array.isArray(rawData) ? rawData : (rawData?.eventos ?? [])

  const eventosFiltrados = filtroNaturaleza !== 'all' || filtroEstado !== 'all'
    ? (eventos as any[]).filter((e: any) => {
        if (filtroNaturaleza !== 'all' && e.naturaleza !== filtroNaturaleza) return false
        if (filtroEstado !== 'all' && e.estado !== filtroEstado) return false
        return true
      })
    : eventos

  if (isError) {
    return (
      <Card className="border-red-200 dark:border-red-900">
        <CardContent className="flex items-center gap-3 p-6">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-600 dark:text-red-400">Error al cargar los eventos contables</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Eventos Contables
            {data && !Array.isArray(data) && 'total' in data && (
              <span className="text-sm font-normal text-muted-foreground">
                ({(data as any).total} total)
              </span>
            )}
          </CardTitle>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Select value={filtroOrigen} onValueChange={setFiltroOrigen}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(ORIGEN_TIPO).map(([key, val]) => (
                <SelectItem key={key} value={val}>{ORIGEN_LABELS[key] ?? key}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroNaturaleza} onValueChange={setFiltroNaturaleza}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Naturaleza" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(NATURALEZA).map(([key, val]) => (
                <SelectItem key={key} value={val}>{NATURALEZA_LABELS[val]?.label ?? key}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(ESTADO_EVENTO).map(([key, val]) => (
                <SelectItem key={key} value={val}>{ESTADO_LABELS[val]?.label ?? key}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="flex h-9 w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            placeholder="Desde"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="flex h-9 w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            placeholder="Hasta"
          />
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : eventosFiltrados.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay eventos contables registrados
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {eventosFiltrados.map((evento: any) => {
              const natConf = NATURALEZA_LABELS[evento.naturaleza] ?? NATURALEZA_LABELS.RESULTADO
              const estConf = ESTADO_LABELS[evento.estado] ?? ESTADO_LABELS.PENDIENTE
              const origenLabel = ORIGEN_LABELS[evento.origenTipo] ?? evento.origenTipo

              return (
                <AccordionItem key={getEventoKey(evento)} value={getEventoKey(evento)}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full text-left">
                      {evento.naturaleza === 'INGRESO' ? (
                        <ArrowUpCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : evento.naturaleza === 'EGRESO' ? (
                        <ArrowDownCircle className="h-4 w-4 text-red-500 shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-blue-300 shrink-0" />
                      )}
                      <span className="font-medium text-sm">{origenLabel}</span>
                      <Badge variant="outline" className={natConf.className}>{natConf.label}</Badge>
                      <Badge variant="outline" className={estConf.className}>{estConf.label}</Badge>
                      <span className="text-sm text-muted-foreground ml-auto">
                        {new Date(evento.fechaOperacion).toLocaleDateString('es-ES')}
                      </span>
                      <span className="font-semibold text-sm">
                        {formatCurrency(evento.monto, evento.moneda ?? 'CUP')}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-6 space-y-2">
                      <p className="text-sm">{evento.descripcion ?? 'Sin descripción'}</p>
                      {evento.criterio && (
                        <p className="text-xs text-muted-foreground">Criterio: {evento.criterio}</p>
                      )}

                      {evento.lineas && evento.lineas.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cuenta</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead className="text-right">Débito</TableHead>
                              <TableHead className="text-right">Crédito</TableHead>
                              <TableHead>Descripción</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {evento.lineas.map((linea: any) => {
                              const debito = getLineaDebito(linea)
                              const credito = getLineaCredito(linea)

                              return (
                              <TableRow key={getLineaKey(linea)}>
                                <TableCell className="font-mono text-xs">{linea.cuenta ?? '-'}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {getLineaTipo(linea)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {debito > 0 ? formatCurrency(debito, evento.moneda) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {credito > 0 ? formatCurrency(credito, evento.moneda) : '-'}
                                </TableCell>
                                <TableCell className="text-xs">{linea.descripcion ?? '-'}</TableCell>
                              </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Sin líneas de doble partida</p>
                      )}

                      <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                        <span>Origen: {evento.origenId ?? '-'}</span>
                        {evento.montoConvertido && (
                          <span>Convertido: {formatCurrency(evento.montoConvertido, 'USD')}</span>
                        )}
                        <span>Moneda: {evento.moneda ?? 'CUP'}</span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}
