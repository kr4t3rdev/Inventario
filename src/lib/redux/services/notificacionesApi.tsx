import { apiSlice } from "./apiSlice"
import { Notification } from "../../../app/models/model"


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
      query: () => '/notificaciones',
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
        body: { id, leida: true },
      }),
      invalidatesTags: ["Notificaciones"],
    }),
    updateNotificacion: builder.mutation<Notification, Partial<Notification> & { id: string }>({
      query: ({ id, ...patch }) => ({
          url: `/notificaciones/${id}`,
          method: 'PATCH',
          body: patch,
      }),
      invalidatesTags: ["Notificaciones"],
    }),
    deleteNotificacion: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/notificaciones/${id}`,
        method: "DELETE",
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
