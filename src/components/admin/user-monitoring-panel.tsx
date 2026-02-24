'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdminTableLoader } from "@/components/admin/animations"
import { useGetActivityLogsQuery, useGetSessionsQuery, useDeleteSessionMutation, useGetUserQuery, useLockUserMutation, useUnlockUserMutation } from "@/lib/redux/services/adminApi"
import { useGetExpiringSoonQuery, useSendExpiryNotificationsMutation } from "@/lib/redux/services/adminApi"
import { format } from "date-fns"
import { toast } from "sonner"
import { Clock, Shield, LogOut, Activity, Unlock, Lock, History, Bell, Calendar, Sparkles } from "lucide-react"
import { UserActivityLog, UserSession, Usuario } from "@/app/models/model"
import { LoginHistoryDialog } from "./login-history-dialog"

interface ActivityLogWithUser extends UserActivityLog {
  user?: {
    userId: string
    name: string
    email: string
    role: string
  }
}

interface SessionWithUser extends UserSession {
  user?: {
    userId: string
    name: string
    email: string
    role: string
  }
}

export function UserMonitoringPanel() {
  const shouldReduceMotion = useReducedMotion()
  const [activeTab, setActiveTab] = useState<"logs" | "sessions" | "blocked" | "expiring">("logs")
  const [logLimit] = useState("50")
  const [expiringDays, setExpiringDays] = useState("7")
  const [logsPage, setLogsPage] = useState(1)
  const [logsPerPage, setLogsPerPage] = useState(10)
  const [sessionsPage, setSessionsPage] = useState(1)
  const [sessionsPerPage, setSessionsPerPage] = useState(10)
  const [blockedPage, setBlockedPage] = useState(1)
  const [blockedPerPage, setBlockedPerPage] = useState(10)
  const [expiringPage, setExpiringPage] = useState(1)
  const [expiringPerPage, setExpiringPerPage] = useState(10)
  const { data: logs, isLoading: logsLoading } = useGetActivityLogsQuery({ limit: parseInt(logLimit) })
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useGetSessionsQuery({})
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useGetUserQuery()
  const { data: expiringUsers, isLoading: expiringLoading, refetch: refetchExpiring } = useGetExpiringSoonQuery({ days: parseInt(expiringDays) })
  const [deleteSession] = useDeleteSessionMutation()
  const [unlockUser] = useUnlockUserMutation()
  const [lockUser] = useLockUserMutation()
  const [sendExpiryNotifications] = useSendExpiryNotificationsMutation()

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{ userId: string; name: string } | null>(null)
  const [lockDialogOpen, setLockDialogOpen] = useState(false)
  const [lockReason, setLockReason] = useState("")

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId).unwrap()
      toast.success("Sesión cerrada correctamente")
      refetchSessions()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al cerrar sesión")
    }
  }

  const handleUnlockUser = async (userId: string) => {
    try {
      await unlockUser({ userId }).unwrap()
      toast.success("Usuario desbloqueado correctamente")
      refetchUsers()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al desbloquear usuario")
    }
  }

  const handleLockUser = async () => {
    if (!selectedUser) return

    try {
      await lockUser({ userId: selectedUser.userId, reason: lockReason }).unwrap()
      toast.success("Usuario bloqueado correctamente")
      refetchUsers()
      setLockDialogOpen(false)
      setLockReason("")
      setSelectedUser(null)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al bloquear usuario")
    }
  }

  const openHistoryDialog = (userId: string, userName: string) => {
    setSelectedUser({ userId, name: userName })
    setHistoryDialogOpen(true)
  }

  const openLockDialog = (userId: string, userName: string) => {
    setSelectedUser({ userId, name: userName })
    setLockDialogOpen(true)
  }

  const blockedUsers = users?.filter((u: Usuario) => u.lockedUntil && new Date(u.lockedUntil) > new Date()) || []

  const paginatedLogs = logs?.slice(
    (logsPage - 1) * logsPerPage,
    logsPage * logsPerPage
  ) || []

  const paginatedSessions = sessions?.slice(
    (sessionsPage - 1) * sessionsPerPage,
    sessionsPage * sessionsPerPage
  ) || []

  const paginatedBlocked = blockedUsers.slice(
    (blockedPage - 1) * blockedPerPage,
    blockedPage * blockedPerPage
  ) || []

  const paginatedExpiring = expiringUsers?.users.slice(
    (expiringPage - 1) * expiringPerPage,
    expiringPage * expiringPerPage
  ) || []

  const totalLogsPages = logs ? Math.ceil(logs.length / logsPerPage) : 1
  const totalSessionsPages = sessions ? Math.ceil(sessions.length / sessionsPerPage) : 1
  const totalBlockedPages = Math.ceil(blockedUsers.length / blockedPerPage)
  const totalExpiringPages = expiringUsers ? Math.ceil(expiringUsers.users.length / expiringPerPage) : 1

  const handleSendNotifications = async () => {
    try {
      const result = await sendExpiryNotifications({ days: parseInt(expiringDays) }).unwrap()
      toast.success(`Notificaciones enviadas: ${result.notificationsCreated} administradores notificados`)
      refetchExpiring()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al enviar notificaciones")
    }
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case "login":
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          >
            Login
          </Badge>
        )
      case "logout":
        return (
          <Badge
            variant="outline"
            className="border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300"
          >
            Logout
          </Badge>
        )
      case "create_user":
        return (
          <Badge
            variant="outline"
            className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
          >
            Crear Usuario
          </Badge>
        )
      case "update_user":
        return (
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          >
            Actualizar
          </Badge>
        )
      case "delete_user":
        return <Badge variant="destructive">Eliminar</Badge>
      case "role_change":
        return (
          <Badge
            variant="outline"
            className="border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300"
          >
            Cambio Rol
          </Badge>
        )
      case "password_change":
        return (
          <Badge
            variant="outline"
            className="border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          >
            Contraseña
          </Badge>
        )
      default:
        return <Badge>{action}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-600 shadow-md">
                <Activity className="h-5 w-5 text-white" />
                <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-yellow-400" />
              </div>
              <div>
                <CardTitle className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Monitoreo de Usuarios
                </CardTitle>
                <CardDescription>Historial de actividad y sesiones activas</CardDescription>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={activeTab === "logs" ? "default" : "outline"}
                onClick={() => setActiveTab("logs")}
                className="transition-all duration-200 hover:shadow-sm"
              >
                <Clock className="mr-2 h-4 w-4" />
                Logs
              </Button>
              <Button
                variant={activeTab === "sessions" ? "default" : "outline"}
                onClick={() => setActiveTab("sessions")}
                className="transition-all duration-200 hover:shadow-sm"
              >
                <Shield className="mr-2 h-4 w-4" />
                Sesiones
              </Button>
              <Button
                variant={activeTab === "blocked" ? "default" : "outline"}
                onClick={() => setActiveTab("blocked")}
                className="transition-all duration-200 hover:shadow-sm"
              >
                <Unlock className="mr-2 h-4 w-4" />
                Bloqueados
                {blockedUsers.length > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 px-2 text-xs">
                    {blockedUsers.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant={activeTab === "expiring" ? "default" : "outline"}
                onClick={() => setActiveTab("expiring")}
                className="transition-all duration-200 hover:shadow-sm"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Expiran Pronto
                {expiringUsers && expiringUsers.users.length > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 px-2 text-xs">
                    {expiringUsers.users.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
            className="space-y-4"
          >
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Total: {logs?.length || 0} registros
                </p>
                <Select value={logsPerPage.toString()} onValueChange={(v) => {
                  setLogsPerPage(parseInt(v))
                  setLogsPage(1)
                }}>
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
                      <PaginationPrevious
                        onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                        className={logsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="flex items-center px-4">
                        Página {logsPage} de {totalLogsPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setLogsPage(p => Math.min(totalLogsPages, p + 1))}
                        className={logsPage === totalLogsPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>

            {logsLoading ? (
              <AdminTableLoader columns={5} rows={6} caption="Cargando logs de actividad..." />
            ) : paginatedLogs && paginatedLogs.length > 0 ? (
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
                        <TableRow
                          key={log.id}
                          className={shouldReduceMotion ? '' : 'animate-fade-in'}
                          style={
                            shouldReduceMotion
                              ? undefined
                              : {
                                  animationDelay: `${Math.min(index * 35, 240)}ms`,
                                  animationFillMode: 'both',
                                }
                          }
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
                <p className="text-center py-4 text-muted-foreground">No hay registros de actividad</p>
              )}
            </div>
        )}

        {activeTab === "sessions" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Total: {sessions?.length || 0} sesiones
                </p>
                <Select value={sessionsPerPage.toString()} onValueChange={(v) => {
                  setSessionsPerPage(parseInt(v))
                  setSessionsPage(1)
                }}>
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
                      <PaginationPrevious
                        onClick={() => setSessionsPage(p => Math.max(1, p - 1))}
                        className={sessionsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="flex items-center px-4">
                        Página {sessionsPage} de {totalSessionsPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setSessionsPage(p => Math.min(totalSessionsPages, p + 1))}
                        className={sessionsPage === totalSessionsPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>

            {sessionsLoading ? (
              <AdminTableLoader columns={7} rows={5} caption="Cargando sesiones activas..." />
            ) : paginatedSessions && paginatedSessions.length > 0 ? (
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
                        <TableRow
                          key={session.id}
                          className={shouldReduceMotion ? '' : 'animate-fade-in'}
                          style={
                            shouldReduceMotion
                              ? undefined
                              : {
                                  animationDelay: `${Math.min(index * 35, 240)}ms`,
                                  animationFillMode: 'both',
                                }
                          }
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{session.user?.name || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">{session.user?.email || "N/A"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {session.isActive ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              >
                                Activa
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Inactiva</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{session.ipAddress || "N/A"}</TableCell>
                          <TableCell>{format(new Date(session.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell>{format(new Date(session.lastActive), "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell>
                            {session.expiresAt ? format(new Date(session.expiresAt), "dd/MM/yyyy HH:mm") : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            {session.isActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteSession(session.id)}
                                className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                              >
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
                <p className="text-center py-4 text-muted-foreground">No hay sesiones activas</p>
              )}
            </div>
        )}

        {activeTab === "blocked" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Total: {blockedUsers.length} usuarios bloqueados
                </p>
                <Select value={blockedPerPage.toString()} onValueChange={(v) => {
                  setBlockedPerPage(parseInt(v))
                  setBlockedPage(1)
                }}>
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
              {blockedUsers.length > 0 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setBlockedPage(p => Math.max(1, p - 1))}
                        className={blockedPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="flex items-center px-4">
                        Página {blockedPage} de {totalBlockedPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setBlockedPage(p => Math.min(totalBlockedPages, p + 1))}
                        className={blockedPage === totalBlockedPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>

            {usersLoading ? (
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
                          <TableRow
                            key={user.userId}
                            className={shouldReduceMotion ? '' : 'animate-fade-in'}
                            style={
                              shouldReduceMotion
                                ? undefined
                                : {
                                    animationDelay: `${Math.min(index * 35, 240)}ms`,
                                    animationFillMode: 'both',
                                  }
                            }
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive">{user.loginAttempts} / 5</Badge>
                            </TableCell>
                            <TableCell>
                              {user.lastFailedLogin ? format(new Date(user.lastFailedLogin), "dd/MM/yyyy HH:mm") : "N/A"}
                            </TableCell>
                            <TableCell>
                              {user.lockedUntil ? format(new Date(user.lockedUntil), "dd/MM/yyyy HH:mm") : "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              >
                                {remainingMinutes} min
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openHistoryDialog(user.userId, user.name)}
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnlockUser(user.userId)}
                                  className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                                >
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
                 <p className="text-center py-4 text-muted-foreground">No hay usuarios bloqueados</p>
               )}
             </div>
         )}

        {activeTab === "expiring" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Total: {expiringUsers?.users.length || 0} usuarios
                </p>
                <Select value={expiringDays} onValueChange={setExpiringDays}>
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
                <Select value={expiringPerPage.toString()} onValueChange={(v) => {
                  setExpiringPerPage(parseInt(v))
                  setExpiringPage(1)
                }}>
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
                        <PaginationPrevious
                          onClick={() => setExpiringPage(p => Math.max(1, p - 1))}
                          className={expiringPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="flex items-center px-4">
                          Página {expiringPage} de {totalExpiringPages}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setExpiringPage(p => Math.min(totalExpiringPages, p + 1))}
                          className={expiringPage === totalExpiringPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSendNotifications}
                  disabled={!expiringUsers || expiringUsers.users.length === 0}
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Enviar Alertas
                </Button>
              </div>
            </div>

            {expiringLoading ? (
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
                        <TableRow
                          key={user.userId}
                          className={shouldReduceMotion ? '' : 'animate-fade-in'}
                          style={
                            shouldReduceMotion
                              ? undefined
                              : {
                                  animationDelay: `${Math.min(index * 35, 240)}ms`,
                                  animationFillMode: 'both',
                                }
                          }
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                user.role === "admin" ? "default" : user.role === "dependiente" ? "secondary" : "outline"
                              }
                              className={
                                user.role === "admin"
                                  ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                  : user.role === "dependiente"
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : ""
                              }
                            >
                              {user.role === "admin" ? "Admin" : user.role === "dependiente" ? "Dependiente" : "Usuario"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(user.expiresAt!), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                user.daysUntilExpiry <= 3
                                  ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                  : user.daysUntilExpiry <= 7
                                  ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                              }
                            >
                              {user.daysUntilExpiry} días
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openHistoryDialog(user.userId, user.name)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">
                  No hay usuarios que expiren en los próximos {expiringDays} días
                </p>
              )}
            </div>
        )}
          </motion.div>
        </AnimatePresence>
      </CardContent>
       </Card>

       {selectedUser && (
        <LoginHistoryDialog
          open={historyDialogOpen}
          onClose={() => {
            setHistoryDialogOpen(false)
            setSelectedUser(null)
          }}
          userId={selectedUser.userId}
          userName={selectedUser.name}
          onUnlock={handleUnlockUser}
          onLock={(userId, reason) => {
            setLockReason(reason || "")
            openLockDialog(userId, selectedUser.name)
          }}
        />
      )}

      <AlertDialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <AlertDialogContent className="border-border/70 bg-card/95 backdrop-blur-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear Usuario Manualmente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres bloquear al usuario {selectedUser?.name}? Esta acción bloqueará todas las sesiones activas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Razón del bloqueo (opcional)</Label>
            <Input
              id="reason"
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              placeholder="Describe la razón del bloqueo..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setLockDialogOpen(false)
              setLockReason("")
              setSelectedUser(null)
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleLockUser} className="bg-rose-600 hover:bg-rose-700">
              <Lock className="mr-2 h-4 w-4" />
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
