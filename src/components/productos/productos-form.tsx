'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { motion } from 'framer-motion'
import {
  Boxes,
  Sparkles,
  ArrowLeft,
  Loader2,
  Info,
  DollarSign,
  Package,
  Warehouse,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

import {
  useAddProductoMutation,
  useUpdateProductoMutation,
} from '@/lib/redux/services/productosApi'
import { useGetUnidadesQuery } from '@/lib/redux/services/unidadesApi'
import { useGetAlmacenesQuery } from '@/lib/redux/services/almacenesApi'
import { useGetListasPreciosQuery } from '@/lib/redux/services/listasPreciosApi'
import { buildPreciosPayload } from './precios-payload'
import { SubcategorySelector } from '@/components/categorias/subcategory-selector'
import { ProductPhotoUpload } from './product-photo-upload'
import { generateEan13BusinessCode } from '@/lib/ean13-utils'
import { CompoundProductSection } from './compound-product-section'

const productosSchema = z.object({
  nombre: z.string({
    required_error: 'Escriba un nombre',
  }),
  descripcion: z.string({
    required_error: 'Escriba una descripción',
  }),
  codigoInterno: z
    .string()
    .optional()
    .refine((value) => !value || /^[0-9]{11}$/.test(value), {
      message: 'El código interno debe contener exactamente 11 números',
    }),
  proveedorCodigo: z.string().regex(/^\d{1,2}$/, {
    message: 'Proveedor debe tener hasta 2 dígitos',
  }),
  idSeccionCodigo: z.string().regex(/^\d{1,2}$/, {
    message: 'Id Sección debe tener hasta 2 dígitos',
  }),
  especificoCodigo: z.string().regex(/^\d{1,4}$/, {
    message: 'Específico debe tener hasta 4 dígitos',
  }),
  surtidoCodigo: z.string().regex(/^\d{1,4}$/, {
    message: 'Surtido debe tener hasta 4 dígitos',
  }),
  categoriaId: z.string({
    required_error: 'Seleccione una categoría',
  }),
  subcategoriaId: z.string().optional(),
  precioCosto: z.coerce.number().positive({
    message: 'El precio de costo debe ser mayor a 0',
  }),
  precioVenta: z.coerce.number().positive({
    message: 'El precio de venta debe ser mayor a 0',
  }),
  stock: z.coerce.number().min(0, {
    message: 'El stock debe ser mayor o igual a 0',
  }),
  stockMinimo: z.coerce.number().min(0, {
    message: 'El stock mínimo debe ser mayor o igual a 0',
  }),
  fotos: z.array(z.string()),
  unidadId: z.string({
    required_error: 'Seleccione una unidad',
  }),
  almacenId: z.string({
    required_error: 'Seleccione un almacén',
  }),
  // Campos de producto compuesto
  esCompuesto: z.boolean().optional(),
  cantidadEnPack: z.number().optional(),
  nombreHijo: z.string().optional(),
  codigoNegocioHijo: z.string().optional(),
})

export type ProductosFormValues = z.infer<typeof productosSchema>

interface ProductosFormProps {
  initialData?: {
    id: string
    nombre: string
    descripcion: string | null
    codigoInterno?: string | null
    codigoNegocio?: string | null
    proveedorCodigo?: string | null
    idSeccionCodigo?: string | null
    especificoCodigo?: string | null
    surtidoCodigo?: string | null
    categoriaId: string
    subcategoriaId?: string
    precioCosto: number
    precioVenta: number
    stock: number
    stockMinimo: number
    fotos: string[]
    unidadId: string
    almacenId: string
    // Campos de producto compuesto
    esCompuesto?: boolean
    cantidadEnPack?: number | null
    precios?: Array<{
      listaPrecioId: string
      precio: number
    }>
  }
}

function PulseSkeleton({ className }: { className?: string }): React.JSX.Element {
  return (
    <motion.div
      className={`bg-muted rounded ${className}`}
      animate={{ opacity: [0.45, 0.8, 0.45] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

/**
 * @description Formulario de creación/edición de productos con layout visual consistente.
 * @param {ProductosFormProps} props - Datos iniciales para modo edición.
 * @returns {JSX.Element} Formulario de producto.
 */
export function ProductoForm({ initialData }: ProductosFormProps): React.JSX.Element {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const { data: unidades, isLoading: isLoadingUnidades } = useGetUnidadesQuery()
  const { data: almacenes, isLoading: isLoadingAlmacenes } = useGetAlmacenesQuery()
  const { data: listasPrecios } = useGetListasPreciosQuery()
  const [preciosPorLista, setPreciosPorLista] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {}
    initialData?.precios?.forEach((precio) => {
      initialMap[precio.listaPrecioId] = String(precio.precio)
    })
    return initialMap
  })

  const [addProducto] = useAddProductoMutation()
  const [updateProducto] = useUpdateProductoMutation()

  const form = useForm<ProductosFormValues>({
    resolver: zodResolver(productosSchema),
    defaultValues: {
      nombre: initialData?.nombre || '',
      descripcion: initialData?.descripcion || '',
      codigoInterno: initialData?.codigoInterno || '',
      proveedorCodigo: initialData?.proveedorCodigo || '',
      idSeccionCodigo: initialData?.idSeccionCodigo || '',
      especificoCodigo: initialData?.especificoCodigo || '',
      surtidoCodigo: initialData?.surtidoCodigo || '',
      categoriaId: initialData?.categoriaId || '',
      subcategoriaId: initialData?.subcategoriaId || '',
      precioCosto: initialData?.precioCosto ?? 0,
      precioVenta: initialData?.precioVenta ?? 0,
      stock: initialData?.stock ?? 0,
      stockMinimo: initialData?.stockMinimo ?? 0,
      fotos: initialData?.fotos || [],
      unidadId: initialData?.unidadId || '',
      almacenId: initialData?.almacenId || '',
      // Valores por defecto para producto compuesto
      esCompuesto: initialData?.esCompuesto || false,
      cantidadEnPack: initialData?.cantidadEnPack ?? undefined,
      nombreHijo: '',
      codigoNegocioHijo: '',
    },
  })

  const stockValue = Number(form.watch('stock') || 0)
  const stockMinimoValue = Number(form.watch('stockMinimo') || 0)
  const umbral = stockMinimoValue > 0 ? stockMinimoValue : 10
  const estadoStock =
    stockValue === 0
      ? 'Sin stock'
      : stockValue <= umbral
      ? 'Stock bajo'
      : 'Stock normal'

  const watchedSegments = {
    proveedorCodigo: form.watch('proveedorCodigo'),
    idSeccionCodigo: form.watch('idSeccionCodigo'),
    especificoCodigo: form.watch('especificoCodigo'),
    surtidoCodigo: form.watch('surtidoCodigo'),
  }

  let eanPreview = ''
  try {
    eanPreview = generateEan13BusinessCode(watchedSegments).codigoNegocio
  } catch {
    eanPreview = ''
  }

  async function onSubmit(data: ProductosFormValues) {
    setIsLoading(true)

    try {
      if (initialData) {
        await updateProducto({
          id: initialData.id,
          ...data,
          precios: buildPreciosPayload(preciosPorLista),
        }).unwrap()
        toast('El producto ha sido actualizado exitosamente.')
      } else {
        // Construir payload para producto normal o compuesto
        const payload: any = {
          nombre: data.nombre,
          descripcion: data.descripcion,
          codigoInterno: data.codigoInterno || null,
          proveedorCodigo: data.proveedorCodigo,
          idSeccionCodigo: data.idSeccionCodigo,
          especificoCodigo: data.especificoCodigo,
          surtidoCodigo: data.surtidoCodigo,
          precioCosto: data.precioCosto,
          precioVenta: data.precioVenta,
          stock: data.stock,
          stockMinimo: data.stockMinimo ?? 0,
          fotos: data.fotos ?? [],
          categoriaId: data.categoriaId,
          subcategoriaId: data.subcategoriaId || null,
          unidadId: data.unidadId,
          almacenId: data.almacenId,
          precios: buildPreciosPayload(preciosPorLista),
        }

        // Agregar campos de producto compuesto si está marcado
        if (data.esCompuesto === true && data.cantidadEnPack && data.nombreHijo && data.codigoNegocioHijo) {
          payload.esCompuesto = true
          payload.cantidadEnPack = data.cantidadEnPack
          payload.nombreHijo = data.nombreHijo
          payload.codigoNegocioHijo = data.codigoNegocioHijo
        }

        await addProducto(payload).unwrap()
        toast('El producto ha sido registrado exitosamente.')
      }

      router.push('/busy/products')
      router.refresh()
    } catch (error) {
      console.error('Error al guardar el producto:', error)
      toast('Hubo un error al guardar el producto.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingUnidades || isLoadingAlmacenes) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="overflow-hidden border-dashed">
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-center gap-3">
              <PulseSkeleton className="h-10 w-10 rounded-xl" />
              <PulseSkeleton className="h-6 w-60" />
            </div>
            <PulseSkeleton className="h-12 w-full" />
            <PulseSkeleton className="h-12 w-full" />
            <PulseSkeleton className="h-24 w-full" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PulseSkeleton className="h-12 w-full" />
              <PulseSkeleton className="h-12 w-full" />
            </div>
            <div className="flex justify-end gap-3">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-40" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <Card className="overflow-hidden border-dashed bg-gradient-to-br from-primary/[0.05] via-background to-purple-500/[0.08] dark:from-primary/10 dark:to-purple-500/10">
        <CardContent className="pt-6">
          <motion.div
            className="mb-7 flex items-start gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <motion.div
              className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-600 text-white shadow-lg"
              whileHover={{ scale: 1.05, rotate: 4 }}
              transition={{ duration: 0.2 }}
            >
              <Boxes className="h-5 w-5" />
              <motion.span
                className="absolute -right-1 -top-1"
                animate={{ rotate: 360, scale: [1, 1.15, 1] }}
                transition={{
                  rotate: { duration: 18, repeat: Infinity, ease: 'linear' },
                  scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                }}
              >
                <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              </motion.span>
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold">
                {initialData ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {initialData
                  ? 'Actualiza datos de inventario, precios y clasificación del producto.'
                  : 'Registra un producto nuevo con categoría, precios y stock inicial.'}
              </p>
            </div>
          </motion.div>

          <TooltipProvider>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <motion.div
                  className="grid grid-cols-1 gap-4 md:grid-cols-3"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Ej: Arroz premium 1kg"
                            disabled={isLoading}
                            className="transition-all duration-200 focus-visible:ring-primary/30"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Nombre comercial del producto.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Descripción corta del producto"
                            disabled={isLoading}
                            className="transition-all duration-200 focus-visible:ring-primary/30"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Información útil para identificar el producto.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="codigoInterno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código interno</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            maxLength={11}
                            placeholder="Ej: 12345678901"
                            disabled={isLoading}
                            className="transition-all duration-200 focus-visible:ring-primary/30"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Opcional. Debe contener 11 números únicos.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="proveedorCodigo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Proveedor (2)</FormLabel>
                          <FormControl>
                            <Input type="text" inputMode="numeric" maxLength={2} disabled={isLoading} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="idSeccionCodigo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Id Sección (2)</FormLabel>
                          <FormControl>
                            <Input type="text" inputMode="numeric" maxLength={2} disabled={isLoading} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="especificoCodigo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Específico (4)</FormLabel>
                          <FormControl>
                            <Input type="text" inputMode="numeric" maxLength={4} disabled={isLoading} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="surtidoCodigo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Surtido (4)</FormLabel>
                          <FormControl>
                            <Input type="text" inputMode="numeric" maxLength={4} disabled={isLoading} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormItem>
                    <FormLabel>Código de negocio (EAN-13)</FormLabel>
                    <FormControl>
                      <Input type="text" value={eanPreview} readOnly placeholder="Se autogenera" />
                    </FormControl>
                    <FormDescription>Autogenerado: Proveedor(2)+IdSección(2)+Específico(4)+Surtido(4)+DC(1)</FormDescription>
                  </FormItem>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <FormField
                    control={form.control}
                    name="fotos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Foto del producto</FormLabel>
                        <FormControl>
                          <ProductPhotoUpload
                            photos={field.value || []}
                            onPhotosChange={field.onChange}
                            maxPhotos={1}
                          />
                        </FormControl>
                        <FormDescription>
                          Adjunta una imagen opcional (máximo 2MB).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <FormField
                    control={form.control}
                    name="categoriaId"
                    render={({ field }) => (
                      <FormItem>
                        <SubcategorySelector
                          selectedCategoryId={field.value}
                          selectedSubcategoryId={form.watch('subcategoriaId')}
                          onCategoryChange={(categoryId) => {
                            field.onChange(categoryId)
                            form.setValue('subcategoriaId', '')
                          }}
                          onSubcategoryChange={(subcategoryId) => {
                            form.setValue('subcategoriaId', subcategoryId || '')
                          }}
                          required
                          showLabels
                          disabled={isLoading}
                        />
                        <FormDescription>
                          Selecciona una categoría y, opcionalmente, una subcategoría.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div
                  className="grid grid-cols-1 gap-4 md:grid-cols-2"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <FormField
                    control={form.control}
                    name="precioCosto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          Precio de costo
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            disabled={isLoading}
                            className="transition-all duration-200 focus-visible:ring-primary/30"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Monto de compra por unidad.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="precioVenta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          Precio de venta
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            disabled={isLoading}
                            className="transition-all duration-200 focus-visible:ring-primary/30"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Monto de venta por unidad.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div
                  className="grid grid-cols-1 gap-4 md:grid-cols-3"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          Stock inicial
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            disabled={isLoading}
                            className="transition-all duration-200 focus-visible:ring-primary/30"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Cantidad disponible al registrar.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stockMinimo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Stock mínimo
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Si colocas 0, se usa el umbral por defecto de 10.</p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            disabled={isLoading}
                            className="transition-all duration-200 focus-visible:ring-primary/30"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Umbral para alertas de inventario bajo.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unidadId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidad</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger className="transition-all duration-200 focus-visible:ring-primary/30">
                              <SelectValue placeholder="Selecciona una unidad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unidades?.map((unidad) => (
                              <SelectItem key={unidad.unidadId} value={unidad.unidadId}>
                                {unidad.nombre} ({unidad.simbolo})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Unidad de medida del producto.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div
                  className="grid grid-cols-1 gap-4 md:grid-cols-2"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <FormField
                    control={form.control}
                    name="almacenId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Warehouse className="h-4 w-4 text-muted-foreground" />
                          Almacén inicial
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger className="transition-all duration-200 focus-visible:ring-primary/30">
                              <SelectValue placeholder="Selecciona un almacén" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {almacenes?.map((almacen) => (
                              <SelectItem key={almacen.almacenId} value={almacen.almacenId}>
                                {almacen.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Ubicación principal para el stock inicial.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-xl border border-dashed bg-gradient-to-br from-primary/[0.05] to-purple-500/[0.08] dark:from-primary/10 dark:to-purple-500/10 p-4">
                    <p className="text-sm font-semibold">Estado de inventario estimado</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Con los valores actuales, el sistema marcará este producto como:
                    </p>
                    <p
                      className={`mt-2 text-sm font-semibold ${
                        estadoStock === 'Sin stock'
                          ? 'text-destructive'
                          : estadoStock === 'Stock bajo'
                          ? 'text-amber-500'
                          : 'text-emerald-500'
                      }`}
                    >
                      {estadoStock}
                    </p>
                  </div>
                </motion.div>

                {listasPrecios && listasPrecios.length > 0 && (
                  <motion.div
                    className="space-y-3 rounded-xl border border-dashed p-4"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.43 }}
                  >
                    <p className="text-sm font-semibold">Precios por lista</p>
                    <p className="text-xs text-muted-foreground">
                      Si dejas vacío un campo, el sistema usará el precio base de venta.
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {listasPrecios.map((lista) => (
                        <div key={lista.id} className="space-y-1">
                          <label className="text-xs text-muted-foreground">{lista.nombre}</label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder={`Base: ${Number(form.watch('precioVenta') || 0).toFixed(2)}`}
                            value={preciosPorLista[lista.id] ?? ''}
                            onChange={(event) =>
                              setPreciosPorLista((prev) => ({
                                ...prev,
                                [lista.id]: event.target.value,
                              }))
                            }
                            disabled={isLoading}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Sección de producto compuesto */}
                <CompoundProductSection disabled={isLoading || !!initialData} />

                <motion.div
                  className="flex flex-col justify-end gap-3 border-t pt-4 sm:flex-row"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <motion.div whileHover={{ scale: isLoading ? 1 : 1.02 }} whileTap={{ scale: isLoading ? 1 : 0.98 }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push('/busy/products')}
                      disabled={isLoading}
                      className="gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Cancelar
                    </Button>
                  </motion.div>

                  <motion.div whileHover={{ scale: isLoading ? 1 : 1.02 }} whileTap={{ scale: isLoading ? 1 : 0.98 }}>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="min-w-[170px] gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {initialData ? 'Actualizando...' : 'Creando...'}
                        </>
                      ) : initialData ? (
                        'Actualizar producto'
                      ) : (
                        'Crear producto'
                      )}
                    </Button>
                  </motion.div>
                </motion.div>
              </form>
            </Form>
          </TooltipProvider>
        </CardContent>
      </Card>
    </motion.div>
  )
}
