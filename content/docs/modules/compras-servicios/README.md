# Compras de Servicios

> Registra servicios recibidos, su proveedor, costo, vencimiento y conciliación con anticipos o pagos contables.

## Qué hace

Este módulo cubre el lado de egresos del catálogo de servicios. Permite registrar servicios que la empresa contrata o recibe, con fechas, factura, forma de pago y proveedor. También puede aplicar anticipos y crear reconciliaciones de gasto vinculadas.

## Qué incluye

- listado de servicios recibidos
- alta, edición y consulta por ID
- proveedor opcional
- número de factura y fecha de vencimiento
- integración con anticipos
- conciliación contable del gasto asociado

## Cuándo usarlo

- Cuando contratás un servicio externo y querés registrarlo.
- Cuando el gasto debe quedar enlazado a proveedor, servicio y vencimiento.
- Cuando querés que el servicio recibido impacte contabilidad sin salir del flujo de negocio.

## Reglas importantes

- Las altas pasan por `withPeriodValidation` usando la fecha del servicio.
- Si se informa proveedor, debe existir y pertenecer al flujo correcto.
- Los anticipos pueden crear reconciliaciones de gasto en la misma operación.
- Para crear un servicio recibido con saldo pendiente o aumentar una obligación existente, el plan debe incluir `cuentas-pagar`.
- La moneda sale del servicio contratado, no de un campo libre separado.

## Qué conviene cuidar

- Verificá proveedor, fecha y monto antes de guardar.
- Guardá comprobantes o referencias cuando corresponda.
- No mezcles este flujo con compras de productos: ambos impactan costos y contabilidad de forma distinta.
- Revisá forma de pago y vencimiento porque después condicionan cuentas por pagar y reconciliación.

## Rutas y referencias

- Vista operativa: `/busy/servicios/recibidos`
- Backend: `src/features/compras-servicios/actions.ts`

## En una frase

Registra el costo real de los servicios que la empresa consume y los conecta con contabilidad.
