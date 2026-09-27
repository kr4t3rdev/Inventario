# Spec delta — Ofertas: hardening de ciclo de vida

## ADDED Requirements

### Requirement: Numeración secuencial por tenant con reintento

El sistema MUST asignar a cada oferta un número `OF-XXXXXX` secuencial por tenant,
resuelto por un generador dedicado. Ante una colisión de unicidad
(`@@unique([tenantId, numeroOferta])`) el generador MUST reintentar la creación con
el siguiente consecutivo, hasta un máximo de 3 intentos. Un error distinto de
colisión de unicidad MUST propagarse sin reintento.

#### Scenario: Creación concurrente de ofertas

- **Given** dos creaciones simultáneas de ofertas para el mismo tenant
- **When** la segunda creación recibe una colisión P2002 del índice único
- **Then** el generador reintenta con el consecutivo siguiente y ambas ofertas
  quedan persistidas con números distintos, sin error 500

#### Scenario: Agotamiento de reintentos

- **Given** tres intentos consecutivos que colisionan
- **When** se agota el máximo de reintentos
- **Then** el error de colisión original se propaga a la acción invocadora

### Requirement: Expiración de ofertas (estado VENCIDA)

El enum `EstadoOferta` MUST incluir el valor `VENCIDA`. Una oferta en
`PENDIENTE` cuya `fechaVencimiento` sea anterior al momento actual MUST pasar a
`VENCIDA` al tocar el módulo (lectura de lista, lectura individual, facturar,
convertir). Ofertas sin `fechaVencimiento` MUST NOT expirar. Ofertas en estados
distintos de `PENDIENTE` MUST NOT expirar.

#### Scenario: Listado marca vencidas

- **Given** una oferta PENDIENTE con fechaVencimiento ayer
- **When** se ejecuta `getOfertasAction`
- **Then** la oferta queda en estado VENCIDA antes de responder

#### Scenario: Facturación de una oferta vencida

- **Given** una oferta PENDIENTE vencida
- **When** se ejecuta `facturarOfertaAction`
- **Then** la expiración ocurre primero y la facturación se rechaza con error
  explícito de estado no facturable

### Requirement: Máquina de transiciones de estado

`updateOfertaAction` MUST validar transiciones contra una matriz server-side: solo
`PENDIENTE → ACEPTADA` y `PENDIENTE → RECHAZADA` están permitidas; `VENCIDA`,
`RECHAZADA` y `FACTURADA` MUST NOT tener transiciones de salida vía update. La
edición de `observaciones` MUST seguir permitida en cualquier estado. La eliminación
de una oferta `FACTURADA` MUST rechazarse en servidor.

#### Scenario: Salto de estado forjado

- **Given** una oferta FACTURADA
- **When** un cliente envía `updateOfertaAction` con `estado: PENDIENTE`
- **Then** la acción rechaza con `ESTADO_TRANSICION_INVALIDA` sin modificar la oferta

#### Scenario: Eliminación de oferta facturada

- **Given** una oferta FACTURADA
- **When** se ejecuta `deleteOfertaAction`
- **Then** la acción rechaza con `ESTADO_NO_ELIMINABLE`

### Requirement: Recalculo autoritativo de totales e impuestos en servidor

El servidor MUST calcular el total de cada línea como `cantidad × precioUnitario`
(sobre el precio resuelto), el `subtotal` como suma de líneas y el `total` como
`subtotal + impuestos`. Los campos `precioUnitario` y `total` del payload MUST
ignorarse como autoridad. El valor `impuestos` es una declaración del cliente y
MUST satisfacer `0 ≤ impuestos ≤ subtotal`; en caso contrario la acción MUST
rechazar con `TAX_INVALID`.

#### Scenario: Payload con totales forjados

- **Given** un payload con `impuestos: 500` y `total: 99999` sobre ítems cuyo
  subtotal resuelto es 200
- **When** se ejecuta `createOfertaAction`
- **Then** la acción rechaza con `TAX_INVALID` y no persiste la oferta

#### Scenario: Declaración válida

- **Given** un payload con ítems cuyo subtotal resuelto es 200 e
  `impuestos: 40`
- **When** se ejecuta `createOfertaAction`
- **Then** la oferta persiste `subtotal: 200`, `impuestos: 40`, `total: 240` y
  líneas con `total = cantidad × precioUnitario` recalculado

### Requirement: Edición de ítems de la oferta

`updateOfertaAction` MUST aceptar un conjunto opcional de ítems que reemplace
atómicamente los existentes únicamente cuando la oferta está en `PENDIENTE`; en
otro estado MUST rechazar con `ITEMS_NO_EDITABLES`. Los precios del reemplazo MUST
re-resolverse server-side (lista del cliente sobre precio del producto/servicio)
y los totales MUST recalcularse según el requirement de recalculo autoritativo.

#### Scenario: Edición válida en PENDIENTE

- **Given** una oferta PENDIENTE con dos ítems
- **When** se envía `updateOfertaAction` con un nuevo conjunto de ítems
- **Then** los ítems originales se reemplazan atómicamente y los montos de la
  oferta se recalculan con precios vigentes

#### Scenario: Edición en estado no editable

- **Given** una oferta ACEPTADA
- **When** se envía `updateOfertaAction` con ítems
- **Then** la acción rechaza con `ITEMS_NO_EDITABLES`

### Requirement: Duplicación de oferta

El sistema MUST exponer `duplicarOfertaAction(ofertaId)` que cree una nueva oferta
en `PENDIENTE` con número nuevo del generador, copiando cliente, ítems y
observaciones, con precios re-resueltos al momento de duplicar. La
`fechaVencimiento` original MUST conservarse solo si sigue futura; si ya venció,
la copia MUST quedar sin `fechaVencimiento`. El `impuestos` original se conserva
como declaración y MUST pasar la validación del requirement de recalculo; si no,
la duplicación MUST rechazar con `TAX_INVALID`.

#### Scenario: Duplicar oferta vigente

- **Given** una oferta con precios de catálogo que cambiaron desde su emisión
- **When** se ejecuta `duplicarOfertaAction`
- **Then** la copia queda PENDIENTE con número nuevo y montos recalculados a
  precios vigentes

#### Scenario: Duplicar oferta ya vencida

- **Given** una oferta con fechaVencimiento pasada
- **When** se ejecuta `duplicarOfertaAction`
- **Then** la copia se crea PENDIENTE sin fechaVencimiento
