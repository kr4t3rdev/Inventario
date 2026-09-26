# Spec delta — Transferencias: cierre de flujo

## ADDED Requirements

### Requirement: Máquina de estados de transferencias

Una transferencia MUST recorrer exclusivamente las transiciones:
`PENDIENTE → APROBADA` (aprobar), `APROBADA → EN_TRANSITO` (despachar),
`{APROBADA, EN_TRANSITO, PARCIAL} → COMPLETADA | PARCIAL` (completar),
`PENDIENTE → RECHAZADA` (rechazar) y cualquier estado vivo → `CANCELADA`
(eliminar). `EN_TRANSITO` MUST ser alcanzable mediante una action de despacho
que no mueva stock. Toda transición MUST aplicarse mediante un claim atómico
tenant-scoped que falle con error de conflicto si la fila cambió de estado.

#### Scenario: Despacho de una transferencia aprobada

- **Given** una transferencia en estado `APROBADA`
- **When** un usuario con permiso `inventario.transferencias.gestionar` ejecuta `despacharTransferenciaAction`
- **Then** el estado queda `EN_TRANSITO`, no se escribe stock ni kardex y el listado se revalida

#### Scenario: Despacho sin permiso

- **Given** un usuario sin el permiso `inventario.transferencias.gestionar`
- **When** intenta despachar
- **Then** recibe `FORBIDDEN` antes de cualquier consulta de datos

#### Scenario: Despacho de una transferencia no aprobada

- **Given** una transferencia `PENDIENTE`
- **When** se intenta despachar
- **Then** la operación es rechazada con `VALIDATION_ERROR`

### Requirement: Recepción total y parcial real

`completarTransferenciaAction` MUST exigir el permiso
`inventario.transferencias.gestionar` y tratar el input `cantidadRecibida`
como unidades recibidas en esta recepción, acumuladas sobre
`cantidadRecibida` previa. Si el acumulado es menor a `cantidad` MUST
persistir `estado: 'PARCIAL'` y `cantidadRecibida` acumulada; si iguala
`cantidad` MUST persistir `estado: 'COMPLETADA'`. El stock (StockUbicacion) y
el kardex (StockMoveLine) MUST mover solo el delta de la recepción, con
secuencia `SALIDA-n`/`ENTRADA-n` distinta por recepción. Una recepción que
supere el pendiente MUST ser rechazada.

#### Scenario: Recepción parcial persiste PARCIAL

- **Given** una transferencia `APROBADA` de 10 unidades sin recepciones previas
- **When** se confirma la recepción de 4
- **Then** el estado persistido es `PARCIAL` con `cantidadRecibida = 4`, el origen descuenta 4, el destino suma 4 y el kardex registra `SALIDA-0`/`ENTRADA-0` por 4

#### Scenario: Recepción adicional acumula hasta COMPLETADA

- **Given** una transferencia `PARCIAL` con `cantidadRecibida = 4` de 10
- **When** se confirman los 6 restantes
- **Then** el estado persistido es `COMPLETADA` con `cantidadRecibida = 10`, solo se mueven 6 unidades y el kardex registra `SALIDA-1`/`ENTRADA-1` por 6

#### Scenario: Recepción que supera el pendiente

- **Given** una transferencia `PARCIAL` con `cantidadRecibida = 4` de 10
- **When** se intenta recibir 7
- **Then** la operación es rechazada con `VALIDATION_ERROR` y no se mueve stock

#### Scenario: Recepciones concurrentes sobre la misma fila

- **Given** dos recepciones simultáneas sobre una transferencia recepcionable
- **When** ambas intentan el claim con el mismo valor previo de `cantidadRecibida`
- **Then** solo una aplica delta de stock y la otra recibe error de conflicto

#### Scenario: Cancelación de una transferencia parcial

- **Given** una transferencia `PARCIAL` que ya movió 4 unidades
- **When** se elimina
- **Then** se revierten 4 unidades en StockUbicacion (origen recupera, destino descuenta) y el kardex compensa las líneas registradas

#### Scenario: Completar sin permiso

- **Given** un usuario sin el permiso `inventario.transferencias.gestionar`
- **When** intenta completar una transferencia
- **Then** recibe `FORBIDDEN` antes de cualquier consulta de datos

### Requirement: Edición y creación con estados coherentes

`updateTransferenciaSchema` MUST NOT aceptar un campo `estado`. La edición
MUST rechazar transferencias en `EN_TRANSITO` o `PARCIAL`. La creación MUST
aceptar únicamente `PENDIENTE` o `COMPLETADA` como estado inicial.

#### Scenario: Input de estado retirado de la edición

- **Given** un payload de edición que incluye `estado`
- **When** se valida con `updateTransferenciaSchema`
- **Then** la clave es descartada y el resultado parseado no la contiene

#### Scenario: Edición de una transferencia en tránsito o parcial

- **Given** una transferencia `EN_TRANSITO` (o `PARCIAL`)
- **When** se intenta editar cantidad, producto u ubicaciones
- **Then** la operación es rechazada con `VALIDATION_ERROR`

#### Scenario: Creación con estado inválido

- **Given** un payload de creación con `estado: 'RECHAZADA'` (o `EN_TRANSITO`, `CANCELADA`, `PARCIAL`)
- **When** se valida con `createTransferenciaSchema`
- **Then** la validación falla

### Requirement: Higiene de registro y documentación

Las actions de transferencias MUST NOT emitir logs con datos de negocio
(por ejemplo payloads, ids de producto, stocks o resultados de transacción).
Los changes openspec de transferencias ya implementados en código
(`fix-transferencias-bugs`, `migrar-transferencias-server-first`) MUST
sincronizarse con la realidad y archivarse.

#### Scenario: Creación de transferencia sin logs de negocio

- **Given** la ejecución de `createTransferenciaAction` (feliz o con error de negocio)
- **Then** no se emiten `console.log`/`console.error` con payloads ni datos de la transacción

#### Scenario: Checklists archivadas

- **Given** los changes `fix-transferencias-bugs` y `migrar-transferencias-server-first` con su código ya implementado
- **When** se sincronizan sus tareas contra el código real
- **Then** quedan archivados bajo `openspec/changes/archive/` con prefijo de fecha
