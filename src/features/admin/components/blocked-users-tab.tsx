'use client'

import { useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { AdminTableLoader } from "@/features/admin/components/animations"
import { useAdminUsers } from '@/features/admin/hooks/use-admin-users'
import { unlockUserAction } from '@/features/admin/actions'
import { format } from "date-fns"
import { toast } from "sonner"
import { History, Unlock, Lock } from "lucide-react"
import type { Usuario } from "@/app/models/model"

interface BlockedUsersTabProps {
  onOpenHistory: (userId: string, userName: string) => void
}

export function BlockedUsersTab({ onOpenHistory }: BlockedUsersTabProps) {
  const shouldReduceMotion = useReducedMotion()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const { users, isLoading, refetch } = useAdminUsers()

  const blockedUsers = users?.filter((u: Usuario) => u.lockedUntil && new Date(u.lockedUntil) > new Date()) || []
  const paginatedBlocked = blockedUsers.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(blockedUsers.length / perPage)

  const handleUnlockUser = async (userId: string) => {
    try {
      const r = await unlockUserAction({ userId }); if (!r.success) throw new Error(r.error?.message ?? 'Error')
      toast.success("Usuario desbloqueado correctamente")
      refetch()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al desbloquear usuario")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Total: {blockedUsers.length} usuarios bloqueados</p>
        <Select value={perPage.toString()} onValueChange={(v) => { setPerPage(parseInt(v)); setPage(1) }}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5 por página</SelectItem>
            <SelectItem value="10">10 por página</SelectItem>
            <SelectItem value="20">20 por página</SelectItem>
            <SelectItem value="50">50 por página</SelectItem>
          </SelectContent>
        </Select>
        {/* Pagination moved below table */}
      </div>

      {isLoading ? (
        <AdminTableLoader columns={6} rows={5} caption="Cargando usuarios bloqueados..." />
      ) : paginatedBlocked.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Intentos</TableHead>
                <TableHead>Último fallo</TableHead>
                <TableHead>Bloqueado hasta</TableHead>
                <TableHead>Tiempo restante</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedBlocked.map((user: Usuario, index: number) => {
                const remainingMinutes = Math.ceil((new Date(user.lockedUntil!).getTime() - Date.now()) / (1000 * 60))
                return (
                  <TableRow key={user.userId} className={shouldReduceMotion ? '' : 'animate-fade-in'}
                    style={shouldReduceMotion ? undefined : { animationDelay: `${Math.min(index * 35, 240)}ms`, animationFillMode: 'both' }}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="destructive">{user.loginAttempts} / 5</Badge></TableCell>
                    <TableCell>{user.lastFailedLogin ? format(new Date(user.lastFailedLogin), "dd/MM/yyyy HH:mm") : "N/A"}</TableCell>
                    <TableCell>{user.lockedUntil ? format(new Date(user.lockedUntil), "dd/MM/yyyy HH:mm") : "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700">{remainingMinutes} min</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenHistory(user.userId, user.name)}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleUnlockUser(user.userId)}
                          className="text-emerald-700 hover:text-emerald-800">
                          <Unlock className="mr-2 h-4 w-4" />
                          Desbloquear
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-12 text-center dark:bg-muted/10">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Lock className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No hay usuarios bloqueados</p>
              <p className="text-xs text-muted-foreground">Los usuarios bloqueados por intentos fallidos aparecerán aquí.</p>
            </div>
          </div>
        </div>
      )}

      {blockedUsers.length > 0 && (
        <div className="flex justify-center pt-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
              </PaginationItem>
              <PaginationItem>
                <span className="flex items-center px-4">Página {page} de {totalPages}</span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
