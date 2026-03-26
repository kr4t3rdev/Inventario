'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Boxes,
  Calculator,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useFormContext } from 'react-hook-form'
import type { ProductosFormValues } from './productos-form'

interface CompoundProductSectionProps {
  disabled?: boolean
  parentBusinessCode?: string
  childBusinessCodePreview?: string
  childSurtidoPreview?: string
  parentSegmentSummary?: {
    proveedorCodigo?: string
    idSeccionCodigo?: string
    especificoCodigo?: string
  }
}

/**
 * @description Normaliza valores de preview para mostrarlos como etiquetas legibles.
 * @param {string | undefined} value - Valor actual del segmento.
 * @returns {string} Texto preparado para UI.
 */
function getPreviewLabel(value?: string): string {
  return value && value.trim() !== '' ? value : 'Pendiente'
}

/**
 * @description Sección de configuración de producto compuesto (caja/conjunto)
 * @param {CompoundProductSectionProps} props - Props del componente
 * @returns {JSX.Element} Sección de producto compuesto
 */
export function CompoundProductSection({
  disabled = false,
  parentBusinessCode = '',
  childBusinessCodePreview = '',
  childSurtidoPreview = '',
  parentSegmentSummary,
}: CompoundProductSectionProps): React.JSX.Element {
  const form = useFormContext<ProductosFormValues>()
  
  const isCompound = form.watch('esCompuesto') === true
  const precioVenta = Number(form.watch('precioVenta') || 0)
  const cantidadEnPack = Number(form.watch('cantidadEnPack') || 0)
  
  // Calcular precio unitario del hijo
  const precioUnitarioCalculado = cantidadEnPack > 0 
    ? Math.round(precioVenta / cantidadEnPack) 
    : 0
  
  const precioCosto = Number(form.watch('precioCosto') || 0)
  const precioCostoUnitario = cantidadEnPack > 0 
    ? Math.round(precioCosto / cantidadEnPack) 
    : 0

  // Validar si el precio es divisible exactamente
  const esDivisibleExactamente = cantidadEnPack > 0 && precioVenta % cantidadEnPack === 0

  return (
    <motion.div
      className="rounded-xl border border-dashed bg-gradient-to-br from-primary/[0.05] via-background to-purple-500/[0.08] dark:from-primary/10 dark:to-purple-500/10 p-4"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.42 }}
    >
      {/* Header con checkbox */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-5 w-5 items-center">
          <Checkbox
            id="esCompuesto"
            checked={isCompound}
            onCheckedChange={(checked) => {
              form.setValue('esCompuesto', checked === true, { shouldValidate: true })
              if (!checked) {
                form.setValue('cantidadEnPack', undefined, { shouldValidate: true })
                form.setValue('nombreHijo', '', { shouldValidate: true })
              }
            }}
            disabled={disabled}
          />
        </div>
        <Label
          htmlFor="esCompuesto"
          className="flex cursor-pointer items-center gap-2 text-sm font-semibold"
        >
          <Boxes className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          Es producto compuesto (caja/conjunto)
        </Label>
      </div>

      <AnimatePresence>
        {isCompound && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 overflow-hidden"
          >
            {/* Descripción */}
            <p className="text-xs text-muted-foreground">
              Un producto compuesto es una caja o conjunto que contiene múltiples unidades de un producto individual.
              Por ejemplo: una caja de 20 cigarros, un paquete de 24 cervezas.
            </p>

            {/* Grid de campos */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Cantidad en pack */}
              <div className="space-y-2">
                <Label htmlFor="cantidadEnPack" className="text-xs font-medium">
                  Cantidad en el pack <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cantidadEnPack"
                  type="number"
                  min={1}
                  placeholder="Ej: 20"
                  disabled={disabled}
                  className="transition-all duration-200 focus-visible:ring-primary/30"
                  value={form.watch('cantidadEnPack') || ''}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value, 10) : undefined
                    form.setValue('cantidadEnPack', value, { shouldValidate: true })
                  }}
                />
                {form.formState.errors.cantidadEnPack && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.cantidadEnPack.message as string}
                  </p>
                )}
              </div>

              {/* Nombre del producto hijo */}
              <div className="space-y-2">
                <Label htmlFor="nombreHijo" className="text-xs font-medium">
                  Nombre del producto individual <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nombreHijo"
                  type="text"
                  placeholder="Ej: Cigarro (unidad)"
                  disabled={disabled}
                  className="transition-all duration-200 focus-visible:ring-primary/30"
                  value={form.watch('nombreHijo') || ''}
                  onChange={(e) => form.setValue('nombreHijo', e.target.value, { shouldValidate: true })}
                />
                {form.formState.errors.nombreHijo && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nombreHijo.message as string}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-medium">
                  Código del producto hijo (preview)
                </Label>
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-dashed p-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Código base del padre</p>
                    <p className="mt-1 text-sm font-semibold">
                      {getPreviewLabel(parentBusinessCode)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Surtido heredado + variante</p>
                    <p className="mt-1 text-sm font-semibold">
                      {getPreviewLabel(childSurtidoPreview)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Proveedor heredado</p>
                    <p className="mt-1 text-sm font-semibold">
                      {getPreviewLabel(parentSegmentSummary?.proveedorCodigo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sección / específico heredados</p>
                    <p className="mt-1 text-sm font-semibold">
                      {`${getPreviewLabel(parentSegmentSummary?.idSeccionCodigo)} / ${getPreviewLabel(parentSegmentSummary?.especificoCodigo)}`}
                    </p>
                  </div>
                </div>
                <Input
                  value={childBusinessCodePreview}
                  readOnly
                  placeholder="Se genera automáticamente al guardar"
                  className="transition-all duration-200 focus-visible:ring-primary/30"
                />
                <p className="text-xs text-muted-foreground">
                  El hijo hereda proveedor, sección y específico del padre. Solo cambia el surtido y se recalcula el EAN-13.
                </p>
              </div>
            </div>

            {/* Preview de precios calculados */}
            {cantidadEnPack > 0 && precioVenta > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950/30"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                  <Calculator className="h-4 w-4" />
                  Precio calculado para producto individual
                </div>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Precio venta unitario</p>
                    <p className="font-semibold text-purple-700 dark:text-purple-300">
                      ${precioUnitarioCalculado.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Precio costo unitario</p>
                    <p className="font-semibold text-purple-700 dark:text-purple-300">
                      ${precioCostoUnitario.toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {/* Warning si no es divisible exactamente */}
                {!esDivisibleExactamente && (
                  <div className="mt-2 flex items-start gap-2 rounded bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      El precio no se divide exactamente. El precio unitario se redondea al entero más cercano.
                    </span>
                  </div>
                )}

                {/* Info de precio total */}
                {isCompound && (
                  <div className="mt-2 flex items-center gap-2 rounded bg-green-50 p-2 text-xs text-green-700 dark:bg-green-950/30 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      El cliente podrá comprar {cantidadEnPack} unidades individuales a ${precioUnitarioCalculado} 
                      o la caja completa a ${precioVenta}
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
