'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Calendar,
  User,
  FileText,
  DollarSign
} from 'lucide-react'
import { useGetAjustesByCuentaQuery, useGetCuentasBancariasQuery, useGetMonedasQuery } from '@/features/contabilidad/api/contabilidadApi'
import { useAppSelector } from '@/lib/redux/hooks'
import type { AjusteBancario, CuentaBancaria } from '../../app/models/model'

interface HistorialAjustesTableProps {
  cuentaId?: string
  showAllAccounts?: boolean
}

export function HistorialAjustesTable({ cuentaId, showAllAccounts = false }: HistorialAjustesTableProps) {
  // Get cuentasBancarias from Redux
  const { data:cuentas = { cuentas: []} } = useGetCuentasBancariasQuery()
  const cuentasBancarias: CuentaBancaria[] = cuentas.cuentas || []
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTipo, setFilterTipo] = useState<string>('all')
  const [filterMoneda, setFilterMoneda] = useState<string>('all')
  const [selectedCuentaId, setSelectedCuentaId] = useState(cuentaId || 'all')

  const { data: monedasResponse } = useGetMonedasQuery()
  const monedas = monedasResponse?.data || []
  
  const { 
    data: ajustesData = {data:{ ajustes:[], cuentas:[]}}, 
    isLoading, 
    error 
  } = useGetAjustesByCuentaQuery(
    showAllAccounts ? 'all' : selectedCuentaId,
    { skip: !selectedCuentaId && !showAllAccounts }
  )
  const ajustes: AjusteBancario[] = ajustesData?.data.ajustes || []
 
  // Filtrar ajustes según los criterios
  const filteredAjustes = ajustes.filter((ajuste: AjusteBancario) => {
    const matchesSearch = 
      ajuste.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ajuste.motivo.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesTipo = filterTipo === 'all' || ajuste.tipo === filterTipo
    const matchesMoneda = filterMoneda === 'all' || ajuste.moneda === filterMoneda
    
    return matchesSearch && matchesTipo && matchesMoneda
  })

  const getCuentaInfo = (cuentaId: string) => {
    const cuenta = cuentasBancarias?.find((c: any) => c.cuentaId === cuentaId)
    return cuenta ? `${cuenta.nombreBanco} - ${cuenta.numeroCuenta}` : 'Cuenta no encontrada'
  }

  const getMonedaInfo = (codigo: string) => {
    const moneda = monedas?.find((m: any) => m.codigo === codigo)
    return moneda ? `${codigo} (${moneda.simbolo})` : codigo
  }

  const formatMonto = (monto: number, moneda: string) => {
    const monedaInfo = monedas?.find((m: any) => m.codigo === moneda)
    const simbolo = monedaInfo?.simbolo || moneda
    return `${simbolo} ${monto.toFixed(2)}`
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Cargando historial de ajustes...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Error al cargar el historial de ajustes
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Historial de Ajustes Bancarios
        </CardTitle>
        <CardDescription>
          Registro completo de todos los ajustes manuales realizados con información de auditoría
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {showAllAccounts && (
            <div className="flex-1">
              <Select
                value={selectedCuentaId}
                onValueChange={setSelectedCuentaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las cuentas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cuentas</SelectItem>
                  {cuentasBancarias.map((cuenta) => (
                    <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                      {cuenta.nombreBanco} - {cuenta.numeroCuenta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por descripción o motivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="ingreso">Ingresos</SelectItem>
              <SelectItem value="egreso">Egresos</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterMoneda} onValueChange={setFilterMoneda}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Moneda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {monedas.map((moneda) => (
                <SelectItem key={moneda.codigo} value={moneda.codigo}>
                  {moneda.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabla de ajustes */}
        {filteredAjustes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {ajustes.length === 0 
              ? 'No hay ajustes bancarios registrados'
              : 'No se encontraron ajustes que coincidan con los filtros aplicados'
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  {showAllAccounts && <TableHead>Cuenta</TableHead>}
                  <TableHead>Tipo</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Conversión</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAjustes.map((ajuste: AjusteBancario) => (
                  <TableRow key={ajuste.ajusteId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium">
                            {format(new Date(ajuste.createdAt), 'dd/MM/yyyy')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(ajuste.createdAt), 'HH:mm:ss')}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    
                    {showAllAccounts && (
                      <TableCell>
                        <div className="text-sm">
                          {getCuentaInfo(ajuste.cuentaId)}
                        </div>
                      </TableCell>
                    )}
                    
                    <TableCell>
                      <Badge 
                        variant={ajuste.tipo === 'ingreso' ? 'default' : 'destructive'}
                        className="flex items-center gap-1 w-fit"
                      >
                        {ajuste.tipo === 'ingreso' ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {ajuste.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="font-medium">
                        {formatMonto(Number(ajuste.monto), ajuste.moneda)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline">
                        {getMonedaInfo(ajuste.moneda)}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      {ajuste.tasaCambio && ajuste.montoConvertido ? (
                        <div className="text-sm">
                          <div>Tasa: {Number(ajuste.tasaCambio).toFixed(4)}</div>
                          <div className="text-gray-500">
                            = {formatMonto(Number(ajuste.montoConvertido), 'CUP')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={ajuste.motivo}>
                        {ajuste.motivo}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="max-w-[250px] truncate" title={ajuste.descripcion}>
                        {ajuste.descripcion}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{ajuste.realizadoPor}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Resumen */}
        {filteredAjustes.length > 0 && (
          <div className="mt-6 p-4 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span>
                  Ingresos: {filteredAjustes.filter(a => a.tipo === 'ingreso').length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span>
                  Egresos: {filteredAjustes.filter(a => a.tipo === 'egreso').length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>
                  Total: {filteredAjustes.length} ajustes
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}