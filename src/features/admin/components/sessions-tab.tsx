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
import { useGetSessionsQuery, useDeleteSessionMutation } from "@/features/admin/services/adminApi"
import { format } from "date-fns"
import { toast } from "sonner"
import { LogOut, Shield } from "lucide-react"
import type { UserSession } from "@/app/models/model"

interface SessionWithUser extends UserSession {
  user?: {
    userId: string
    name: string
    email: string
    role: string
  }
}

export function SessionsTab() {
  const shouldReduceMotion = useReducedMotion()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const { data: sessions, isLoading, refetch } = useGetSessionsQuery({})
  const [deleteSession] = useDeleteSessionMutation()

  const paginatedSessions = sessions?.slice((page - 1) * perPage, page * perPage) || []
  const totalPages = sessions ? Math.ceil(sessions.length / perPage) : 1

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId).unwrap()
      toast.success("Sesión cerrada correctamente")
      refetch()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al cerrar sesión")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">Total: {sessions?.length || 0} sesiones</p>
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
        {sessions && sessions.length > 0 && (
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
      </div>

      {isLoading ? (
        <AdminTableLoader columns={7} rows={5} caption="Cargando sesiones activas..." />
      ) : paginatedSessions.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead>Última actividad</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSessions.map((session: SessionWithUser, index: number) => (
                <TableRow key={session.id} className={shouldReduceMotion ? '' : 'animate-fade-in'}
                  style={shouldReduceMotion ? undefined : { animationDelay: `${Math.min(index * 35, 240)}ms`, animationFillMode: 'both' }}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{session.user?.name || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">{session.user?.email || "N/A"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {session.isActive ? (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700">Activa</Badge>
                    ) : (
                      <Badge variant="secondary">Inactiva</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{session.ipAddress || "N/A"}</TableCell>
                  <TableCell>{format(new Date(session.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>{format(new Date(session.lastActive), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>{session.expiresAt ? format(new Date(session.expiresAt), "dd/MM/yyyy HH:mm") : "N/A"}</TableCell>
                  <TableCell className="text-right">
                    {session.isActive && (
                      <Button variant="outline" size="sm" onClick={() => handleDeleteSession(session.id)}
                        className="text-rose-600 hover:text-rose-700">
                        <LogOut className="h-4 w-4" />
                      </Button>
                    )}
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
              <Shield className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No hay sesiones activas</p>
              <p className="text-xs text-muted-foreground">Las sesiones de los usuarios aparecerán aquí cuando inicien sesión.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
