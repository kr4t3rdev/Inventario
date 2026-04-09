'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { sileo } from 'sileo'
import { motion } from 'framer-motion'
import { ShoppingCart, Sparkles, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

import { ProductPhotoUpload } from '@/components/productos/product-photo-upload'
import type { Producto, Vendor } from '@/app/models/model'
import { useGetVendorsQuery } from '@/lib/redux/services/vendorsApi'
import { useGetProductosQuery } from '@/lib/redux/services/productosApi'
import { useCreateCompraProductoMutation } from '@/lib/redux/services/comprasProductosApi'
import { useGetAnticiposDisponiblesQuery } from '@/lib/redux/services/contabilidadApi'
import { FORMA_PAGO_ANTICIPO_PAGO } from '@/lib/constants/anticipos'

const compraProductoSchema = z.object({
  productoId: z.string().min(1, 'Seleccione un producto'),
  precioCosto: z.coerce.number().positive('El precio de costo debe ser mayor a 0'),
  cantidad: z.coerce.number().int('La cantidad debe ser un entero').positive('La cantidad debe ser mayor a 0'),
  vendorId: z.string().min(1, 'Seleccione un proveedor'),
  numeroFactura: z.string().optional().default(''),
  facturaUrl: z.string().optional().default(''),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO', FORMA_PAGO_ANTICIPO_PAGO]),
  estado: z.enum(['PENDIENTE', 'PAGADA']),
  descripcionCompra: z.string().max(500).optional().default(''),
  fechaVencimiento: z.string().optional().default(''),
  anticipoPagoId: z.string().optional().default('')
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

type CompraProductoFormValues = z.input<typeof compraProductoSchema>

interface CompraProductoFormProps {
  onSuccess?: () => void
}

/**
 * @description Formulario simplificado para registrar compras de productos existentes.
 * @param {CompraProductoFormProps} props - Props del componente
 * @returns {JSX.Element} Formulario de compra de productos
 */
export function CompraProductoForm({ onSuccess }: CompraProductoFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const anticiposFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_ANTICIPOS !== 'false'

  const { data: products, isLoading: isLoadingProducts } = useGetProductosQuery()
  const { data: vendors, isLoading: isLoadingVendors } = useGetVendorsQuery()
  const [createCompraProducto] = useCreateCompraProductoMutation()

  const form = useForm<CompraProductoFormValues>({
    resolver: zodResolver(compraProductoSchema),
    defaultValues: {
      productoId: '',
      precioCosto: '' as unknown as number,
      cantidad: 1,
      vendorId: '',
      numeroFactura: '',
      facturaUrl: '',
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      descripcionCompra: '',
      fechaVencimiento: '',
      anticipoPagoId: ''
    }
  })

  const formaPagoSeleccionada = form.watch('formaPago')
  const productoSeleccionado = form.watch('productoId')
  const proveedorSeleccionado = form.watch('vendorId')
  const precioCostoSeleccionado = form.watch('precioCosto')
  const cantidadSeleccionada = form.watch('cantidad')
  const montoEstimadoCompra = Number(precioCostoSeleccionado || 0) * Number(cantidadSeleccionada || 0)
  const previousProductoIdRef = useRef<string | null>(null)
  const lastAutofilledVendorRef = useRef<string | null>(null)
  const lastAutofilledCostoRef = useRef<number | null>(null)
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

  useEffect(() => {
    if (!productoSeleccionado) {
      previousProductoIdRef.current = null
      return
    }

    const producto = productoLookup.get(productoSeleccionado)
    if (!producto) return

    const selectedVendorId = typeof producto.vendorId === 'string' ? producto.vendorId : ''
    const selectedPrecioCosto = Number(producto.precioCosto ?? 0)
    const previousProductoId = previousProductoIdRef.current

    const vendorActual = form.getValues('vendorId')
    const costoActual = Number(form.getValues('precioCosto') || 0)
    const vendorDirty = !!form.formState.dirtyFields.vendorId
    const costoDirty = !!form.formState.dirtyFields.precioCosto

    const canAutofillVendor =
      !vendorDirty ||
      !vendorActual ||
      (lastAutofilledVendorRef.current !== null && vendorActual === lastAutofilledVendorRef.current) ||
      previousProductoId !== productoSeleccionado

    if (selectedVendorId && canAutofillVendor) {
      form.setValue('vendorId', selectedVendorId, { shouldValidate: true })
      lastAutofilledVendorRef.current = selectedVendorId
    }

    const canAutofillCosto =
      !costoDirty ||
      !Number.isFinite(costoActual) ||
      costoActual <= 0 ||
      (lastAutofilledCostoRef.current !== null && costoActual === lastAutofilledCostoRef.current) ||
      previousProductoId !== productoSeleccionado

    if (selectedPrecioCosto > 0 && canAutofillCosto) {
      form.setValue('precioCosto', selectedPrecioCosto, { shouldValidate: true })
      lastAutofilledCostoRef.current = selectedPrecioCosto
    }

    previousProductoIdRef.current = productoSeleccionado
  }, [productoSeleccionado, productoLookup, form])

  async function onSubmit(data: CompraProductoFormValues) {
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

      if (result.gastoCompra?.gastoCompraId) {
        const stockTrace =
          result.stockAntes !== undefined && result.stockDespues !== undefined
            ? ` Stock: ${result.stockAntes} → ${result.stockDespues}.`
            : ''
        const costoTrace =
          result.precioCostoAntes !== undefined && result.precioCostoDespues !== undefined
            ? ` Costo catálogo: ${result.precioCostoAntes.toFixed(2)} → ${result.precioCostoDespues.toFixed(2)} (${result.metodoCosto === 'PRIMERA_COMPRA' ? 'primera compra' : 'ponderado'}).`
            : ''

        if (data.formaPago === 'PAGO_COMPLETO') {
          sileo.success({ title: `Compra registrada exitosamente.${stockTrace}${costoTrace}` })
        } else if (data.formaPago === FORMA_PAGO_ANTICIPO_PAGO) {
          sileo.success({ title: `Compra registrada con anticipo ejecutado exitosamente.${stockTrace}${costoTrace}` })
        } else {
          sileo.success({ title: `Compra registrada exitosamente. Se generó una cuenta por pagar.${stockTrace}${costoTrace}` })
        }
      }

      if (result.advertencia) {
        sileo.warning({ title: result.advertencia })
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
        <div className='h-1 bg-gradient-to-r from-primary via-purple-500 to-primary' />
        <CardContent className='pt-6'>
          <motion.div className='flex items-center gap-3 mb-6' initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <motion.div className='w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg'>
              <ShoppingCart className='h-5 w-5 text-white' />
            </motion.div>
            <div className='relative'>
              <h2 className='text-lg font-semibold'>Datos de la Compra</h2>
              <p className='text-sm text-muted-foreground'>Seleccione un producto del clasificador y registre la compra</p>
              <motion.div className='absolute -right-4 -top-1' animate={{ rotate: 360 }} transition={{ rotate: { duration: 20, repeat: Infinity, ease: 'linear' } }}>
                <Sparkles className='h-4 w-4 text-yellow-500' />
              </motion.div>
            </div>
          </motion.div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className='space-y-6'>
              <FormField
                control={form.control}
                name='productoId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Producto (clasificador)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Seleccione un producto' />
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
                    <FormDescription>Este flujo usa productos existentes del catálogo maestro.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='vendorId'
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
                  name='cantidad'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad comprada</FormLabel>
                      <FormControl>
                        <Input type='number' min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='precioCosto'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo unitario</FormLabel>
                    <FormControl>
                      <Input type='number' step='0.01' min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className='my-6' />

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

              <div className='flex justify-end space-x-4 pt-4'>
                <Button type='button' variant='destructive' className='cursor-pointer' onClick={() => router.push('/busy/compras-productos')}>
                  Cancelar
                </Button>
                <Button type='submit' disabled={isLoading} className='cursor-pointer bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90'>
                  {isLoading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Procesando...
                    </>
                  ) : (
                    'Registrar compra'
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
