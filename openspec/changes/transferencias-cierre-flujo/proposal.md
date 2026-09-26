# Proposal: Transferencias — cierre de flujo (Sesión B)

## Intent

La re-auditoría de módulos del 2026-09-26 (hallazgo #5 y #11) confirmó que el
workflow de transferencias quedó a medio camino: el estado `EN_TRANSITO` es
inalcanzable (ninguna action lo produce), la recepción parcial es fantasma (la
UI promete `PARCIAL`, la action persiste `COMPLETADA`), el schema de edición
acepta un input `estado` que jamás se usa, `createTransferenciaAction` llena
los logs de datos de negocio, y las checklists openspec de transferencias
quedaron desactualizadas pese a que el código ya está hecho.

## Scope

### In Scope

1. **EN_TRANSITO alcanzable**: nueva action `despacharTransferenciaAction`
   (APROBADA → EN_TRANSITO, sin movimiento de stock) + botón "Despachar" en la
   tabla y handler en el content.
2. **PARCIAL real**: `completarTransferenciaAction` persiste `PARCIAL` cuando
   el acumulado recibido es menor a lo enviado, mueve solo el delta de stock,
   acumula recepciones sucesivas hasta `COMPLETADA`, y la cancelación de una
   PARCIAL revierte lo ya recibido (stock + kardex).
3. **Input muerto retirado**: eliminar `estado` de
   `updateTransferenciaSchema`; restringir los estados de creación a
   `PENDIENTE|COMPLETADA`; bloquear la edición de transferencias
   `EN_TRANSITO`/`PARCIAL`.
4. **Permisos simétricos**: `completar` y `despachar` exigen
   `inventario.transferencias.gestionar` (hoy aprobar/rechazar piden permiso y
   completar no).
5. **Limpieza de logs**: eliminar los `console.log/console.error` con datos de
   negocio de `createTransferenciaAction`.
6. **Checklists openspec sincronizadas y archivadas**:
   `fix-transferencias-bugs` y `migrar-transferencias-server-first`.

### Out of Scope

- BUG-3 (agregados de stock de PV sin filtro de estado/eliminadas): pertenece
  a la Sesión A, que será re-integrada con revert-del-revert.
- Backorders tipo Odoo (filas hijas por el faltante): el modelo actual es una
  fila por producto; la acumulación sobre la misma fila lo cubre.
- Notificaciones nuevas (despacho) y cambios al modelo Prisma.

## Impact

- **Specs**: capability nueva `transferencias`.
- **Código**: `src/features/transferencias/` (actions, schemas, components,
  tests) y `openspec/changes/` (sync/archivo de dos changes viejos).
- **Base de datos**: ninguna migración — `Transferencia.estado` es `String` y
  `PARCIAL` ya existe en el tipo de UI `EstadoTransferencia`.
- **Compatibilidad**: las transferencias creadas como `COMPLETADA` y el flujo
  PENDIENTE→APROBADA→COMPLETADA siguen funcionando igual; la primera recepción
  usa las mismas secuencias de kardex (`SALIDA-0`/`ENTRADA-0`) de hoy.
