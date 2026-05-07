'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Loader2, RefreshCw, Search, Users, X } from 'lucide-react'
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
    bg: 'bg-violet-100 dark:bg-violet-900/40',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-700',
  },
  admin: {
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-700',
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
export function TenantUsersTable({ users, isLoading, onRefresh }: TenantUsersTableProps) {
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
  useMemo(() => {
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
          <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors group-focus-within:text-violet-500" />
          <Input
            placeholder="Buscar usuarios..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-8 text-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-violet-400 focus-visible:ring-violet-500/30 dark:border-slate-800 dark:bg-slate-900/50"
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
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="py-3 pl-6">Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="pr-6">Ingreso</TableHead>
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
                          className="group border-b border-border/50 transition-colors hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
                        >
                          <TableCell className="py-3 pl-6">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border-2 border-violet-100 dark:border-violet-800">
                                <AvatarFallback className="bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-200">
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
