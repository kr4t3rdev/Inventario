# Notificaciones

> Centraliza alertas del usuario y permite leerlas, borrarlas, resumirlas y navegar a la pantalla relacionada.

## Qué hace

Este módulo muestra notificaciones personales generadas por el sistema, agrupadas por prioridad y estado de lectura. Además define navegación contextual según el tipo de alerta y soporta verificaciones manuales, como stock bajo, desde roles autorizados.

## Qué incluye

- listado de notificaciones del usuario
- resumen por prioridad y no leídas
- marcar una o todas como leídas
- eliminación individual
- navegación contextual por tipo de notificación
- verificación manual de stock bajo para admin

## Cuándo usarlo

- Cuando querés revisar alertas operativas pendientes.
- Cuando necesitás entrar rápido al módulo afectado por una notificación.
- Cuando soporte o admin quiere disparar un chequeo de stock bajo.

## Reglas importantes

- El acceso depende de la feature `notificaciones`.
- Las notificaciones están scoped al `userId`, no solo al tenant.
- `verificarStockAction` está restringida a admin.
- El click puede marcar como leída y redirigir según `notification-navigation`.

## Qué conviene cuidar

- Si la navegación contextual falla, conviene revisar el tipo de notificación más que la UI.
- La bandeja sirve como centro de atención operativa, no solo como inbox pasivo.

## Rutas y referencias

- `/busy/notificaciones`
- `src/features/notificaciones/actions.ts`
- `src/features/notificaciones/notification-navigation.ts`

## En una frase

Convierte eventos del sistema en tareas visibles y accionables para cada usuario.
