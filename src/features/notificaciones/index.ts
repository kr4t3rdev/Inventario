// Server Actions (nuevo)
export {
  getNotificacionesAction,
  createNotificacionAction,
  marcarNotificacionLeidaAction,
  updateNotificacionAction,
  deleteNotificacionAction,
  verificarStockAction,
} from './actions'

// RTK Query (legacy)
export { notificacionesApi, useGetNotificacionesQuery, useMarcarNotificacionLeidaMutation, useUpdateNotificacionMutation, useAddNotificacionesMutation, useDeleteNotificacionMutation } from './api/notificacionesApi'
export { PanelNotificaciones } from './components/panel-notificaciones'
export { BadgeNotificaciones } from './components/badge-notificaciones'
export type { Notification } from './types'
