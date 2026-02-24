"use client"

import { Badge } from "@/components/ui/badge"
import { useGetNotificacionesQuery } from "@/lib/redux/services/notificacionesApi"

export function BadgeNotificaciones() {
  const { data } = useGetNotificacionesQuery()
  const resumen = data?.resumen

  if (!resumen || resumen.alta === 0) return null

  return (
    <Badge variant="destructive" className="ml-auto">
      {resumen.alta}
    </Badge>
  )
}
