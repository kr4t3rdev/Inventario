"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { createAnticipoAction } from "@/features/contabilidad/actions-anticipos"
import { Loader2 } from "lucide-react"
import { sileo } from "@/lib/sileo-shim"

const anticipoSchema = z.object({
  tipo: z.enum(["PAGO", "COBRO"], { required_error: "Seleccione el tipo de anticipo" }),
  contratoId: z.string().min(1, "Seleccione un contrato"),
  proveedorId: z.string().optional(),
  clienteId: z.string().optional(),
  monto: z.coerce.number().positive("El monto debe ser mayor que cero"),
  moneda: z.string().min(1, "Seleccione la moneda"),
  cuentaOrigenId: z.string().optional(),
  tipoPagoOrigenId: z.string().optional(),
  referenciaExterna: z.string().optional(),
  vigenciaHasta: z.string().optional(),
})

type AnticipoFormValues = z.infer<typeof anticipoSchema>

/**
 * @description Normaliza los valores del formulario al payload de creación de anticipos.
 * @param {AnticipoFormValues} data - Valores ingresados en el formulario.
 * @param {string | undefined} proveedorId - Proveedor resuelto desde el contrato.
 * @param {string | undefined} clienteId - Cliente resuelto desde el contrato.
 * @returns {import('@/app/models/model').CreateAnticipoRequest} Payload listo para la API.
 */
export function buildCreateAnticipoPayload(
  data: AnticipoFormValues,
  proveedorId?: string,
  clienteId?: string,
): import('@/app/models/model').CreateAnticipoRequest {
  return {
    tipo: data.tipo,
    contratoId: data.contratoId,
    proveedorId: data.tipo === 'PAGO' ? (proveedorId || data.proveedorId) : undefined,
    clienteId: data.tipo === 'COBRO' ? (clienteId || data.clienteId) : undefined,
    monto: data.monto,
    moneda: data.moneda,
    cuentaOrigenId: data.cuentaOrigenId,
    tipoPagoOrigenId: data.tipoPagoOrigenId,
    referenciaExterna: data.referenciaExterna,
    vigenciaHasta: data.vigenciaHasta || undefined,
  }
}

interface AnticipoFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contratos?: Array<{ nombre: string; contratoId: string; clienteId?: string; vendorId?: string }>
  clientes?: Array<{ clienteId: string; nombre: string }>
  proveedores?: Array<{ vendorId: string; nombre: string }>
  cuentasBancarias?: Array<{ cuentaId: string; nombreBanco: string; numeroCuenta: string }>
  tiposPago?: Array<{ tipoId: string; nombre: string }>
  onSuccess?: () => void
}

/**
 * @description Formulario para crear nuevos anticipos
 * @param {AnticipoFormProps} props - Props del componente
 * @returns {JSX.Element} Formulario de anticipo
 */
export function AnticipoForm({
  open,
  onOpenChange,
  contratos = [],
  clientes = [],
  proveedores = [],
  cuentasBancarias = [],
  tiposPago = [],
  onSuccess,
}: AnticipoFormProps) {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<AnticipoFormValues>({
    resolver: zodResolver(anticipoSchema),
    defaultValues: {
      tipo: "PAGO",
      monto: 0,
      moneda: "CUP",
    },
  })

  const tipoSeleccionado = form.watch("tipo")
  const contratoSeleccionado = form.watch("contratoId")

  // Resetear contratoId cuando cambia el tipo
  React.useEffect(() => {
    form.setValue("contratoId", "")
  }, [tipoSeleccionado, form])

  // Filtrar contratos según el tipo
  const contratosFiltrados = contratos.filter((c) => {
    if (tipoSeleccionado === "PAGO") return c.vendorId
    if (tipoSeleccionado === "COBRO") return c.clienteId
    return true
  })

  // Obtener cliente o proveedor del contrato seleccionado
  const contratoActual = contratos.find((c) => c.contratoId === contratoSeleccionado)
  const clienteDelContrato = clientes.find((c) => c.clienteId === contratoActual?.clienteId)
  const proveedorDelContrato = proveedores.find((p) => p.vendorId === contratoActual?.vendorId)

  const onSubmit = async (data: AnticipoFormValues) => {
    setIsLoading(true)
    try {
      const result = await createAnticipoAction(
        buildCreateAnticipoPayload(
          data,
          proveedorDelContrato?.vendorId,
          clienteDelContrato?.clienteId,
        )
      )

      if (!result.success) {
        throw new Error(result.error?.message || "No se pudo crear el anticipo")
      }

      sileo.success({ title: `El anticipo de ${data.tipo === "PAGO" ? "pago" : "cobro"} ha sido creado exitosamente.` })

      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      sileo.error({ title: error?.message || "No se pudo crear el anticipo"})
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Anticipo</DialogTitle>
          <DialogDescription>
            Complete los datos para registrar un nuevo anticipo de pago o cobro.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-4">
            {/* Tipo de Anticipo */}
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Anticipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PAGO">Pago (a proveedor)</SelectItem>
                      <SelectItem value="COBRO">Cobro (de cliente)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contrato */}
            <FormField
              control={form.control}
              name="contratoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contrato</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un contrato" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contratosFiltrados.map((contrato) => (
                        <SelectItem key={contrato.contratoId} value={contrato.contratoId}>
                          {contrato.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contraparte (solo lectura según contrato) */}
            {tipoSeleccionado === "PAGO" && proveedorDelContrato && (
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Input value={proveedorDelContrato.nombre} disabled />
              </div>
            )}
            {tipoSeleccionado === "COBRO" && clienteDelContrato && (
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input value={clienteDelContrato.nombre} disabled />
              </div>
            )}

            {/* Monto */}
            <FormField
              control={form.control}
              name="monto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Moneda */}
            <FormField
              control={form.control}
              name="moneda"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CUP">CUP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="MLC">MLC</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cuenta de Origen */}
            {cuentasBancarias.length > 0 && (
              <FormField
                control={form.control}
                name="cuentaOrigenId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta de Origen (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cuentasBancarias.map((cuenta) => (
                          <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                            {cuenta.nombreBanco} - {cuenta.numeroCuenta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Tipo de Pago de Origen */}
            {tiposPago.length > 0 && (
              <FormField
                control={form.control}
                name="tipoPagoOrigenId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Pago (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione tipo de pago" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tiposPago.map((tipo) => (
                          <SelectItem key={tipo.tipoId} value={tipo.tipoId}>
                            {tipo.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Referencia Externa */}
            <FormField
              control={form.control}
              name="referenciaExterna"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia Externa (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Factura, comprobante, nota..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vigencia */}
            <FormField
              control={form.control}
              name="vigenciaHasta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vigencia Hasta (Opcional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Anticipo
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
