"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Plus, Key, Copy, Check, X, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner'
import { getAuthToken } from "@/lib/token"

interface Plan {
  planId: string
  nombre: string
  descripcion: string | null
  precio: number
  duracionDias: number
}

interface Usuario {
  userId: string
  name: string
  email: string
}

interface Licencia {
  licenciaId: string
  clave: string
  activa: boolean
  inicio: string
  expiracion: string
  plan: Plan
  usuario: Usuario | null
}

export default function LicenciasPage() {
  const [licencias, setLicencias] = useState<Licencia[]>([])
  const [planes, setPlanes] = useState<Plan[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [generarDialogOpen, setGenerarDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    clave: "",
    usuarioId: "",
    planId: "",
    duracionDias: "",
  })
  const [generarData, setGenerarData] = useState({
    planId: "",
    cantidad: 1,
    duracionDias: "",
  })
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    fetchLicencias()
    fetchPlanes()
    fetchUsuarios()
  }, [])

  async function fetchLicencias() {
    try {
      const res = await fetch("/api/licencias", {
        headers: {
          "Authorization": getAuthToken()
        }
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setLicencias(data)
      }
    } catch (error) {
      console.error("Error fetching licencias:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPlanes() {
    try {
      const res = await fetch("/api/planes?page=1&limit=100", {
        headers: {
          "Authorization": getAuthToken()
        }
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setPlanes(data)
      } else if (data.data && Array.isArray(data.data)) {
        setPlanes(data.data)
      }
    } catch (error) {
      console.error("Error fetching planes:", error)
    }
  }

  async function fetchUsuarios() {
    try {
      const res = await fetch("/api/admin/users", {
        headers: {
          "Authorization": getAuthToken()
        }
      })
      const data = await res.json()
      setUsuarios(Array.isArray(data) ? data : data.users || [])
    } catch (error) {
      console.error("Error fetching usuarios:", error)
    }
  }

  async function handleCrearLicencia() {
    try {
      const res = await fetch("/api/licencias", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": getAuthToken()
        },
        body: JSON.stringify({
          clave: formData.clave,
          usuarioId: formData.usuarioId,
          planId: formData.planId,
          duracionDias: formData.duracionDias ? parseInt(formData.duracionDias) : undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Error creando licencia")
      }

      toast.success("Licencia creada exitosamente")
      setDialogOpen(false)
      setFormData({ clave: "", usuarioId: "", planId: "", duracionDias: "" })
      fetchLicencias()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error creando licencia")
    }
  }

  async function handleGenerarLicencias() {
    try {
      const res = await fetch("/api/licencias/generar", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": getAuthToken()
        },
        body: JSON.stringify({
          planId: generarData.planId,
          cantidad: parseInt(String(generarData.cantidad)),
          duracionDias: generarData.duracionDias ? parseInt(generarData.duracionDias) : undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Error generando licencias")
      }

      const data = await res.json()
      toast.success(`${data.cantidad} licencias generadas - Plan: ${data.plan}, ${data.dias} días`)
      setGenerarDialogOpen(false)
      setGenerarData({ planId: "", cantidad: 1, duracionDias: "" })
      fetchLicencias()
    } catch (error) {
      toast.error("Error generando licencias")
    }
  }

  async function handleRevocarLicencia(licenciaId: string) {
    try {
      const licencia = licencias.find((l) => l.licenciaId === licenciaId)
      if (!licencia) return

      const res = await fetch(`/api/licencias/${licenciaId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": getAuthToken()
        },
        body: JSON.stringify({ activa: !licencia.activa }),
      })

      if (!res.ok) throw new Error("Error actualizando licencia")

      toast.success(licencia.activa ? "Licencia revocada" : "Licencia activada")
      fetchLicencias()
    } catch (error) {
      toast.error("Error actualizando licencia")
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(text)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  function estaExpirada(expiracion: string): boolean {
    return new Date(expiracion) < new Date()
  }

  function diasRestantes(expiracion: string): number {
    return Math.ceil((new Date(expiracion).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="container mx-auto p-6 space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Licencias</h1>
          <p className="text-muted-foreground">Gestiona las licencias de los usuarios</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGenerarDialogOpen(true)}>
            <Key className="mr-2 h-4 w-4" />
            Generar Licencias
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Licencia
          </Button>
        </div>
      </motion.div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clave</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Expiración</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {licencias.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No hay licencias registradas
                </TableCell>
              </TableRow>
            ) : (
              licencias.map((licencia) => {
                const expirada = estaExpirada(licencia.expiracion)
                const dias = diasRestantes(licencia.expiracion)
                return (
                  <TableRow key={licencia.licenciaId}>
                    <TableCell className="font-mono">
                      <div className="flex items-center gap-2">
                        <span>{licencia.clave}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(licencia.clave)}
                        >
                          {copiedKey === licencia.clave ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {licencia.usuario ? (
                        <div>
                          <div className="font-medium">{licencia.usuario.name}</div>
                          <div className="text-sm text-muted-foreground">{licencia.usuario.email}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{licencia.plan.nombre}</Badge>
                    </TableCell>
                    <TableCell>{new Date(licencia.inicio).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className={expirada ? "text-red-500" : dias <= 7 ? "text-yellow-500" : ""}>
                        {new Date(licencia.expiracion).toLocaleDateString()}
                        {!expirada && (
                          <span className="text-xs ml-1">({dias} días)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {expirada ? (
                        <Badge variant="destructive">Expirada</Badge>
                      ) : licencia.activa ? (
                        <Badge variant="default" className="bg-green-500">Activa</Badge>
                      ) : (
                        <Badge variant="secondary">Revocada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={licencia.activa ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => handleRevocarLicencia(licencia.licenciaId)}
                      >
                        {licencia.activa ? "Revocar" : "Activar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Licencia</DialogTitle>
            <DialogDescription>Crea una licencia manual para un usuario</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="clave">Clave de Licencia</Label>
                <span className="text-xs text-muted-foreground">Opcional</span>
              </div>
              <Input
                id="clave"
                value={formData.clave}
                onChange={(e) => setFormData({ ...formData, clave: e.target.value })}
                placeholder="Dejar vacío para generar automáticamente"
              />
              <p className="text-[0.8rem] text-muted-foreground">
                Si se deja vacío, se generará una clave única automáticamente.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan">Plan</Label>
              <Select
                value={formData.planId}
                onValueChange={(value) => setFormData({ ...formData, planId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {planes.map((plan) => (
                    <SelectItem key={plan.planId} value={plan.planId}>
                      {plan.nombre} ({plan.duracionDias} días)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usuario">Usuario</Label>
              <Select
                value={formData.usuarioId}
                onValueChange={(value) => setFormData({ ...formData, usuarioId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((usuario) => (
                    <SelectItem key={usuario.userId} value={usuario.userId}>
                      {usuario.name} ({usuario.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duracion">Duración (días, opcional)</Label>
              <Input
                id="duracion"
                type="number"
                value={formData.duracionDias}
                onChange={(e) => setFormData({ ...formData, duracionDias: e.target.value })}
                placeholder="Dejar vacío para usar la del plan"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCrearLicencia}>Crear Licencia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generarDialogOpen} onOpenChange={setGenerarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar Licencias</DialogTitle>
            <DialogDescription>Genera claves de licencia automáticamente</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="generar-plan">Plan</Label>
              <Select
                value={generarData.planId}
                onValueChange={(value) => setGenerarData({ ...generarData, planId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {planes.map((plan) => (
                    <SelectItem key={plan.planId} value={plan.planId}>
                      {plan.nombre} - ${plan.precio}/{plan.duracionDias} días
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input
                id="cantidad"
                type="number"
                min={1}
                max={100}
                value={generarData.cantidad}
                onChange={(e) => setGenerarData({ ...generarData, cantidad: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="generar-duracion">Duración (días, opcional)</Label>
              <Input
                id="generar-duracion"
                type="number"
                value={generarData.duracionDias}
                onChange={(e) => setGenerarData({ ...generarData, duracionDias: e.target.value })}
                placeholder="Dejar vacío para usar la del plan"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerarDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerarLicencias}>Generar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
