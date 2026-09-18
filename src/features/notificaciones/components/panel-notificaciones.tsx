"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Bell, AlertTriangle, Package, TrendingDown, ArrowRightLeft, ShoppingCart, X, Info, CheckCircle } from "lucide-react"
import {
  deleteNotificacionAction,
  getNotificacionesAction,
  marcarNotificacionLeidaAction,
} from "@/features/notificaciones/actions"
import { getNotificationHref } from "@/features/notificaciones/notification-navigation"
import type { Notification } from "@/app/models/model"
import {formatDistanceToNow} from "date-fns/formatDistanceToNow"
import { es } from "date-fns/locale"
import { LazyMotion, m as motion, AnimatePresence, useReducedMotion } from "framer-motion"

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

const coloresPrioridad = {
  alta: "destructive",
  media: "default",
  baja: "secondary",
} as const

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

const notificationVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20, scale: 0.95 },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

const skeletonVariants = {
  start: { opacity: 0.4 },
  end: { opacity: 0.7 },
}

/**
 * @description Formatea una fecha para mostrar en el panel de notificaciones.
 * Maneja fechas inválidas sin lanzar error.
 */
function formatNotificacionDate(dateValue: unknown): string {
  try {
    if (!dateValue) return 'Fecha inválida'
    const d = new Date(dateValue as string)
    if (isNaN(d.getTime())) return 'Fecha inválida'
    return formatDistanceToNow(d, { addSuffix: true, locale: es })
  } catch {
    return 'Fecha inválida'
  }
}

/**
 * @description Muestra las notificaciones del usuario y sus acciones disponibles.
 * @returns {React.JSX.Element} Panel lateral de notificaciones.
 */
export function PanelNotificaciones() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    getNotificacionesAction().then(r => {
      if (r.success) setData(r.data)
      else setError(r.error)
      setIsLoading(false)
    })
  }, [])
  const shouldReduceMotion = useReducedMotion()

  const handleNotificacionClick = async (notification: Notification) => {
    try {
      if (!notification.isRead) {
        await marcarNotificacionLeidaAction(notification.id)
      }
      const ref = await getNotificacionesAction()
      if (ref.success) setData(ref.data)

      const href = getNotificationHref(notification)
      if (href) {
        setOpen(false)
        router.push(href)
      }
    } catch (error) {
      console.error('Error al marcar como leída:', error)
    }
  }

  const handleEliminarClick = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteNotificacionAction(id)
      const ref = await getNotificacionesAction()
      if (ref.success) setData(ref.data)
    } catch (error) {
      console.error('Error al eliminar la notificación:', error)
    }
  }
  const notificacionesFiltradas: Notification[] = data?.notificaciones || []

  const notificacionesNoLeidas = notificacionesFiltradas.filter((n) => !n.isRead).length

  const notificaciones = notificacionesFiltradas

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          aria-label="Abrir notificaciones"
          variant="ghost"
          size="icon"
          className="relative size-11"
        >
          <Bell aria-hidden="true" className="h-4 w-4" />
          <AnimatePresence>
            {notificacionesNoLeidas > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
              >
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {notificacionesNoLeidas > 99 ? "99+" : notificacionesNoLeidas}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <motion.div
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Bell className="h-5 w-5" />
            </motion.div>
            Notificaciones
          </SheetTitle>
          <SheetDescription>Alertas y notificaciones del sistema</SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        {/* Lista de notificaciones */}
        <ScrollArea className="h-[calc(100vh-200px)]">
          {isLoading ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  variants={notificationVariants}
                  className="animate-pulse"
                >
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <motion.div
                      variants={skeletonVariants}
                      animate="end"
                      initial="start"
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        repeatType: "reverse",
                        delay: i * 0.1,
                      }}
                      className="h-4 w-4 bg-gray-300 dark:bg-gray-600 rounded"
                    />
                    <div className="flex-1 space-y-2">
                      <motion.div
                        variants={skeletonVariants}
                        animate="end"
                        initial="start"
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          repeatType: "reverse",
                          delay: i * 0.1 + 0.1,
                        }}
                        className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"
                      />
                      <motion.div
                        variants={skeletonVariants}
                        animate="end"
                        initial="start"
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          repeatType: "reverse",
                          delay: i * 0.1 + 0.2,
                        }}
                        className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8 text-gray-500"
            >
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>Error al cargar notificaciones</p>
            </motion.div>
          ) : notificaciones.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8 text-gray-500"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <Bell className="h-8 w-8 mx-auto mb-2" />
              </motion.div>
              <p>No hay notificaciones</p>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              <AnimatePresence mode="popLayout">
                {notificaciones.map((notificacion: any) => {
                  const Icono = iconos[notificacion.type as keyof typeof iconos] || Info
                  const iconColor = coloresIcono[notificacion.type as keyof typeof coloresIcono] || "text-blue-500"
                  return (
                    <motion.div
                      key={notificacion.id}
                      variants={notificationVariants}
                      exit="exit"
                      layout
                      onClick={() => handleNotificacionClick(notificacion)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          void handleNotificacionClick(notificacion)
                        }
                      }}
                      whileHover={{ scale: 1.01, x: 4 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                      role="button"
                      tabIndex={0}
                      className={`p-3 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 group relative ${
                        !notificacion.isRead
                          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                          : "bg-white dark:bg-gray-800"
                      } ${getNotificationHref(notificacion) ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex items-start gap-3">
                        <motion.div
                          className={`flex-shrink-0 ${iconColor}`}
                          whileHover={{ scale: 1.2, rotate: 5 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <Icono className="h-4 w-4" />
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="text-sm font-medium truncate">{notificacion.title}</h4>
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                coloresPrioridad[notificacion.prioridad as keyof typeof coloresPrioridad] || "default"
                              }>
                                {notificacion.prioridad}
                              </Badge>
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ opacity: 1, scale: 1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <Button
                                  aria-label={`Eliminar notificación: ${notificacion.title}`}
                                  variant="ghost"
                                  size="icon"
                                  className="size-11 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-100 hover:text-red-600"
                                  onClick={(e) => handleEliminarClick(notificacion.id, e)}
                                >
                                  <X aria-hidden="true" className="h-4 w-4" />
                                </Button>
                              </motion.div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{notificacion.message}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {formatNotificacionDate(notificacion.createdAt)}
                            </span>
                            {!notificacion.isRead && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                                className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </ScrollArea>        
        {/* Acciones */}
        {notificaciones.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="pt-4 border-t"
          >
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full" 
              onClick={() => setOpen(false)}
            >
              <motion.span
                whileHover={{ x: 4 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                Ver todas las notificaciones
              </motion.span>
            </Button>
          </motion.div>
        )}
      </SheetContent>
    </Sheet>
  )
}
