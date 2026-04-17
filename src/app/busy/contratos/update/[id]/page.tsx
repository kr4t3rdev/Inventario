'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { useGetClientesQuery } from "@/lib/redux/services/ClienteApi"
import { useGetVendorsQuery } from "@/lib/redux/services/vendorsApi"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { getAuthToken } from "@/lib/token"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Sparkles, ArrowLeft, Loader2, Receipt, Building2, UserCircle, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SelectSeparator } from "@/components/ui/select"

export default function UpdateContratoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [tiposCustom, setTiposCustom] = useState<{ tipoCustomId: string; nombre: string }[]>([])
  
  // Queries
  const { data: clientes, isLoading: isLoadingClientes } = useGetClientesQuery()
  const { data: vendors, isLoading: isLoadingVendors } = useGetVendorsQuery()

  const [formData, setFormData] = useState({
    tipo: 'COMPRA_VENTA' as string,
    fechaInicio: '',
    fechaFin: '',
    monto: '',
    moneda: 'CUP',
    esMultiMoneda: false,
    clienteId: '',
    vendorId: '',
    numeroContratoClienteProveedor: '',
    observaciones: '',
    numeroContrato: '',
  })

  useEffect(() => {
    if (id) {
      fetchContrato(id)
    }
  }, [id])

  useEffect(() => {
    fetch('/api/tipos-contratos?activos=true', {
      headers: { Authorization: getAuthToken() },
    })
      .then(r => r.json())
      .then(data => setTiposCustom(data.data || []))
      .catch(() => {})
  }, [])

  const fetchContrato = async (contratoId: string) => {
    setIsFetching(true)
    try {
      const response = await fetch(`/api/contratos/${contratoId}`, {
        headers: {
          'Authorization': getAuthToken(),
        },
      })
      
      if (!response.ok) {
        throw new Error('Error al cargar el contrato')
      }
      
      const data = await response.json()
      
      setFormData({
        tipo: data.tipo,
        fechaInicio: data.fechaInicio ? new Date(data.fechaInicio).toISOString().split('T')[0] : '',
        fechaFin: data.fechaFin ? new Date(data.fechaFin).toISOString().split('T')[0] : '',
        monto: data.monto || '',
        moneda: data.moneda || 'CUP',
        esMultiMoneda: data.esMultiMoneda || false,
        clienteId: data.clienteId || '',
        vendorId: data.vendorId || '',
        numeroContratoClienteProveedor: data.numeroContratoClienteProveedor || '',
        observaciones: data.observaciones || '',
        numeroContrato: data.numeroContrato || '',
      })
    } catch (error) {
      console.error('Error:', error)
      toast.error('No se pudo cargar la información del contrato')
    } finally {
      setIsFetching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validación client-side
    if (!formData.fechaInicio) {
      toast.error('La fecha de inicio es requerida')
      return
    }

    if (formData.tipo === 'COMPRA_VENTA' || formData.tipo === 'SERVICIO') {
      if (!formData.clienteId) {
        toast.error('El cliente es requerido para contratos de tipo ' + formData.tipo)
        return
      }
    } else if (formData.tipo === 'SUMINISTROS') {
      if (!formData.vendorId) {
        toast.error('El proveedor es requerido para contratos de tipo SUMINISTROS')
        return
      }
    }

    setIsLoading(true)

    try {
      const payload = {
        ...formData,
        clienteId: formData.clienteId || null,
        vendorId: formData.vendorId || null,
        monto: formData.monto || null,
        fechaInicio: new Date(formData.fechaInicio).toISOString(),
        fechaFin: formData.fechaFin ? new Date(formData.fechaFin).toISOString() : null,
        observaciones: formData.observaciones,
      }

      const response = await fetch(`/api/contratos/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthToken(),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al actualizar contrato')
      }

      toast.success('El contrato ha sido actualizado exitosamente.')
      router.push('/busy/contratos')
    } catch (error) {
      console.error('Error al actualizar contrato:', error)
      toast.error('Error al actualizar contrato')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTipoChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      tipo: value,
      clienteId: value === 'SUMINISTROS' ? '' : prev.clienteId,
      vendorId: value !== 'SUMINISTROS' ? '' : prev.vendorId,
    }))
  }

  if (isFetching) {
    return (
      <div className="container mx-auto py-4">
        <motion.div 
          className="flex items-center gap-2 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="h-8 w-32 bg-muted animate-pulse rounded mb-4"></div>
        </motion.div>
        <div className="flex items-center justify-center py-12">
          <motion.div
            className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-4">
      {/* Header */}
      <motion.div 
        className="mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href="/busy/contratos">
              <Button variant="outline" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
          <motion.div 
            className="flex items-center gap-3"
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
                Editar Contrato
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
        </div>
        <motion.p 
          className="text-muted-foreground ml-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {formData.numeroContrato}
        </motion.p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-dashed overflow-hidden">
            <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Tipo de Contrato */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <label className="flex items-center gap-2 text-sm font-medium mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Tipo de Contrato
                  </label>
                  <Select
                    value={formData.tipo}
                    onValueChange={handleTipoChange}
                  >
                    <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                      <SelectValue placeholder="Seleccione el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPRA_VENTA">Compra - Venta</SelectItem>
                      <SelectItem value="SERVICIO">Servicio</SelectItem>
                      <SelectItem value="SUMINISTROS">Suministros</SelectItem>
                      {tiposCustom.length > 0 && (
                        <>
                          <SelectSeparator />
                          {tiposCustom.map(t => (
                            <SelectItem key={t.tipoCustomId} value={t.nombre}>
                              {t.nombre}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </motion.div>

                {/* Cliente o Proveedor */}
                <AnimatePresence mode="wait">
                  {(formData.tipo === 'COMPRA_VENTA' || formData.tipo === 'SERVICIO') && (
                    <motion.div
                      key="cliente"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        Cliente
                      </label>
                      <Select
                        value={formData.clienteId}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, clienteId: val }))}
                        disabled={isLoadingClientes}
                      >
                        <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                          <SelectValue placeholder="Seleccione un cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes?.map(cliente => (
                            <SelectItem key={cliente.clienteId} value={cliente.clienteId}>
                              {cliente.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isLoadingClientes && (
                        <motion.p 
                          className="text-xs text-muted-foreground mt-1 flex items-center gap-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Cargando clientes...
                        </motion.p>
                      )}
                    </motion.div>
                  )}

                  {formData.tipo === 'SUMINISTROS' && (
                    <motion.div
                      key="proveedor"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        Proveedor
                      </label>
                      <Select
                        value={formData.vendorId}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, vendorId: val }))}
                        disabled={isLoadingVendors}
                      >
                        <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                          <SelectValue placeholder="Seleccione un proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors?.map(vendor => (
                            <SelectItem key={vendor.vendorId} value={vendor.vendorId}>
                              {vendor.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isLoadingVendors && (
                        <motion.p 
                          className="text-xs text-muted-foreground mt-1 flex items-center gap-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Cargando proveedores...
                        </motion.p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Número de Contrato del Cliente/Proveedor */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <label className="flex items-center gap-2 text-sm font-medium mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Número de Contrato (Cliente/Proveedor)
                  </label>
                  <Input
                    type="text"
                    value={formData.numeroContratoClienteProveedor}
                    onChange={(e) => setFormData(prev => ({ ...prev, numeroContratoClienteProveedor: e.target.value }))}
                    placeholder="Ej: PR-2026-04-001"
                    className="transition-all duration-200 focus:scale-[1.01]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Referencia con la cual el cliente/proveedor identifica este contrato (opcional)</p>
                </motion.div>

                {/* Fechas */}
                <motion.div 
                  className="grid grid-cols-2 gap-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Fecha de Inicio
                    </label>
                    <Input
                      type="date"
                      value={formData.fechaInicio}
                      onChange={(e) => setFormData(prev => ({ ...prev, fechaInicio: e.target.value }))}
                      className="transition-all duration-200 focus:scale-[1.01]"
                      required
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Fecha de Fin
                    </label>
                    <Input
                      type="date"
                      value={formData.fechaFin}
                      onChange={(e) => setFormData(prev => ({ ...prev, fechaFin: e.target.value }))}
                      className="transition-all duration-200 focus:scale-[1.01]"
                    />
                  </div>
                </motion.div>

                {/* Configuración de Moneda */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card className="bg-muted/50 border-dashed">
                    <CardContent className="pt-4">
                      <div className="space-y-4">
                        <div>
                          <Label className="flex items-center gap-2 text-sm font-medium mb-3">
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                            Configuración de Moneda
                          </Label>
                          <RadioGroup
                            value={formData.esMultiMoneda ? "multi" : "single"}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, esMultiMoneda: value === 'multi' }))}
                            className="flex flex-row space-x-6"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="single" id="single" />
                              <Label htmlFor="single" className="cursor-pointer font-normal">Moneda Única</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="multi" id="multi" />
                              <Label htmlFor="multi" className="cursor-pointer font-normal">Múltiples Monedas</Label>
                            </div>
                          </RadioGroup>
                          {formData.esMultiMoneda && (
                            <motion.p 
                              className="text-xs text-muted-foreground mt-2"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                            >
                              El contrato permitirá transacciones y pagos en diferentes monedas (CUP, USD, EUR, MLC).
                            </motion.p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="block text-sm font-medium mb-2">
                              Monto Total {formData.esMultiMoneda ? '(Referencia)' : ''}
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.monto}
                              onChange={(e) => setFormData(prev => ({ ...prev, monto: e.target.value }))}
                              placeholder="0.00"
                              className="transition-all duration-200 focus:scale-[1.01]"
                            />
                          </div>
                          
                          {!formData.esMultiMoneda && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                            >
                              <Label className="block text-sm font-medium mb-2">Moneda</Label>
                              <Select
                                value={formData.moneda}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, moneda: val }))}
                              >
                                <SelectTrigger className="transition-all duration-200 focus:scale-[1.01]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CUP">CUP (Peso Cubano)</SelectItem>
                                  <SelectItem value="USD">USD (Dólar)</SelectItem>
                                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                                  <SelectItem value="MLC">MLC</SelectItem>
                                </SelectContent>
                              </Select>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Observaciones */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <label className="block text-sm font-medium mb-2">Observaciones</label>
                  <Textarea
                    value={formData.observaciones}
                    onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                    placeholder="Ingrese observaciones adicionales..."
                    className="min-h-25 resize-none transition-all duration-200 focus:scale-[1.01]"
                  />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Botones */}
        <motion.div 
          className="flex justify-end gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant='outline'
              type="button"
              onClick={() => router.push('/busy/contratos')}
              disabled={isLoading}
            >
              Cancelar
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Actualizar Contrato'
              )}
            </Button>
          </motion.div>
        </motion.div>
      </form>
    </div>
  )
}
