'use client'

import { useState } from 'react'
import { useGetReporteLibroDiarioQuery, useGetReporteSumasSaldosQuery, useGetReporteEstadoResultadosQuery, useGetReporteConciliacionSnapshotQuery, useGetPeriodosQuery } from '@/lib/redux/services/contabilidadApi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, BookOpen, Scale, TrendingUp, CheckCircle2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ReportesSubledger() {
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [periodoId, setPeriodoId] = useState('')
  const [cuentaFilter, setCuentaFilter] = useState('')

  const { data: periodosData } = useGetPeriodosQuery({})
  const periodos: any[] = periodosData?.items ?? periodosData?.periodos ?? []

  const libroDiarioQuery = useGetReporteLibroDiarioQuery({ fechaDesde: fechaDesde || undefined, fechaHasta: fechaHasta || undefined, periodoId: periodoId || undefined }, { skip: !fechaDesde && !periodoId })
  const sumasSaldosQuery = useGetReporteSumasSaldosQuery({ fechaDesde: fechaDesde || undefined, fechaHasta: fechaHasta || undefined, periodoId: periodoId || undefined }, { skip: !fechaDesde && !periodoId })
  const estadoResultadosQuery = useGetReporteEstadoResultadosQuery({ fechaDesde: fechaDesde || undefined, fechaHasta: fechaHasta || undefined, periodoId: periodoId || undefined }, { skip: !fechaDesde && !periodoId })
  const conciliacionQuery = useGetReporteConciliacionSnapshotQuery({ periodoId }, { skip: !periodoId })

  const dateFilter = (
    <div className="grid gap-3 md:grid-cols-3 mb-4">
      <div>
        <Label>Fecha desde</Label>
        <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
      </div>
      <div>
        <Label>Fecha hasta</Label>
        <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
      </div>
      <div>
        <Label>Período</Label>
        <Select value={periodoId} onValueChange={setPeriodoId}>
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {periodos.map((p: any) => (
              <SelectItem key={p.periodoId} value={p.periodoId}>{p.codigo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  const loadingState = (libroDiarioQuery.isLoading || sumasSaldosQuery.isLoading || estadoResultadosQuery.isLoading) && (
    <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
  )

  const emptyState = (!fechaDesde && !periodoId) && (
    <div className="text-center py-12 text-muted-foreground">Seleccione fecha o período para cargar reportes</div>
  )

  return (
    <Tabs defaultValue="libro-diario">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="libro-diario"><BookOpen className="h-4 w-4 mr-1" />Libro Diario</TabsTrigger>
        <TabsTrigger value="sumas-saldos"><Scale className="h-4 w-4 mr-1" />Sumas y Saldos</TabsTrigger>
        <TabsTrigger value="estado-resultados"><TrendingUp className="h-4 w-4 mr-1" />Edo. Resultados</TabsTrigger>
        <TabsTrigger value="conciliacion"><CheckCircle2 className="h-4 w-4 mr-1" />Conciliación</TabsTrigger>
      </TabsList>

      <div className="mt-4">{dateFilter}</div>

      <TabsContent value="libro-diario">
        {loadingState}{emptyState}
        {libroDiarioQuery.data?.eventos?.length > 0 && (
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-2">Total eventos: <strong>{libroDiarioQuery.data.total}</strong> | Débitos: <strong>{libroDiarioQuery.data.resumen?.totalDebito?.toLocaleString()}</strong> | Créditos: <strong>{libroDiarioQuery.data.resumen?.totalCreditos?.toLocaleString()}</strong></p>
            <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Descripción</TableHead><TableHead>Monto</TableHead></TableRow></TableHeader>
            <TableBody>{libroDiarioQuery.data.eventos.slice(0, 50).map((e: any) => (
              <TableRow key={e.eventoId}><TableCell className="text-xs">{new Date(e.fechaOperacion).toLocaleDateString('es-ES')}</TableCell>
              <TableCell><Badge variant="outline">{e.origenTipo}</Badge></TableCell>
              <TableCell className="text-xs">{e.descripcion ?? '-'}</TableCell>
              <TableCell className="font-mono text-xs">{Number(e.monto).toLocaleString()}</TableCell></TableRow>
            ))}</TableBody></Table>
          </CardContent></Card>
        )}
      </TabsContent>

      <TabsContent value="sumas-saldos">
        {loadingState}{emptyState}
        {sumasSaldosQuery.data?.cuentas?.length > 0 && (
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-2">Total débitos: <strong>{sumasSaldosQuery.data.totalDebito?.toLocaleString()}</strong> | Créditos: <strong>{sumasSaldosQuery.data.totalCredito?.toLocaleString()}</strong> | Diferencia: <strong>{sumasSaldosQuery.data.diferencia?.toLocaleString()}</strong></p>
            <Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Débito</TableHead><TableHead className="text-right">Crédito</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Movs.</TableHead></TableRow></TableHeader>
            <TableBody>{sumasSaldosQuery.data.cuentas.map((c: any) => (
              <TableRow key={c.cuenta}><TableCell className="font-mono text-xs">{c.cuenta}</TableCell>
              <TableCell className="text-right font-mono text-xs">{c.debito?.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono text-xs">{c.credito?.toLocaleString()}</TableCell>
              <TableCell className={`text-right font-mono text-xs ${c.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{c.saldo?.toLocaleString()}</TableCell>
              <TableCell className="text-right text-xs">{c.movimientos}</TableCell></TableRow>
            ))}</TableBody></Table>
          </CardContent></Card>
        )}
      </TabsContent>

      <TabsContent value="estado-resultados">
        {loadingState}{emptyState}
        {estadoResultadosQuery.data?.resumen && (
          <div className="space-y-4">
            <Card><CardContent className="pt-4 space-y-2">
              <div className="flex justify-between"><span className="font-medium">Total Ingresos</span><span className="font-mono text-emerald-600">+{estadoResultadosQuery.data.resumen.totalIngresos?.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="font-medium">Total Egresos</span><span className="font-mono text-red-600">-{estadoResultadosQuery.data.resumen.totalEgresos?.toLocaleString()}</span></div>
              <div className="border-t pt-2 flex justify-between"><span className="font-bold">Utilidad / Pérdida</span>
                <span className={`font-mono font-bold ${(estadoResultadosQuery.data.resumen.utilidad ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {estadoResultadosQuery.data.resumen.utilidad?.toLocaleString()}
                </span>
              </div>
            </CardContent></Card>
            {estadoResultadosQuery.data.desglose?.porCuentaIngresos?.length > 0 && (
              <Card><CardHeader><CardTitle className="text-sm">Desglose por Cuenta</CardTitle></CardHeader><CardContent>
                <Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
                <TableBody>
                  {estadoResultadosQuery.data.desglose.porCuentaIngresos.map((i: any) => (
                    <TableRow key={i.cuenta}><TableCell className="text-xs">{i.cuenta}</TableCell><TableCell className="text-right text-xs font-mono text-emerald-600">+{i.monto?.toLocaleString()}</TableCell></TableRow>
                  ))}
                  {estadoResultadosQuery.data.desglose.porCuentaEgresos.map((e: any) => (
                    <TableRow key={e.cuenta}><TableCell className="text-xs">{e.cuenta}</TableCell><TableCell className="text-right text-xs font-mono text-red-600">-{e.monto?.toLocaleString()}</TableCell></TableRow>
                  ))}
                </TableBody></Table>
              </CardContent></Card>
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="conciliacion">
        {!periodoId ? (
          <div className="text-center py-12 text-muted-foreground">Seleccione un período para verificar la conciliación</div>
        ) : conciliacionQuery.isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : conciliacionQuery.data ? (
          <Card className={conciliacionQuery.data.conciliado ? 'border-emerald-200' : 'border-amber-200'}>
            <CardContent className="pt-4 space-y-3">
              <div className={`text-sm font-medium flex items-center gap-2 ${conciliacionQuery.data.conciliado ? 'text-emerald-600' : 'text-amber-600'}`}>
                {conciliacionQuery.data.conciliado ? '✓' : '⚠'} {conciliacionQuery.data.message}
              </div>
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <div><p className="text-muted-foreground">Snapshot ingresos</p><p className="font-mono">{conciliacionQuery.data.snapshot?.totalIngresos?.toLocaleString() ?? '-'}</p></div>
                <div><p className="text-muted-foreground">Subledger ingresos</p><p className="font-mono">{conciliacionQuery.data.subledger?.totalIngresos?.toLocaleString() ?? '-'}</p></div>
                <div><p className="text-muted-foreground">Snapshot egresos</p><p className="font-mono">{conciliacionQuery.data.snapshot?.totalEgresos?.toLocaleString() ?? '-'}</p></div>
                <div><p className="text-muted-foreground">Subledger egresos</p><p className="font-mono">{conciliacionQuery.data.subledger?.totalEgresos?.toLocaleString() ?? '-'}</p></div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <div><p className="text-muted-foreground">Dif. ingresos</p><p className={`font-mono ${Math.abs(conciliacionQuery.data.diferencias?.ingresos ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{conciliacionQuery.data.diferencias?.ingresos?.toLocaleString() ?? '0'}</p></div>
                <div><p className="text-muted-foreground">Dif. egresos</p><p className={`font-mono ${Math.abs(conciliacionQuery.data.diferencias?.egresos ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{conciliacionQuery.data.diferencias?.egresos?.toLocaleString() ?? '0'}</p></div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </TabsContent>
    </Tabs>
  )
}
