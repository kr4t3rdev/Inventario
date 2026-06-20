'use client'

import { useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResumenCosto } from './resumen-costo'
import { HistorialCostos } from './historial-costos'
import { ComposicionCosto } from './composicion-costo'
import { ListasPrecios } from './listas-precios'
import { VentasTrazabilidad } from './ventas-trazabilidad'
import { FichaCostoPdf } from './ficha-costo-pdf'
import { PlantillaCostoTab } from './plantilla-costo-tab'
import type { FichaCostoData } from '../actions'

interface FichaCostoViewProps {
  data: FichaCostoData
  /** Cuando es true, no muestra el header propio (usado por FichaCostoDetalle). */
  hideHeader?: boolean
}

/**
 * @description Vista cliente de la ficha de costo. Recibe los datos
 *   ya calculados desde el server component y los muestra organizados
 *   por pestañas. La pestaña "Composición" solo se muestra para
 *   productos compuestos. El botón "Exportar PDF" captura el contenido
 *   de la vista y lo descarga.
 */
export function FichaCostoView({ data, hideHeader = false }: FichaCostoViewProps) {
  const esCompuesto = data.producto.tipo === 'COMPUESTO'
  const printableRef = useRef<HTMLDivElement>(null)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      {!hideHeader && (
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Ficha de costo: {data.producto.nombre}
            </h1>
            <p className="text-muted-foreground text-sm">
              {data.producto.codigoInterno ?? 'sin código interno'} ·{' '}
              {esCompuesto ? 'Producto compuesto' : 'Producto simple'}
            </p>
          </div>
          <FichaCostoPdf data={data} targetRef={printableRef} />
        </header>
      )}
      {hideHeader && (
        <div className="flex justify-end">
          <FichaCostoPdf data={data} targetRef={printableRef} />
        </div>
      )}

      <div ref={printableRef} className="space-y-6">
        <Tabs defaultValue="resumen" className="w-full">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          {esCompuesto && <TabsTrigger value="composicion">Composición</TabsTrigger>}
          <TabsTrigger value="historial">Historial de compras</TabsTrigger>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="plantilla">Plantilla</TabsTrigger>
          <TabsTrigger value="listas">Listas de precios</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <ResumenCosto data={data} />
        </TabsContent>

        {esCompuesto && (
          <TabsContent value="composicion" className="mt-4">
            <ComposicionCosto productoId={data.producto.id} />
          </TabsContent>
        )}

        <TabsContent value="historial" className="mt-4">
          <HistorialCostos productoId={data.producto.id} />
        </TabsContent>

        <TabsContent value="ventas" className="mt-4">
          <VentasTrazabilidad
            productoId={data.producto.id}
            precioCosto={data.producto.precioCosto}
          />
        </TabsContent>

        <TabsContent value="plantilla" className="mt-4">
          <PlantillaCostoTab
            productoId={data.producto.id}
            precioVenta={data.producto.precioVenta}
          />
        </TabsContent>

        <TabsContent value="listas" className="mt-4">
          <ListasPrecios productoId={data.producto.id} />
        </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
