'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FichaCostoView } from './ficha-costo-view'
import { EditarPrecioCosto } from './editar-precio-costo'
import type { FichaCostoData } from '../actions'

interface FichaCostoDetalleProps {
  data: FichaCostoData
}

/**
 * @description Wrapper de la ficha con header que muestra el código y
 *   nombre del producto, un botón "Volver" al listado, y el precio de
 *   costo editable inline.
 */
export function FichaCostoDetalle({ data }: FichaCostoDetalleProps) {
  const [precioCosto, setPrecioCosto] = useState(data.producto.precioCosto)
  const esServicio = data.producto.entityType === 'SERVICIO'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <div className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="self-start gap-2">
          <Link href="/busy/ficha-costo">
            <ArrowLeft className="h-4 w-4" />
            Volver al listado
          </Link>
        </Button>

        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {data.producto.nombre}
            </h1>
            <p className="text-muted-foreground text-sm">
              {data.producto.codigoInterno ?? 'sin código interno'} ·{' '}
              {esServicio
                ? 'Servicio'
                : data.producto.tipo === 'SIMPLE'
                  ? 'Producto simple'
                  : 'Producto compuesto'}
            </p>
          </div>
          {!esServicio && (
            <div className="bg-muted/40 rounded-md border p-3">
              <div className="text-muted-foreground text-xs uppercase tracking-wide">
                Precio de costo (estándar)
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xl font-semibold">{precioCosto}</span>
                <EditarPrecioCosto
                  productoId={data.producto.id}
                  precioCostoInicial={precioCosto}
                  onUpdated={setPrecioCosto}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <FichaCostoView data={data} hideHeader />
    </div>
  )
}
