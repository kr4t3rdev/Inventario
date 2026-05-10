"use client"

import React, { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { sileo } from '@/lib/sileo-shim'
import { getAuthToken } from "@/lib/token"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { motion } from "framer-motion"
import { Switch } from "@/components/ui/switch"
import { FormDescription } from "@/components/ui/form"
import { Barcode, TriangleAlert } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { CuentaBancariaItem, MiEmpresaFormValues as MiEmpresaFormValuesType } from '../lib/miEmpresaUtils'
import { normalizeMiEmpresaFormValues } from '../lib/miEmpresaUtils'

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
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 },
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1 },
}

const miEmpresaSchema = z.object({
  nombre: z.string().optional(),
  propietario: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  carnetIdentidad: z.string().optional(),
  nit: z.string().optional(),
  licenciaOperacion: z.string().optional(),
  logoUrl: z.string().optional().or(z.literal("")),
  cuentaBancariaId: z.string().optional(),
  usaCodigoEan13: z.boolean().optional(),
})

interface MiEmpresaFormProps {
  /** Datos iniciales de la empresa (server-side) */
  initialData?: MiEmpresaFormValuesType
  /** Cuentas bancarias activas del tenant (server-side) */
  cuentas?: CuentaBancariaItem[]
}

/** Tipo interno para la respuesta de la API (formato plano del empresa) */
type MiEmpresaApiResponse = {
  nombre: string
  propietario: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  carnetIdentidad: string | null
  nit: string | null
  licenciaOperacion: string | null
  logoUrl: string | null
  cuentaBancariaId: string | null
  usaCodigoEan13: boolean
}

async function saveMiEmpresa(values: MiEmpresaFormValuesType): Promise<MiEmpresaApiResponse> {
  const token = getAuthToken()
  const payload = normalizeMiEmpresaFormValues(values)

  const res = await fetch("/api/mi-empresa", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    
    // Si hay errores de validación por campo, lanzar objeto con estructura especial
    if ((data as any)?.fieldErrors) {
      const error = new Error('Validation errors') as any
      error.fieldErrors = (data as any).fieldErrors
      throw error
    }
    
    const message = (data as any)?.error || "Error guardando Mi Empresa"
    throw new Error(message)
  }
  const json = await res.json().catch(() => null)
  if (!json) throw new Error('Respuesta inválida al guardar Mi Empresa')
  const responseData = (json?.data ?? json) as MiEmpresaApiResponse
  return responseData
}

