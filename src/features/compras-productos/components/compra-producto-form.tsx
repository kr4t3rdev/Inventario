'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { sileo } from '@/lib/sileo-shim'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Sparkles, Loader2, Plus, Trash2, Package } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

import { ProductPhotoUpload } from '@/components/productos/product-photo-upload'
import type { Producto, Vendor } from '@/app/models/model'
import { useGetVendorsQuery } from '@/features/vendors/api/vendorsApi'
import { useGetProductosQuery } from '@/features/productos/api/productosApi'
import { useCreateCompraProductoMutation } from '@/features/compras-productos/api/comprasProductosApi'
import { useGetAnticiposDisponiblesQuery } from '@/features/contabilidad/api/contabilidadApi'
import { FORMA_PAGO_ANTICIPO_PAGO } from '@/lib/constants/anticipos'

const itemSchema = z.object({
  productoId: z.string().min(1, 'Seleccione un producto'),
  precioCosto: z.coerce.number().positive('El precio de costo debe ser mayor a 0'),
  cantidad: z.coerce.number().int('La cantidad debe ser un entero').positive('La cantidad debe ser mayor a 0'),
})

const compraDocumentoSchema = z.object({
  proveedorId: z.string().min(1, 'Seleccione un proveedor'),
  numeroFactura: z.string().optional().default(''),
  facturaUrl: z.string().optional().default(''),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO', FORMA_PAGO_ANTICIPO_PAGO]),
  estado: z.enum(['PENDIENTE', 'PAGADA']),
  descripcionCompra: z.string().max(500).optional().default(''),
  fechaVencimiento: z.string().optional().default(''),
  anticipoPagoId: z.string().optional().default(''),
  items: z.array(itemSchema).min(1, 'Agregue al menos un producto'),
}).refine(
  (data) => {
    if (data.formaPago === 'PAGO_COMPLETO' || data.formaPago === FORMA_PAGO_ANTICIPO_PAGO) {
      return data.estado === 'PAGADA'
    }
    return data.estado === 'PENDIENTE'
  },
  {
    message: 'El estado no coincide con la forma de pago',
    path: ['estado']
  }
).refine(
  (data) => {
    if (data.formaPago !== FORMA_PAGO_ANTICIPO_PAGO) {
      return true
    }
    return !!data.anticipoPagoId
  },
  {
    message: 'Seleccione un anticipo para completar la compra',
    path: ['anticipoPagoId']
  }
)

type CompraDocumentoFormValues = z.input<typeof compraDocumentoSchema>

interface CompraProductoFormProps {
  onSuccess?: () => void
}

/**
 * @description Formulario para registrar compras múltiples de productos.
 * Permite agregar N productos con cantidades y costos individuales.
 * @param {CompraProductoFormProps} props - Props del componente
 * @returns {JSX.Element} Formulario de compra múltiple
 */
