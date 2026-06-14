"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { LazyMotion, m as motion } from "framer-motion"
import { Users, Loader2, UserCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { sileo } from '@/lib/sileo-shim'
import { Skeleton } from "@/components/ui/skeleton"
import { useClientes } from "@/features/clientes/hooks/use-clientes"
import { createClienteAction, updateClienteAction } from "@/features/clientes/actions"
import { useListasPrecios } from "@/features/listas-precios/hooks/use-listas-precios"
import { ClienteLogoUpload } from "./cliente-logo-upload"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const clienteSchema = z
  .object({
    nombre: z.string({
      required_error: 'El campo Nombre no ha sido rellenado',
    }),
    direccion: z.string().optional(),
    telefono: z.string().optional(),
    numeroCuentaCUP: z.string().optional(),
    numeroCuentaUSD: z.string().optional(),
    logoUrl: z.string().optional(),
    listaPrecioId: z.string().optional(),
  })

type ClienteFormValues = {
  nombre: string
  direccion?: string
  telefono?: string
  numeroCuentaCUP?: string
  numeroCuentaUSD?: string
  logoUrl?: string
  listaPrecioId?: string
}

interface ClienteFormProps {
  initialData?: {
    clienteId: string
    nombre: string
    direccion?: string
    telefono?: string
    numeroCuentaCUP?: string
    numeroCuentaUSD?: string
    numeroContrato?: string
    logoUrl?: string | null
    listaPrecioId?: string | null
    Venta?: any[]
    ventasServicios?: any[]
    createdAt?: string
    updatedAt?: string
  }
}

export function ClienteForm({ initialData }: ClienteFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const { clientes, isLoading: isLoadingClientes } = useClientes()
  const { listasPrecios, isLoading: isLoadingListas } = useListasPrecios()
  
  
  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nombre: initialData?.nombre || "",
      direccion: initialData?.direccion || "",
      telefono: initialData?.telefono || "",
      numeroCuentaCUP: initialData?.numeroCuentaCUP ?? "",
      numeroCuentaUSD: initialData?.numeroCuentaUSD ?? "",
      logoUrl: initialData?.logoUrl ?? undefined,
      listaPrecioId: initialData?.listaPrecioId ?? "none",
    }
  })

  async function onSubmit(data: ClienteFormValues) {
    setIsLoading(true)

    try {
      if (initialData) {
        const result = await updateClienteAction({
          clienteId: initialData.clienteId,
          nombre: data.nombre,
          direccion: data.direccion,
          telefono: data.telefono,
          numeroCuentaCUP: data.numeroCuentaCUP,
          numeroCuentaUSD: data.numeroCuentaUSD,
        } as any)
        if (!result.success) throw new Error(result.error?.message ?? 'Error al actualizar')
        sileo.success({ title: 'El cliente ha sido actualizado exitosamente.' })
      } else {
        const result = await createClienteAction({
          nombre: data.nombre,
          direccion: data.direccion,
          telefono: data.telefono,
          numeroCuentaCUP: data.numeroCuentaCUP,
          numeroCuentaUSD: data.numeroCuentaUSD,
        } as any)
        if (!result.success) throw new Error(result.error?.message ?? 'Error al crear')
        sileo.success({ title: 'El cliente ha sido registrado exitosamente.' })
      }
      router.push("/busy/cliente")
      router.refresh()
    } catch (error) {
      console.error("Error al guardar el cliente:", error)
      sileo.error({ title: 'Hubo un error al guardar el cliente.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingClientes) {
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
        <div className="h-1 bg-linear-to-r from-orange-500 via-red-500 to-orange-500" />
        <CardContent className="pt-6">
          <motion.div 
            className="flex items-center gap-3 mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <motion.div 
              className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <UserCircle className="h-5 w-5 text-white" />
            </motion.div>
            <div className="relative">
              <h2 className="text-lg font-semibold">
                {initialData ? "Editar Cliente" : "Nuevo Cliente"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {initialData ? "Modifique los datos del cliente" : "Ingrese los datos del cliente"}
              </p>

            </div>
          </motion.div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-6">
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
                        <Input 
                          type="text" 
                          {...field} 
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </FormControl>
                      <FormDescription>Ingrese el nombre del cliente.</FormDescription>
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
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo del Cliente</FormLabel>
                      <FormControl>
                        <ClienteLogoUpload
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormDescription>Sube un logo o imagen representativa del cliente.</FormDescription>
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
                  name="direccion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          {...field} 
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </FormControl>
                      <FormDescription>Ingrese la dirección del cliente.</FormDescription>
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
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          {...field} 
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </FormControl>
                      <FormDescription>Ingrese el teléfono del cliente.</FormDescription>
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
                  name="numeroCuentaCUP"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Cuenta CUP</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          {...field} 
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </FormControl>
                      <FormDescription>Ingrese el número de cuenta en CUP.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
              >
                <FormField
                  control={form.control}
                  name="numeroCuentaUSD"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Cuenta USD</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          {...field} 
                          className="transition-all duration-200 focus:scale-[1.01]"
                        />
                      </FormControl>
                      <FormDescription>Ingrese el número de cuenta en USD.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.48 }}
              >
                <FormField
                  control={form.control}
                  name="listaPrecioId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lista de Precios</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isLoading || isLoadingListas}
                      >
                        <FormControl>
                          <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                            <SelectValue placeholder="Seleccionar lista de precios..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin lista (usa precio sucursal/base)</SelectItem>
                          {listasPrecios?.map((lista) => (
                            <SelectItem key={lista.id} value={lista.id}>
                              {lista.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Lista de precios preferencial para este cliente.</FormDescription>
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
                  <Button type="button" variant="outline" onClick={() => router.push("/busy/cliente")}>
                    Cancelar
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : initialData ? (
                      "Actualizar Cliente"
                    ) : (
                      "Registrar Cliente"
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
