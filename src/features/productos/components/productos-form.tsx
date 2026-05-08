'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type FieldErrors } from 'react-hook-form'
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
import { CurrencyInput } from '@/components/ui/currency-input'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { sileo } from '@/lib/sileo-shim'

import {
  createProductoAction,
  updateProductoAction,
} from '@/features/productos/actions'
import { useGetUnidadesQuery } from '@/features/unidades'
import { useGetAlmacenesQuery } from '@/features/almacenes'
import { useGetListasPreciosQuery } from '@/features/listas-precios/api/listasPreciosApi'
import { useGetVendorsQuery } from '@/features/vendors'
import {
  useGetCategoriasQuery,
  useGetSubcategoriasQuery,
} from '@/features/categorias'
import {
  buildProductBusinessCodePreview,
  DEFAULT_PARENT_PREVIEW_SURTIDO,
  type ProductBusinessCodeResult,
} from '@/lib/product-business-code'
import { buildPreciosPayload } from './precios-payload'
import { SubcategorySelector } from '@/features/categorias/components/subcategory-selector'
import { ProductPhotoUpload } from './product-photo-upload'
import { ClasificadorInfoNote } from './clasificador-info-note'
import { getAuthToken } from '@/lib/token'
import { mapCategoryToSection, mapSubcategoryToSpecific } from '@/lib/category-mapping'
import type { Vendor } from '@/app/models/model'

export function buildProductosSchema(usaEan13: boolean) {
  return z.object({
    nombre: z
      .string({ required_error: 'El campo Nombre no ha sido rellenado' })
      .min(1, 'El campo Nombre no ha sido rellenado')
      .max(120, 'El nombre no puede superar los 120 caracteres'),
    descripcion: z
      .string()
      .max(300, 'La descripción no puede superar los 300 caracteres')
      .optional()
      .or(z.literal('')),
    codigoInterno: z
      .string({ required_error: 'El código interno es requerido' })
      .min(1, 'El código interno es requerido')
      .regex(/^[0-9]{11}$/, 'El código interno debe contener exactamente 11 números'),
    proveedorCodigo: z.string().optional(),
    vendorId: z.string().optional(),
    categoriaId: z
      .string({ required_error: 'El campo Categoría no ha sido seleccionada' })
      .min(1, 'El campo Categoría no ha sido seleccionada'),
    subcategoriaId: z.string().optional(),
    precioCosto: z.coerce
      .number({
        required_error: 'El campo Precio de costo no ha sido rellenado',
        invalid_type_error: 'El campo Precio de costo no ha sido rellenado',
      })
      .positive('El precio de costo debe ser mayor a 0'),
    precioVenta: z.coerce
      .number({
        required_error: 'El campo Precio de venta no ha sido rellenado',
        invalid_type_error: 'El campo Precio de venta no ha sido rellenado',
      })
      .positive('El precio de venta debe ser mayor a 0'),
    stock: z.coerce
      .number({ invalid_type_error: 'Ingrese un número válido' })
      .int('El stock debe ser un número entero')
      .min(0, 'El stock debe ser mayor o igual a 0'),
    stockMinimo: z.coerce
      .number({ invalid_type_error: 'Ingrese un número válido' })
      .int('El stock mínimo debe ser un número entero')
      .min(0, 'El stock mínimo debe ser mayor o igual a 0'),
    fotos: z.array(z.string()),
    unidadId: z
      .string({ required_error: 'El campo Unidad no ha sido seleccionada' })
      .min(1, 'El campo Unidad no ha sido seleccionada'),
    almacenId: z
      .string({ required_error: 'El campo Almacén no ha sido seleccionado' })
      .min(1, 'El campo Almacén no ha sido seleccionado'),
  }).superRefine((value, ctx) => {
    if (
      value.precioCosto > 0 &&
      value.precioVenta > 0 &&
      value.precioVenta < value.precioCosto
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['precioVenta'],
        message: 'El precio de venta es menor al precio de costo — ¿es correcto?',
      })
    }

    if (!usaEan13) {
      return
    }

    if (!value.vendorId?.trim() && !value.proveedorCodigo?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vendorId'],
        message: 'Seleccione un proveedor para generar el EAN-13',
      })
    }

    if (!value.subcategoriaId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subcategoriaId'],
        message: 'Selecciona una subcategoría para generar el EAN-13',
      })
    }

    if (
      value.proveedorCodigo?.trim() &&
      !/^\d{1,2}$/.test(value.proveedorCodigo.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['proveedorCodigo'],
        message: 'Proveedor debe tener hasta 2 dígitos',
      })
    }
  })
}

