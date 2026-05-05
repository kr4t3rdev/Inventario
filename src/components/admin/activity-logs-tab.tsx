'use client'

import { useState } from 'react'
import { useReducedMotion } from 'framer-motion'
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
import { AdminTableLoader } from "@/components/admin/animations"
import { useGetActivityLogsQuery } from "@/lib/redux/services/adminApi"
import { format } from "date-fns"
import { Clock } from "lucide-react"
import type { UserActivityLog } from "@/app/models/model"

interface ActivityLogWithUser extends UserActivityLog {
  user?: {
    userId: string
    name: string
    email: string
    role: string
  }
}

function getActionBadge(action: string) {
  switch (action) {
    case "login":
      return <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700">Login</Badge>
    case "logout":
      return <Badge variant="outline" className="border-slate-500/40 bg-slate-500/10 text-slate-700">Logout</Badge>
    case "create_user":
      return <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-700">Crear Usuario</Badge>
    case "update_user":
      return <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700">Actualizar</Badge>
    case "delete_user":
      return <Badge variant="destructive">Eliminar</Badge>
    case "role_change":
      return <Badge variant="outline" className="border-violet-500/40 bg-violet-500/10 text-violet-700">Cambio Rol</Badge>
    case "password_change":
      return <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-700">Contraseña</Badge>
    default:
      return <Badge>{action}</Badge>
  }
}

export function ActivityLogsTab() {
  const shouldReduceMotion = useReducedMotion()
  const [limit] = useState("50")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const { data: logs, isLoading } = useGetActivityLogsQuery({ limit: parseInt(limit) })

  const paginatedLogs = logs?.slice((page - 1) * perPage, page * perPage) || []
  const totalPages = logs ? Math.ceil(logs.length / perPage) : 1

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">Total: {logs?.length || 0} registros</p>
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
        {logs && logs.length > 0 && (
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
        <AdminTableLoader columns={5} rows={6} caption="Cargando logs de actividad..." />
      ) : paginatedLogs.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acción</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Realizado por</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.map((log: ActivityLogWithUser, index: number) => (
                <TableRow key={log.id} className={shouldReduceMotion ? '' : 'animate-fade-in'}
                  style={shouldReduceMotion ? undefined : { animationDelay: `${Math.min(index * 35, 240)}ms`, animationFillMode: 'both' }}
                >
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{log.user?.name || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">{log.user?.email || "N/A"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.performedBy === log.userId ? "Mismo usuario" : "Admin"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.ipAddress || "N/A"}</TableCell>
                  <TableCell>{format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-12 text-center dark:bg-muted/10">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Clock className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No hay registros de actividad</p>
              <p className="text-xs text-muted-foreground">Los logs de actividad aparecerán aquí cuando los usuarios interactúen con el sistema.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
