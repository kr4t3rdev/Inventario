'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Users,
  Archive,
  Package,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  getAdminPlanesAction,
  createAdminPlanAction,
  updateAdminPlanAction,
  deleteAdminPlanAction,
} from '@/features/admin'

export default function AdminPlanesPage() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<any>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    duracionDias: '',
    maxUsuarios: '1',
    maxAlmacenes: '1',
    maxProductos: '100',
  })

  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => { setIsLoading(true); getAdminPlanesAction().then(r => { if(r.success) setData({ planes: r.data, total: (r.data as any)?.length||0, pages: 1 }); setIsLoading(false) }) }, [page, search])

  const planes = data?.planes || []
  const total = data?.total || 0
  const pages = data?.pages || 1

  function resetForm() {
    setFormData({
      nombre: '',
      descripcion: '',
      precio: '',
      duracionDias: '',
      maxUsuarios: '1',
      maxAlmacenes: '1',
      maxProductos: '100',
    })
    setEditingPlan(null)
  }

  function openEdit(plan: any) {
    setEditingPlan(plan)
    setFormData({
      nombre: plan.nombre,
      descripcion: plan.descripcion || '',
      precio: String(plan.precio),
      duracionDias: String(plan.duracionDias),
      maxUsuarios: String(plan.maxUsuarios),
      maxAlmacenes: String(plan.maxAlmacenes),
      maxProductos: String(plan.maxProductos),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    try {
      const body = {
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        precio: formData.precio ? parseFloat(formData.precio) : 0,
        duracionDias: parseInt(formData.duracionDias),
        maxUsuarios: parseInt(formData.maxUsuarios) || 1,
        maxAlmacenes: parseInt(formData.maxAlmacenes) || 1,
        maxProductos: parseInt(formData.maxProductos) || 100,
      }

      if (editingPlan) {
        const r = await updateAdminPlanAction({ planId: editingPlan.planId, nombre: body.nombre, maxUsuarios: Number(body.maxUsuarios)||1, maxAlmacenes: Number(body.maxAlmacenes)||1, maxProductos: Number(body.maxProductos)||100 })
        if(r.success) { toast.success('Plan actualizado'); resetForm(); getAdminPlanesAction().then(r2 => { if(r2.success) setData({ planes: r2.data, total: (r2.data as any)?.length||0, pages: 1 }) }) }
        else toast.error(r.error?.message||'Error')
      } else {
        const r = await createAdminPlanAction({ nombre: body.nombre, maxUsuarios: Number(body.maxUsuarios)||1, maxAlmacenes: Number(body.maxAlmacenes)||1, maxProductos: Number(body.maxProductos)||100 })
        if(r.success) { toast.success('Plan creado'); resetForm(); getAdminPlanesAction().then(r2 => { if(r2.success) setData({ planes: r2.data, total: (r2.data as any)?.length||0, pages: 1 }) }) }
        else toast.error(r.error?.message||'Error')
    } catch (error: any) {
      toast.error(error.data?.error || 'Error guardando plan')
    }
  }

  async function handleDelete(planId: string) {
    if (!confirm('¿Eliminar este plan?')) return
    try {
      const r=await deleteAdminPlanAction(planId)
      if(r.success) { toast.success('Plan eliminado'); getAdminPlanesAction().then(r2 => { if(r2.success) setData({ planes: r2.data, total: (r2.data as any)?.length||0, pages: 1 }) }) }
      else toast.error(r.error?.message||'Error')
    } catch (error: any) {
      toast.error(error.data?.error || 'Error eliminando plan')
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planes</h1>
          <p className="text-muted-foreground">Gestión de planes de suscripción</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Plan
        </Button>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar planes..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="pl-10"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead>Límites</TableHead>
              <TableHead>Licencias</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Cargando...</TableCell>
              </TableRow>
            ) : planes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No hay planes configurados
                </TableCell>
              </TableRow>
            ) : (
              planes.map((plan: any) => (
                <TableRow key={plan.planId}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{plan.nombre}</div>
                      {plan.descripcion && (
                        <div className="text-xs text-muted-foreground">{plan.descripcion}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.precio === 0 ? 'secondary' : 'default'}>
                      {plan.precio === 0 ? 'Gratis' : `$${plan.precio}`}
                    </Badge>
                  </TableCell>
                  <TableCell>{plan.duracionDias} días</TableCell>
                  <TableCell>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />{plan.maxUsuarios}
                      </span>
                      <span className="flex items-center gap-1">
                        <Archive className="h-3 w-3" />{plan.maxAlmacenes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />{plan.maxProductos}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{plan.licenciasCount || 0}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(plan.planId)}
                        className="text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="text-sm text-muted-foreground px-4">
                  Página {page} de {pages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  className={page === pages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plan' : 'Nuevo Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan ? 'Modifica los datos del plan' : 'Crea un nuevo plan de suscripción'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre *</Label>
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
                <Label htmlFor="precio">
                  <DollarSign className="h-3 w-3 inline mr-1" />
                  Precio ($)
                </Label>
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
                <Label htmlFor="duracion">Duración (días) *</Label>
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
                <Label htmlFor="maxUsuarios">
                  <Users className="h-3 w-3 inline mr-1" />
                  Usuarios
                </Label>
                <Input
                  id="maxUsuarios"
                  type="number"
                  value={formData.maxUsuarios}
                  onChange={(e) => setFormData({ ...formData, maxUsuarios: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxAlmacenes">
                  <Archive className="h-3 w-3 inline mr-1" />
                  Almacenes
                </Label>
                <Input
                  id="maxAlmacenes"
                  type="number"
                  value={formData.maxAlmacenes}
                  onChange={(e) => setFormData({ ...formData, maxAlmacenes: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxProductos">
                  <Package className="h-3 w-3 inline mr-1" />
                  Productos
                </Label>
                <Input
                  id="maxProductos"
                  type="number"
                  value={formData.maxProductos}
                  onChange={(e) => setFormData({ ...formData, maxProductos: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.nombre || !formData.duracionDias}>
              {editingPlan ? 'Guardar Cambios' : 'Crear Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