export type ProductosFormValues = z.infer<ReturnType<typeof buildProductosSchema>>

function getFirstFormErrorMessage(errors: FieldErrors<ProductosFormValues>): string | null {
  for (const value of Object.values(errors)) {
    if (!value) {
      continue
    }

    if (typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
      return value.message
    }

    if (typeof value === 'object') {
      const nestedMessage = getFirstFormErrorMessage(
        value as FieldErrors<ProductosFormValues>
      )
      if (nestedMessage) {
        return nestedMessage
      }
    }
  }

  return null
}

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
    vendorId?: string | null
    precios?: Array<{
      listaPrecioId: string
      precio: number
    }>
  }
}

/**
 * @description Devuelve un valor legible para previews read-only de segmentos.
 * @param {string | null | undefined} value - Valor actual del segmento.
 * @returns {string} Texto listo para UI.
 */
function formatPreviewValue(value: string | null | undefined): string {
  return value && value.trim() !== '' ? value : 'Pendiente'
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
  const [usaEan13, setUsaEan13] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isEditing = Boolean(initialData)
  const isTaxonomyLocked = usaEan13 && isEditing

  useEffect(() => {
    const token = getAuthToken()
    fetch('/api/mi-empresa', {
      headers: token ? { Authorization: token } : undefined,
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data) => setUsaEan13(data?.usaCodigoEan13 ?? false))
      .catch(() => {})
  }, [])

  const { data: unidades, isLoading: isLoadingUnidades } = useGetUnidadesQuery()
  const { data: almacenes, isLoading: isLoadingAlmacenes } = useGetAlmacenesQuery()
  const { data: listasPrecios } = useGetListasPreciosQuery()
  const { data: categorias = [] } = useGetCategoriasQuery()
  const { data: vendors = [], isLoading: isLoadingVendors } = useGetVendorsQuery()

  const [preciosPorLista, setPreciosPorLista] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {}
    initialData?.precios?.forEach((precio) => {
      initialMap[precio.listaPrecioId] = String(precio.precio)
    })
    return initialMap
  })

  const form = useForm<ProductosFormValues>({
    resolver: zodResolver(buildProductosSchema(usaEan13)),
    defaultValues: {
      nombre: initialData?.nombre || '',
      descripcion: initialData?.descripcion || '',
      codigoInterno: initialData?.codigoInterno || '',
      proveedorCodigo: initialData?.proveedorCodigo || '',
      vendorId: initialData?.vendorId || '',
      categoriaId: initialData?.categoriaId || '',
      subcategoriaId: initialData?.subcategoriaId || '',
      precioCosto: initialData?.precioCosto,
      precioVenta: initialData?.precioVenta,
      stock: initialData?.stock ?? 0,
      stockMinimo: initialData?.stockMinimo ?? 0,
      fotos: initialData?.fotos || [],
      unidadId: initialData?.unidadId || '',
      almacenId: initialData?.almacenId || '',
    },
  })

  const watchedCategoryId = form.watch('categoriaId')
  const watchedSubcategoryId = form.watch('subcategoriaId')
  const watchedProveedorCodigo = form.watch('proveedorCodigo')
  const watchedVendorId = form.watch('vendorId')

  const { data: subcategorias = [] } = useGetSubcategoriasQuery(watchedCategoryId, {
    skip: !watchedCategoryId,
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

  const vendorOptions = (vendors as Array<Vendor & { proveedorCodigo?: string | null }>) ?? []
  const selectedVendor = vendorOptions.find((vendor) => vendor.vendorId === watchedVendorId)
  const selectedVendorProviderCode = selectedVendor?.proveedorCodigo?.trim() || ''

  const selectedCategory = categorias.find((categoria) => categoria.catId === watchedCategoryId)
  const selectedSubcategory = subcategorias.find(
    (subcategoria) => subcategoria.catId === watchedSubcategoryId
  )

  let parentCodePreview: ProductBusinessCodeResult | null = null
  if (!isEditing && selectedCategory?.nombre && selectedSubcategory?.nombre) {
    try {
      parentCodePreview = buildProductBusinessCodePreview({
        proveedorCodigo: selectedVendorProviderCode || watchedProveedorCodigo || '',
        categoriaNombre: selectedCategory.nombre,
        subcategoriaNombre: selectedSubcategory.nombre,
        surtidoCodigo: DEFAULT_PARENT_PREVIEW_SURTIDO,
      })
    } catch {
      parentCodePreview = null
    }
  }

  const watchedParentSegments = {
    proveedorCodigo:
      parentCodePreview?.proveedorCodigo ||
      initialData?.proveedorCodigo ||
      selectedVendorProviderCode ||
      watchedProveedorCodigo ||
      '',
    idSeccionCodigo: parentCodePreview?.idSeccionCodigo || initialData?.idSeccionCodigo || '',
    especificoCodigo: parentCodePreview?.especificoCodigo || initialData?.especificoCodigo || '',
  }

  async function onSubmit(data: ProductosFormValues) {
    setIsLoading(true)

    try {
       if (initialData) {
         const resolvedProveedorCodigo = selectedVendorProviderCode || data.proveedorCodigo

         if (usaEan13) {
           if (!resolvedProveedorCodigo) {
             form.setError('vendorId', {
               type: 'manual',
               message: 'El proveedor seleccionado no tiene código configurado para generar el EAN-13',
             })
             sileo.error({ title: 'Seleccioná un proveedor con código configurado para generar el EAN-13.' })
             return
           }
         }

         const payload: any = {
           nombre: data.nombre,
           descripcion: data.descripcion || null,
           codigoInterno: data.codigoInterno || null,
           proveedorCodigo: usaEan13 ? (resolvedProveedorCodigo || null) : null,
           vendorId: data.vendorId || null,
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

        const result = await updateProductoAction({
          id: initialData.id,
          ...payload,
        })
        if (result.success) {
          sileo.success({ title: 'El producto ha sido actualizado exitosamente.' })
        } else {
          throw new Error(result.error?.message || 'Error al actualizar')
        }
      } else {
        const resolvedProveedorCodigo = selectedVendorProviderCode || watchedProveedorCodigo

        if (usaEan13) {
          if (!resolvedProveedorCodigo) {
            form.setError('vendorId', {
              type: 'manual',
              message: 'El proveedor seleccionado no tiene código configurado para generar el EAN-13',
            })
            sileo.error({ title: 'Seleccioná un proveedor con código configurado para generar el EAN-13.' })
            return
          }
        }

        const payload: any = {
          nombre: data.nombre,
          descripcion: data.descripcion,
          codigoInterno: data.codigoInterno || null,
          proveedorCodigo: usaEan13 ? (resolvedProveedorCodigo || null) : null,
          vendorId: data.vendorId || null,
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

        const result = await createProductoAction(payload)
        if (result.success) {
          sileo.success({ title: 'El producto ha sido registrado exitosamente.' })
        } else {
          throw new Error(result.error?.message || 'Error al crear')
        }
      }

      router.push('/busy/products')
      router.refresh()
    } catch (error) {
      console.error('Error al guardar el producto:', error)
      
      // Extraer mensaje de error del servidor
      let errorMessage = 'Hubo un error al guardar el producto.'
      
      if (error && typeof error === 'object') {
        const err = error as any
        
        // Si viene del RTK Query error
        if (err.data?.error) {
          errorMessage = err.data.error
        }
        // Si es un objeto con propiedad message
        else if (err.message) {
          errorMessage = err.message
        }
        // Si es una respuesta HTTP
        else if (err.status && err.data) {
          errorMessage = JSON.stringify(err.data)
        }
      }
      
      sileo.error({ title: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingUnidades || isLoadingAlmacenes || isLoadingVendors) {
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
      <Card className="overflow-hidden border-dashed bg-linear-to-br from-primary/5 via-background to-purple-500/8 dark:from-primary/10 dark:to-purple-500/10">
        <CardContent className="pt-6">
          <motion.div
            className="mb-7 flex items-start gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <motion.div
              className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-600 text-white shadow-lg"
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
              <form
                onSubmit={form.handleSubmit(onSubmit, (errors) => {
                  sileo.error({
                    title:
                      getFirstFormErrorMessage(errors) ||
                      'Completa los campos requeridos antes de continuar.',
                  })
                })}
                className="space-y-6"
              >
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
                        <FormLabel>Descripción <span className="text-muted-foreground text-xs">(opcional)</span></FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Descripción corta del producto"
                            disabled={isLoading}
                            className="transition-all duration-200 focus-visible:ring-primary/30"
                            {...field}
                            value={field.value ?? ''}
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
                          Requerido. Debe contener exactamente 11 números.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Selector de proveedor — siempre visible */}
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proveedor</FormLabel>
                        <Select
                          value={field.value || ''}
                          onValueChange={(value) => {
                            field.onChange(value)
                            const nextVendor = vendorOptions.find((vendor) => vendor.vendorId === value)
                            form.setValue('proveedorCodigo', nextVendor?.proveedorCodigo || '', {
                              shouldValidate: true,
                              shouldDirty: true,
                            })
                            form.clearErrors(['vendorId', 'proveedorCodigo'])
                          }}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger className="transition-all duration-200 focus-visible:ring-primary/30">
                              <SelectValue placeholder="Selecciona un proveedor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vendorOptions.map((vendor) => (
                              <SelectItem key={vendor.vendorId} value={vendor.vendorId}>
                                {vendor.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {usaEan13
                            ? 'Selecciona un proveedor activo. El sistema toma su código configurado y genera el EAN-13.'
                            : 'Proveedor del producto (opcional).'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* EAN-13: campos al editar */}
                  {usaEan13 && isEditing && (
                    <>
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

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <FormItem>
                          <FormLabel>Sección (2)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              value={initialData?.idSeccionCodigo || ''}
                              readOnly
                              placeholder="Se autogenera"
                              className="bg-muted"
                            />
                          </FormControl>
                          <FormDescription>No editable. Auto-generado por categoría.</FormDescription>
                        </FormItem>
                        <FormItem>
                          <FormLabel>Específico (4)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              value={initialData?.especificoCodigo || ''}
                              readOnly
                              placeholder="Se autogenera"
                              className="bg-muted"
                            />
                          </FormControl>
                          <FormDescription>No editable. Auto-generado por subcategoría.</FormDescription>
                        </FormItem>
                        <FormItem>
                          <FormLabel>Surtido (4)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              value={initialData?.surtidoCodigo || ''}
                              readOnly
                              placeholder="Se autogenera"
                              className="bg-muted"
                            />
                          </FormControl>
                          <FormDescription>No editable. Secuencial por sección.</FormDescription>
                        </FormItem>
                      </div>

                      <FormItem>
                        <FormLabel>Código de negocio (EAN-13)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            value={initialData?.codigoNegocio || ''}
                            readOnly
                            placeholder="Se autogenera"
                            className="bg-muted font-mono"
                          />
                        </FormControl>
                        <FormDescription>
                          El código EAN-13 se genera a partir de los segmentos. Se puede cambiar el proveedor sin recalcular automáticamente.
                        </FormDescription>
                      </FormItem>
                    </>
                  )}

                  {/* EAN-13: preview de segmentos al crear */}
                  {usaEan13 && !isEditing && (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-dashed p-4">
                          <p className="text-xs font-medium text-muted-foreground">Proveedor</p>
                          <p className="mt-2 text-sm font-semibold">
                            {formatPreviewValue(watchedParentSegments.proveedorCodigo)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-dashed p-4">
                          <p className="text-xs font-medium text-muted-foreground">Sección</p>
                          <p className="mt-2 text-sm font-semibold">
                            {formatPreviewValue(parentCodePreview?.idSeccionCodigo)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-dashed p-4">
                          <p className="text-xs font-medium text-muted-foreground">Específico</p>
                          <p className="mt-2 text-sm font-semibold">
                            {formatPreviewValue(parentCodePreview?.especificoCodigo)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-dashed p-4">
                          <p className="text-xs font-medium text-muted-foreground">Surtido inicial</p>
                          <p className="mt-2 text-sm font-semibold">
                            {formatPreviewValue(parentCodePreview?.surtidoCodigo)}
                          </p>
                        </div>
                      </div>

                      <FormItem>
                        <FormLabel htmlFor="codigoNegocioPreview">Código de negocio (preview)</FormLabel>
                        <FormControl>
                          <Input
                            id="codigoNegocioPreview"
                            type="text"
                            value={parentCodePreview?.codigoNegocio || ''}
                            readOnly
                            placeholder="Se genera cuando completes proveedor, categoría y subcategoría"
                          />
                        </FormControl>
                        <FormDescription>
                          Preview referencial. El surtido real se valida y asigna al guardar.
                        </FormDescription>
                      </FormItem>
                    </>
                  )}
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
                            if (usaEan13) {
                              form.setError('subcategoriaId', {
                                type: 'manual',
                                message: 'Selecciona una subcategoría para generar el EAN-13',
                              })
                            } else {
                              form.clearErrors('subcategoriaId')
                            }
                            if (usaEan13 && categoryId) {
                              const cat = categorias.find((c) => c.catId === categoryId)
                              if (cat) {
                                try {
                                  mapCategoryToSection(cat.nombre)
                                  form.clearErrors('categoriaId')
                                } catch {
                                  form.setError('categoriaId', {
                                    type: 'manual',
                                    message:
                                      'Categoría no encontrada en el Clasificador oficial CLAS — revisá el documento antes de crear Secciones y Específicos',
                                  })
                                }
                              }
                            } else {
                              form.clearErrors('categoriaId')
                            }
                          }}
                          onSubcategoryChange={(subcategoryId) => {
                            form.setValue('subcategoriaId', subcategoryId || '', {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                            if (usaEan13 && subcategoryId) {
                              const sub = subcategorias.find((s) => s.catId === subcategoryId)
                              if (sub) {
                                try {
                                  mapSubcategoryToSpecific(sub.nombre)
                                  form.clearErrors('subcategoriaId')
                                } catch {
                                  form.setError('subcategoriaId', {
                                    type: 'manual',
                                    message:
                                      'Subcategoría no encontrada en el Clasificador oficial CLAS — revisá el documento antes de crear Secciones y Específicos',
                                  })
                                }
                              }
                            } else if (usaEan13) {
                              form.setError('subcategoriaId', {
                                type: 'manual',
                                message: 'Selecciona una subcategoría para generar el EAN-13',
                              })
                            } else {
                              form.clearErrors('subcategoriaId')
                            }
                          }}
                          required={usaEan13}
                          showLabels
                          disabled={isLoading || isTaxonomyLocked}
                        />
                        <FormDescription>
                          {isTaxonomyLocked
                            ? 'La categoría y la subcategoría quedan bloqueadas cuando el producto ya tiene EAN-13 emitido.'
                            : usaEan13
                            ? 'Selecciona una categoría y una subcategoría para generar el EAN-13.'
                            : 'Selecciona una categoría y, opcionalmente, una subcategoría.'}
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
                           Precio de costo <span className="text-destructive">*</span>
                         </FormLabel>
                         <FormControl>
                           <CurrencyInput
                             disabled={isLoading}
                             value={field.value ?? ''}
                             onChange={field.onChange}
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
                           Precio de venta <span className="text-destructive">*</span>
                         </FormLabel>
                         <FormControl>
                           <CurrencyInput
                             disabled={isLoading}
                             value={field.value ?? ''}
                             onChange={field.onChange}
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

                  <div className="rounded-xl border border-dashed bg-linear-to-br from-primary/5 to-purple-500/8 dark:from-primary/10 dark:to-purple-500/10 p-4">
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
                           <CurrencyInput
                             value={preciosPorLista[lista.id] ?? ''}
                             onChange={(newValue) =>
                               setPreciosPorLista((prev) => ({
                                 ...prev,
                                 [lista.id]: newValue,
                               }))
                             }
                             disabled={isLoading}
                             placeholder={`Base: ${Number(form.watch('precioVenta') || 0).toFixed(2)}`}
                           />
                         </div>
                       ))}
                     </div>
                  </motion.div>
                )}

                {usaEan13 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.42 }}
                  >
                    <ClasificadorInfoNote />
                  </motion.div>
                )}

                <motion.div
                  className="flex flex-col justify-end gap-3 border-t pt-4 sm:flex-row"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => startTransition(() => router.push('/busy/products'))}
                    disabled={isLoading || isPending}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Cancelar
                  </Button>

                  <motion.div whileHover={{ scale: (isLoading || isPending) ? 1 : 1.02 }}>
                    <Button
                      type="submit"
                      disabled={isLoading || isPending}
                      className="cursor-pointer min-w-42.5 gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                    >
                      {isLoading || isPending ? (
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
