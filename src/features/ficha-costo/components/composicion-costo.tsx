'use client'

import { useEffect, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getComposicionCostoAction,
  type ComposicionCostoData,
} from '../actions'

interface ComposicionCostoProps {
  productoId: string
  className?: string
}

/**
 * @description Desglose del costo de un producto compuesto: lista de
 *   ingredientes con su CPP y costo total, e inputs manuales para
 *   mano de obra e indirectos. Recalcula en cada cambio de input.
 */
export function ComposicionCosto({ productoId, className }: ComposicionCostoProps) {
  const [manoObra, setManoObra] = useState<number | ''>('')
  const [indirectos, setIndirectos] = useState<number | ''>('')
  const [data, setData] = useState<ComposicionCostoData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      const res = await getComposicionCostoAction({
        productoId,
        manoObra: manoObra === '' ? 0 : Number(manoObra),
        indirectos: indirectos === '' ? 0 : Number(indirectos),
      })
      if (cancelled) return
      if (!res.success) {
        setError(res.error?.message ?? 'Error desconocido')
        setData(null)
      } else {
        setData(res.data)
      }
      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [productoId, manoObra, indirectos])

  function handleManoObra(value: string) {
    startTransition(() => {
      setManoObra(value === '' ? '' : Number(value))
    })
  }

  function handleIndirectos(value: string) {
    startTransition(() => {
      setIndirectos(value === '' ? '' : Number(value))
    })
  }

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="mano-obra">Mano de obra (CUP)</Label>
          <Input
            id="mano-obra"
            type="number"
            min={0}
            step="0.01"
            value={manoObra}
            onChange={(e) => handleManoObra(e.target.value)}
            placeholder="0.00"
            aria-label="Costo de mano de obra"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="indirectos">Costos indirectos (CUP)</Label>
          <Input
            id="indirectos"
            type="number"
            min={0}
            step="0.01"
            value={indirectos}
            onChange={(e) => handleIndirectos(e.target.value)}
            placeholder="0.00"
            aria-label="Costos indirectos"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="text-destructive bg-card text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Componente</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">% del total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Materiales</TableCell>
                <TableCell className="text-right">{data.materiales.toFixed(2)}</TableCell>
                <TableCell className="text-right">{data.porcentajes.materiales}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Mano de obra</TableCell>
                <TableCell className="text-right">{data.manoObra.toFixed(2)}</TableCell>
                <TableCell className="text-right">{data.porcentajes.manoObra}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Costos indirectos</TableCell>
                <TableCell className="text-right">{data.indirectos.toFixed(2)}</TableCell>
                <TableCell className="text-right">{data.porcentajes.indirectos}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold">
                  {data.total.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.detalle.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Desperdicio %</TableHead>
                <TableHead className="text-right">CPP</TableHead>
                <TableHead className="text-right">Costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.detalle.map((ing) => (
                <TableRow key={ing.productoId}>
                  <TableCell>
                    {ing.nombre}
                    {ing.sinCosto && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        (sin costo)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{ing.cantidad}</TableCell>
                  <TableCell className="text-right">{ing.desperdicio}</TableCell>
                  <TableCell className="text-right">
                    {ing.sinCosto ? 'N/A' : ing.cpp.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">{ing.costoTotal.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.ingredientesSinCosto > 0 && (
        <p className="text-muted-foreground text-xs">
          {data.ingredientesSinCosto} ingrediente(s) sin compras registradas en los
          últimos 12 meses.
        </p>
      )}

      {isLoading && (
        <p className="text-muted-foreground text-xs" role="status" aria-live="polite">
          Calculando…
        </p>
      )}
    </div>
  )
}
