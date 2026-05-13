'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, CheckCircle2, XCircle, Building2, DollarSign, AlertCircle } from 'lucide-react'

interface TipoPago {
  tipoPagoId: string
  nombre: string
  descripcion: string | null
  requiereCuenta: boolean
  isActive: boolean
  _count: {
    reconciliacionesVenta: number
    reconciliacionesServicio: number
    reconciliacionesGasto: number
  }
  cuentaDefectoInfo?: {
    nombreBanco: string
    numeroCuenta: string
  } | null
}

/**
 * @description Página de configuración de tipos de pago.
 * Muestra los tipos de pago disponibles con sus detalles y estado.
 * @returns {JSX.Element} Página de configuración de tipos de pago
 */
export function TiposPagoConfigPage() {
  const [tiposPago, setTiposPago] = useState<TipoPago[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTiposPago = async () => {
      try {
        const response = await fetch('/api/contabilidad/tipos-pago')
        if (!response.ok) throw new Error('Error al cargar tipos de pago')
        const data = await response.json()
        setTiposPago(data.data ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTiposPago()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Error al cargar</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    )
  }

  const totalActivos = tiposPago.filter((t) => t.isActive).length
  const totalConCuenta = tiposPago.filter((t) => t.requiereCuenta).length

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configuraci&oacute;n de Tipos de Pago</h2>
        <p className="text-muted-foreground">
          Administra los m&eacute;todos de pago disponibles en el sistema.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tiposPago.length}</div>
            <p className="text-xs text-muted-foreground">Tipos de pago registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActivos}</div>
            <p className="text-xs text-muted-foreground">Disponibles para usar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Cuenta</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConCuenta}</div>
            <p className="text-xs text-muted-foreground">Requieren cuenta bancaria</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Types List */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Pago</CardTitle>
          <CardDescription>
            Lista completa de m&eacute;todos de pago configurados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {tiposPago.map((tipo) => (
              <div key={tipo.tipoPagoId} className="flex items-center justify-between py-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tipo.nombre}</span>
                    <Badge variant={tipo.isActive ? 'default' : 'secondary'}>
                      {tipo.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  {tipo.descripcion && (
                    <p className="text-sm text-muted-foreground">{tipo.descripcion}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {tipo.requiereCuenta && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Requiere cuenta
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {tipo._count.reconciliacionesVenta + tipo._count.reconciliacionesServicio + tipo._count.reconciliacionesGasto} transacciones
                    </span>
                    {tipo.cuentaDefectoInfo && (
                      <span>
                        Cuenta: {tipo.cuentaDefectoInfo.nombreBanco} -{' '}
                        {tipo.cuentaDefectoInfo.numeroCuenta}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
