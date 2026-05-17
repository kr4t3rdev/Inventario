'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { LazyMotion, m as motion } from 'framer-motion'
import {
  Key,
  Plus,
  Copy,
  Check,
  Search,
  Filter,
  Trash2,
  Shield,
  Calendar,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { getLicenciasAction } from '@/features/licencias'
import { getAdminPlanesAction, getGlobalUsersAction, deleteLicenciaAction, updateLicenciaAction, generateLicenciasAction } from '@/features/admin'

export default function AdminLicenciasPage() {
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [generarDialogOpen, setGenerarDialogOpen] = useState(false)
  const [selectedLicencias, setSelectedLicencias] = useState<Set<string>>(new Set())

  const [data, setData] = useState<any>(null)
  const [planesData, setPlanesData] = useState<any[]>([])
  const [usersData, setUsersData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => { setIsLoading(true); Promise.all([getLicenciasAction(), getAdminPlanesAction(), getGlobalUsersAction({limit:100})]).then(([r1,r2,r3]) => { if(r1.success) setData(r1.data); if(r2.success) setPlanesData(r2.data??[]); if(r3.success) setUsersData(r3.data); setIsLoading(false) }) }, [page, search, planFilter, statusFilter])

  const licencias = data?.licencias || data || []
  const total = (data as any)?.total || licencias.length
  const pages = (data as any)?.pages || 1

  const planes = planesData || []
  const users = (usersData as any)?.users || []

  // Métricas
  const activas = licencias.filter((l: any) => l.activa && new Date(l.expiracion) > new Date()).length
  const expiradas = licencias.filter((l: any) => new Date(l.expiracion) < new Date()).length
  const porVencer = licencias.filter((l: any) => {
    const dias = differenceInDays(new Date(l.expiracion), new Date())
    return dias <= 7 && dias >= 0
  }).length

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(text)
    setTimeout(() => setCopiedKey(null), 2000)
    toast.success('Clave copiada')
  }

  async function handleToggleLicencia(licencia: any) {
    try {
      const r = await updateLicenciaAction({ id: licencia.licenciaId, activa: !licencia.activa })
      if (r.success) {
        toast.success(licencia.activa ? 'Licencia revocada' : 'Licencia activada')
        const licenciasResult = await getLicenciasAction()
        if (licenciasResult.success) setData(licenciasResult.data)
      } else {
        toast.error('Error actualizando licencia')
      }
    } catch (error) {
      toast.error('Error actualizando licencia')
    }
  }

  async function handleDeleteLicencia(id: string) {
    if (!confirm('¿Eliminar esta licencia?')) return
    try {
      const r = await deleteLicenciaAction(id)
      if (r.success) {
        toast.success('Licencia eliminada')
        const licenciasResult = await getLicenciasAction()
        if (licenciasResult.success) setData(licenciasResult.data)
      } else {
        toast.error('Error eliminando licencia')
      }
    } catch (error) {
      toast.error('Error eliminando licencia')
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedLicencias)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedLicencias(next)
  }

  const toggleSelectAll = () => {
    if (selectedLicencias.size === licencias.length) {
      setSelectedLicencias(new Set())
    } else {
      setSelectedLicencias(new Set(licencias.map((l: any) => l.licenciaId)))
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
          <h1 className="text-3xl font-bold tracking-tight">Licencias</h1>
          <p className="text-muted-foreground">Gestión de licencias y activaciones</p>
        </div>
        <Button onClick={() => setGenerarDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Generar Licencias
        </Button>
      </motion.div>

      {/* Métricas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{activas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Por Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{porVencer}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-rose-500" />
              Expiradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{expiradas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por clave o usuario..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-10"
          />
        </div>
        <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(1) }}>
          <SelectTrigger className="w-44">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los planes</SelectItem>
            {planes.map((plan: any) => (
              <SelectItem key={plan.planId} value={plan.planId}>{plan.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Activas</SelectItem>
            <SelectItem value="false">Revocadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedLicencias.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5"
        >
          <span className="text-sm font-medium">{selectedLicencias.size} seleccionadas</span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              for (const id of selectedLicencias) {
                const lic = licencias.find((l: any) => l.licenciaId === id)
                if (lic) await handleToggleLicencia(lic)
              }
              setSelectedLicencias(new Set())
            }}
          >
            <Shield className="h-3 w-3 mr-1" />
            Toggle Estado
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedLicencias(new Set())}
          >
            <X className="h-3 w-3 mr-1" />
            Cancelar
          </Button>
        </motion.div>
      )}

      {/* Tabla */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <button onClick={toggleSelectAll} className="flex items-center justify-center">
                  {selectedLicencias.size === licencias.length && licencias.length > 0 ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <div className="h-4 w-4 border rounded" />
                  )}
                </button>
              </TableHead>
              <TableHead>Clave</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Expiración</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">Cargando...</TableCell>
              </TableRow>
            ) : licencias.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No hay licencias
                </TableCell>
              </TableRow>
            ) : (
              licencias.map((licencia: any) => {
                const expirada = new Date(licencia.expiracion) < new Date()
                const diasRestantes = differenceInDays(new Date(licencia.expiracion), new Date())
                const isSelected = selectedLicencias.has(licencia.licenciaId)

                return (
                  <TableRow key={licencia.licenciaId} className={isSelected ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <button onClick={() => toggleSelect(licencia.licenciaId)}>
                        {isSelected ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <div className="h-4 w-4 border rounded" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-mono text-sm">
                        <Key className="h-3 w-3 text-muted-foreground" />
                        {licencia.clave}
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
                          <div className="text-xs text-muted-foreground">{licencia.usuario.email}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{licencia.plan?.nombre}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className={expirada ? 'text-rose-500' : diasRestantes <= 7 ? 'text-amber-500' : ''}>
                          {format(new Date(licencia.expiracion), 'dd/MM/yyyy')}
                        </span>
                        {!expirada && (
                          <span className="text-xs text-muted-foreground">({diasRestantes}d)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {expirada ? (
                        <Badge variant="destructive">Expirada</Badge>
                      ) : licencia.activa ? (
                        <Badge className="bg-emerald-500">Activa</Badge>
                      ) : (
                        <Badge variant="secondary">Revocada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleLicencia(licencia)}
                        >
                          {licencia.activa ? 'Revocar' : 'Activar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLicencia(licencia.licenciaId)}
                          className="text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
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

      {/* Dialog Generar */}
      <GenerarLicenciasDialog
        open={generarDialogOpen}
        onClose={() => setGenerarDialogOpen(false)}
        planes={planes}
        users={users}
        onGenerate={async (data) => {
          try {
            const r = await generateLicenciasAction(data)
            if (r.success) {
              toast.success(`${data.cantidad} licencias generadas`)
              setGenerarDialogOpen(false)
              const licenciasResult = await getLicenciasAction()
              if (licenciasResult.success) setData(licenciasResult.data)
            } else {
              toast.error('Error generando licencias')
            }
          } catch (error) {
            toast.error('Error generando licencias')
          }
        }}
      />
    </div>
  )
}

function GenerarLicenciasDialog({
  open,
  onClose,
  planes,
  users,
  onGenerate,
}: {
  open: boolean
  onClose: () => void
  planes: any[]
  users: any[]
  onGenerate: (data: any) => void
}) {
  const [planId, setPlanId] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [duracionDias, setDuracionDias] = useState('')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar Licencias</DialogTitle>
          <DialogDescription>Genera claves de licencia automáticamente</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Usuario</label>
            <Select value={usuarioId} onValueChange={setUsuarioId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar usuario" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user: any) => (
                  <SelectItem key={user.userId} value={user.userId}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Plan</label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plan" />
              </SelectTrigger>
              <SelectContent>
                {planes.map((plan: any) => (
                  <SelectItem key={plan.planId} value={plan.planId}>
                    {plan.nombre} - ${plan.precio}/{plan.duracionDias} días
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Cantidad</label>
            <Input
              type="number"
              min={1}
              max={200}
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Duración (días, opcional)</label>
            <Input
              type="number"
              value={duracionDias}
              onChange={(e) => setDuracionDias(e.target.value)}
              placeholder="Usar duración del plan"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() =>
              onGenerate({
                planId,
                usuarioId,
                cantidad,
                ...(duracionDias ? { duracionDias: parseInt(duracionDias) } : {}),
              })
            }
            disabled={!planId || !usuarioId}
          >
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
