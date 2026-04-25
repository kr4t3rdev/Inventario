'use client'

import { useState } from 'react'
import { useGetPeriodosQuery } from '@/lib/redux/services/contabilidadApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  CalendarDays,
  Filter,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

const ESTADO_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  BORRADOR: { label: 'Borrador', variant: 'outline', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  ABIERTO: { label: 'Abierto', variant: 'default', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  EN_CIERRE: { label: 'En Cierre', variant: 'secondary', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  CERRADO: { label: 'Cerrado', variant: 'default', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  APROBADO: { label: 'Aprobado', variant: 'default', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  REABIERTO: { label: 'Reabierto', variant: 'destructive', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
}

const TIPO_CONFIG: Record<string, { label: string; className: string }> = {
  DIARIO: { label: 'Diario', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  MENSUAL: { label: 'Mensual', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  ANUAL: { label: 'Anual', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
}

/**
 * @description Tabla de períodos contables con filtros por tipo y estado
 * @param {Object} props - Props del componente
 * @param {Function} props.onSelectPeriodo - Callback al seleccionar un período
 * @returns {JSX.Element} Tabla de períodos
 */
export function PeriodosTable({ onSelectPeriodo }: { onSelectPeriodo: (id: string) => void }) {
  const [filtroTipo, setFiltroTipo] = useState<string>('all')
  const [filtroEstado, setFiltroEstado] = useState<string>('all')

  const { data, isLoading, isError } = useGetPeriodosQuery({
    tipo: filtroTipo !== 'all' ? filtroTipo : undefined,
    estado: filtroEstado !== 'all' ? filtroEstado : undefined,
  })

  if (isError) {
    return (
      <Card className="border-red-200 dark:border-red-900">
        <CardContent className="flex items-center gap-3 p-6">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <p className="text-red-600 dark:text-red-400">Error al cargar los períodos contables</p>
        </CardContent>
      </Card>
    )
  }

  const periodos = data?.periodos ?? []

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Períodos Contables
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="DIARIO">Diario</SelectItem>
                <SelectItem value="MENSUAL">Mensual</SelectItem>
                <SelectItem value="ANUAL">Anual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="BORRADOR">Borrador</SelectItem>
                <SelectItem value="ABIERTO">Abierto</SelectItem>
                <SelectItem value="EN_CIERRE">En Cierre</SelectItem>
                <SelectItem value="CERRADO">Cerrado</SelectItem>
                <SelectItem value="APROBADO">Aprobado</SelectItem>
                <SelectItem value="REABIERTO">Reabierto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : periodos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay períodos contables registrados
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Inicio</TableHead>
                <TableHead>Fecha Fin</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodos.map((p: any) => {
                const estadoConf = ESTADO_CONFIG[p.estado] ?? ESTADO_CONFIG.BORRADOR
                const tipoConf = TIPO_CONFIG[p.tipo] ?? TIPO_CONFIG.DIARIO
                return (
                  <TableRow
                    key={p.periodoId}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => onSelectPeriodo(p.periodoId)}
                  >
                    <TableCell className="font-mono font-medium">{p.codigo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={tipoConf.className}>
                        {tipoConf.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={estadoConf.variant} className={estadoConf.className}>
                        {estadoConf.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(p.fechaInicio).toLocaleDateString('es-ES')}</TableCell>
                    <TableCell>{new Date(p.fechaFin).toLocaleDateString('es-ES')}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectPeriodo(p.periodoId)
                        }}
                      >
                        Ver Detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}