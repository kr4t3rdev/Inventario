'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useClientes } from "@/features/clientes/hooks/use-clientes"
import { useVendors } from '@/features/vendors/hooks/use-vendors'
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Sparkles, ArrowLeft, Loader2, Receipt, Building2, UserCircle, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SelectSeparator } from "@/components/ui/select"
import { createContratoAction } from "@/features/contratos"
import { getAuthToken } from '@/lib/token'

interface Cliente {
  clienteId: string
  nombre: string
  empresa: string
}

interface Vendor {
  vendorId: string
  nombre: string
}

interface TipoCustom {
  tipoCustomId: string
  nombre: string
}

interface ContratoFormProps {
  initialData?: {
    contratoId: string
    tipo: string
    fechaInicio: string
    fechaFin: string | null
    monto: string | null
    moneda: string
    esMultiMoneda: boolean
    clienteId: string | null
    vendorId: string | null
    numeroContratoClienteProveedor: string | null
    observaciones: string | null
    condiciones: unknown
  }
  initialClientes?: Cliente[]
  initialVendors?: Vendor[]
  initialTiposCustom?: TipoCustom[]
  isUpdate?: boolean
}

/**
 * @description Componente de formulario para crear/editar contratos
 * @param {ContratoFormProps} props - Props del componente
 * @returns {JSX.Element} Formulario de contrato
 */