export function MiEmpresaForm({ initialData, cuentas = [] }: MiEmpresaFormProps) {
  const [saving, setSaving] = useState(false)
  const [showEan13Confirmation, setShowEan13Confirmation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savedUsaEan13, setSavedUsaEan13] = useState(initialData?.usaCodigoEan13 ?? false)

  const defaultValues = initialData ?? {
    nombre: "Mi Empresa",
    propietario: "",
    direccion: "",
    telefono: "",
    email: "",
    carnetIdentidad: "",
    nit: "",
    licenciaOperacion: "",
    logoUrl: "",
    cuentaBancariaId: "none",
  }

  const form = useForm<MiEmpresaFormValuesType>({
    resolver: zodResolver(miEmpresaSchema),
    defaultValues,
  })

  /**
   * @description Maneja el cambio del switch EAN-13. Si se desactiva, envía directamente. Si se activa, muestra diálogo.
   * @param {boolean} checked - Nuevo estado del switch
   */
  const handleEan13Toggle = async (checked: boolean) => {
    if (!checked) {
      // Desactivando EAN-13 - sin confirmación necesaria
      setIsSubmitting(true)
      try {
        const token = getAuthToken()
        const res = await fetch('/api/mi-empresa', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: token } : {}),
          },
          body: JSON.stringify({ usaCodigoEan13: false }),
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || 'Error al actualizar configuración')
        }

        sileo.success({ title: (data as { message?: string }).message || 'Configuración actualizada' })
        form.setValue('usaCodigoEan13', false, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: false,
        })
        setSavedUsaEan13(false)
      } catch (error) {
        sileo.error({
          title: error instanceof Error ? error.message : 'Error al actualizar',
        })
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // Activando EAN-13 - mostrar diálogo de confirmación
      setShowEan13Confirmation(true)
    }
  }

  /**
   * @description Confirma la activación de EAN-13 y ejecuta el reset de productos
   */
  const handleConfirmEan13Reset = async () => {
    setIsSubmitting(true)
    setShowEan13Confirmation(false)
    try {
      const token = getAuthToken()
      const res = await fetch('/api/mi-empresa', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({
          usaCodigoEan13: true,
          confirmReset: true,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Error al activar EAN-13')
      }

      const responseData = (data as { data?: MiEmpresaApiResponse; message?: string }).data
      sileo.success({ title: (data as { message?: string }).message || 'EAN-13 activado correctamente' })
      form.setValue('usaCodigoEan13', responseData?.usaCodigoEan13 ?? true, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
      setSavedUsaEan13(responseData?.usaCodigoEan13 ?? true)
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : 'Error al activar EAN-13',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmit = async (values: MiEmpresaFormValuesType) => {
    setSaving(true)
    try {
      const saved = await saveMiEmpresa(values)
      form.reset({
        nombre: saved.nombre || "Mi Empresa",
        propietario: saved.propietario || "",
        direccion: saved.direccion || "",
        telefono: saved.telefono || "",
        email: saved.email || "",
        carnetIdentidad: saved.carnetIdentidad || "",
        nit: saved.nit || "",
        licenciaOperacion: saved.licenciaOperacion || "",
        logoUrl: saved.logoUrl || "",
        cuentaBancariaId: saved.cuentaBancariaId || "none",
        usaCodigoEan13: saved.usaCodigoEan13 ?? false,
      })
      sileo.success({ title: 'Mi Empresa actualizada' })
    } catch (e) {
      const error = e as any
      
      // Si hay errores de validación por campo, mostrar cada uno
      if (error.fieldErrors && typeof error.fieldErrors === 'object') {
        Object.entries(error.fieldErrors).forEach(([field, message]) => {
          form.setError(field as any, { message: message as string })
        })
        sileo.error({ title: 'Por favor revisa los errores en los campos' })
      } else {
        // Error general
        sileo.error({ title: error instanceof Error ? error.message : 'Error guardando Mi Empresa' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.005, y: -2 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Mi Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-5"
              >
              <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <motion.div whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                          <Input placeholder="Mi Empresa" {...field} disabled={saving} />
                        </motion.div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="propietario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Propietario</FormLabel>
                      <FormControl>
                        <motion.div whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                          <Input placeholder="Nombre del propietario" autoComplete="name" {...field} value={field.value ?? ""} disabled={saving} />
                        </motion.div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="carnetIdentidad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carnet de Identidad</FormLabel>
                      <FormControl>
                        <motion.div whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                          <Input placeholder="Carnet de Identidad" {...field} disabled={saving} />
                        </motion.div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NIT</FormLabel>
                      <FormControl>
                        <motion.div whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                          <Input placeholder="NIT" {...field} disabled={saving} />
                        </motion.div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="licenciaOperacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Licencia de Operación</FormLabel>
                      <FormControl>
                        <motion.div whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                          <Input placeholder="Licencia de Operación" {...field} disabled={saving} />
                        </motion.div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <motion.div whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                          <Input placeholder="+53 ..." {...field} disabled={saving} />
                        </motion.div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <motion.div whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                          <Input placeholder="email@empresa.com" {...field} disabled={saving} />
                        </motion.div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <FormField
                  control={form.control}
                  name="direccion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <motion.div whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                          <Textarea placeholder="Dirección de la empresa" {...field} disabled={saving} />
                        </motion.div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo</FormLabel>
                      <FormControl>
                        <div className="flex flex-col gap-4">
                          {field.value && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ type: "spring", stiffness: 300 }}
                              className="relative w-32 h-32 border rounded-md overflow-hidden bg-muted/50"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={field.value}
                                alt="Logo preview"
                                className="w-full h-full object-contain p-2"
                              />
                            </motion.div>
                          )}
                          <div className="flex gap-2 items-center">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return

                                const formData = new FormData()
                                formData.append("file", file)

                                const loadingToastId = sileo.info({ title: 'Subiendo logo...' })

                                try {
                                  const res = await fetch("/api/upload", {
                                    method: "POST",
                                    headers: {
                                      Authorization: getAuthToken(),
                                    },
                                    body: formData,
                                  })

                                  if (!res.ok) throw new Error("Error subiendo imagen")

                                  const data = await res.json()
                                  field.onChange(data.url)
                                  sileo.success({ title: 'Logo subido correctamente' })
                                } catch (error) {
                                  console.error(error)
                                  sileo.error({ title: 'Error al subir el logo' })
                                } finally {
                                  sileo.dismiss(loadingToastId)
                                }
                              }}
                              disabled={saving}
                              className="cursor-pointer"
                            />
                            {field.value && (
                              <motion.div
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => field.onChange("")}
                                  title="Eliminar logo"
                                >
                                  <span className="sr-only">Eliminar</span>
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                  >
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                  </svg>
                                </Button>
                              </motion.div>
                            )}
                          </div>
                          {/* Campo oculto para mantener el valor en el formulario */}
                          <input type="hidden" {...field} value={field.value || ""} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cuentaBancariaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cuenta bancaria (beneficiario)</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={(v) => field.onChange(v)}
                        disabled={saving}
                      >
                        <FormControl>
                          <motion.div whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar cuenta..." />
                            </SelectTrigger>
                          </motion.div>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin cuenta</SelectItem>
                          {cuentas.map((c) => (
                            <SelectItem key={c.cuentaId} value={c.cuentaId}>
                              {c.nombreBanco} · {c.numeroCuenta} · {c.moneda}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <FormField
                  control={form.control}
                  name="usaCodigoEan13"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-xl border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-2">
                          <Barcode className="h-4 w-4" />
                          Codificación EAN-13
                        </FormLabel>
                        <FormDescription>
                          Activa para generar códigos de barras EAN-13. Las categorías de productos
                          deben seguir el Clasificador oficial (CLAS).
                        </FormDescription>
                      </div>
                       <FormControl>
                         <Switch
                           checked={field.value ?? false}
                           onCheckedChange={handleEan13Toggle}
                           disabled={saving || isSubmitting}
                         />
                       </FormControl>
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div 
                variants={itemVariants}
                className="flex justify-end gap-2"
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    disabled={saving}
                  >
                    Reiniciar
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Button type="submit" disabled={saving}>
                    Guardar
                  </Button>
                </motion.div>
              </motion.div>
              </motion.div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AlertDialog open={showEan13Confirmation} onOpenChange={setShowEan13Confirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Activar EAN-13</AlertDialogTitle>
            <AlertDialogDescription>
              Activar el sistema EAN-13 eliminará TODOS los productos existentes en el catálogo.
              El histórico de ventas se conservará.
              <br />
              <br />
              <strong>¿Está seguro de que desea continuar?</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmEan13Reset}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? 'Procesando...' : 'Sí, activar EAN-13'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
