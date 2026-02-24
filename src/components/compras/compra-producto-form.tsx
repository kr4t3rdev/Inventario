'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { ShoppingCart, Sparkles, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

import { SubcategorySelector } from '@/components/categorias/subcategory-selector'
import { ProductPhotoUpload } from '@/components/productos/product-photo-upload'
import { useGetAlmacenesQuery } from '@/lib/redux/services/almacenesApi'
import { useGetUnidadesQuery } from '@/lib/redux/services/unidadesApi'
import { useGetVendorsQuery } from '@/lib/redux/services/vendorsApi'
import { useCreateCompraProductoMutation } from '@/lib/redux/services/comprasProductosApi'

const compraProductoSchema = z.object({
  nombre: z.string().min(1, 'Escriba un nombre'),
  descripcion: z.string().optional().default(''),
  categoriaId: z.string().min(1, 'Seleccione una categoría'),
  subcategoriaId: z.string().optional().default(''),
  precioCosto: z.coerce.number().positive('El precio de costo debe ser mayor a 0'),
  precioVenta: z.coerce.number().positive('El precio de venta debe ser mayor a 0'),
  stock: z.coerce.number().int('La cantidad debe ser un entero').positive('La cantidad debe ser mayor a 0'),
  stockMinimo: z.coerce.number().int().min(0).optional().default(0),
  fotos: z.array(z.string()).optional().default([]),
  unidadId: z.string().min(1, 'Seleccione una unidad'),
  vendorId: z.string().min(1, 'Seleccione un proveedor'),
  almacenId: z.string().min(1, 'Seleccione un almacén'),
  numeroFactura: z.string().optional().default(''),
  facturaUrl: z.string().optional().default(''),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO']),
  estado: z.enum(['PENDIENTE', 'PAGADA']),
  descripcionCompra: z.string().max(500).optional().default(''),
}).refine(
  (data) => {
    if (data.formaPago === 'PAGO_COMPLETO') {
      return data.estado === 'PAGADA'
    }
    return data.estado === 'PENDIENTE'
  },
  {
    message: 'El estado no coincide con la forma de pago',
    path: ['estado']
  }
).refine(
  (data) => data.precioVenta >= data.precioCosto * 1.1,
  {
    message: 'El precio de venta debe tener al menos un 10% de margen sobre el costo',
    path: ['precioVenta']
  }
)

type CompraProductoFormValues = z.input<typeof compraProductoSchema>

interface CompraProductoFormProps {
  onSuccess?: () => void
}

/**
 * @description Formulario para registrar compras de productos con stock inicial.
 * @param {CompraProductoFormProps} props - Props del componente
 * @returns {JSX.Element} Formulario de compra de productos
 */
