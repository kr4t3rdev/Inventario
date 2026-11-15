# Corregir errores detectados en pruebas CT-1

## Objetivo

Investigar y corregir los bloqueos observados al probar ventas, compras y apertura
contable en el tenant de pruebas PonzTest. Las correcciones se verifican primero
con pruebas aisladas; la comprobación en la sesión de producción queda a cargo
de la conversación original.

## Evidencia observada

- Venta en efectivo de una unidad de `QA Sesion F Producto`, por 15 CUP, desde
  `QA Contabilidad`: «La valoración monetaria del evento no está disponible».
  Después, la lista mostraba cero ventas y el punto conservaba una unidad.
- Compra directa de una unidad del mismo producto, proveedor `QA Sesion F
  Proveedor`, costo 10 CUP, pago parcial, factura `QA-CT1-20261114-01`:
  «No se pudo persistir la auditoría del período». Después, la lista mostraba
  cero compras. La pantalla de períodos mostraba cero períodos.
- Configuración contable mostró CUP y plan activo (35 cuentas, 7 diarios y 25
  roles mapeados); el diálogo de apertura mostró «Moneda funcional: No
  configurada». La causa de esa discrepancia no está confirmada.
- El selector de cajero del turno no mostró opciones; `QA Contabilidad` seguía
  ofreciendo «Abrir Turno». No se verificó si el tenant tenía empleados.
- Conciliación cargó con cero pendientes. No se completó una conciliación ni
  se verificaron los asientos de extremo a extremo.

## Pistas, no conclusiones

- `src/lib/services/periodo-contable-guard.ts` intenta auditar la ausencia de
  período usando `periodoId: 'N/A'`; `AuditoriaPeriodo` tiene FK obligatoria.
  Una revisión estática sugiere que esa inserción puede fallar y ocultar el
  mensaje original. Falta reproducirlo contra PostgreSQL aislado.
- `src/features/contabilidad-formal/services/posting-engine.ts` rechaza una
  valoración incompleta; hay que identificar qué emisor y dato faltaron. No
  asumir que el costo FIFO, política o tasa son la causa sin evidencia.
- El diálogo de apertura consulta `TenantAccountingPolicy`; verificar la misma
  sesión y respuesta de la acción antes de atribuir la diferencia a UI o datos.
- Se guardó `enforce` global en Railway por autorización previa, pero no se
  confirmó que el despliegue activo incorporara el cambio. El control no Cash
  es independiente. No inferir el modo efectivo de esas observaciones.

## Límites

No crear demos, purgar, modificar `Dev`, usar credenciales de otro entorno ni
leer `.env`, `.env.local` o `prisma/.env`. No alterar datos o configuración de
producción ni hacer pruebas allí desde OpenCode. Mantener intacta la ventana de
la sesión original. No eliminar auditoría ni omitir validaciones para pasar.
