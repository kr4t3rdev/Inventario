/**
 * @description Tests para resolver navegación desde notificaciones.
 */
import { describe, expect, it } from 'vitest';

import { getNotificationHref } from '@/features/notificaciones/notification-navigation';

describe('getNotificationHref', () => {
  it('envía stock bajo a productos', () => {
    expect(getNotificationHref({ type: 'stock_bajo', title: 'Stock Bajo' } as any)).toBe('/busy/products');
  });

  it('envía transferencias a su módulo', () => {
    expect(getNotificationHref({ type: 'transferencia', title: 'Nueva Transferencia' } as any)).toBe('/busy/transferencias');
  });

  it('envía alertas de margen bajo a ficha de costo', () => {
    expect(getNotificationHref({ type: 'margen_bajo', title: 'Margen Bajo' } as any)).toBe('/busy/ficha-costo');
  });

  it('envía alertas de bloqueo de usuarios al panel admin', () => {
    expect(
      getNotificationHref({
        type: 'warning',
        title: 'Usuario bloqueado por intentos fallidos',
      } as any),
    ).toBe('/admin/usuarios');
  });

  it('envía solicitudes pendientes a configuración de usuarios', () => {
    expect(
      getNotificationHref({
        type: 'info',
        title: 'Nuevo miembro esperando aprobación',
      } as any),
    ).toBe('/busy/configuracion/usuarios');
  });

  it('retorna null si no hay destino configurado', () => {
    expect(getNotificationHref({ type: 'info', title: 'Info general' } as any)).toBeNull();
  });
});