export function CompraProductoForm({ onSuccess }: CompraProductoFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const anticiposFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_ANTICIPOS !== 'false'

  const { data: products, isLoading: isLoadingProducts } = useGetProductosQuery()
  const { data: vendors, isLoading: isLoadingVendors } = useGetVendorsQuery()
  const [createCompraProducto] = useCreateCompraProductoMutation()

  const form = useForm<CompraDocumentoFormValues>({
    resolver: zodResolver(compraDocumentoSchema),
    defaultValues: {
      proveedorId: '',
      numeroFactura: '',
      facturaUrl: '',
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      descripcionCompra: '',
      fechaVencimiento: '',
      anticipoPagoId: '',
      items: [{ productoId: '', precioCosto: '' as unknown as number, cantidad: 1 }],
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const formaPagoSeleccionada = form.watch('formaPago')
  const proveedorSeleccionado = form.watch('proveedorId')
  const items = useWatch({ control: form.control, name: 'items' }) ?? []

  const productosCatalogo = useMemo<Producto[]>(
    () => (Array.isArray(products) ? products : []),
    [products]
  )
  const proveedoresCatalogo = useMemo<Vendor[]>(
    () => (Array.isArray(vendors) ? vendors : []),
    [vendors]
  )
  const productosComprables = useMemo<Producto[]>(
    () => productosCatalogo.filter((product) => !product.productoPadreId),
    [productosCatalogo]
  )

  const productoLookup = useMemo(() => {
    const map = new Map<string, Producto>()
    for (const product of productosCatalogo) {
      map.set(product.id, product)
    }
    return map
  }, [productosCatalogo])

  const { data: anticiposDisponibles, isFetching: isLoadingAnticipos } = useGetAnticiposDisponiblesQuery(
    {
      contexto: 'compra',
      proveedorId: proveedorSeleccionado || undefined,
      moneda: 'CUP'
    },
    {
      skip: !anticiposFeatureEnabled || formaPagoSeleccionada !== FORMA_PAGO_ANTICIPO_PAGO || !proveedorSeleccionado
    }
  )

  // Calcular monto total estimado (con parsing robusto)
  const montoEstimadoCompra = useMemo(() => {
    return items.reduce((sum, item) => {
      const costo = parseFloat(String(item.precioCosto)) || 0
      const cant = parseInt(String(item.cantidad), 10) || 0
      return sum + (costo * cant)
    }, 0)
  }, [items])

  // Contar items válidos
  const itemsValidos = useMemo(() => {
    return items.filter((item) => {
      const costo = parseFloat(String(item.precioCosto)) || 0
      const cant = parseInt(String(item.cantidad), 10) || 0
      return costo > 0 && cant > 0
    }).length
  }, [items])

  useEffect(() => {
    if (!formaPagoSeleccionada) return
    const nextEstado =
      formaPagoSeleccionada === 'PAGO_COMPLETO' || formaPagoSeleccionada === FORMA_PAGO_ANTICIPO_PAGO
        ? 'PAGADA'
        : 'PENDIENTE'
    form.setValue('estado', nextEstado, { shouldValidate: true })
    if (formaPagoSeleccionada !== FORMA_PAGO_ANTICIPO_PAGO) {
      form.setValue('anticipoPagoId', '')
    }
  }, [formaPagoSeleccionada, form])

  const handleProductoChange = useCallback((index: number, productoId: string) => {
    const producto = productoLookup.get(productoId)
    if (!producto) return

    // Auto-fill proveedor si está vacío o si todos los items son del mismo proveedor
    const selectedVendorId = typeof producto.vendorId === 'string' ? producto.vendorId : ''
    if (selectedVendorId) {
      const currentVendor = form.getValues('proveedorId')
      if (!currentVendor) {
        form.setValue('proveedorId', selectedVendorId, { shouldValidate: true })
      }
    }

    // Auto-fill precio costo
    const selectedPrecioCosto = Number(producto.precioCosto ?? 0)
    if (selectedPrecioCosto > 0) {
      form.setValue(`items.${index}.precioCosto`, selectedPrecioCosto, { shouldValidate: true })
    }
  }, [productoLookup, form])

  const addItem = useCallback(() => {
    append({ productoId: '', precioCosto: '' as unknown as number, cantidad: 1 })
  }, [append])

  const removeItem = useCallback((index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }, [fields.length, remove])

  async function onSubmit(data: CompraDocumentoFormValues) {
    setIsLoading(true)
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`

      const result = await createCompraProducto({
        ...data,
        estado:
          data.formaPago === 'PAGO_COMPLETO' || data.formaPago === FORMA_PAGO_ANTICIPO_PAGO
            ? 'PAGADA'
            : 'PENDIENTE',
        fechaVencimiento: data.fechaVencimiento || undefined,
        anticipoPagoId: data.formaPago === FORMA_PAGO_ANTICIPO_PAGO ? data.anticipoPagoId : undefined,
        idempotencyKey: data.formaPago === FORMA_PAGO_ANTICIPO_PAGO ? idempotencyKey : undefined
      }).unwrap()

      if (result.compraDocumento?.compraDocumentoId) {
        const itemCount = result.items?.length || 0
        const stockTraces = (result.items || [])
          .filter((item: any) => item.stockAntes !== undefined && item.stockDespues !== undefined)
          .map((item: any) => {
            const producto = item.producto?.nombre || 'N/A'
            return ` ${producto}: ${item.stockAntes} → ${item.stockDespues}`
          })
          .join(',')

        if (data.formaPago === 'PAGO_COMPLETO') {
          sileo.success({ title: `Compra múltiple registrada: ${itemCount} productos.${stockTraces}` })
        } else if (data.formaPago === FORMA_PAGO_ANTICIPO_PAGO) {
          sileo.success({ title: `Compra múltiple registrada con anticipo: ${itemCount} productos.${stockTraces}` })
        } else {
          sileo.success({ title: `Compra múltiple registrada: ${itemCount} productos. Se generó una cuenta por pagar.${stockTraces}` })
        }
      }

      if (onSuccess) onSuccess()
      router.push('/busy/compras-productos')
    } catch (error: any) {
      console.error('Error al registrar compra:', error)
      const errorMessage = error?.data?.error || 'Hubo un error al registrar la compra.'
      sileo.error({ title: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingProducts || isLoadingVendors) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className='border-dashed'>
          <CardContent className='pt-6'>
            <div className='flex items-center justify-center py-8 mb-6'>
              <motion.div
                className='w-12 h-12 border-4 border-primary border-t-transparent rounded-full'
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <div className='space-y-6'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-full' />
              <div className='flex justify-end space-x-4'>
                <Skeleton className='h-10 w-24' />
                <Skeleton className='h-10 w-24' />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className='border-dashed overflow-hidden'>
        <div className='h-1 bg-linear-to-r from-primary via-purple-500 to-primary' />
        <CardContent className='pt-6'>
          <motion.div className='flex items-center gap-3 mb-6' initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <motion.div className='w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg'>
              <ShoppingCart className='h-5 w-5 text-white' />
            </motion.div>
            <div className='relative'>
              <h2 className='text-lg font-semibold'>Datos de la Compra</h2>
              <p className='text-sm text-muted-foreground'>Agregue productos del clasificador y registre la compra múltiple</p>
              <motion.div className='absolute -right-4 -top-1' animate={{ rotate: 360 }} transition={{ rotate: { duration: 20, repeat: Infinity, ease: 'linear' } }}>
                <Sparkles className='h-4 w-4 text-yellow-500' />
              </motion.div>
            </div>
          </motion.div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className='space-y-6'>
              {/* Cabecera: Proveedor y Factura */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='proveedorId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Seleccione un proveedor' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {proveedoresCatalogo.map((vendor) => (
                            <SelectItem key={vendor.vendorId} value={vendor.vendorId}>
                              {vendor.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='numeroFactura'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nro. Factura</FormLabel>
                      <FormControl>
                        <Input type='text' placeholder='Ej: F-2024-0012' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='facturaUrl'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Captura de Factura</FormLabel>
                    <FormControl>
                      <ProductPhotoUpload
                        photos={field.value ? [field.value] : []}
                        onPhotosChange={(photos) => field.onChange(photos[0] || '')}
                        maxPhotos={1}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='formaPago'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pago</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Seleccione la forma de pago' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='PAGO_COMPLETO'>Pago completo</SelectItem>
                          <SelectItem value='PAGO_PARCIAL'>Pago parcial</SelectItem>
                          <SelectItem value={FORMA_PAGO_ANTICIPO_PAGO}>Pago anticipado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>El pago parcial genera cuentas por pagar.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='estado'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Estado' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='PAGADA'>Pagada</SelectItem>
                          <SelectItem value='PENDIENTE'>Pendiente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {anticiposFeatureEnabled && formaPagoSeleccionada === FORMA_PAGO_ANTICIPO_PAGO && (
                <FormField
                  control={form.control}
                  name='anticipoPagoId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Anticipo disponible</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Seleccione un anticipo de pago' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(anticiposDisponibles?.anticipos || []).map((anticipo) => (
                            <SelectItem key={anticipo.anticipoId} value={anticipo.anticipoId}>
                              {`${anticipo.anticipoId.slice(0, 8)} · Saldo ${Number(anticipo.saldoDisponible).toFixed(2)} ${anticipo.moneda}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {isLoadingAnticipos
                          ? 'Cargando anticipos disponibles...'
                          : `Monto estimado de compra: ${Number(montoEstimadoCompra || 0).toFixed(2)} CUP`}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name='descripcionCompra'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción de compra (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder='Notas de la compra' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className='my-6' />

              {/* Items de compra */}
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <Package className='h-5 w-5 text-muted-foreground' />
                    <h3 className='text-sm font-semibold'>Productos a comprar</h3>
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={addItem}
                    className='cursor-pointer'
                  >
                    <Plus className='h-4 w-4 mr-1' />
                    Agregar producto
                  </Button>
                </div>

                <AnimatePresence>
                  {fields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className='p-4 bg-muted/30'>
                        <div className='flex items-start gap-3'>
                          <div className='flex-1 grid grid-cols-1 md:grid-cols-3 gap-3'>
                            <FormField
                              control={form.control}
                              name={`items.${index}.productoId`}
                              render={({ field: itemField }) => (
                                <FormItem>
                                  <FormLabel className='text-xs'>Producto</FormLabel>
                                  <Select
                                    onValueChange={(value) => {
                                      itemField.onChange(value)
                                      handleProductoChange(index, value)
                                    }}
                                    value={itemField.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder='Seleccione' />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {productosComprables.map((product) => (
                                        <SelectItem key={product.id} value={product.id}>
                                          {product.nombre}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`items.${index}.cantidad`}
                              render={({ field: itemField }) => (
                                <FormItem>
                                  <FormLabel className='text-xs'>Cantidad</FormLabel>
                                  <FormControl>
                                    <Input
                                      type='number'
                                      min={1}
                                      value={itemField.value}
                                      onChange={(e) => {
                                        const raw = e.target.value
                                        itemField.onChange(raw === '' ? '' : e.target.valueAsNumber)
                                      }}
                                      onBlur={itemField.onBlur}
                                      ref={itemField.ref}
                                      name={itemField.name}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`items.${index}.precioCosto`}
                              render={({ field: itemField }) => (
                                <FormItem>
                                  <FormLabel className='text-xs'>Costo unitario</FormLabel>
                                  <FormControl>
                                    <Input
                                      type='number'
                                      step='0.01'
                                      min={0}
                                      value={itemField.value}
                                      onChange={(e) => {
                                        const raw = e.target.value
                                        itemField.onChange(raw === '' ? '' : e.target.valueAsNumber)
                                      }}
                                      onBlur={itemField.onBlur}
                                      ref={itemField.ref}
                                      name={itemField.name}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {fields.length > 1 && (
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              onClick={() => removeItem(index)}
                              className='mt-6 text-destructive hover:text-destructive cursor-pointer'
                              title='Quitar producto'
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          )}
                        </div>

                        {/* Subtotal por línea */}
                        {(() => {
                          const costo = parseFloat(String(items[index]?.precioCosto)) || 0
                          const cant = parseInt(String(items[index]?.cantidad), 10) || 0
                          if (costo <= 0 || cant <= 0) return null
                          return (
                            <div className='mt-2 text-right text-sm text-muted-foreground'>
                              Subtotal: <span className='font-medium text-foreground'>
                                ${(costo * cant).toLocaleString('es-CU')}
                              </span>
                            </div>
                          )
                        })()}
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Total general */}
                <div className='flex justify-end pt-2'>
                  <div className='text-right space-y-1'>
                    <div className='text-xs text-muted-foreground'>
                      {itemsValidos} {itemsValidos === 1 ? 'producto' : 'productos'} con precio
                    </div>
                    <div className='flex items-baseline gap-2'>
                      <span className='text-sm text-muted-foreground'>Total general:</span>
                      <span className='text-xl font-bold text-primary'>
                        ${montoEstimadoCompra.toLocaleString('es-CU')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className='flex justify-end space-x-4 pt-4'>
                <Button type='button' variant='destructive' className='cursor-pointer' onClick={() => router.push('/busy/compras-productos')}>
                  Cancelar
                </Button>
                <Button type='submit' disabled={isLoading} className='cursor-pointer bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90'>
                  {isLoading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Procesando...
                    </>
                  ) : (
                    `Registrar compra (${itemsValidos} ${itemsValidos === 1 ? 'producto' : 'productos'})`
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
