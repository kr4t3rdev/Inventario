# Contratos

> Gestiona contratos comerciales con numeración automática, versiones, firmas, aprobaciones, archivos y alertas.

## Qué hace

Este módulo modela contratos del tenant como entidades vivas: tienen tipo, estado, contraparte, fechas, monto, historial de versiones y anexos operativos. También permite vincular el contrato a cliente o proveedor según el tipo y mantener numeración automática por consecutivo.

## Qué incluye

- listado paginado de contratos
- filtros por tipo, estado y fechas
- detalle con versiones, firmas, aprobaciones, archivos y alertas
- alta con numeración automática
- actualización de estado, montos, contraparte y fechas
- borrado individual o masivo
- cambios masivos de estado

## Cuándo usarlo

- Cuando necesitás registrar un contrato de compra-venta, servicio o suministros.
- Cuando querés saber qué contrato está vigente, vencido o pendiente.
- Cuando hace falta conservar trazabilidad documental y versiones.

## Reglas importantes

- El acceso depende de la feature `contratos`.
- La numeración se genera automáticamente con consecutivo y formato del tipo de contrato.
- El esquema obliga a elegir solo un cliente o un proveedor, no ambos.
- Contratos de `SUMINISTROS` requieren proveedor; `COMPRA_VENTA` y `SERVICIO` requieren cliente.
- Al crear el contrato se genera también la versión inicial.

## Qué conviene cuidar

- Si el contrato se vincula a un cliente, ese vínculo impacta el `numeroContrato` del cliente.
- No mezcles contratos sin contraparte correcta porque después complica alertas, aprobaciones y archivos.
- Las operaciones masivas sirven, pero hay que usarlas con cuidado por su impacto documental.

## Rutas y referencias

- `/busy/contratos`
- `/busy/contratos/new`
- `/busy/contratos/[id]`
- `/busy/contratos/update/[id]`
- `src/features/contratos/actions.ts`
- `src/features/contratos/lib/numeroContratoGenerator.ts`

## En una frase

Centraliza el ciclo documental del contrato desde su alta hasta su versionado y seguimiento operativo.
