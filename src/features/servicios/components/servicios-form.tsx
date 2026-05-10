'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { sileo } from '@/lib/sileo-shim'
import { Skeleton } from '@/components/ui/skeleton'
import { v4 } from 'uuid'
import { useAddServiciosMutation, useGetServiciosQuery, useUpdateServiciosMutation } from '@/features/servicios/api/serviciosApi'
import { useVendors } from '@/features/vendors/hooks/use-vendors'
import type { Vendor } from '@/app/models/model'
import { createServicioAction, updateServicioAction } from '@/features/servicios/actions'
import { ArrowLeft, Package, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'

const servicioSchema = z.object({
  nombre: z.string({
    required_error: 'Escribe el tipo de servicio',
  }).min(1, 'El nombre es requerido'),
  precio: z.coerce.number().positive({
    message: 'El monto debe ser mayor a 0',
  }),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  precioCosto: z.coerce.number().nonnegative().optional(),
  codigoInterno: z.string().max(11).optional(),
  codigoNegocio: z.string().max(40).optional(),
  vendorId: z.string().optional(),
})

type ServicioFormValues = z.infer<typeof servicioSchema>

const servicioInputClassName = 'bg-slate-50 dark:bg-slate-900/10 border-slate-200 dark:border-orange-900/20 focus:border-transparent focus:ring-2 focus:ring-orange-500 focus-visible:border-transparent focus-visible:ring-0 h-12 text-base transition-all'

interface ServicioFormProps {
  initialData?: {
    servicioId: string
    nombre: string
    precio: number
    descripcion: string
  }
  initialVendors?: Vendor[]
}

/**
 * @description Formulario para crear/editar servicios con animaciones
 * @param {ServicioFormProps} props - Props del componente
 * @returns {JSX.Element} Formulario de servicio
 */
export function ServicioForm({ initialData, initialVendors }: ServicioFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Si se pasan vendors por props, usar esos; sino usar el hook
  const hookVendors = useVendors()
  const vendors = initialVendors ?? hookVendors.vendors
  const isLoadingServicios = initialVendors ? false : useGetServiciosQuery().isLoading

  // Usar Server Actions si se pasaron vendors (modo Server Component)
  const useServerActions = !!initialVendors
  const [addServicios] = useAddServiciosMutation()
  const [updateServicios] = useUpdateServiciosMutation()

  const form = useForm<ServicioFormValues>({
    resolver: zodResolver(servicioSchema),
    defaultValues: {
      nombre: initialData?.nombre || '',
      descripcion: initialData?.descripcion || '',
      precio: initialData?.precio ?? undefined,
      precioCosto: undefined,
      codigoInterno: '',
      codigoNegocio: '',
      vendorId: '',
    },
  })

  async function onSubmit(data: ServicioFormValues) {
    setIsLoading(true)
    try {
      if (useServerActions) {
        // Usar Server Actions (modo Server Component)
        if (initialData) {
          const result = await updateServicioAction({
            servicioId: initialData.servicioId,
            ...data,
          })
          if (!result.success) throw new Error(result.error?.message)
          sileo.success({ title: 'El servicio ha sido actualizado exitosamente.' })
        } else {
          const result = await createServicioAction({
            servicioId: v4(),
            ...data
          })
          if (!result.success) throw new Error(result.error?.message)
          sileo.success({ title: 'El servicio ha sido registrado exitosamente.' })
        }
      } else {
        // Usar RTK Query (modo Client Component tradicional)
        if (initialData) {
          await updateServicios({
            servicioId: initialData.servicioId,
            ...data,
          }).unwrap()
          sileo.success({ title: 'El servicio ha sido actualizado exitosamente.' })
        } else {
          await addServicios({
            servicioId: v4(),
            ...data
          }).unwrap()
          sileo.success({ title: 'El servicio ha sido registrado exitosamente.' })
        }
      }
      router.back()
    } catch (error) {
      console.error('Error al guardar el servicio:', error)
      sileo.error({ title: 'Hubo un error al guardar el servicio.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingServicios) {
    return (
      <div className='min-h-screen bg-linear-to-br  py-8 px-4'>
        <div className='container mx-auto max-w-2xl'>
          <Card className='border-slate-200 backdrop-blur-sm shadow-xl'>
            <CardContent className='pt-8'>
              <div className='space-y-6'>
                <Skeleton className='h-12 w-full bg-slate-200 dark:bg-slate-800/60' />
                <Skeleton className='h-12 w-full bg-slate-200 dark:bg-slate-800/60' />
                <Skeleton className='h-24 w-full bg-slate-200 dark:bg-slate-800/60' />
                <div className='flex justify-end space-x-4'>
                  <Skeleton className='h-10 w-24 bg-slate-200 dark:bg-slate-800/60' />
                  <Skeleton className='h-10 w-32 bg-slate-200 dark:bg-slate-800/60' />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900/10 dark:to-slate-800/10 py-8 px-4'>
      <motion.div 
        className='container mx-auto max-w-2xl'
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Back Button */}
        <motion.div 
          className='mb-6'
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link href='/busy/servicios'>
            <Button variant='ghost' className='text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'>
              <ArrowLeft className='mr-2 h-4 w-4' />
              Volver a Servicios
            </Button>
          </Link>
        </motion.div>

        <Card className='border-slate-200 dark:border-slate-700/10 bg-white/80 dark:bg-slate-900/10 backdrop-blur-sm shadow-xl overflow-hidden'>
          <CardHeader className='border-b border-slate-100 dark:border-slate-700/10 bg-linear-to-r pb-6'>
            <div className='flex items-center gap-3'>
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className='p-3 bg-linear-to-br from-orange-500 to-red-600 dark:from-orange-600 dark:to-red-700 rounded-xl shadow-lg shadow-orange-500/25'
              >
                <Package className='h-6 w-6 text-white' />
              </motion.div>
              <div>
                <CardTitle className='text-2xl text-slate-900 dark:text-slate-100'>
                  {initialData ? 'Editar Servicio' : 'Nuevo Servicio'}
                </CardTitle>
                <CardDescription className='text-slate-500 dark:text-slate-400 mt-1'>
                  {initialData ? 'Modifica los datos del servicio existente' : 'Completa los datos para registrar un nuevo servicio'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className='pt-8'>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className='space-y-6'>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <FormField
                    control={form.control}
                    name='nombre'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Nombre del Servicio</FormLabel>
                        <FormControl>
                          <Input 
                            type='text' 
                            {...field} 
                            placeholder='Ej: Instalación de Aire Acondicionado'
                            className={servicioInputClassName}
                          />
                        </FormControl>
                        <FormDescription className='text-slate-500 dark:text-slate-500'>
                          Ingrese un nombre descriptivo para el servicio.
                        </FormDescription>
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
                    name='descripcion'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Descripción</FormLabel>
                        <FormControl>
                          <Input 
                            type='text' 
                            {...field} 
                            placeholder='Describe los detalles del servicio...'
                            className={servicioInputClassName}
                          />
                        </FormControl>
                        <FormDescription className='text-slate-500 dark:text-slate-500'>
                          Proporciona una descripción clara de lo que incluye el servicio.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <FormField
                    control={form.control}
                    name='precio'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Precio</FormLabel>
                        <FormControl>
                          <div className='relative'>
                            <span className='absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 text-lg'>$</span>
                            <Input 
                              type='number' 
                              {...field} 
                              placeholder='0.00'
                              className={`${servicioInputClassName} pl-8`}
                            />
                          </div>
                        </FormControl>
                        <FormDescription className='text-slate-500 dark:text-slate-500'>
                          Ingrese el monto del servicio en pesos.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <FormField
                    control={form.control}
                    name='precioCosto'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Costo de referencia</FormLabel>
                        <FormControl>
                          <Input 
                            type='number' 
                            min='0' 
                            {...field} 
                            className={servicioInputClassName}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='vendorId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Proveedor (opcional)</FormLabel>
                        <FormControl>
                          <select
                            className='h-12 w-full rounded-md border border-slate-200 dark:border-orange-900/20 bg-slate-50 dark:bg-slate-900/10 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all'
                            {...field}
                          >
                            <option value=''>Sin proveedor</option>
                            {vendors?.map((vendor: any) => (
                              vendor.vendorId ? (
                                <option key={vendor.vendorId} value={vendor.vendorId}>
                                  {vendor.nombre}
                                </option>
                              ) : null
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <motion.div 
                  className='flex justify-end space-x-4 pt-6 border-t border-slate-100 dark:border-slate-700'
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                      type='button' 
                      variant='destructive' 
                      onClick={() => router.back()}
                      className='border-slate-200 dark:border-slate-700 hover:bg-red-150 dark:hover:bg-orange-700'
                    >
                      Cancelar
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                      type='submit' 
                      disabled={isLoading}
                      className='bg-linear-to-r from-orange-600 to-red-700 hover:from-orange-700 hover:to-red-800 text-white shadow-lg shadow-orange-500/25 disabled:opacity-50'
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className='mr-2 h-4 w-4' />
                          {initialData ? 'Actualizar Servicio' : 'Crear Servicio'}
                        </>
                      )}
                    </Button>
                  </motion.div>
                </motion.div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
