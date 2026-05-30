'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { LazyMotion, m as motion, useReducedMotion } from 'framer-motion'
import {
  ArrowDown, ArrowUp, ArrowUpDown, CheckCircle, Clock, Download, Edit,
  Loader2, Search, Shield, ShieldCheck, Trash2, User, XCircle,
  CheckSquare, Square, Unlock, Lock,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { Usuario } from '@/app/models/model'
import type { UsuarioWithTenant } from '@/lib/types/admin'
import { AdminTableLoader } from '@/features/admin/components/animations'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription } from '@/components/ui/alert-dialog'
import { AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { useAdminUsers } from '@/features/admin/hooks/use-admin-users'
import { deleteUserAction, updateUserAction, lockUserAction, unlockUserAction, getAdminTenantsAction } from '@/features/admin/actions'
import { getAuthToken } from '@/lib/token'
import { getTenantRoleLabel } from '@/lib/auth/roles'

interface AdminUsersTableProps {
  users: Usuario[] | UsuarioWithTenant[]
  total?: number
  page?: number
  pages?: number
  showTenantColumn?: boolean
  isLoading: boolean
  onEditUser: (user: Usuario) => void
  onRefresh: () => Promise<unknown> | void
  onPageChange?: (page: number) => void
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  onApproveUser?: (user: Usuario) => void
}

type RoleFilter = 'all' | 'manager' | 'admin' | 'economico' | 'dependiente' | 'regularUser'
type StatusFilter = 'all' | 'active' | 'inactive'
type SortableColumn = 'name' | 'email' | 'createdAt' | 'expiresAt'

const SORTABLE_COLUMNS: { key: SortableColumn; label: string }[] = [
  { key: 'name', label: 'Usuario' },
  { key: 'email', label: 'Email' },
  { key: 'createdAt', label: 'Fecha de Creación' },
  { key: 'expiresAt', label: 'Expira' },
]

export function AdminUsersTable({
  users, total, page, pages, showTenantColumn = true, isLoading,
  onEditUser, onRefresh, onPageChange, onSortChange, onApproveUser,
}: AdminUsersTableProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion()
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)
  const [tenantFilter, setTenantFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [isExporting, setIsExporting] = useState(false)
  const [sortBy, setSortBy] = useState<SortableColumn>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [tenants, setTenants] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false
    getAdminTenantsAction().then((r) => { if (!cancelled && r.success) setTenants(r.data ?? []) })
    return () => { cancelled = true }
  }, [])

  const perPage = 25

  const isUserWithTenant = (u: Usuario | UsuarioWithTenant): u is UsuarioWithTenant =>
    'tenantName' in u && u.tenantName !== null && u.tenantName !== undefined

  const filteredUsers = useMemo(() => {
    let filtered = users.filter((candidate) => {
      const matchesSearch =
        candidate.name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        candidate.email.toLowerCase().includes(deferredSearch.toLowerCase())
      const effectiveRole = candidate.tenantRole ?? candidate.role
      const matchesRole = roleFilter === 'all' || effectiveRole === roleFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && candidate.isActive) ||
        (statusFilter === 'inactive' && !candidate.isActive)
      const matchesTenant =
        tenantFilter === 'all' ||
        (isUserWithTenant(candidate) && candidate.tenantId === tenantFilter)
      return matchesSearch && matchesRole && matchesStatus && matchesTenant
    })

    filtered.sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      if (sortBy === 'name') { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase() }
      else if (sortBy === 'email') { aVal = a.email.toLowerCase(); bVal = b.email.toLowerCase() }
      else if (sortBy === 'createdAt') { aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime() }
      else if (sortBy === 'expiresAt') { aVal = a.expiresAt ? new Date(a.expiresAt).getTime() : 0; bVal = b.expiresAt ? new Date(b.expiresAt).getTime() : 0 }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [deferredSearch, roleFilter, sortBy, sortOrder, statusFilter, tenantFilter, users])

  const totalPages = pages ?? Math.ceil(filteredUsers.length / perPage)
  const effectivePage = onPageChange ? (page ?? 1) : currentPage
  const paginatedUsers = onPageChange
    ? filteredUsers
    : filteredUsers.slice((effectivePage - 1) * perPage, effectivePage * perPage)

  const isAllSelected = paginatedUsers.length > 0 && paginatedUsers.every((u) => selectedUserIds.has(u.userId))
  const isSomeSelected = paginatedUsers.some((u) => selectedUserIds.has(u.userId))

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds((prev) => {
        const next = new Set(prev)
        paginatedUsers.forEach((u) => next.delete(u.userId))
        return next
      })
    } else {
      setSelectedUserIds((prev) => {
        const next = new Set(prev)
        paginatedUsers.forEach((u) => next.add(u.userId))
        return next
      })
    }
  }

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const clearSelection = () => setSelectedUserIds(new Set())

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete' | 'lock' | 'unlock') => {
    const count = selectedUserIds.size
    if (count === 0) return

    const actionLabel: Record<string, string> = {
      activate: 'Activados',
      deactivate: 'Desactivados',
      delete: 'Eliminados',
      lock: 'Bloqueados',
      unlock: 'Desbloqueados',
    }

    const confirmMsg: Record<string, string> = {
      activate: `¿Activar ${count} usuario${count > 1 ? 's' : ''}?`,
      deactivate: `¿Desactivar ${count} usuario${count > 1 ? 's' : ''}?`,
      delete: `¿Eliminar ${count} usuario${count > 1 ? 's' : ''}? Esta acción no se puede deshacer.`,
      lock: `¿Bloquear ${count} usuario${count > 1 ? 's' : ''}?`,
      unlock: `¿Desbloquear ${count} usuario${count > 1 ? 's' : ''}?`,
    }

    if (!window.confirm(confirmMsg[action])) return

    const entries = Array.from(selectedUserIds)
    const results = await Promise.allSettled(
      entries.map(async (userId) => {
        if (action === 'delete') { const r = await deleteUserAction(userId); if (!r.success) throw new Error(r.error?.message ?? 'Error') }
        else if (action === 'lock') { const r = await lockUserAction({ userId, reason: 'Bloqueo masivo desde admin' }); if (!r.success) throw new Error(r.error?.message ?? 'Error') }
        else if (action === 'unlock') { const r = await unlockUserAction({ userId }); if (!r.success) throw new Error(r.error?.message ?? 'Error') }
        else if (action === 'activate') { const r = await updateUserAction({ userId, isActive: true }); if (!r.success) throw new Error(r.error?.message ?? 'Error') }
        else if (action === 'deactivate') { const r = await updateUserAction({ userId, isActive: false }); if (!r.success) throw new Error(r.error?.message ?? 'Error') }
      }),
    )

    const successCount = results.filter((r) => r.status === 'fulfilled').length
    const failCount = count - successCount

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Error en ${action} para usuario ${entries[i]}:`, r.reason)
      }
    })

    if (failCount > 0) {
      toast.error(`${actionLabel[action]} ${successCount}/${count} usuario${count > 1 ? 's' : ''} (${failCount} fallo${failCount > 1 ? 's' : ''})`)
    } else {
      toast.success(`${actionLabel[action]} ${successCount}/${count} usuario${count > 1 ? 's' : ''}`)
    }

    clearSelection()
    await onRefresh()
  }

  const handleSort = (column: SortableColumn) => {
    let newOrder: 'asc' | 'desc' = 'asc'
    if (sortBy === column) newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
    setSortBy(column)
    setSortOrder(newOrder)
    if (onSortChange) onSortChange(column, newOrder)
  }

  const handlePageChange = (newPage: number) => {
    if (onPageChange) onPageChange(newPage)
    else setCurrentPage(newPage)
  }

  const renderSortIcon = (column: SortableColumn) => {
    if (sortBy !== column) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />
    return sortOrder === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 inline" />
  }

  const getRoleBadge = (role: string, tenantRole?: string | null): React.JSX.Element => {
    const effectiveRole = tenantRole ?? role
    switch (effectiveRole) {
      case 'manager':
        return (<Badge variant="outline" className="border-violet-500/40 bg-violet-500/10 text-violet-700"><Shield className="mr-1 h-3 w-3" />{getTenantRoleLabel('manager')}</Badge>)
      case 'admin':
        return (<Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-700"><Shield className="mr-1 h-3 w-3" />{getTenantRoleLabel('admin')}</Badge>)
      case 'economico':
        return (<Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700"><User className="mr-1 h-3 w-3" />{getTenantRoleLabel('economico')}</Badge>)
      case 'dependiente':
        return (<Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700"><User className="mr-1 h-3 w-3" />{getTenantRoleLabel('dependiente')}</Badge>)
      case 'regularUser':
        return (<Badge variant="outline" className="border-slate-300/50 bg-slate-100/50 text-slate-600 dark:border-slate-600/50 dark:bg-slate-800/30 dark:text-slate-400"><User className="mr-1 h-3 w-3" />{getTenantRoleLabel('regularUser')}</Badge>)
      default:
        return (<Badge variant="outline" className="border-border/80 bg-muted/40 text-foreground"><User className="mr-1 h-3 w-3" />{getTenantRoleLabel(null)}</Badge>)
    }
  }

  const getStatusBadge = (isActive: boolean, expiresAt?: string): React.JSX.Element => {
    if (!isActive) return (<Badge variant="destructive" className="bg-rose-600/90"><XCircle className="mr-1 h-3 w-3" />Inactivo</Badge>)
    if (expiresAt) {
      const daysUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysUntilExpiry <= 0) return (<Badge variant="destructive"><Clock className="mr-1 h-3 w-3" />Expirado</Badge>)
      if (daysUntilExpiry <= 7) return (<Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700"><Clock className="mr-1 h-3 w-3" />Expira en {daysUntilExpiry}d</Badge>)
    }
    return (<Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700"><CheckCircle className="mr-1 h-3 w-3" />Activo</Badge>)
  }

  const handleDeleteUser = async (userId: string): Promise<void> => {
    try { const r = await deleteUserAction(userId); if (!r.success) throw new Error(r.error?.message ?? 'Error'); toast.success('Usuario eliminado correctamente'); await onRefresh() }
    catch (error) { console.error('Error al eliminar usuario:', error); toast.error('Error al eliminar usuario') }
  }

  const handleExport = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/admin/users/export?format=csv', { headers: { Authorization: getAuthToken() } })
      if (!response.ok) throw new Error('Error al exportar usuarios')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(anchor)
      toast.success('Usuarios exportados correctamente')
    } catch (error) {
      console.error('Error al exportar usuarios:', error)
      toast.error('Error al exportar usuarios')
    } finally { setIsExporting(false) }
  }

  if (isLoading) {
    return (<AdminTableLoader columns={showTenantColumn ? 8 : 7} rows={6} caption="Cargando usuarios y permisos..." />)
  }

  return (
    <div className="space-y-4">
      {selectedUserIds.size > 0 && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
          className="rounded-xl border border-primary/30 bg-primary/5 p-3 shadow-sm"
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-primary">{selectedUserIds.size} usuario{selectedUserIds.size > 1 ? 's' : ''} seleccionado{selectedUserIds.size > 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => handleBulkAction('activate')} className="h-9 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"><CheckCircle className="mr-1 h-3 w-3" />Activar</Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkAction('deactivate')} className="h-9 border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"><XCircle className="mr-1 h-3 w-3" />Desactivar</Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkAction('lock')} className="h-9 border-violet-500/40 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20"><Lock className="mr-1 h-3 w-3" />Bloquear</Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkAction('unlock')} className="h-9 border-sky-500/40 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20"><Unlock className="mr-1 h-3 w-3" />Desbloquear</Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkAction('delete')} className="h-9 border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20"><Trash2 className="mr-1 h-3 w-3" />Eliminar</Button>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-9 text-muted-foreground hover:text-foreground">Cancelar</Button>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
        className="rounded-xl border border-slate-200 bg-card p-3 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            Resultados: {total ?? filteredUsers.length}
            {deferredSearch !== searchTerm && (<span className="ml-2 text-xs text-muted-foreground animate-pulse">Buscando...</span>)}
          </p>
          <Badge variant="outline" className="bg-primary/10 text-primary">Gestión de usuarios</Badge>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nombre o email..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="h-11 border-slate-200 bg-white/60 pl-10 dark:border-slate-700 dark:bg-slate-800/50" />
          </div>
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
            <SelectTrigger className="h-11 w-full border-slate-200 bg-white/60 sm:w-44 dark:border-slate-700 dark:bg-slate-800/50"><SelectValue placeholder="Filtrar por tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="manager">Directores</SelectItem>
              <SelectItem value="admin">Administradores</SelectItem>
              <SelectItem value="economico">Económicos</SelectItem>
              <SelectItem value="dependiente">Dependientes</SelectItem>
              <SelectItem value="regularUser">Usuarios legados</SelectItem>
            </SelectContent>
          </Select>
          {showTenantColumn && tenants && (
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="h-11 w-full border-slate-200 bg-white/60 sm:w-44 dark:border-slate-700 dark:bg-slate-800/50"><SelectValue placeholder="Filtrar por empresa" /></SelectTrigger>
              <SelectContent>{tenants.map((t) => (<SelectItem key={t.tenantId} value={t.tenantId}>{t.nombre}</SelectItem>))}</SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="h-11 w-full border-slate-200 bg-white/60 sm:w-44 dark:border-slate-700 dark:bg-slate-800/50"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={isExporting} className="h-11 border-slate-200 bg-white/70 transition-all duration-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isExporting ? 'Exportando...' : 'Exportar'}
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
        className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-linear-to-r from-primary/10 via-purple-600/5 to-primary/10">
              <TableHead className="w-12">
                <button onClick={toggleSelectAll} className="flex items-center justify-center w-full h-full hover:opacity-80 transition-opacity" title={isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}>
                  {isAllSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : isSomeSelected ? <Square className="h-4 w-4 text-primary/60" /> : <Square className="h-4 w-4 opacity-40" />}
                </button>
              </TableHead>
              {SORTABLE_COLUMNS.filter((c) => c.key === 'name' || c.key === 'email').map((col) => (
                <TableHead key={col.key}>
                  <button onClick={() => handleSort(col.key)} className="flex items-center gap-1 font-medium hover:text-foreground/80 transition-colors">
                    {col.label}{renderSortIcon(col.key)}
                  </button>
                </TableHead>
              ))}
              {showTenantColumn && <TableHead>Empresa</TableHead>}
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>
                <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1 font-medium hover:text-foreground/80 transition-colors">
                  Fecha de Creación{renderSortIcon('createdAt')}
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => handleSort('expiresAt')} className="flex items-center gap-1 font-medium hover:text-foreground/80 transition-colors">
                  Expira{renderSortIcon('expiresAt')}
                </button>
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(onPageChange ? filteredUsers : paginatedUsers).map((candidate, index) => {
              const isSelected = selectedUserIds.has(candidate.userId)
              return (
                <TableRow key={candidate.userId} className={`${shouldReduceMotion ? '' : 'animate-fade-in'} ${isSelected ? 'bg-primary/5' : ''}`} style={shouldReduceMotion ? undefined : { animationDelay: `${Math.min(index * 45, 320)}ms`, animationFillMode: 'both' }}>
                  <TableCell>
                    <button onClick={() => toggleSelectUser(candidate.userId)} className="flex items-center justify-center w-full h-full hover:opacity-80 transition-opacity" title={isSelected ? 'Deseleccionar' : 'Seleccionar'}>
                      {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 opacity-40" />}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{candidate.name}</TableCell>
                  <TableCell>{candidate.email}</TableCell>
                  {showTenantColumn && (<TableCell>{isUserWithTenant(candidate) ? <span className="text-sm">{candidate.tenantName}</span> : <span className="text-sm text-muted-foreground">—</span>}</TableCell>)}
                  <TableCell>{getRoleBadge(candidate.role, candidate.tenantRole)}</TableCell>
                  <TableCell>{getStatusBadge(candidate.isActive, candidate.expiresAt ?? undefined)}</TableCell>
                  <TableCell>{format(new Date(candidate.createdAt), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{candidate.expiresAt ? format(new Date(candidate.expiresAt), 'dd/MM/yyyy') : <span className="text-muted-foreground">Sin límite</span>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {onApproveUser && candidate.onboardingType === 'company' && candidate.onboardingStatus === 'awaiting_global_approval' && (
                        <Button variant="outline" size="sm" onClick={() => onApproveUser(candidate)} className="border-emerald-200 bg-emerald-50 text-emerald-700 transition-all duration-200 hover:shadow-sm hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60"><ShieldCheck className="h-4 w-4" /></Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => onEditUser(candidate)} className="border-slate-200 bg-white/70 transition-all duration-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/60"><Edit className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="border-slate-200 bg-white/70 text-rose-600 transition-all duration-200 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-rose-400 dark:hover:text-rose-300"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-slate-200/70 bg-white/90 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar Usuario</AlertDialogTitle>
                            <AlertDialogDescription>¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <Button onClick={() => handleDeleteUser(candidate.userId)} variant="destructive">Eliminar</Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </motion.div>

      {(onPageChange ? filteredUsers.length > 0 : paginatedUsers.length > 0) && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">Página {effectivePage} de {totalPages}</p>
          <Pagination>
            <PaginationContent className="gap-16">
              <PaginationItem><PaginationPrevious onClick={() => handlePageChange(Math.max(1, effectivePage - 1))} className={effectivePage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} /></PaginationItem>
              <PaginationItem><PaginationNext onClick={() => handlePageChange(Math.min(totalPages, effectivePage + 1))} className={effectivePage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} /></PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {filteredUsers.length === 0 && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
          className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-12 text-center dark:bg-muted/10"
        >
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><User className="h-8 w-8 text-muted-foreground/60" /></div>
            <div className="space-y-1">
              <p className="text-lg font-medium text-foreground">{deferredSearch || roleFilter !== 'all' || statusFilter !== 'all' || tenantFilter !== 'all' ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}</p>
              <p className="text-sm text-muted-foreground max-w-md">{deferredSearch || roleFilter !== 'all' || statusFilter !== 'all' || tenantFilter !== 'all' ? 'Intenta ajustar los filtros de búsqueda o seleccionar otros criterios.' : 'Comienza creando un nuevo usuario para gestionar permisos y accesos.'}</p>
            </div>
            {(deferredSearch || roleFilter !== 'all' || statusFilter !== 'all' || tenantFilter !== 'all') && (
              <Button variant="outline" onClick={() => { setSearchTerm(''); setRoleFilter('all'); setStatusFilter('all'); setTenantFilter('all') }} className="mt-2">Limpiar filtros</Button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
