# Taller de Reparaciones

> Gestiona el catálogo técnico del taller y el ciclo completo de órdenes de reparación, desde la recepción hasta la facturación asociada.

## Qué hace

Este dominio mezcla dos capas: la configuración del catálogo técnico y la operación diaria del taller. Por un lado administra equipos, piezas y defectaciones. Por otro, crea órdenes, genera recibos de recepción, calcula complejidad, sigue estados del trabajo y puede vincular facturación o cotizaciones.

## Áreas principales

- **Configuración del catálogo**: equipos reparables, piezas por equipo y defectaciones con costos base.
- **Órdenes de reparación**: listado, búsqueda, filtros por estado y detalle completo.
- **Recepción**: alta de orden con cliente, uno o varios equipos, fotos y problema reportado.
- **Seguimiento**: estados como `RECIBIDO`, `EN_DIAGNOSTICO`, `ESPERANDO_APROBACION`, `EN_REPARACION`, `TERMINADO`, `ENTREGADO`.
- **Detalle técnico**: combinación de piezas, defectaciones, complejidad y límites de costo.
- **Documentación**: recibos, cotizaciones y facturas asociadas cuando corresponde.

## Cuándo usarlo

- Cuando seguís un trabajo operativo, una reparación o un costo.
- Cuando querés dejar trazabilidad de cambios, insumos o estado del proceso.
- Cuando necesitás ordenar pendientes antes de avanzar.
- Cuando necesitás configurar el catálogo antes de empezar a recibir equipos.
- Cuando querés ver el tablero de órdenes del taller y su estado actual.

## Reglas importantes

- Crear una orden genera también un recibo de recepción dentro de la misma transacción.
- Una orden puede incluir múltiples equipos, no solo uno.
- Los costos del taller se apoyan en piezas y defectaciones configuradas previamente.
- La complejidad puede calcularse según piezas seleccionadas y disparar alertas por límites de monto.

## Qué conviene cuidar

- Dejá comentarios claros para que cualquiera entienda el estado.
- No mezcles tareas distintas en un mismo registro.
- Asegurate de registrar insumos, tiempos o piezas cuando corresponda.
- El catálogo técnico y la operación diaria comparten datos; si el catálogo está mal, el diagnóstico también.
- La UI usa tanto acciones legacy como APIs específicas del dominio.
- Fotos, recibos y documentos forman parte de la trazabilidad del caso.

## Rutas clave

- `/busy/reparaciones`
- `/busy/reparaciones/ordenes`
- `/busy/reparaciones/ordenes/new`
- `/busy/reparaciones/ordenes/[id]`
- `/busy/reparaciones/historial`
- `/busy/reparaciones/tecnicos`

## Referencias útiles

- `src/app/busy/reparaciones/page.tsx`
- `src/app/busy/reparaciones/ordenes/page.tsx`
- `src/app/busy/reparaciones/ordenes/[id]/page.tsx`
- `src/app/api/reparaciones/ordenes/route.ts`
- `src/app/api/reparaciones/equipos/route.ts`
- `src/app/api/reparaciones/defectaciones/route.ts`

## En una frase

Le da al taller un flujo trazable desde el catálogo técnico hasta la entrega y el cobro de la reparación.
