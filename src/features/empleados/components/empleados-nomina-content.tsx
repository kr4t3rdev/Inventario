'use client'

/**
 * @description Contenido interactivo para la página de empleados y nómina.
 * @param {EmpleadosNominaContentProps} props - Datos iniciales cargados por el Server Component.
 * @returns {JSX.Element} Vista interactiva de empleados y pagos de salario.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createPagoSalarioAction } from '@/features/pago-salario/actions'
import { deleteEmpleadoAction } from '@/features/empleados/actions'
import { Pencil, Plus, Trash2, CreditCard, Users, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import type { Empleado, Pagosalario } from '@/app/models/model'

interface PagoSalarioFormValues {
  salario: number
  bonificaciones: number
  deducciones: number
  horasExtras: number
  observaciones: string
}

interface EmpleadosNominaContentProps {
  initialEmpleados: Empleado[]
  initialPagos: Pagosalario[]
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.4, 0.25, 1] as const,
    },
  },
}

/**
 * @description Vista interactiva de empleados con historial y registro de nómina.
 * @param {EmpleadosNominaContentProps} props - Datos iniciales precargados por el servidor.
 * @returns {JSX.Element} Panel de empleados y nómina.
 */
export function EmpleadosNominaContent({ initialEmpleados, initialPagos }: EmpleadosNominaContentProps) {
  const router = useRouter()
  const [empleados, setEmpleados] = useState<Empleado[]>(initialEmpleados)
  const [pagos, setPagos] = useState<Pagosalario[]>(initialPagos)
  const [empleadoToDelete, setEmpleadoToDelete] = useState<string | null>(null)
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    setEmpleados(initialEmpleados)
  }, [initialEmpleados])

  useEffect(() => {
    setPagos(initialPagos)
  }, [initialPagos])

  const { register, handleSubmit, reset } = useForm<PagoSalarioFormValues>({
    defaultValues: {
      salario: 0,
      bonificaciones: 0,
      deducciones: 0,
      horasExtras: 0,
      observaciones: '',
    },
  })

  const handleOpenPagoDialog = (empleado: Empleado) => {
    setSelectedEmpleado(empleado)
    setIsDialogOpen(true)
  }

  const handleClosePagoDialog = () => {
    setIsDialogOpen(false)
    setSelectedEmpleado(null)
    reset()
  }

  const onSubmitPago = async (data: PagoSalarioFormValues) => {
    if (!selectedEmpleado) return

    try {
      const result = await createPagoSalarioAction({
        empleadoId: selectedEmpleado.empleadoId,
        salario: data.salario,
        bonificaciones: data.bonificaciones || 0,
        deducciones: data.deducciones || 0,
        horasExtras: data.horasExtras || 0,
        observaciones: data.observaciones || undefined,
      })

      if (!result.success) {
        toast.error(result.error?.message || 'Error al registrar el pago de salario')
        return
      }

      toast.success('Pago de salario registrado exitosamente')
      handleClosePagoDialog()
      router.refresh()
    } catch (_error) {
      toast.error('Error al registrar el pago de salario')
    }
  }

  const handleDelete = async () => {
    if (!empleadoToDelete) return

    try {
      const result = await deleteEmpleadoAction(empleadoToDelete)
      if (!result.success) {
        toast.error(result.error?.message || 'Hubo un error al eliminar el empleado.')
        return
      }

      toast.success('El empleado ha sido eliminado exitosamente.')
      router.refresh()
    } catch (_error) {
      toast.error('Hubo un error al eliminar el empleado.')
    } finally {
      setEmpleadoToDelete(null)
    }
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <motion.div
          className="container mx-auto py-6 px-4"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.div
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
            variants={itemVariants}
          >
            <motion.div className="flex items-center gap-3">
              <motion.div
                className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                <Users className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                  Empleados
                </h1>
                <motion.div
                  className="absolute -right-4 -top-1"
                  animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                  transition={{
                    rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                    scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                  }}
                >
                </motion.div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button asChild className="bg-linear-to-r from-orange-500 to-red-600 text-white shadow-lg hover:shadow-xl transition-shadow">
                <Link href="/busy/empleados/new">
                  <Plus className="mr-2 h-4 w-4" /> Nuevo Empleado
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={containerVariants}
          >
            {empleados.map((empleado) => (
              <motion.div
                key={empleado.empleadoId}
                variants={itemVariants}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <Card className="border-dashed dark:border-slate-700/10 dark:bg-slate-900/10 overflow-hidden group">
                  <div className="h-1 bg-linear-to-r from-orange-500 to-red-600" />
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="dark:text-slate-100">
                          {empleado.nombre} {empleado.apellido}
                        </CardTitle>
                        <CardDescription className="dark:text-slate-400">
                          {empleado.cargo}
                        </CardDescription>
                      </div>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                      >
                        <Avatar className="h-12 w-12 ring-2 ring-orange-500/20">
                          <AvatarFallback className="bg-linear-to-br from-orange-500/20 to-red-600/20 text-orange-500 font-semibold">
                            {empleado.nombre.charAt(0)}{empleado.apellido?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </motion.div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground dark:text-slate-400">
                      <span className="font-medium dark:text-slate-300">Teléfono:</span> {empleado.telefono}
                    </p>
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 min-w-25">
                      <Button asChild variant="outline" size="sm" className="w-full dark:border-slate-700/10 dark:hover:bg-slate-800/10">
                        <Link href={`/busy/empleados/update/${empleado.empleadoId}`}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </Link>
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 min-w-25">
                      <Button
                        onClick={() => handleOpenPagoDialog(empleado)}
                        variant="outline"
                        size="sm"
                        className="w-full dark:border-slate-700/10 dark:hover:bg-slate-800/10"
                      >
                        <CreditCard className="h-4 w-4 mr-2" /> Realizar Pago
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 min-w-25">
                      <Button
                        onClick={() => setEmpleadoToDelete(empleado.empleadoId)}
                        variant="outline"
                        size="sm"
                        className="w-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive dark:border-slate-700/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </Button>
                    </motion.div>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="mt-8" variants={itemVariants}>
            <motion.div className="flex items-center gap-3 mb-4">
              <motion.div
                className="w-8 h-8 bg-linear-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <CreditCard className="h-4 w-4 text-white" />
              </motion.div>
              <h2 className="text-xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Historial de Pagos de Salario
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Tabs defaultValue="historial" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 dark:bg-slate-900/10">
                  <TabsTrigger value="historial">Historial Detallado</TabsTrigger>
                  <TabsTrigger value="resumen">Resumen por Período</TabsTrigger>
                </TabsList>

                <TabsContent value="historial" className="mt-4">
                  <Card className="border-dashed dark:border-slate-700/10 dark:bg-slate-900/10">
                    <div className="h-1 bg-linear-to-r from-orange-500 via-red-500 to-orange-500" />
                    <CardContent className="pt-6">
                      <Table>
                        <TableHeader>
                          <TableRow className="dark:border-slate-700">
                            <TableHead className="dark:text-slate-400">Empleado</TableHead>
                            <TableHead className="dark:text-slate-400">Salario Base</TableHead>
                            <TableHead className="dark:text-slate-400">Bonificaciones</TableHead>
                            <TableHead className="dark:text-slate-400">Deducciones</TableHead>
                            <TableHead className="dark:text-slate-400">Horas Extras</TableHead>
                            <TableHead className="dark:text-slate-400">Total Pagado</TableHead>
                            <TableHead className="dark:text-slate-400">Observaciones</TableHead>
                            <TableHead className="dark:text-slate-400">Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagos.map((pago, index) => {
                            const totalPagado = pago.salario + (pago.bonificaciones || 0) - Math.abs(pago.deducciones || 0)

                            return (
                              <motion.tr
                                key={pago.pgId}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="border-b dark:border-slate-700/10 dark:hover:bg-slate-800/10 transition-colors"
                              >
                                <TableCell className="font-medium dark:text-slate-200">
                                  {pago.empleado?.nombre} {pago.empleado?.apellido}
                                </TableCell>
                                <TableCell className="dark:text-slate-300">${pago.salario.toLocaleString()}</TableCell>
                                <TableCell className="dark:text-slate-300">${(pago.bonificaciones || 0).toLocaleString()}</TableCell>
                                <TableCell className="dark:text-slate-300">${(pago.deducciones || 0).toLocaleString()}</TableCell>
                                <TableCell className="dark:text-slate-300">{(pago.horasExtras || 0).toLocaleString()}</TableCell>
                                <TableCell className="font-semibold from-orange-400 to-red-500">
                                  ${totalPagado.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-muted-foreground dark:text-slate-400">{pago.observaciones || '-'}</TableCell>
                                <TableCell className="text-muted-foreground dark:text-slate-400">
                                  {new Date(pago.createdAt).toLocaleDateString()}
                                </TableCell>
                              </motion.tr>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="resumen" className="mt-4">
                  <Card className="border-dashed dark:border-slate-700/10 dark:bg-slate-900/10">
                    <div className="h-1 bg-linear-to-r from-orange-500 to-red-600" />
                    <CardContent className="pt-6">
                      <Table>
                        <TableHeader>
                          <TableRow className="dark:border-slate-700/10">
                            <TableHead className="dark:text-slate-400">Empleado</TableHead>
                            <TableHead className="dark:text-slate-400">Período</TableHead>
                            <TableHead className="dark:text-slate-400">Total Pagado</TableHead>
                            <TableHead className="dark:text-slate-400">Número de Pagos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const grouped = pagos.reduce((acc, pago) => {
                              const key = `${pago.empleadoId}-${pago.periodo}`

                              if (!acc[key]) {
                                acc[key] = {
                                  empleado: pago.empleado!,
                                  periodo: pago.periodo,
                                  total: 0,
                                  count: 0,
                                }
                              }

                              const totalPagado = pago.salario + (pago.bonificaciones || 0) - Math.abs(pago.deducciones || 0)
                              acc[key].total += totalPagado
                              acc[key].count += 1
                              return acc
                            }, {} as Record<string, { empleado: Empleado; periodo: string; total: number; count: number }>)

                            return Object.values(grouped || {}).map((group) => (
                              <motion.tr
                                key={`${group.empleado.empleadoId}-${group.periodo}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="border-b dark:border-slate-700/10 dark:hover:bg-slate-800/10 transition-colors"
                              >
                                <TableCell className="font-medium dark:text-slate-200">
                                  {group.empleado?.nombre} {group.empleado?.apellido}
                                </TableCell>
                                <TableCell className="dark:text-slate-300">{group.periodo}</TableCell>
                                <TableCell className="font-semibold from-orange-400 to-red-500">
                                  ${group.total.toLocaleString()}
                                </TableCell>
                                <TableCell className="dark:text-slate-300">{group.count}</TableCell>
                              </motion.tr>
                            ))
                          })()}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </motion.div>

          <AlertDialog open={!!empleadoToDelete} onOpenChange={(open) => !open && setEmpleadoToDelete(null)}>
            <AlertDialogContent className="dark:bg-slate-900/10 dark:border-slate-700/10">
              <AlertDialogHeader>
                <AlertDialogTitle className="dark:text-slate-100">¿Está seguro?</AlertDialogTitle>
                <AlertDialogDescription className="dark:text-slate-400">
                  Esta acción no se puede deshacer. Esto eliminará permanentemente al empleado.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="dark:bg-slate-800/10 dark:text-slate-200 dark:border-slate-700/10">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleClosePagoDialog()}>
            <DialogContent className="sm:max-w-106.25 dark:bg-slate-900 dark:border-slate-700">
              <DialogHeader>
                <DialogTitle className="dark:text-slate-100 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Registrar Pago de Salario
                </DialogTitle>
                <DialogDescription className="dark:text-slate-400">
                  Complete los detalles del pago para {selectedEmpleado?.nombre} {selectedEmpleado?.apellido}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmitPago)} className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="salario" className="text-right dark:text-slate-300">
                    Salario Base
                  </Label>
                  <Input
                    id="salario"
                    type="number"
                    className="col-span-3 dark:bg-slate-800/10 dark:border-slate-700/10 dark:text-slate-100"
                    {...register('salario', { required: true, valueAsNumber: true })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="bonificaciones" className="text-right dark:text-slate-300">
                    Bonificaciones
                  </Label>
                  <Input
                    id="bonificaciones"
                    type="number"
                    className="col-span-3 dark:bg-slate-800/10 dark:border-slate-700/10 dark:text-slate-100"
                    {...register('bonificaciones', { valueAsNumber: true })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="deducciones" className="text-right dark:text-slate-300">
                    Deducciones
                  </Label>
                  <Input
                    id="deducciones"
                    type="number"
                    className="col-span-3 dark:bg-slate-800/10 dark:border-slate-700/10 dark:text-slate-100"
                    {...register('deducciones', { valueAsNumber: true })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="horasExtras" className="text-right dark:text-slate-300">
                    Horas Extras
                  </Label>
                  <Input
                    id="horasExtras"
                    type="number"
                    className="col-span-3 dark:bg-slate-800/10 dark:border-slate-700/10 dark:text-slate-100"
                    {...register('horasExtras', { valueAsNumber: true })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="observaciones" className="text-right dark:text-slate-300">
                    Observaciones
                  </Label>
                  <Textarea
                    id="observaciones"
                    className="col-span-3 dark:bg-slate-800/10 dark:border-slate-700/10 dark:text-slate-100"
                    {...register('observaciones')}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleClosePagoDialog} className="dark:border-slate-700 dark:hover:bg-slate-800">
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-linear-to-r from-orange-500 to-red-600 text-white">
                    Registrar Pago
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}