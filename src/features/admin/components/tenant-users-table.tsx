'use client'

import { useEffect, useDeferredValue, useMemo, useState } from 'react'
import { LazyMotion, m as motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Loader2,
  RefreshCw,
  Search,
  Users,
  X,
  ShieldCheck,
  Power,
  PowerOff,
  UserPlus,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getTenantRoleLabel } from '@/lib/auth/roles'

interface TenantUser {
  userId: string
  name: string
  email: string
  tenantRole: string | null
  isActive: boolean
  createdAt: string
}

interface TenantUsersTableProps {
  users: TenantUser[]
  isLoading: boolean
  onRefresh: () => void
  currentUserId?: string
  onRoleChange?: (user: TenantUser) => void
  onToggleActive?: (user: TenantUser) => void
  onInviteUser?: () => void
}

/** Genera iniciales a partir del nombre */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/** Configuración visual por rol */
const roleStyles: Record<string, { bg: string; text: string; border: string }> = {
  manager: {
    bg: 'bg-purple/15 dark:bg-purple/30',
    text: 'text-purple',
    border: 'border-purple/30 dark:border-purple/60',
  },

  economico: {
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-700',
  },
  dependiente: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
  },
}

/**
 * @description Tabla de usuarios del tenant con avatares, badges por rol y búsqueda.
 * @param {TenantUsersTableProps} props - Usuarios, estado de carga, acción de refrescar
 * @returns {JSX.Element} Tabla paginada con búsqueda
 */
export function TenantUsersTable({
  users,
  isLoading,
  onRefresh,
  currentUserId,
  onRoleChange,
  onToggleActive,
  onInviteUser,
}: TenantUsersTableProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const deferredSearch = useDeferredValue(search)
  const shouldReduceMotion = useReducedMotion()
  const pageSize = 10

  const filteredUsers = useMemo(() => {
    if (!deferredSearch.trim()) return users
    const q = deferredSearch.toLowerCase()
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users, deferredSearch])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)

  // Reset page when search changes
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
    if (page > maxPage) setPage(1)
  }, [filteredUsers.length, page, pageSize])

  if (isLoading) {
    return (
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <CardHeader className="flex flex-col gap-4 border-b bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CardTitle>Usuarios de la Empresa</CardTitle>
          <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8" aria-label="Refrescar usuarios">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors group-focus-within:text-purple" />
          <Input
            placeholder="Buscar usuarios..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-8 text-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-purple/60 focus-visible:ring-purple/30 dark:border-slate-800 dark:bg-slate-900/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {paginatedUsers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Users className="h-8 w-8 text-slate-400" />
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {deferredSearch ? 'Sin resultados' : 'No hay usuarios en la empresa'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {deferredSearch
                    ? 'Ningún usuario coincide con tu búsqueda.'
                    : 'Aún no se han agregado usuarios a esta empresa.'}
                </p>
              </div>
              {!deferredSearch && onInviteUser && (
                <Button onClick={onInviteUser} size="sm">
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Invitar usuario
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[70vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="py-3 pl-6">Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="pr-6">Ingreso</TableHead>
                    {(onRoleChange || onToggleActive) && (
                      <TableHead className="pr-6 text-right">Acciones</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {paginatedUsers.map((user, index) => {
                      const roleKey = user.tenantRole && roleStyles[user.tenantRole] ? user.tenantRole : 'dependiente'
                      const style = roleStyles[roleKey]

                      return (
                        <motion.tr
                          key={user.userId}
                          layout={shouldReduceMotion ? false : true}
                          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 8 }}
                          transition={{ delay: shouldReduceMotion ? 0 : index * 0.025, duration: 0.25 }}
                          className="group border-b border-border/50 transition-colors hover:bg-purple/10 dark:hover:bg-purple/20"
                        >
                          <TableCell className="py-3 pl-6">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border-2 border-purple/20 dark:border-purple/60">
                                <AvatarFallback className="bg-purple/15 text-xs font-bold text-purple dark:bg-purple/25 dark:text-purple/60">
                                  {getInitials(user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="text-sm font-medium">{user.name}</div>
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`${style.bg} ${style.text} ${style.border} border px-2.5 py-0.5 text-xs font-medium`}
                            >
                              {getTenantRoleLabel(user.tenantRole as any) || 'Sin rol'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2 w-2">
                                <span
                                  className={`absolute inline-flex h-full w-full rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                                />
                                {user.isActive && (
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                )}
                                <span
                                  className={`relative inline-flex h-2 w-2 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                                />
                              </span>
                              <span className="text-xs text-muted-foreground">{user.isActive ? 'Activo' : 'Inactivo'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="pr-6 text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(user.createdAt), { locale: es, addSuffix: true })}
                          </TableCell>
                          {(onRoleChange || onToggleActive) && (
                            <TableCell className="pr-6 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {onRoleChange && user.userId !== currentUserId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-purple"
                                    onClick={() => onRoleChange(user)}
                                    title="Cambiar rol"
                                  >
                                    <ShieldCheck className="h-4 w-4" />
                                  </Button>
                                )}
                                {onToggleActive && user.userId !== currentUserId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 w-8 p-0 ${
                                      user.isActive
                                        ? 'text-muted-foreground hover:text-red-600'
                                        : 'text-muted-foreground hover:text-emerald-600'
                                    }`}
                                    onClick={() => onToggleActive(user)}
                                    title={user.isActive ? 'Desactivar' : 'Activar'}
                                  >
                                    {user.isActive ? (
                                      <PowerOff className="h-4 w-4" />
                                    ) : (
                                      <Power className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-6 py-3 text-sm text-muted-foreground">
                <p>
                  Página {page} de {totalPages} ({filteredUsers.length} usuarios)
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
