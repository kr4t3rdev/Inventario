'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getPlantillaActivaAction, aplicarPrecioSugeridoAction } from '../actions-plantilla'

interface ResumenPlantillaCardProps {
  productoId: string
  precioVenta: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)

/**
 * @description Card cliente que muestra el precio sugerido de la plantilla
 *   activa en el resumen de ficha de costo. Permite aplicar el precio
 *   sugerido directamente desde el resumen.
 */
export function ResumenPlantillaCard({ productoId, precioVenta }: ResumenPlantillaCardProps) {
  const [precioSugerido, setPrecioSugerido] = useState<number | null>(null)
  const [nombre, setNombre] = useState<string | null>(null)
  const [version, setVersion] = useState<number | null>(null)
  const [plantillaId, setPlantillaId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await getPlantillaActivaAction({ productoId })
      if (res.success && res.data.plantilla) {
        setPrecioSugerido(res.data.precioSugerido)
        setNombre(res.data.plantilla.nombre)
        setVersion(res.data.plantilla.version)
        setPlantillaId(res.data.plantilla.id)
      }
      setIsLoading(false)
    }
    load()
  }, [productoId])

  if (isLoading) return null
  if (!precioSugerido || !plantillaId) {
    return (
      <div className="rounded-md border p-3">
        <div className="text-muted-foreground text-xs uppercase tracking-wide">
          Precio sugerido (plantilla)
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-amber-600">
          <AlertTriangle className="h-3 w-3" />
          Sin plantilla activa
        </div>
      </div>
    )
  }

  const yaAplicado = Math.round(precioSugerido) === precioVenta

  return (
    <div className="rounded-md border p-3">
      <div className="text-muted-foreground flex items-center justify-between text-xs uppercase tracking-wide">
        <span>Precio sugerido (plantilla)</span>
        <Badge variant="outline" className="text-xs">
          {nombre} v{version}
        </Badge>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-lg font-semibold">{fmt(precioSugerido)}</span>
        {yaAplicado ? (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Aplicado
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => aplicarPrecioSugeridoAction({ plantillaId, productoId })}
          >
            Aplicar
          </Button>
        )}
      </div>
    </div>
  )
}
