'use client'

import { motion } from "framer-motion"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDeleteEmpleadoMutation, useGetEmpleadosQuery } from "@/lib/redux/services/empleadosApi"
import { useAddPagoSalarioMutation, useGetPagoSalariosQuery } from "@/lib/redux/services/pagoSalarioApi"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { openDialog, closeDialog, selectCart, selectCartTotal, selectIsDialogOpen, selectSelectedEmpleado } from "@/lib/redux/slices/pagoSalarioSlice"
import { Pencil, Plus, Trash2, ShoppingCart, CreditCard, Users, Sparkles, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import type { Empleado } from "../../models/model"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.4, 0.25, 1] as const
    }
  }
}

const Empleado = () => {
  const { data: empleados, isLoading } = useGetEmpleadosQuery()
  const { data: pagos, isLoading: isLoadingPagos } = useGetPagoSalariosQuery()

  const [empleadoToDelete, setEmpleadoToDelete] = useState<string | null>(null)
  const [deleteEmpleado] = useDeleteEmpleadoMutation()

  const dispatch = useAppDispatch()
  const cart = useAppSelector(selectCart)
  const cartTotal = useAppSelector(selectCartTotal)
  const isDialogOpen = useAppSelector(selectIsDialogOpen)
  const selectedEmpleado = useAppSelector(selectSelectedEmpleado)
  const [addPagoSalario] = useAddPagoSalarioMutation()

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      salario: 0,
      bonificaciones: 0,
      deducciones: 0,
      horasExtras: 0,
      observaciones: "",
      clienteId: ""
    }
  })

  const handleAddToCart = (empleado: any) => {
    dispatch(openDialog(empleado))
  }

  const onSubmitPago = async (data: any) => {
    if (!selectedEmpleado) return

    try {
      await addPagoSalario({
        empleadoId: selectedEmpleado.empleadoId,
        salario: data.salario,
        bonificaciones: data.bonificaciones || 0,
        deducciones: data.deducciones || 0,
        horasExtras: data.horasExtras || 0,
        observaciones: data.observaciones || undefined,
      }).unwrap()

      toast.success("Pago de salario registrado exitosamente")
      dispatch(closeDialog())
      reset()
    } catch (error) {
      toast.error("Error al registrar el pago de salario")
    }
  }

  const handleDelete = async () => {
    if (!empleadoToDelete) return
    try {
      await deleteEmpleado(empleadoToDelete).unwrap()
      toast.success("El empleado ha sido eliminado exitosamente.")
    } catch (error) {
      toast.error("Hubo un error al eliminar el empleado.")
    } finally {
      setEmpleadoToDelete(null)
    }
  }

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="flex min-h-[60vh] items-center justify-center">
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <p className="text-muted-foreground animate-pulse">Cargando empleados...</p>
            </motion.div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
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
                className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Users className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Empleados
                </h1>
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

            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <Badge variant="secondary" className="flex items-center gap-1 bg-primary/10 text-primary">
                    <ShoppingCart className="h-3 w-3" />
                    {cart.length} en carrito
                  </Badge>
                </motion.div>
              )}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button asChild className="bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg hover:shadow-xl transition-shadow">
                  <Link href="/busy/empleados/new">
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Empleado
                  </Link>
                </Button>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={containerVariants}
          >
            {empleados?.map((empleado, index) => (
              <motion.div
                key={empleado.empleadoId}
                variants={itemVariants}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <Card className="border-dashed dark:border-slate-700 dark:bg-slate-900/50 overflow-hidden group">
                  <div className="h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="dark:text-slate-100">{empleado.nombre} {empleado.apellido}</CardTitle>
                        <CardDescription className="dark:text-slate-400">{empleado.cargo}</CardDescription>
                      </div>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      >
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-600/20 text-primary font-semibold">
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
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 min-w-[100px]">
                      <Button asChild variant="outline" size="sm" className="w-full dark:border-slate-700 dark:hover:bg-slate-800">
                        <Link href={`/busy/empleados/update/${empleado.empleadoId}`}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </Link>
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 min-w-[100px]">
                      <Button
                        onClick={() => handleAddToCart(empleado)}
                        variant="outline"
                        size="sm"
                        className="w-full dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        <CreditCard className="h-4 w-4 mr-2" /> Realizar Pago
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 min-w-[100px]">
                      <Button
                        onClick={() => setEmpleadoToDelete(empleado.empleadoId)}
                        variant="outline"
                        size="sm"
                        className="w-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive dark:border-slate-700"
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
                className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <CreditCard className="h-4 w-4 text-white" />
              </motion.div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
                Historial de Pagos de Salario
              </h2>
            </motion.div>

            {isLoadingPagos ? (
              <div className="flex justify-center py-8">
                <motion.div
                  className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Tabs defaultValue="historial" className="w-full">
                  <TabsList className="grid w-full max-w-md grid-cols-2 dark:bg-slate-900">
                    <TabsTrigger value="historial">Historial Detallado</TabsTrigger>
                    <TabsTrigger value="resumen">Resumen por Período</TabsTrigger>
                  </TabsList>

                  <TabsContent value="historial" className="mt-4">
                    <Card className="border-dashed dark:border-slate-700 dark:bg-slate-900/50">
                      <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
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
                            {pagos?.map((pago, index) => {
                              const totalPagado = pago.salario + (pago.bonificaciones || 0) - Math.abs(pago.deducciones || 0)
                              return (
                                <motion.tr
                                  key={pago.pgId}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  className="border-b dark:border-slate-700 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                  <TableCell className="font-medium dark:text-slate-200">
                                    {pago.empleado?.nombre} {pago.empleado?.apellido}
                                  </TableCell>
                                  <TableCell className="dark:text-slate-300">${pago.salario.toLocaleString()}</TableCell>
                                  <TableCell className="dark:text-slate-300">${(pago.bonificaciones || 0).toLocaleString()}</TableCell>
                                  <TableCell className="dark:text-slate-300">${(pago.deducciones || 0).toLocaleString()}</TableCell>
                                  <TableCell className="dark:text-slate-300">{(pago.horasExtras || 0).toLocaleString()}</TableCell>
                                  <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
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
                    <Card className="border-dashed dark:border-slate-700 dark:bg-slate-900/50">
                      <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
                      <CardContent className="pt-6">
                        <Table>
                          <TableHeader>
                            <TableRow className="dark:border-slate-700">
                              <TableHead className="dark:text-slate-400">Empleado</TableHead>
                              <TableHead className="dark:text-slate-400">Período</TableHead>
                              <TableHead className="dark:text-slate-400">Total Pagado</TableHead>
                              <TableHead className="dark:text-slate-400">Número de Pagos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const grouped = pagos?.reduce((acc, pago) => {
                                const key = `${pago.empleadoId}-${pago.periodo}`
                                if (!acc[key]) {
                                  acc[key] = {
                                    empleado: pago.empleado!,
                                    periodo: pago.periodo,
                                    total: 0,
                                    count: 0
                                  }
                                }
                                const totalPagado = pago.salario + (pago.bonificaciones || 0) - Math.abs(pago.deducciones || 0)
                                acc[key].total += totalPagado
                                acc[key].count += 1
                                return acc
                              }, {} as Record<string, { empleado: Empleado; periodo: string; total: number; count: number }>)
                              return Object.values(grouped || {}).map((group, index) => (
                                <motion.tr
                                  key={index}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  className="border-b dark:border-slate-700 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                  <TableCell className="font-medium dark:text-slate-200">
                                    {group.empleado?.nombre} {group.empleado?.apellido}
                                  </TableCell>
                                  <TableCell className="dark:text-slate-300">{group.periodo}</TableCell>
                                  <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
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
            )}
          </motion.div>

          <AlertDialog open={!!empleadoToDelete} onOpenChange={(open) => !open && setEmpleadoToDelete(null)}>
            <AlertDialogContent className="dark:bg-slate-900 dark:border-slate-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="dark:text-slate-100">¿Está seguro?</AlertDialogTitle>
                <AlertDialogDescription className="dark:text-slate-400">
                  Esta acción no se puede deshacer. Esto eliminará permanentemente al empleado.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={isDialogOpen} onOpenChange={() => dispatch(closeDialog())}>
            <DialogContent className="sm:max-w-[425px] dark:bg-slate-900 dark:border-slate-700">
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
                    className="col-span-3 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    {...register("salario", { required: true, valueAsNumber: true })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="bonificaciones" className="text-right dark:text-slate-300">
                    Bonificaciones
                  </Label>
                  <Input
                    id="bonificaciones"
                    type="number"
                    className="col-span-3 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    {...register("bonificaciones", { valueAsNumber: true })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="deducciones" className="text-right dark:text-slate-300">
                    Deducciones
                  </Label>
                  <Input
                    id="deducciones"
                    type="number"
                    className="col-span-3 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    {...register("deducciones", { valueAsNumber: true })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="horasExtras" className="text-right dark:text-slate-300">
                    Horas Extras
                  </Label>
                  <Input
                    id="horasExtras"
                    type="number"
                    className="col-span-3 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    {...register("horasExtras", { valueAsNumber: true })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="observaciones" className="text-right dark:text-slate-300">
                    Observaciones
                  </Label>
                  <Textarea
                    id="observaciones"
                    className="col-span-3 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    {...register("observaciones")}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => dispatch(closeDialog())} className="dark:border-slate-700 dark:hover:bg-slate-800">
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
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

export default Empleado
