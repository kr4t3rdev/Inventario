'use client'

import { useState } from 'react'
import type { ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { LazyMotion, m as motion } from 'framer-motion'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { sileo } from '@/lib/sileo-shim'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientes } from '@/features/clientes/hooks/use-clientes'
import { createVentaServicioAction } from '@/features/venta-servicios/actions'
import { AnticipoSelector } from '@/features/contabilidad/components/anticipos/anticipo-selector'
import type { AnticipoAllocation } from '@/features/contabilidad/components/anticipos/anticipo-selector'
import { ArrowLeft, Handshake, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { Servicios } from '@/app/models/model'

const FORMA_COBRO_ANTICIPO = 'ANTICIPO_COBRO' as const

const schema = z.object({
  servicioId: z.string().min(1, 'Seleccione un servicio'),
  clienteId: z.string().optional(),
  cantidad: z.coerce.number().int().positive(),
  precioUnitario: z.coerce.number().int().positive(),
  costo: z.coerce.number().int().optional().default(0),
  formaCobro: z.enum(['COBRO_DIRECTO', FORMA_COBRO_ANTICIPO]),
  observaciones: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const servicioInputClassName = 'bg-slate-50 dark:bg-slate-900/10 border-slate-200 dark:border-orange-900/20 focus:border-transparent focus:ring-2 focus:ring-orange-500 focus-visible:border-transparent focus-visible:ring-0 h-12 text-base transition-all'

/**
 * @description Formulario para registrar servicios prestados a clientes.
 * @param {object} props - Props del componente.
 * @returns {JSX.Element} Formulario de servicio prestado.
 */
interface ServiciosPrestadosFormProps {
  initialServicios?: Servicios[]
}

export function ServiciosPrestadosForm({ initialServicios }: ServiciosPrestadosFormProps): ReactElement {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [anticipoAllocations, setAnticipoAllocations] = useState<AnticipoAllocation[]>([])
  const servicios = initialServicios ?? []
  const { clientes, isLoading: isLoadingClientes } = useClientes()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      servicioId: '',
      clienteId: '',
      cantidad: 1,
      precioUnitario: 0,
      costo: 0,
      formaCobro: 'COBRO_DIRECTO',
      observaciones: '',
    },
  })

  const servicioId = useWatch({ control: form.control, name: 'servicioId' })
  const clienteId = useWatch({ control: form.control, name: 'clienteId' })
  const cantidad = useWatch({ control: form.control, name: 'cantidad' }) || 1
  const precioUnitario = useWatch({ control: form.control, name: 'precioUnitario' }) || 0
  const totalServicio = cantidad * precioUnitario
  const formaCobro = useWatch({ control: form.control, name: 'formaCobro' })

  /**
   * @description Maneja el envío del formulario de servicio prestado.
   * @param {FormValues} values - Valores validados del formulario.
   * @returns {Promise<void>} Promesa de finalización.
   */
  async function onSubmit(values: FormValues): Promise<void> {
    setIsLoading(true)
    try {
      const result = await createVentaServicioAction({
        servicioId: values.servicioId,
        clienteId: values.clienteId || undefined,
        cantidad: values.cantidad,
        precioUnitario: values.precioUnitario,
        costo: values.costo ?? 0,
        observaciones: values.observaciones,
        anticipos: values.formaCobro === FORMA_COBRO_ANTICIPO ? anticipoAllocations : undefined,
      })
      if (!result.success) {
        throw new Error(result.error?.message ?? 'Error desconocido')
      }

      sileo.success({ title: 'Servicio prestado registrado correctamente.' })
      form.reset()
    } catch (error) {
      console.error('Error al registrar servicio prestado:', error)
      sileo.error({ title: 'No se pudo registrar el servicio prestado.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingClientes) {
    return (
      <div className='min-h-screen bg-linear-to-br py-8 px-4'>
        <div className='container mx-auto max-w-2xl'>
          <Card className='border-slate-200 backdrop-blur-sm shadow-xl'>
            <CardContent className='pt-8'>
              <div className='space-y-6'>
                <Skeleton className='h-12 w-full bg-slate-200 dark:bg-slate-800/60' />
                <Skeleton className='h-12 w-full bg-slate-200 dark:bg-slate-800/60' />
                <Skeleton className='h-12 w-full bg-slate-200 dark:bg-slate-800/60' />
                <Skeleton className='h-12 w-full bg-slate-200 dark:bg-slate-800/60' />
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
                <Handshake className='h-6 w-6 text-white' />
              </motion.div>
              <div>
                <CardTitle className='text-2xl text-slate-900 dark:text-slate-100'>
                  Servicio Prestado
                </CardTitle>
                <CardDescription className='text-slate-500 dark:text-slate-400 mt-1'>
                  Registra un servicio vendido y asígnalo a un cliente (opcional)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className='pt-8'>
            <Form {...form}>
              <form className='space-y-6' onSubmit={form.handleSubmit(onSubmit as any, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <FormField
                    control={form.control}
                    name='servicioId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Servicio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={servicioInputClassName}>
                              <SelectValue placeholder='Seleccione un servicio' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {servicios.map((servicio) => (
                              <SelectItem key={servicio.servicioId} value={servicio.servicioId}>
                                {servicio.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className='text-slate-500 dark:text-slate-500'>
                          Selecciona el servicio que deseas registrar.
                        </FormDescription>
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
                    name='clienteId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Cliente (opcional)</FormLabel>
                        <Select onValueChange={(val) => field.onChange(val === 'none' ? '' : val)} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger className={servicioInputClassName}>
                              <SelectValue placeholder='Seleccione cliente' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='none'>Sin cliente</SelectItem>
                            {clientes?.map((cliente) => (
                              <SelectItem key={cliente.clienteId} value={cliente.clienteId}>
                                {cliente.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className='text-slate-500 dark:text-slate-500'>
                          Asocia el servicio a un cliente existente.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </motion.div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <FormField
                      control={form.control}
                      name='cantidad'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Cantidad</FormLabel>
                          <FormControl>
                            <Input 
                              min={1} 
                              type='number' 
                              {...field} 
                              className={servicioInputClassName}
                            />
                          </FormControl>
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
                      name='precioUnitario'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Precio unitario</FormLabel>
                          <FormControl>
                            <div className='relative'>
                              <span className='absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 text-lg'>$</span>
                              <Input 
                                min={1} 
                                type='number' 
                                {...field} 
                                className={`${servicioInputClassName} pl-8`}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.38 }}
                  >
                    <FormField
                      control={form.control}
                      name='costo'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Costo unitario (opcional)</FormLabel>
                          <FormControl>
                            <div className='relative'>
                              <span className='absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 text-lg'>$</span>
                              <Input
                                min={0}
                                type='number'
                                {...field}
                                className={`${servicioInputClassName} pl-8`}
                              />
                            </div>
                          </FormControl>
                          <FormDescription className='text-slate-500 dark:text-slate-500'>
                            Cuánto te costó prestar este servicio (por unidad).
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
                      name='formaCobro'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Forma de cobro</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={servicioInputClassName}>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='COBRO_DIRECTO'>Cobro directo</SelectItem>
                            <SelectItem value={FORMA_COBRO_ANTICIPO}>Cobro con anticipo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className='text-slate-500 dark:text-slate-500'>
                          Tipo de cobro a realizar.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>
                </div>

                {formaCobro === FORMA_COBRO_ANTICIPO && (
                  <AnticipoSelector
                    tipo="COBRO"
                    entidadId={clienteId}
                    montoTotal={totalServicio}
                    onSelectionChange={setAnticipoAllocations}
                    moneda="CUP"
                    disabled={isLoading}
                  />
                )}

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <FormField
                    control={form.control}
                    name='observaciones'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-slate-700 dark:text-slate-300 text-base'>Observaciones</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder='Notas adicionales sobre el servicio...'
                            className={servicioInputClassName}
                          />
                        </FormControl>
                        <FormDescription className='text-slate-500 dark:text-slate-500'>
                          Agrega cualquier observación relevante.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

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
                      disabled={isLoading || !servicioId}
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
                          Registrar Servicio
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
