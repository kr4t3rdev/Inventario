"use client"

import { motion } from "framer-motion"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { v4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { useAddEmpleadoMutation, useGetEmpleadosQuery, useUpdateEmpleadoMutation } from "@/lib/redux/services/empleadosApi"
import { Users, Loader2 } from "lucide-react"

const empleadoSchema = z.object({
  nombre: z.string({
    required_error: "escriba un nombre",
  }),
  apellido: z.string({
    required_error: "escriba el apellido",
  }),
  telefono: z.string({
    required_error: "escriba un telefono",
  }),
  cargo: z.string({
    required_error: "escriba un cargo",
  }),
})

type EmpleadoFormValues = z.infer<typeof empleadoSchema>

type EmpleadoSubmitData = {
  nombre: string
  apellido: string
  telefono: string
  cargo: string
  periodo: string
  salarioBases: number
}

interface EmpleadoFormProps {
  initialData?: {
    empleadoId: string
    nombre: string
    apellido: string | null
    telefono?: string | undefined
    periodo: string
    salarioBases: number
    cargo: string
    ventas?: any[]
    PagoSalario?: any[]
    createdAt?: string
    updatedAt?: string
  }
}

const formFieldVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: [0.25, 0.4, 0.25, 1] as const
    }
  })
}

export function EmpleadoForm({ initialData }: EmpleadoFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const { isLoading: isLoadingEmpleados } = useGetEmpleadosQuery()

  const [addEmpleados] = useAddEmpleadoMutation()
  const [updateEmpleados] = useUpdateEmpleadoMutation()

  const form = useForm<EmpleadoFormValues>({
    resolver: zodResolver(empleadoSchema),
    defaultValues: {
      nombre: initialData?.nombre || '',
      apellido: initialData?.apellido || '',
      telefono: initialData?.telefono || '',
      cargo: initialData?.cargo || '',
    },
  })

  async function onSubmit(data: EmpleadoFormValues) {
    setIsLoading(true)
    try {
      const submitData: EmpleadoSubmitData = { ...data, periodo: '', salarioBases: 0 }
      if (!initialData) {
        submitData.periodo = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
        submitData.salarioBases = 0
      } else {
        submitData.periodo = initialData.periodo
        submitData.salarioBases = initialData.salarioBases
      }
      if (initialData) {
        await updateEmpleados({
          empleadoId: initialData.empleadoId,
          ...submitData,
        }).unwrap()
        toast.success("Los empleados han sido actualizados exitosamente.")
        router.push("/busy/empleados")
      } else {
        await addEmpleados({
          empleadoId: v4(),
          ...submitData
        }).unwrap()
        toast.success("El empleado ha sido registrado exitosamente.")
      }

      router.back()
    } catch (error) {
      console.error("Error al guardar el empleado:", error)
      toast.error("Hubo un error al guardar el empleado.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingEmpleados) {
    return (
      <Card className="border-dashed dark:border-slate-700 dark:bg-slate-900/50">
        <CardHeader>
          <div className="h-1 bg-gradient-to-r from-primary via-purple-500 to-primary rounded-t-lg" />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Skeleton className="h-10 w-full dark:bg-slate-800" />
              </motion.div>
            ))}
            <div className="flex justify-end space-x-4">
              <Skeleton className="h-10 w-24 dark:bg-slate-800" />
              <Skeleton className="h-10 w-32 dark:bg-slate-800" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-dashed dark:border-slate-700 dark:bg-slate-900/50 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
      <CardHeader>
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div
            className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Users className="h-5 w-5 text-white" />
          </motion.div>
          <CardTitle className="text-xl dark:text-slate-100">
            {initialData ? "Editar Empleado" : "Nuevo Empleado"}
          </CardTitle>
        </motion.div>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <motion.div
              custom={0}
              variants={formFieldVariants}
              initial="hidden"
              animate="visible"
            >
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-slate-200">Nombre</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        {...field}
                        className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </FormControl>
                    <FormDescription className="dark:text-slate-400">
                      Ingrese el nombre del empleado.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            <motion.div
              custom={1}
              variants={formFieldVariants}
              initial="hidden"
              animate="visible"
            >
              <FormField
                control={form.control}
                name="apellido"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-slate-200">Apellidos</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        {...field}
                        className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </FormControl>
                    <FormDescription className="dark:text-slate-400">
                      Ingrese el apellido del empleado.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            <motion.div
              custom={2}
              variants={formFieldVariants}
              initial="hidden"
              animate="visible"
            >
              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-slate-200">Teléfono</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        {...field}
                        className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </FormControl>
                    <FormDescription className="dark:text-slate-400">
                      Ingrese el teléfono del empleado.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            <motion.div
              custom={3}
              variants={formFieldVariants}
              initial="hidden"
              animate="visible"
            >
              <FormField
                control={form.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-slate-200">Cargo</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        {...field}
                        className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </FormControl>
                    <FormDescription className="dark:text-slate-400">
                      Ingrese el cargo del empleado.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            <motion.div
              className="flex justify-end space-x-4 pt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/busy/empleados")}
                  className="dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancelar
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg hover:shadow-xl transition-shadow"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : initialData ? (
                    "Actualizar"
                  ) : (
                    "Crear"
                  )}
                </Button>
              </motion.div>
            </motion.div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
