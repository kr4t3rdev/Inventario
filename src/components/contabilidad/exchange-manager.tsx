'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Coins, ArrowRightLeft, Star, CalendarDays, AlertCircle } from 'lucide-react'

interface Tasa {
  tasaId: string
  monedaOrigenId: string
  monedaDestino: string
  tasa: number
  fechaVigencia: string
}

interface MonedaPrincipal {
  monedaId: string
  codigo: string
  nombre: string
  simbolo: string
  esPrincipal: boolean
}

interface TasasResponse {
  success: boolean
  data: {
    monedaPrincipal: MonedaPrincipal | null
    tasas: Tasa[]
  }
}

/**
 * @description Componente gestor de exchange y tasas de cambio.
 * Muestra la moneda principal del sistema y las tasas de cambio vigentes.
 * @returns {JSX.Element} Vista de exchange
 */
export function ExchangeManager() {
  const [data, setData] = useState<TasasResponse['data'] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/contabilidad/exchange/tasas')
        if (!response.ok) throw new Error('Error al cargar tasas de cambio')
        const json: TasasResponse = await response.json()
        if (!json.success) throw new Error(json.error || 'Error desconocido')
        setData(json.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6 p-6" role="status" aria-label="Cargando exchange">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Error al cargar exchange</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const { monedaPrincipal, tasas } = data

  return (
    <div className="space-y-6 p-6">
      {/* Moneda Principal */}
      {monedaPrincipal && (
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moneda Principal</CardTitle>
            <Star className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{monedaPrincipal.simbolo}</span>
              <span className="text-xl font-semibold">{monedaPrincipal.codigo}</span>
              <span className="text-sm text-muted-foreground">{monedaPrincipal.nombre}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasas de Cambio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Tasas de Cambio Vigentes
          </CardTitle>
          <CardDescription>
            &Uacute;ltimas tasas registradas en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ArrowRightLeft className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No hay tasas de cambio registradas.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {tasas.map((tasa) => (
                <div key={tasa.tasaId} className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        1 {tasa.monedaOrigenId}
                      </span>
                      <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{tasa.monedaDestino}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(tasa.fechaVigencia).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {tasa.tasa.toFixed(4)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
