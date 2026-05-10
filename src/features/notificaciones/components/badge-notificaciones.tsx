"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { getNotificacionesAction } from "@/features/notificaciones/actions"

export function BadgeNotificaciones() {
  const [resumen, setResumen] = useState<any>(null)

  useEffect(() => {
    getNotificacionesAction().then(r => { if (r.success) setResumen(r.data?.resumen) })
  }, [])

  if (!resumen || resumen.alta === 0) return null

  return (
    <Badge variant="destructive" className="ml-auto">
      {resumen.alta}
    </Badge>
  )
}
