'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertTriangle, CheckCircle, Database } from 'lucide-react'
import { toast } from 'sonner'
import { getAuthToken } from '@/lib/token'

interface CuentaPendiente {
  cuentaPorPagarId: string
  numeroFactura: string
  proveedorNombre: string | null
  montoDeuda: number
  estado: string
  createdAt: string
}

interface EstadoMigracion {
  pendientes: number
  cuentas: CuentaPendiente[]
}

export function MigrateCuentasPorPagarButton() {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [estado, setEstado] = useState<EstadoMigracion | null>(null)
  const [resultado, setResultado] = useState<any>(null)

  const verificarEstado = async () => {
    try {
      setChecking(true)
      const response = await fetch('/api/admin/migrate/cuentas-por-pagar', {
        headers: { Authorization: getAuthToken() }
      })
      if (response.ok) {
        const data = await response.json()
        setEstado(data)
      }
    } catch (error) {
      console.error('Error al verificar estado:', error)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    verificarEstado()
  }, [])

  const ejecutarMigracion = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/migrate/cuentas-por-pagar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthToken(),
        }
      })

      const data = await response.json()
      
      if (response.ok) {
        setResultado(data)
        toast.success(`Migración completada: ${data.procesadas} cuentas procesadas`)
        // Actualizar estado
        await verificarEstado()
      } else {
        toast.error(data.error || 'Error al ejecutar migración')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al ejecutar migración')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Verificando estado...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!estado || estado.pendientes === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Migración de Cuentas por Pagar
          </CardTitle>
          <CardDescription>
            No hay cuentas pendientes de migración. Todas las cuentas tienen su GastoCompra asociado.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Migración de Cuentas por Pagar
        </CardTitle>
        <CardDescription>
          Hay <Badge variant="secondary">{estado.pendientes}</Badge> cuentas por pagar antiguas que necesitan ser migradas.
          Esto creará los registros GastoCompra faltantes para permitir la reconciliación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Esta operación creará registros GastoCompra para las compras existentes.
            Asegúrate de tener un backup de la base de datos antes de continuar.
          </AlertDescription>
        </Alert>

        <div className="max-h-60 overflow-y-auto border rounded-md p-2">
          <h4 className="font-medium mb-2 text-sm">Cuentas pendientes:</h4>
          <div className="space-y-1">
            {estado.cuentas.map((cuenta) => (
              <div 
                key={cuenta.cuentaPorPagarId}
                className="flex justify-between items-center p-2 bg-muted rounded text-sm"
              >
                <div>
                  <span className="font-medium">{cuenta.numeroFactura}</span>
                  <span className="text-muted-foreground ml-2">
                    - {cuenta.proveedorNombre || 'Sin proveedor'}
                  </span>
                </div>
                <Badge variant="outline">
                  ${cuenta.montoDeuda.toFixed(2)}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <Button 
          onClick={ejecutarMigracion} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Ejecutando migración...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Ejecutar Migración
            </>
          )}
        </Button>

        {resultado && (
          <div className="border rounded-md p-4 space-y-2">
            <h4 className="font-medium">Resultado:</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-green-50 p-2 rounded">
                <div className="text-2xl font-bold text-green-600">{resultado.procesadas}</div>
                <div className="text-xs text-muted-foreground">Procesadas</div>
              </div>
              <div className="bg-red-50 p-2 rounded">
                <div className="text-2xl font-bold text-red-600">{resultado.errores}</div>
                <div className="text-xs text-muted-foreground">Errores</div>
              </div>
              <div className="bg-blue-50 p-2 rounded">
                <div className="text-2xl font-bold text-blue-600">{resultado.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>
            
            {resultado.errores > 0 && (
              <div className="mt-2">
                <h5 className="text-sm font-medium text-red-600 mb-1">Detalles de errores:</h5>
                <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                  {resultado.detalles
                    .filter((d: any) => d.estado === 'ERROR')
                    .map((detalle: any, idx: number) => (
                      <div key={idx} className="p-1 bg-red-50 rounded text-red-700">
                        {detalle.numeroFactura}: {detalle.error}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
