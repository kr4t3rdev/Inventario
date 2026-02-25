"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { getAuthToken } from "@/lib/token"
import { useGetCuentasBancariasQuery } from "@/lib/redux/services/contabilidadApi"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { motion } from "framer-motion"

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
  nombre: z.string().min(1, "Nombre requerido"),
  propietario: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  carnetIdentidad: z.string().optional(),
  nit: z.string().optional(),
  licenciaOperacion: z.string().optional(),
  logoUrl: z.string().optional().or(z.literal("")),
  cuentaBancariaId: z.string().optional(),
})

export type MiEmpresaFormValues = z.infer<typeof miEmpresaSchema>

type MiEmpresaApiResponse = {
  id: number
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
}

async function fetchMiEmpresa(): Promise<MiEmpresaApiResponse> {
  const token = getAuthToken()
  const res = await fetch("/api/mi-empresa", {
    headers: token ? { Authorization: token } : undefined,
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error("Error cargando Mi Empresa")
  }
  return (await res.json()) as MiEmpresaApiResponse
}

async function saveMiEmpresa(values: MiEmpresaFormValues): Promise<MiEmpresaApiResponse> {
  const token = getAuthToken()
  const payload = {
    nombre: values.nombre,
    propietario: values.propietario?.trim() ? values.propietario.trim() : null,
    direccion: values.direccion?.trim() ? values.direccion.trim() : null,
    telefono: values.telefono?.trim() ? values.telefono.trim() : null,
    email: values.email?.trim() ? values.email.trim() : null,
    carnetIdentidad: values.carnetIdentidad?.trim() ? values.carnetIdentidad.trim() : null,
    nit: values.nit?.trim() ? values.nit.trim() : null,
    licenciaOperacion: values.licenciaOperacion?.trim() ? values.licenciaOperacion.trim() : null,
    logoUrl: values.logoUrl?.trim() ? values.logoUrl.trim() : null,
    cuentaBancariaId: values.cuentaBancariaId === "none" ? null : values.cuentaBancariaId?.trim() ? values.cuentaBancariaId.trim() : null,
  }

  const res = await fetch("/api/mi-empresa", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const message = (data as any)?.error || "Error guardando Mi Empresa"
    throw new Error(message)
  }
  return (await res.json()) as MiEmpresaApiResponse
}

export function MiEmpresaForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { data: cuentasData, isLoading: isLoadingCuentas } = useGetCuentasBancariasQuery()

  const cuentas = useMemo(() => {
    const list = cuentasData?.cuentas ?? []
    return list.filter((c) => c.isActive !== false)
  }, [cuentasData])

  const form = useForm<MiEmpresaFormValues>({
    resolver: zodResolver(miEmpresaSchema),
    defaultValues: {
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
    },
  })

  useEffect(() => {
    let mounted = true
    fetchMiEmpresa()
      .then((data) => {
        if (!mounted) return
        form.reset({
          nombre: data.nombre ?? "Mi Empresa",
          propietario: data.propietario ?? "",
          direccion: data.direccion ?? "",
          telefono: data.telefono ?? "",
          email: data.email ?? "",
          carnetIdentidad: data.carnetIdentidad ?? "",
          nit: data.nit ?? "",
          licenciaOperacion: data.licenciaOperacion ?? "",
          logoUrl: data.logoUrl ?? "",
          cuentaBancariaId: data.cuentaBancariaId ?? "none",
        })
      })
      .catch(() => {
        toast.error("No se pudo cargar la configuración de Mi Empresa")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [form])

  const onSubmit = async (values: MiEmpresaFormValues) => {
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
      })
      toast.success("Mi Empresa actualizada")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando Mi Empresa")
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
                          <Input placeholder="Mi Empresa" {...field} disabled={loading || saving} />
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
                          <Input placeholder="Nombre del propietario" autoComplete="name" {...field} value={field.value ?? ""} disabled={loading || saving} />
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
                          <Input placeholder="Carnet de Identidad" {...field} disabled={loading || saving} />
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
                          <Input placeholder="NIT" {...field} disabled={loading || saving} />
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
                          <Input placeholder="Licencia de Operación" {...field} disabled={loading || saving} />
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
                          <Input placeholder="+53 ..." {...field} disabled={loading || saving} />
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
                          <Input placeholder="email@empresa.com" {...field} disabled={loading || saving} />
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
                          <Textarea placeholder="Dirección de la empresa" {...field} disabled={loading || saving} />
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

                                const loadingToast = toast.loading("Subiendo logo...")

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
                                  toast.success("Logo subido correctamente")
                                } catch (error) {
                                  console.error(error)
                                  toast.error("Error al subir el logo")
                                } finally {
                                  toast.dismiss(loadingToast)
                                }
                              }}
                              disabled={loading || saving}
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
                        disabled={loading || saving || isLoadingCuentas}
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
                    disabled={loading || saving}
                  >
                    Reiniciar
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Button type="submit" disabled={loading || saving}>
                    Guardar
                  </Button>
                </motion.div>
              </motion.div>
              </motion.div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
