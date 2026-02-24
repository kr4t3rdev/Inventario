"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Bell,
  Check,
  Info,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Package,
  TrendingDown,
  ArrowRightLeft,
  ShoppingCart,
} from "lucide-react"
import {
  useDeleteNotificacionMutation,
  useGetNotificacionesQuery,
  useUpdateNotificacionMutation,
} from "@/lib/redux/services/notificacionesApi"
import type { Notification } from "@/app/models/model"
import { format } from "date-fns"
import { useState } from "react"
import { toast } from "sonner"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

const iconos = {
  stock_bajo: Package,
  sin_stock: AlertTriangle,
  transferencia: ArrowRightLeft,
  merma: TrendingDown,
  venta: ShoppingCart,
  warning: AlertTriangle,
  error: AlertTriangle,
  info: Info,
  success: CheckCircle,
}

const coloresIcono = {
  stock_bajo: "text-yellow-500",
  sin_stock: "text-red-500",
  transferencia: "text-blue-500",
  merma: "text-orange-500",
  venta: "text-green-500",
  warning: "text-amber-500",
  error: "text-red-500",
  info: "text-blue-500",
  success: "text-green-500",
}

const coloresPrioridad = {
  alta: "destructive",
  media: "default",
  baja: "secondary",
} as const

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -30, scale: 0.95 },
}

const statsVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
}

export default function NotificationsPage() {
  const { data, isLoading } = useGetNotificacionesQuery()
  const [updateNotificacion] = useUpdateNotificacionMutation()
  const [deleteNotificacion] = useDeleteNotificacionMutation()
  const [eliminandoIds, setEliminandoIds] = useState<Set<string>>(new Set())
  const shouldReduceMotion = useReducedMotion()

  const notificaciones = data?.notificaciones || []
  const resumen = data?.resumen || { total: 0, alta: 0, media: 0, baja: 0, noLeidas: 0 }

  const markAsRead = async (notificationId: string) => {
    try {
      await updateNotificacion({ id: notificationId, isRead: true }).unwrap()
      toast("Notificación marcada como leída")
    } catch (error) {
      toast.error("No se pudo marcar la notificación como leída")
    }
  }

  const markAllAsRead = async () => {
    const unreadNotifications = notificaciones.filter((n: Notification) => !n.isRead)

    try {
      await Promise.all(
        unreadNotifications.map((notification: Notification) =>
          updateNotificacion({ id: notification.id, isRead: true }).unwrap(),
        ),
      )
      toast("Todas las notificaciones marcadas como leídas")
    } catch (error) {
      toast.error("No se pudieron marcar todas las notificaciones como leídas")
    }
  }

  const eliminarNotificacion = async (notificationId: string) => {
    setEliminandoIds((prev) => new Set([...prev, notificationId]))

    try {
      await deleteNotificacion(notificationId).unwrap()
      toast("Notificación eliminada")
    } catch (error) {
      toast.error("No se pudo eliminar la notificación")
    } finally {
      setEliminandoIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(notificationId)
        return newSet
      })
    }
  }

  const getNotificationIcon = (type: string) => {
    const Icono = iconos[type as keyof typeof iconos] || Info
    return <Icono className={`h-5 w-5 ${coloresIcono[type as keyof typeof coloresIcono] || "text-blue-500"}`} />
  }

  const getNotificationBadge = (prioridad: string) => {
    return (
      <Badge variant={coloresPrioridad[prioridad as keyof typeof coloresPrioridad] || "default"}>{prioridad}</Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notificaciones</h1>
          <p className="text-muted-foreground">Mantente al día con las últimas actualizaciones del sistema</p>
        </div>
        {resumen.noLeidas > 0 && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button onClick={markAllAsRead}>
              <Check className="mr-2 h-4 w-4" />
              Marcar todas como leídas
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Estadísticas */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-4 md:grid-cols-4"
      >
        <motion.div variants={statsVariants} whileHover={{ scale: 1.02, y: -2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <motion.div whileHover={{ rotate: 15 }}>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="text-2xl font-bold"
              >
                {resumen.total}
              </motion.div>
              <p className="text-xs text-muted-foreground">Notificaciones totales</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={statsVariants} whileHover={{ scale: 1.02, y: -2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sin Leer</CardTitle>
              <Bell className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                className="text-2xl font-bold text-red-600"
              >
                {resumen.noLeidas}
              </motion.div>
              <p className="text-xs text-muted-foreground">Requieren atención</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={statsVariants} whileHover={{ scale: 1.02, y: -2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alta Prioridad</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.4 }}
                className="text-2xl font-bold text-red-600"
              >
                {resumen.alta}
              </motion.div>
              <p className="text-xs text-muted-foreground">Urgentes</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={statsVariants} whileHover={{ scale: 1.02, y: -2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leídas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
                className="text-2xl font-bold text-green-600"
              >
                {resumen.total - resumen.noLeidas}
              </motion.div>
              <p className="text-xs text-muted-foreground">Ya revisadas</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Lista de notificaciones */}
      <div className="space-y-4">
        {notificaciones.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                </motion.div>
                <h3 className="text-lg font-semibold mb-2">No hay notificaciones</h3>
                <p className="text-muted-foreground text-center">Cuando tengas nuevas notificaciones, aparecerán aquí.</p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {notificaciones.map((notification: Notification) => (
                <motion.div
                  key={notification.id}
                  variants={itemVariants}
                  exit="exit"
                  layout
                  whileHover={{ scale: 1.01, x: 4 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                >
                  <Card
                    className={`transition-all ${
                      !notification.isRead
                        ? "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                        : ""
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <motion.div
                            whileHover={{ scale: 1.2, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            {getNotificationIcon(notification.type)}
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-semibold">{notification.title}</h3>
                              <div className="flex items-center space-x-2">
                                {getNotificationBadge(notification.prioridad)}
                                {!notification.isRead && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                                  >
                                    <Badge variant="outline" className="text-xs">
                                      Nuevo
                                    </Badge>
                                  </motion.div>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(notification.createdAt), "dd/MM/yyyy 'a las' HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          {!notification.isRead && (
                            <motion.div
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Button variant="ghost" size="sm" onClick={() => markAsRead(notification.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                            </motion.div>
                          )}
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => eliminarNotificacion(notification.id)}
                              disabled={eliminandoIds.has(notification.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  )
}