export function CompraProductoForm({ onSuccess }: CompraProductoFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const { data: unidades, isLoading: isLoadingUnidades } = useGetUnidadesQuery()
  const { data: vendors, isLoading: isLoadingVendors } = useGetVendorsQuery()
  const { data: almacenes, isLoading: isLoadingAlmacenes } = useGetAlmacenesQuery()
  const [createCompraProducto] = useCreateCompraProductoMutation()

  const form = useForm<CompraProductoFormValues>({
    resolver: zodResolver(compraProductoSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      categoriaId: '',
      subcategoriaId: '',
      precioCosto: '' as unknown as number,
      precioVenta: '' as unknown as number,
      stock: 1,
      stockMinimo: 0,
      fotos: [],
      unidadId: '',
      vendorId: '',
      almacenId: '',
      numeroFactura: '',
      facturaUrl: '',
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      descripcionCompra: ''
    }
  })

  const formaPagoSeleccionada = form.watch('formaPago')

  useEffect(() => {
    if (!formaPagoSeleccionada) return
    const nextEstado = formaPagoSeleccionada === 'PAGO_COMPLETO' ? 'PAGADA' : 'PENDIENTE'
    form.setValue('estado', nextEstado, { shouldValidate: true })
  }, [formaPagoSeleccionada, form])

  async function onSubmit(data: CompraProductoFormValues) {
    setIsLoading(true)
    try {
      const total = data.precioCosto * data.stock
      
      // Crear la compra
      const result = await createCompraProducto({
        ...data,
        stockMinimo: data.stockMinimo ?? 0,
        fotos: data.fotos ?? [],
        estado: data.formaPago === 'PAGO_COMPLETO' ? 'PAGADA' : 'PENDIENTE'
      }).unwrap()

      const gastoCompraId = result.gastoCompra?.gastoCompraId

      if (gastoCompraId) {
        if (data.formaPago === 'PAGO_COMPLETO') {
          toast.success('Compra registrada exitosamente.')
        } else {
          toast.success('Compra registrada exitosamente. Se generó una cuenta por pagar.')
        }
      }

      // Mostrar advertencia si existe
      if (result.advertencia) {
        toast.warning(result.advertencia, {
          duration: 8000
        })
      }

      if (onSuccess) onSuccess()
      router.push('/busy/compras-productos')
    } catch (error: any) {
      console.error('Error al registrar compra:', error)
      const errorMessage = error?.data?.error || 'Hubo un error al registrar la compra.'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingUnidades || isLoadingVendors || isLoadingAlmacenes) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8 mb-6">
              <motion.div
                className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                <Skeleton className="h-10 w-full" />
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <Skeleton className="h-10 w-full" />
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <Skeleton className="h-20 w-full" />
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <Skeleton className="h-10 w-full" />
              </motion.div>
              <div className="flex justify-end space-x-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-dashed overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
        <CardContent className="pt-6">
          <motion.div 
            className="flex items-center gap-3 mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <motion.div 
              className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <ShoppingCart className="h-5 w-5 text-white" />
            </motion.div>
            <div className="relative">
              <h2 className="text-lg font-semibold">Datos de la Compra</h2>
              <p className="text-sm text-muted-foreground">Complete la información del producto y la compra</p>
              <motion.div
                className="absolute -right-4 -top-1"
                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                transition={{ 
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
              >
                <Sparkles className="h-4 w-4 text-yellow-500" />
              </motion.div>
            </div>
          </motion.div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Sección: Información del Producto */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
                  Información del Producto
                </h3>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input type="text" {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                      </FormControl>
                      <FormDescription>Ingrese el nombre del producto.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
              >
                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input type="text" {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                      </FormControl>
                      <FormDescription>Ingrese una descripción para el producto.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <FormField
                  control={form.control}
                  name="fotos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fotos del Producto</FormLabel>
                      <FormControl>
                        <ProductPhotoUpload
                          photos={field.value || []}
                          onPhotosChange={field.onChange}
                          maxPhotos={1}
                        />
                      </FormControl>
                      <FormDescription>
                        Suba 1 foto del producto (opcional). Tamaño máximo: 2MB.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
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
                        required={true}
                        showLabels={true}
                        disabled={isLoading}
                      />
                      <FormDescription>Seleccione una categoría y subcategoría.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <FormField
                  control={form.control}
                  name="precioCosto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio de costo</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min={0} {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="precioVenta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio de venta</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min={0} {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
              >
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad comprada</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stockMinimo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock mínimo</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <FormField
                  control={form.control}
                  name="unidadId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                            <SelectValue placeholder="Seleccione una unidad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {unidades?.map((unidad: any) => (
                            <SelectItem key={unidad.unidadId} value={unidad.unidadId}>
                              {unidad.nombre}
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
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                            <SelectValue placeholder="Seleccione un proveedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendors?.map((vendor: any) => (
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
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 }}
              >
                <FormField
                  control={form.control}
                  name="almacenId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Almacén</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                            <SelectValue placeholder="Seleccione un almacén" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {almacenes?.map((almacen: any) => (
                            <SelectItem key={almacen.almacenId} value={almacen.almacenId}>
                              {almacen.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Separator className="my-6" />
              </motion.div>

              {/* Sección: Información de la Compra */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65 }}
              >
                <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
                  Información de la Compra
                </h3>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
              >
                <FormField
                  control={form.control}
                  name="numeroFactura"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nro. Factura</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="Ej: F-2024-0012" {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.75 }}
              >
                <FormField
                  control={form.control}
                  name="facturaUrl"
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
              </motion.div>

              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
              >
                <FormField
                  control={form.control}
                  name="formaPago"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pago</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                            <SelectValue placeholder="Seleccione la forma de pago" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PAGO_COMPLETO">Pago completo</SelectItem>
                          <SelectItem value="PAGO_PARCIAL">Pago parcial</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>El pago parcial genera cuentas por pagar.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PAGADA">Pagada</SelectItem>
                          <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>El estado se ajusta según la forma de pago.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.85 }}
              >
                <FormField
                  control={form.control}
                  name="descripcionCompra"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción de compra (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Notas de la compra" {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div 
                className="flex justify-end space-x-4 pt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="button" variant="outline" onClick={() => router.push('/busy/compras-productos')}>
                    Cancelar
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      'Registrar compra'
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
