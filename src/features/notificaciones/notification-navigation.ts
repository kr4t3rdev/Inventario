import type { Notification } from '@/app/models/model';

type NotificationLike = Pick<Notification, 'type' | 'title' | 'link'>;

/**
 * @description Resuelve la ruta destino de una notificación según su tipo o título.
 * @param {NotificationLike} notification - Notificación a resolver.
 * @returns {string | null} Ruta interna destino o null si no aplica navegación.
 */
export function getNotificationHref(notification: NotificationLike): string | null {
  if (notification.link) {
    return notification.link;
  }

  const title = notification.title.toLowerCase();

  switch (notification.type) {
    case 'stock_bajo':
    case 'sin_stock':
      return '/busy/products';
    case 'transferencia':
      return '/busy/transferencias';
    case 'merma':
      return '/busy/mermas';
    case 'venta':
      return '/busy/sales';
    case 'margen_bajo':
      return '/busy/ficha-costo';
    default:
      break;
  }

  if (
    title.includes('usuario bloqueado') ||
    title.includes('intentos fallidos')
  ) {
    return '/admin/usuarios';
  }

  if (title.includes('nuevo miembro esperando aprobación')) {
    return '/busy/configuracion/usuarios';
  }

  return null;
}
