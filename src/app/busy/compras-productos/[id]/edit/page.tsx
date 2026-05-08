'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, ShoppingCart, Package } from 'lucide-react'
import { motion } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetCompraProductoByIdQuery, useUpdateCompraProductoMutation } from '@/features/compras-productos'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const updateSchema = z.object({
  numeroFactura: z.string().optional(),
  facturaUrl: z.string().optional(),
  descripcion: z.string().max(500).optional(),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO']).optional(),
  estado: z.enum(['PENDIENTE', 'PAGADA']).optional(),
}).refine(
  (data) => {
    if (data.formaPago === 'PAGO_COMPLETO' && data.estado) {
      return data.estado === 'PAGADA'
    }
    if (data.formaPago === 'PAGO_PARCIAL' && data.estado) {
      return data.estado === 'PENDIENTE'
    }
    return true
  },
  {
    message: 'El estado no coincide con la forma de pago',
    path: ['estado'],
  }
)

type UpdateFormData = z.infer<typeof updateSchema>

/**
 * @description Página de edición de compra de producto (cabecera).
 * @returns {JSX.Element} Formulario de edición
 */
export default function EditCompraProductoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: compraData, isLoading: isLoadingCompra } = useGetCompraProductoByIdQuery(id)
  const [updateCompra, { isLoading: isUpdating }] = useUpdateCompraProductoMutation()

  const form = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      numeroFactura: '',
      facturaUrl: '',
      descripcion: '',
      formaPago: undefined,
      estado: undefined,
    },
  })

  useEffect(() => {
    if (compraData?.compra) {
      const compra = compraData.compra
      form.reset({
        numeroFactura: compra.numeroFactura || '',
        facturaUrl: compra.facturaUrl || '',
        descripcion: compra.descripcion || '',
        formaPago: compra.formaPago as 'PAGO_PARCIAL' | 'PAGO_COMPLETO',
        estado: compra.estado as 'PENDIENTE' | 'PAGADA',
      })
    }
  }, [compraData, form])

  const onSubmit = async (data: UpdateFormData) => {
    try {
      await updateCompra({ id, data }).unwrap()
      toast.success('Compra actualizada exitosamente')
      router.push('/busy/compras-productos')
    } catch (error) {
      toast.error('Error al actualizar la compra')
    }
  }

  if (isLoadingCompra) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4 max-w-2xl">
            <div className="space-y-6">
              <Skeleton className="h-8 w-48" />
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const compra = compraData?.compra

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-4 mb-6">
              <Link href="/busy/compras-productos">
                <Button variant="outline" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Editar Compra
                </h1>
              </div>
            </div>

            {compra && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-card border rounded-lg p-6"
              >
                {/* Resumen de la compra */}
                <div className="mb-6 p-4 bg-muted rounded-lg">
                  <h2 className="font-semibold mb-2">Resumen de la Compra</h2>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-muted-foreground">Proveedor:</span> {compra.proveedor?.nombre || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Total:</span> <span className="font-bold">${compra.total?.toLocaleString()}</span></p>
                    <p><span className="text-muted-foreground">Productos:</span> {compra.items?.length || 0}</p>
                    <p><span className="text-muted-foreground">Fecha:</span> {new Date(compra.fechaCompra).toLocaleDateString()}</p>
                  </div>

                  {/* Items de la compra (solo lectura) */}
                  {compra.items && compra.items.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-1 mb-2">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Detalle de productos</span>
                      </div>
                      <div className="space-y-1">
                        {compra.items.map((item) => (
                          <div key={item.compraDocumentoItemId} className="flex justify-between text-xs">
                            <span>{item.producto?.nombre || 'N/A'} x{item.cantidad}</span>
                            <span className="font-medium">${item.totalLinea?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="numeroFactura"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Factura</FormLabel>
                          <FormControl>
                            <Input placeholder="Ingrese el número de factura" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="facturaUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL de Factura</FormLabel>
                          <FormControl>
                            <Input placeholder="URL de la imagen/foto de la factura" {...field} />
                          </FormControl>
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
                            <Textarea
                              placeholder="Descripción de la compra"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="formaPago"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Forma de Pago</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="PAGO_COMPLETO">Pago Completo</SelectItem>
                                <SelectItem value="PAGO_PARCIAL">Pago Parcial</SelectItem>
                              </SelectContent>
                            </Select>
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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="PAGADA">Pagada</SelectItem>
                                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                      <Link href="/busy/compras-productos">
                        <Button type="button" variant="outline">
                          Cancelar
                        </Button>
                      </Link>
                      <Button
                        type="submit"
                        disabled={isUpdating}
                        className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          'Guardar Cambios'
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </motion.div>
            )}
          </motion.div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
