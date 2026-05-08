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
import { useGetExpiringSoonQuery, useSendExpiryNotificationsMutation } from "@/features/admin/services/adminApi"
import { format } from "date-fns"
import { toast } from "sonner"
import { Bell, Calendar, History } from "lucide-react"
import type { Usuario } from "@/app/models/model"

interface ExpiringUsersTabProps {
  onOpenHistory: (userId: string, userName: string) => void
}

export function ExpiringUsersTab({ onOpenHistory }: ExpiringUsersTabProps) {
  const shouldReduceMotion = useReducedMotion()
  const [days, setDays] = useState("7")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const { data: expiringUsers, isLoading, refetch } = useGetExpiringSoonQuery({ days: parseInt(days) })
  const [sendExpiryNotifications] = useSendExpiryNotificationsMutation()

  const paginatedExpiring = expiringUsers?.users.slice((page - 1) * perPage, page * perPage) || []
  const totalPages = expiringUsers ? Math.ceil(expiringUsers.users.length / perPage) : 1

  const handleSendNotifications = async () => {
    try {
      const result = await sendExpiryNotifications({ days: parseInt(days) }).unwrap()
      toast.success(`Notificaciones enviadas: ${result.notificationsCreated} administradores notificados`)
      refetch()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al enviar notificaciones")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">Total: {expiringUsers?.users.length || 0} usuarios</p>
          <Select value={days} onValueChange={(v) => { setDays(v); setPage(1) }}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 días</SelectItem>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="14">14 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
            </SelectContent>
          </Select>
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
        </div>
        <div className="flex gap-2">
          {expiringUsers && expiringUsers.users.length > 0 && (
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
          )}
          <Button variant="default" size="sm" onClick={handleSendNotifications}
            disabled={!expiringUsers || expiringUsers.users.length === 0}>
            <Bell className="mr-2 h-4 w-4" />
            Enviar Alertas
          </Button>
        </div>
      </div>

      {isLoading ? (
        <AdminTableLoader columns={5} rows={5} caption="Cargando usuarios por expiración..." />
      ) : paginatedExpiring.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead>Días restantes</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedExpiring.map((user: Usuario & { daysUntilExpiry: number }, index: number) => (
                <TableRow key={user.userId} className={shouldReduceMotion ? '' : 'animate-fade-in'}
                  style={shouldReduceMotion ? undefined : { animationDelay: `${Math.min(index * 35, 240)}ms`, animationFillMode: 'both' }}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : user.role === "dependiente" ? "secondary" : "outline"}
                      className={user.role === "admin" ? "bg-sky-500/10 text-sky-700" : user.role === "dependiente" ? "bg-amber-500/10 text-amber-700" : ""}>
                      {user.role === "admin" ? "Admin" : user.role === "dependiente" ? "Dependiente" : "Usuario"}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(user.expiresAt!), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="outline"
                      className={user.daysUntilExpiry <= 3 ? "border-rose-500/50 bg-rose-500/10 text-rose-700"
                        : user.daysUntilExpiry <= 7 ? "border-amber-500/50 bg-amber-500/10 text-amber-700"
                        : "border-yellow-500/50 bg-yellow-500/10 text-yellow-700"}>
                      {user.daysUntilExpiry} días
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onOpenHistory(user.userId, user.name)}>
                      <History className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-12 text-center dark:bg-muted/10">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Calendar className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                No hay usuarios que expiren en los próximos {days} días
              </p>
              <p className="text-xs text-muted-foreground">
                Los usuarios próximos a expirar aparecerán aquí para que puedas gestionar sus notificaciones.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
