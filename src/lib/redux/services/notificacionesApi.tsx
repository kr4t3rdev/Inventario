import { apiSlice } from "./apiSlice"
import { Notification } from "../../../app/models/model"
import { getAuthToken } from "@/lib/token"


export interface ResumenNotificaciones {
  total: number
  alta: number
  media: number
  baja: number
  noLeidas: number
}



export interface NotificacionesResponse {
  notificaciones: Notification[]
  resumen: ResumenNotificaciones
}

export const notificacionesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getNotificaciones: builder.query<NotificacionesResponse, void>({
      query: () => ({
        url: "/notificaciones",
        headers: {
          Authorization: getAuthToken(),
        },
      }),
      providesTags: ["Notificaciones"],
      // Para refrescar cada 30 segundos, usa pollingInterval al llamar al hook en el componente
      
    }),

    addNotificaciones: builder.mutation<Notification, Omit<Notification, "id" | "createdAt" | "updatedAt">>({
      query: (notification) => ({
        url: "/notificaciones",
        method: "POST",
        body: notification,
      }),
      invalidatesTags: ["Notificaciones"],
    }),
    marcarNotificacionLeida: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: "/notificaciones",
        method: "POST",
        headers: {
          Authorization: getAuthToken(),
        },
        body: { id, leida: true },
      }),
      invalidatesTags: ["Notificaciones"],
    }),
    updateNotificacion: builder.mutation<Notification, Partial<Notification> & { id: string }>({
      query: ({ id, ...patch }) => ({
          url: `/notificaciones/${id}`,
          method: 'PATCH',
          headers: {
            Authorization: getAuthToken(),
          },
          body: patch,
      }),
      invalidatesTags: ["Notificaciones"],
    }),
    deleteNotificacion: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/notificaciones/${id}`,
        method: "DELETE",
        headers: {
          Authorization: getAuthToken(),
        },
      }),
      invalidatesTags: ["Notificaciones"],
    }),
  }),
})

export const {
  useGetNotificacionesQuery,
  useMarcarNotificacionLeidaMutation,
  useUpdateNotificacionMutation,
  useAddNotificacionesMutation,
  useDeleteNotificacionMutation,
} = notificacionesApi
