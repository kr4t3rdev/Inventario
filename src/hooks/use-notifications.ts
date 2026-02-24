import { useQuery } from "@tanstack/react-query"
import { getAuthToken } from "@/lib/token"
import type { NotificacionesResponse } from "@/lib/redux/services/notificacionesApi"

const fetchNotifications = async (): Promise<NotificacionesResponse> => {
  const token = getAuthToken()
  const headers = token ? { Authorization: token } : undefined

  const response = await fetch("/api/notificaciones", { headers })
  if (!response.ok) {
    throw new Error("Error al obtener notificaciones")
  }
  return response.json()
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  })
}
