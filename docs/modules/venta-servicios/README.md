# Ventas de Servicios

> Registra servicios prestados a clientes y soporta cobros con anticipos, líneas mixtas y conciliación posterior.

## Qué hace

Este módulo cubre el circuito comercial de servicios vendidos. Puede trabajar en modo simple, creando una sola venta de servicio, o en modo mixto con múltiples líneas de servicio. También permite asociar cliente, observaciones y anticipos ya cobrados.

## Qué incluye

- listado de ventas de servicio
- detalle por ID
- creación de servicio prestado simple o con líneas
- asociación opcional a cliente
- aplicación de anticipos
- creación de reconciliaciones de servicio para cobros anticipados

## Cuándo usarlo

- Cuando vendés un servicio sin pasar por venta tradicional de productos.
- Cuando querés registrar un servicio ya prestado a un cliente.
- Cuando necesitás aplicar un anticipo cobrado previamente.

## Reglas importantes

- El acceso depende de la feature `servicios`.
- El modo mixto rechaza líneas de producto: esas deben ir por ventas de productos.
- Las altas usan `withPeriodValidation`.
- Si hay anticipos, puede crear reconciliaciones de servicio automáticamente.

## Qué conviene cuidar

- No mezcles este flujo con POS de productos si hay líneas físicas involucradas.
- Revisá bien cliente, total y anticipos aplicados para no duplicar cobros.
- Este módulo impacta contabilidad de servicios y dashboard de ingresos.

## Rutas y referencias

- Vista operativa: `/busy/servicios/prestados`
- Catálogo + historial: `/busy/servicios`
- Backend: `src/features/venta-servicios/actions.ts`

## En una frase

Es el flujo liviano para vender servicios y reflejar sus cobros sin mezclarlo con ventas de productos.
