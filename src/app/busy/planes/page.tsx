"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Plus, Edit, Trash2, RefreshCw, DollarSign, Users, Archive, Package, ChevronLeft, ChevronRight } from "lucide-react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner'

interface Plan {
  planId: string
  nombre: string
  descripcion: string | null
  precio: number
  duracionDias: number
  maxUsuarios: number
  maxAlmacenes: number
  maxProductos: number
  createdAt: string
}

export default function PlanesPage() {
  const [planes, setPlanes] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editandoPlan, setEditandoPlan] = useState<Plan | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    precio: "",
    duracionDias: "",
    maxUsuarios: "",
    maxAlmacenes: "",
    maxProductos: "",
  })

  useEffect(() => {
    fetchPlanes()
  }, [pagination.page])

  async function fetchPlanes() {
    try {
      const res = await fetch(`/api/planes?page=${pagination.page}&limit=${pagination.limit}`)
      const data = await res.json()
      if (data.data) {
        setPlanes(data.data)
        setPagination(data.pagination)
      } else {
        setPlanes(data)
      }
    } catch (error) {
      console.error("Error fetching planes:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleInicializarPlanes() {
    try {
      const res = await fetch("/api/admin/licencias/init", { method: "POST" })
      const data = await res.json()
      
      if (res.ok) {
        toast.success(data.message)
        fetchPlanes()
      } else {
        toast.info(data.message || "Ya existen planes")
      }
    } catch (error) {
      toast.error("Error inicializando planes")
    }
  }

  async function handleGuardarPlan() {
    try {
      const body = {
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        precio: formData.precio ? parseFloat(formData.precio) : 0,
        duracionDias: parseInt(formData.duracionDias),
        maxUsuarios: formData.maxUsuarios ? parseInt(formData.maxUsuarios) : 1,
        maxAlmacenes: formData.maxAlmacenes ? parseInt(formData.maxAlmacenes) : 1,
        maxProductos: formData.maxProductos ? parseInt(formData.maxProductos) : 100,
      }

      const url = editandoPlan ? `/api/planes/${editandoPlan.planId}` : "/api/planes"
      const method = editandoPlan ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Error guardando plan")
      }

      toast.success(editandoPlan ? "Plan actualizado" : "Plan creado")
      setDialogOpen(false)
      resetForm()
      fetchPlanes()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error guardando plan")
    }
  }

  async function handleEliminarPlan(planId: string) {
    if (!confirm("¿Está seguro de eliminar este plan?")) return

    try {
      const res = await fetch(`/api/planes/${planId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error eliminando plan")

      toast.success("Plan eliminado")
      fetchPlanes()
    } catch (error) {
      toast.error("Error eliminando plan")
    }
  }

  function abrirEditar(plan: Plan) {
    setEditandoPlan(plan)
    setFormData({
      nombre: plan.nombre,
      descripcion: plan.descripcion || "",
      precio: String(plan.precio),
      duracionDias: String(plan.duracionDias),
      maxUsuarios: String(plan.maxUsuarios),
      maxAlmacenes: String(plan.maxAlmacenes),
      maxProductos: String(plan.maxProductos),
    })
    setDialogOpen(true)
  }

  function resetForm() {
    setEditandoPlan(null)
    setFormData({
      nombre: "",
      descripcion: "",
      precio: "",
      duracionDias: "",
      maxUsuarios: "",
      maxAlmacenes: "",
      maxProductos: "",
    })
  }

  function abrirCrear() {
    resetForm()
    setDialogOpen(true)
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
          <h1 className="text-3xl font-bold tracking-tight">Planes</h1>
          <p className="text-muted-foreground">Gestiona los planes de suscripción</p>
        </div>
        <div className="flex gap-2">
          {planes.length === 0 && (
            <Button variant="outline" onClick={handleInicializarPlanes}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Inicializar Planes
            </Button>
          )}
          <Button onClick={abrirCrear}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Plan
          </Button>
        </div>
      </motion.div>

      {planes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay planes configurados</p>
          <Button variant="link" onClick={handleInicializarPlanes}>
            Crear planes por defecto
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {planes.map((plan) => (
            <motion.div
              key={plan.planId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border bg-card p-6 shadow-sm"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{plan.nombre}</h3>
                  {plan.descripcion && (
                    <p className="text-sm text-muted-foreground">{plan.descripcion}</p>
                  )}
                </div>
                <Badge variant={plan.precio === 0 ? "secondary" : "default"}>
                  {plan.precio === 0 ? "Gratis" : `$${plan.precio}`}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>{plan.duracionDias} días</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Hasta {plan.maxUsuarios} usuario{plan.maxUsuarios !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  <span>{plan.maxAlmacenes} almacén{plan.maxAlmacenes !== 1 ? "es" : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{plan.maxProductos} producto{plan.maxProductos !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => abrirEditar(plan)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleEliminarPlan(plan.planId)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editandoPlan ? "Editar Plan" : "Nuevo Plan"}</DialogTitle>
            <DialogDescription>
              {editandoPlan ? "Modifica los datos del plan" : "Crea un nuevo plan de suscripción"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Profesional"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción del plan"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="precio">Precio ($)</Label>
                <Input
                  id="precio"
                  type="number"
                  step="0.01"
                  value={formData.precio}
                  onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duracion">Duración (días)</Label>
                <Input
                  id="duracion"
                  type="number"
                  value={formData.duracionDias}
                  onChange={(e) => setFormData({ ...formData, duracionDias: e.target.value })}
                  placeholder="30"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="usuarios">Usuarios</Label>
                <Input
                  id="usuarios"
                  type="number"
                  value={formData.maxUsuarios}
                  onChange={(e) => setFormData({ ...formData, maxUsuarios: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="almacenes">Almacenes</Label>
                <Input
                  id="almacenes"
                  type="number"
                  value={formData.maxAlmacenes}
                  onChange={(e) => setFormData({ ...formData, maxAlmacenes: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="productos">Productos</Label>
                <Input
                  id="productos"
                  type="number"
                  value={formData.maxProductos}
                  onChange={(e) => setFormData({ ...formData, maxProductos: e.target.value })}
                  placeholder="100"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarPlan}>
              {editandoPlan ? "Guardar Cambios" : "Crear Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
