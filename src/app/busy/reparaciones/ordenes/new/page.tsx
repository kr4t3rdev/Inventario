'use client'

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useGetEquiposReparacionQuery } from "@/lib/redux/services/reparacionesApi"
import { useGetClientesQuery } from "@/features/clientes"
import { useCreateOrdenMutation } from "@/lib/redux/services/ordenesReparacionApi"
import { toast } from "sonner"
import { ArrowLeft, Save, Plus, Trash2, Wrench, Upload, X, Camera, FileText, Printer } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface EquipoForm {
  equipoTipoId: string
  marca: string
  modelo: string
  numeroSerie: string
  contrasena: string
  accesorios: string
  problemaReportado: string
  fotos: string[]
}

interface ReciboData {
  id: string
  numeroRecibo: number
  clienteNombre: string
  equipoInfo: string
  problema: string
  fechaRecepcion: string
  estadoInicial: string
  ordenId: string
}

export default function NewOrdenPage() {
  const router = useRouter()
  const [createOrden, { isLoading: isSaving }] = useCreateOrdenMutation()
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])
  
  // Queries
  const { data: equiposCatalog } = useGetEquiposReparacionQuery()
  const { data: clientes } = useGetClientesQuery()
  
  const [formData, setFormData] = useState({
    clienteId: "",
    prioridad: "NORMAL",
    esGarantia: false,
    observaciones: ""
  })

  const [equipos, setEquipos] = useState<EquipoForm[]>([
    {
      equipoTipoId: "",
      marca: "",
      modelo: "",
      numeroSerie: "",
      contrasena: "",
      accesorios: "",
      problemaReportado: "",
      fotos: []
    }
  ])

  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [reciboGenerado, setReciboGenerado] = useState<ReciboData | null>(null)
  const [mostrarRecibo, setMostrarRecibo] = useState(false)

  const updateEquipo = (index: number, patch: Partial<EquipoForm>) => {
    setEquipos((prev) => prev.map((eq, i) => (i === index ? { ...eq, ...patch } : eq)))
  }

  const addEquipo = () => {
    setEquipos((prev) => [
      ...prev,
      {
        equipoTipoId: "",
        marca: "",
        modelo: "",
        numeroSerie: "",
        contrasena: "",
        accesorios: "",
        problemaReportado: "",
        fotos: []
      }
    ])
  }

  const removeEquipo = (index: number) => {
    setEquipos((prev) => prev.filter((_, i) => i !== index))
    fileInputRefs.current = fileInputRefs.current.filter((_, i) => i !== index)
  }

  const handleFileUpload = async (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploadingIndex(index)
    const uploadedUrls: string[] = []

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const data = await response.json()
          uploadedUrls.push(data.url)
        } else {
          toast.error(`Error al subir ${file.name}`)
        }
      }

      if (uploadedUrls.length > 0) {
        const currentFotos = equipos[index].fotos || []
        updateEquipo(index, { fotos: [...currentFotos, ...uploadedUrls] })
        toast.success(`${uploadedUrls.length} foto(s) subida(s) exitosamente`)
      }
    } catch (error) {
      toast.error("Error al subir fotos")
    } finally {
      setUploadingIndex(null)
    }
  }

  const removeFoto = (equipoIndex: number, fotoIndex: number) => {
    const nuevasFotos = equipos[equipoIndex].fotos.filter((_, i) => i !== fotoIndex)
    updateEquipo(equipoIndex, { fotos: nuevasFotos })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const isEquiposValid = equipos.every((eq) => eq.equipoTipoId && eq.marca && eq.problemaReportado)
    if (!formData.clienteId || !isEquiposValid) {
      toast.error("Por favor completa los campos requeridos")
      return
    }

    try {
      const primary = equipos[0]
      const result = await createOrden({
        clienteId: formData.clienteId,
        prioridad: formData.prioridad,
        esGarantia: formData.esGarantia,
        equipoTipoId: primary.equipoTipoId,
        marca: primary.marca,
        modelo: primary.modelo,
        numeroSerie: primary.numeroSerie,
        contrasena: primary.contrasena,
        accesorios: primary.accesorios,
        problemaReportado: primary.problemaReportado,
        fotos: primary.fotos,
        equipos: equipos.map((eq) => ({
          equipoTipoId: eq.equipoTipoId,
          marca: eq.marca,
          modelo: eq.modelo,
          numeroSerie: eq.numeroSerie,
          contrasena: eq.contrasena,
          accesorios: eq.accesorios,
          problemaReportado: eq.problemaReportado,
          fotos: eq.fotos
        }))
      }).unwrap()

      if (result.recibos && result.recibos.length > 0) {
        setReciboGenerado(result.recibos[0])
        setMostrarRecibo(true)
        toast.success("Orden creada exitosamente")
      } else {
        toast.success("Orden creada exitosamente")
        router.push("/busy/reparaciones/ordenes")
      }
    } catch (error) {
      console.error(error)
      toast.error("Error al crear la orden")
    }
  }

  const handleImprimirRecibo = () => {
    window.print()
  }

  const handleCerrarRecibo = () => {
    setMostrarRecibo(false)
    router.push("/busy/reparaciones/ordenes")
  }

  return (
    <motion.div 
      className="container mx-auto py-6 px-4 max-w-3xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="flex items-center gap-4 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button variant="ghost" size="icon" asChild>
              <Link href="/busy/reparaciones/ordenes">
                <ArrowLeft className="h-5 w-5" />
              </Link>
          </Button>
        </motion.div>
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            <Wrench className="h-5 w-5 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold">Nueva Orden de Reparación</h1>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Información del Cliente */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Cliente y Equipos</CardTitle>
                <CardDescription>Selecciona el cliente y agrega uno o varios equipos a reparar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Cliente *</Label>
                    <Select 
                      value={formData.clienteId} 
                      onValueChange={(val) => setFormData({...formData, clienteId: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes?.map((c) => (
                          <SelectItem key={c.clienteId} value={c.clienteId}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex md:justify-end">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button 
                        type="button" 
                        onClick={addEquipo}
                        className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Agregar equipo
                      </Button>
                    </motion.div>
                  </div>
                </div>

                <div className="space-y-4">
                  {equipos.map((equipo, idx) => (
                    <motion.div 
                      key={`equipo-${idx}`} 
                      className="rounded-lg border p-4 space-y-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * idx }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">Equipo {idx + 1}</div>
                        {equipos.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeEquipo(idx)}>
                            <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Eliminar
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo de Equipo *</Label>
                          <Select 
                            value={equipo.equipoTipoId} 
                            onValueChange={(val) => updateEquipo(idx, { equipoTipoId: val })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Ej. Split, Laptop" />
                            </SelectTrigger>
                            <SelectContent>
                              {equiposCatalog?.map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Marca *</Label>
                          <Input 
                            placeholder="Samsung, LG..." 
                            value={equipo.marca}
                            onChange={(e) => updateEquipo(idx, { marca: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Modelo</Label>
                          <Input 
                            placeholder="Opcional" 
                            value={equipo.modelo}
                            onChange={(e) => updateEquipo(idx, { modelo: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nº Serie</Label>
                          <Input 
                            placeholder="Opcional" 
                            value={equipo.numeroSerie}
                            onChange={(e) => updateEquipo(idx, { numeroSerie: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Accesorios Recibidos</Label>
                          <Input 
                            placeholder="Cargador, control remoto, funda..." 
                            value={equipo.accesorios}
                            onChange={(e) => updateEquipo(idx, { accesorios: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Contraseña / Patrón</Label>
                          <Input 
                            placeholder="Si es necesario para desbloquear" 
                            value={equipo.contrasena}
                            onChange={(e) => updateEquipo(idx, { contrasena: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Problema Reportado *</Label>
                          <Textarea 
                            placeholder="Describe la falla que indica el cliente..."
                            className="min-h-[90px]"
                            value={equipo.problemaReportado}
                            onChange={(e) => updateEquipo(idx, { problemaReportado: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Sección de Fotos */}
                      <div className="space-y-3 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <Camera className="h-4 w-4" />
                            Fotos del Equipo
                          </Label>
                          <input
                            ref={(el) => { fileInputRefs.current[idx] = el }}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFileUpload(idx, e.target.files)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRefs.current[idx]?.click()}
                            disabled={uploadingIndex === idx}
                          >
                            {uploadingIndex === idx ? (
                              <>
                                <motion.div
                                  className="mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                />
                                Subiendo...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Agregar Fotos
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Preview de fotos */}
                        <AnimatePresence>
                          {equipo.fotos && equipo.fotos.length > 0 && (
                            <motion.div 
                              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              {equipo.fotos.map((foto, fotoIdx) => (
                                <motion.div
                                  key={fotoIdx}
                                  className="relative aspect-square rounded-lg overflow-hidden border group"
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  transition={{ delay: fotoIdx * 0.05 }}
                                >
                                  <Image
                                    src={foto}
                                    alt={`Foto ${fotoIdx + 1}`}
                                    fill
                                    className="object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeFoto(idx, fotoIdx)}
                                    className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </motion.div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {(!equipo.fotos || equipo.fotos.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                            No hay fotos. Agrega fotos del equipo para el recibo.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Configuración de la Orden */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Configuración de la Orden</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="space-y-2">
                    <Label>Prioridad</Label>
                    <Select 
                        value={formData.prioridad} 
                        onValueChange={(val) => setFormData({...formData, prioridad: val})}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="BAJA">Baja</SelectItem>
                            <SelectItem value="NORMAL">Normal</SelectItem>
                            <SelectItem value="URGENTE">Urgente</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-6">
                      <Checkbox 
                          id="esGarantia" 
                          checked={formData.esGarantia}
                          onCheckedChange={(checked) => setFormData({...formData, esGarantia: checked as boolean})}
                      />
                      <Label htmlFor="esGarantia">Es Garantía (Costo Cero)</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observaciones Generales</Label>
                  <Textarea
                    placeholder="Observaciones adicionales para el recibo..."
                    value={formData.observaciones}
                    onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div 
            className="flex justify-end gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" type="button" onClick={() => router.back()}>
                  Cancelar
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                type="submit" 
                disabled={isSaving}
                className="bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg disabled:opacity-50"
              >
                  <Save className="mr-2 h-4 w-4" />
                  Crear Orden y Generar Recibo
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </form>

      {/* Dialog del Recibo */}
      <Dialog open={mostrarRecibo} onOpenChange={setMostrarRecibo}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recibo de Recepción Generado
            </DialogTitle>
            <DialogDescription>
              Orden #{reciboGenerado?.ordenId.slice(-6)} - Recibo #{reciboGenerado?.numeroRecibo}
            </DialogDescription>
          </DialogHeader>

          {reciboGenerado && (
            <div className="space-y-6">
              {/* Vista previa del recibo */}
              <div className="border rounded-lg p-6 bg-muted/30 print:bg-white print:border-black">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold">RECIBO DE RECEPCIÓN</h2>
                  <p className="text-muted-foreground">Nº {reciboGenerado.numeroRecibo}</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Fecha:</span>{" "}
                      {new Date(reciboGenerado.fechaRecepcion).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="font-semibold">Orden Nº:</span>{" "}
                      {reciboGenerado.ordenId.slice(-6)}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">Cliente:</h3>
                    <p>{reciboGenerado.clienteNombre}</p>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">Equipo:</h3>
                    <p>{reciboGenerado.equipoInfo}</p>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">Problema Reportado:</h3>
                    <p className="whitespace-pre-wrap">{reciboGenerado.problema}</p>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">Estado Inicial:</h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {reciboGenerado.estadoInicial}
                    </span>
                  </div>

                  {equipos[0]?.fotos && equipos[0].fotos.length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-2">Fotos del Equipo:</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {equipos[0].fotos.map((foto, idx) => (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                            <Image
                              src={foto}
                              alt={`Foto ${idx + 1}`}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4 text-center text-sm text-muted-foreground">
                    <p>Este recibo es comprobante de recepción del equipo.</p>
                    <p>Conserve este documento para retirar el equipo.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={handleCerrarRecibo}>
                  Cerrar
                </Button>
                <Button onClick={handleImprimirRecibo} className="gap-2">
                  <Printer className="h-4 w-4" />
                  Imprimir Recibo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