export function ContratoForm({
  initialData,
  initialClientes,
  initialVendors,
  initialTiposCustom,
  isUpdate = false
}: ContratoFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [tiposCustom, setTiposCustom] = useState<TipoCustom[]>(initialTiposCustom || [])

  // Dual mode: usar datos iniciales del server o fallback a hook
  const { clientes: clientesFromQuery, isLoading: isLoadingClientesQuery } = useClientes()
  const { vendors: vendorsFromQuery, isLoading: isLoadingVendorsQuery } = useVendors()

  const clientes = initialClientes || clientesFromQuery || []
  const vendors = initialVendors || vendorsFromQuery || []

  const isLoadingClientes = isLoadingClientesQuery && !initialClientes
  const isLoadingVendors = isLoadingVendorsQuery && !initialVendors

  const [formData, setFormData] = useState({
    tipo: initialData?.tipo || 'COMPRA_VENTA',
    fechaInicio: initialData?.fechaInicio ? initialData.fechaInicio.split('T')[0] : '',
    fechaFin: initialData?.fechaFin ? initialData.fechaFin.split('T')[0] : '',
    monto: initialData?.monto || '',
    moneda: initialData?.moneda || 'CUP',
    esMultiMoneda: initialData?.esMultiMoneda || false,
    clienteId: initialData?.clienteId || '',
    vendorId: initialData?.vendorId || '',
    numeroContratoClienteProveedor: initialData?.numeroContratoClienteProveedor || '',
    observaciones: initialData?.observaciones || '',
  })

  useEffect(() => {
      // Si no hay tiposCustom iniciales, fetch del API
      if (!initialTiposCustom) {
      fetch('/api/tipos-contratos?activos=true', {
        headers: {
          Authorization: getAuthToken(),
        },
      })
        .then(r => r.json())
        .then(data => setTiposCustom(data.data || []))
        .catch(() => {})
      }
  }, [initialTiposCustom])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.fechaInicio) {
      toast.error('La fecha de inicio es requerida')
      return
    }

    if (!formData.clienteId && !formData.vendorId) {
      toast.error('Debes seleccionar un cliente o un proveedor')
      return
    }

    setIsLoading(true)

    try {
      if (isUpdate && initialData) {
        // Usar update action
        const { updateContratoAction } = await import('@/features/contratos')
        await updateContratoAction({
          contratoId: initialData.contratoId,
          tipo: formData.tipo,
          fechaInicio: formData.fechaInicio,
          fechaFin: formData.fechaFin || undefined,
  // @ts-expect-error - El tipo de monto se normaliza antes de enviar la acción.
          monto: formData.monto ? parseFloat(formData.monto) : undefined,
          moneda: formData.moneda,
          esMultiMoneda: formData.esMultiMoneda,
          clienteId: formData.clienteId || undefined,
          vendorId: formData.vendorId || undefined,
          numeroContratoClienteProveedor: formData.numeroContratoClienteProveedor || undefined,
          observaciones: formData.observaciones || undefined,
        })
        toast.success('El contrato ha sido actualizado exitosamente.')
        router.push(`/busy/contratos/${initialData.contratoId}`)
      } else {
        // Usar create action
        await createContratoAction({
          tipo: formData.tipo,
          fechaInicio: formData.fechaInicio,
          fechaFin: formData.fechaFin || null,
  // @ts-expect-error - El tipo de monto se normaliza antes de enviar la acción.
          monto: formData.monto ? parseFloat(formData.monto) : null,
          moneda: formData.moneda,
          esMultiMoneda: formData.esMultiMoneda,
          clienteId: formData.clienteId || null,
          vendorId: formData.vendorId || null,
          numeroContratoClienteProveedor: formData.numeroContratoClienteProveedor || null,
          observaciones: formData.observaciones || null,
        })
        toast.success('El contrato ha sido creado exitosamente.')
        router.push('/busy/contratos')
      }
    } catch (error) {
      console.error('Error al guardar contrato:', error)
      toast.error('Error al guardar contrato')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingClientes || isLoadingVendors) {
    return (
      <motion.div
        className="flex items-center justify-center min-h-[400px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center gap-3 mb-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <motion.div
          className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <FileText className="h-5 w-5 text-white" />
        </motion.div>
        <div className="relative">
          <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            {isUpdate ? 'Editar Contrato' : 'Nuevo Contrato'}
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

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Tipo de Contrato */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Tipo de Contrato
              </CardTitle>
              <CardDescription>
                Selecciona el tipo de contrato que deseas crear
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.tipo}
                onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}
                className="flex flex-wrap gap-4"
              >
                {tiposCustom.length > 0 ? (
                  tiposCustom.map((tipo) => (
                    <div key={tipo.tipoCustomId} className="flex items-center space-x-2">
                      <RadioGroupItem value={tipo.tipoCustomId} id={tipo.tipoCustomId} />
                      <Label htmlFor={tipo.tipoCustomId}>{tipo.nombre}</Label>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="COMPRA_VENTA" id="COMPRA_VENTA" />
                      <Label htmlFor="COMPRA_VENTA">Compra Venta</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="SERVICIO" id="SERVICIO" />
                      <Label htmlFor="SERVICIO">Servicio</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="PROVEEDOR" id="PROVEEDOR" />
                      <Label htmlFor="PROVEEDOR">Proveedor</Label>
                    </div>
                  </>
                )}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Fechas y Monto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Período y Monto
              </CardTitle>
              <CardDescription>
                Define el período de vigencia y el monto del contrato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fechaInicio">Fecha de Inicio *</Label>
                  <Input
                    id="fechaInicio"
                    type="date"
                    value={formData.fechaInicio}
                    onChange={(e) => setFormData(prev => ({ ...prev, fechaInicio: e.target.value }))}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="fechaFin">Fecha de Fin</Label>
                  <Input
                    id="fechaFin"
                    type="date"
                    value={formData.fechaFin}
                    onChange={(e) => setFormData(prev => ({ ...prev, fechaFin: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="monto">Monto</Label>
                  <Input
                    id="monto"
                    type="number"
                    step="0.01"
                    value={formData.monto}
                    onChange={(e) => setFormData(prev => ({ ...prev, monto: e.target.value }))}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="moneda">Moneda</Label>
                  <Select
                    value={formData.moneda}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, moneda: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUP">CUP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="MXN">MXN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="esMultiMoneda"
                    checked={formData.esMultiMoneda}
                    onChange={(e) => setFormData(prev => ({ ...prev, esMultiMoneda: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="esMultiMoneda" className="text-sm cursor-pointer">
                    Acepta múltiples monedas
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cliente / Proveedor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {formData.clienteId ? 'Cliente Seleccionado' : formData.vendorId ? 'Proveedor Seleccionado' : 'Seleccionar Parte'}
              </CardTitle>
              <CardDescription>
                Selecciona un cliente o proveedor para este contrato
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cliente */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Cliente</Label>
                  <Select
                    value={formData.clienteId}
                    onValueChange={(value) => {
                      setFormData(prev => ({
                        ...prev,
                        clienteId: value,
                        vendorId: value ? '' : prev.vendorId
                      }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente: any) => (
                        <SelectItem key={cliente.clienteId} value={cliente.clienteId}>
                          {cliente.nombre} {cliente.empresa ? `(${cliente.empresa})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Proveedor */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Proveedor</Label>
                  <Select
                    value={formData.vendorId}
                    onValueChange={(value) => {
                      setFormData(prev => ({
                        ...prev,
                        vendorId: value,
                        clienteId: value ? '' : prev.clienteId
                      }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor: any) => (
                        <SelectItem key={vendor.vendorId} value={vendor.vendorId}>
                          {vendor.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información Adicional */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                Información Adicional
              </CardTitle>
              <CardDescription>
                Agrega información adicional opcional
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="numeroContratoClienteProveedor">Número de Contrato del Cliente/Proveedor</Label>
                <Input
                  id="numeroContratoClienteProveedor"
                  value={formData.numeroContratoClienteProveedor}
                  onChange={(e) => setFormData(prev => ({ ...prev, numeroContratoClienteProveedor: e.target.value }))}
                  placeholder="Número de contrato del cliente/proveedor"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                  placeholder="Observaciones adicionales..."
                  rows={4}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild type="button">
              <Link href="/busy/contratos">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancelar
              </Link>
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-linear-to-r from-primary to-purple-600">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {isUpdate ? 'Actualizar Contrato' : 'Crear Contrato'}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </motion.div>
  )
}
