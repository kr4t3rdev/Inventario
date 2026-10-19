# Spec delta — Contratos fase 2 (ciclo de vida, RBAC, config por tenant y alertas)

## ADDED Requirements

### Requirement: Máquina de estados del contrato

El sistema MUST validar toda transición de `Contrato.estado` contra la tabla de transiciones válidas (BORRADOR→PENDIENTE_APROBACION|ANULADO; PENDIENTE_APROBACION→APROBADO|RECHAZADO|ANULADO; RECHAZADO→BORRADOR|ANULADO; APROBADO→ACTIVO|ANULADO; ACTIVO→FINALIZADO|ANULADO; FINALIZADO y ANULADO son terminales). Una transición inválida MUST ser rechazada con código `TRANSICION_INVALIDA` sin mutar el contrato. El cambio de estado masivo (bulk) MUST aplicar solo los contratos con transición válida y MUST reportar los fallidos por id con su motivo, sin error 500. La aprobación registrada vía `ContratoAprobacion` MUST pasar por la máquina de estados y MUST asignar `aprobadoPor` y `fechaAprobacion` desde el servidor, nunca desde el payload del cliente.

#### Scenario: Transición inválida rechazada

- **Given** un contrato en estado `BORRADOR` del tenant del usuario
- **When** se intenta cambiar su estado a `ACTIVO`
- **Then** la operación falla con `TRANSICION_INVALIDA`, el contrato permanece en `BORRADOR` y no se registra aprobador

#### Scenario: Bulk con mezcla de válidos e inválidos

- **Given** tres contratos: dos en `PENDIENTE_APROBACION` y uno en `FINALIZADO`
- **When** se solicita el cambio masivo a `APROBADO`
- **Then** los dos primeros pasan a `APROBADO`, el tercero queda en `FINALIZADO`, la respuesta es 200 con `actualizados` de longitud 2 y `fallidos` con el id y motivo del tercero

### Requirement: Ciclo de vida no escribible por cliente

El canal de edición de contratos (server action de update y handler PUT de `/api/contratos/[id]`) MUST ignorar los campos `estado`, `numeroContrato`, `fechaAprobacion` y `aprobadoPor` del payload del cliente. La numeración (`numeroContrato`) MUST seguir generándose en el servidor con consecutivo por tenant. Los cambios de estado solo pueden ocurrir por la vía de la máquina de estados y la firma.

#### Scenario: PUT con campos protegidos no muta el contrato

- **Given** un contrato en `BORRADOR` con numeración server-generated
- **When** se envía un update con `estado: 'ACTIVO'`, `numeroContrato: 'X-001'` y `aprobadoPor` en el payload
- **Then** la edición de contenido se aplica, pero el contrato conserva `BORRADOR`, su numeración original y sin aprobador

#### Scenario: Edición de contenido sigue funcionando

- **Given** un contrato en `ACTIVO`
- **When** se envía un update con `monto` y `observaciones`
- **Then** ambos campos se persisten

### Requirement: Activación del contrato por firma

El registro de una firma con estado `FIRMADA` sobre un contrato en `APROBADO` MUST transicionar el contrato a `ACTIVO` vía la máquina de estados, con `fechaFirma` asignada por el servidor. Una firma con estado distinto de `FIRMADA` MUST NOT alterar el estado del contrato. El estado de la firma MUST estar restringido a `PENDIENTE|FIRMADA|RECHAZADA`.

#### Scenario: Firma activa el contrato

- **Given** un contrato en `APROBADO`
- **When** se registra una firma con estado `FIRMADA`
- **Then** el contrato pasa a `ACTIVO`, la firma queda con `fechaFirma` del servidor y el payload no puede imponer otra fecha

#### Scenario: Firma pendiente no cambia el estado

- **Given** un contrato en `APROBADO`
- **When** se registra una firma con estado `PENDIENTE`
- **Then** la firma se crea para seguimiento y el contrato permanece en `APROBADO`

### Requirement: Control de acceso por ruta

Todas las rutas REST del módulo de contratos (13 archivos bajo `/api/contratos`, `/api/tipos-contratos` y `/api/configuracion/sistema/contratos`) MUST pasar por el wrapper `withAuth` y quedar mapeadas en el route-map de permisos: `/api/contratos` (todos los métodos) → `ventas.contratos.gestionar`; `/api/tipos-contratos` GET → `ventas.contratos.gestionar`, POST/PUT → `config.tipos-contrato.crear`, DELETE → `config.tipos-contrato.eliminar`; `/api/configuracion/sistema/contratos` GET → `ventas.contratos.gestionar`, PUT → `config.contratos.configurar`. Una ruta sin clave mapeada o un usuario sin la clave resuelva MUST recibir 403 (fail-closed).

#### Scenario: Usuario sin permiso de gestión intenta editar

- **Given** un usuario autenticado cuya membresía no tiene la clave `ventas.contratos.gestionar`
- **When** envía un PUT a `/api/contratos/<id>`
- **Then** recibe 403 y el contrato no se modifica

#### Scenario: Configuración global protegida

- **Given** un usuario autenticado con rol `dependiente` (sin `config.contratos.configurar`)
- **When** envía un PUT a `/api/configuracion/sistema/contratos`
- **Then** recibe 403

### Requirement: Configuración de contratos por tenant

El sistema MUST disponer de la configuración de contratos por tenant (modelo `ConfiguracionContratos`, una fila por tenant, `diasAvisoVencimiento` con default 30) servida por `/api/configuracion/sistema/contratos`: GET con upsert perezoso de la fila default y PUT con validación 1..365 para el tenant del usuario autenticado. El campo global `ConfiguracionSistema.diasAvisoVencimientoContrato` queda deprecado (se conserva lectura/escritura de la columna; no se borra).

#### Scenario: Primera consulta crea la configuración default

- **Given** un tenant sin fila de `ConfiguracionContratos`
- **When** un usuario del tenant consulta GET en la ruta de configuración
- **Then** recibe `{ diasAvisoVencimiento: 30 }` y la fila queda creada para su tenant

#### Scenario: Un tenant no puede leer ni escribir la configuración de otro

- **Given** dos tenants A y B con filas de configuración distintas
- **When** un usuario de A hace PUT con `diasAvisoVencimiento: 15`
- **Then** solo la fila de A cambia; la de B permanece intacta

### Requirement: Alertas automáticas de vencimiento

El sistema MUST generar alertas de vencimiento para contratos `ACTIVO` con `fechaFin`: `VENCIMIENTO_PROXIMO` cuando faltan entre 0 y N días (N = `contrato.diasAvisoVencimiento` > 0, si no config del tenant, si no 30) y `CONTRATO_VENCIDO` cuando la fecha fin ya pasó (hasta 30 días de antigüedad), con `fechaAlerta` truncada al día. El proceso (script programable por cron externo) MUST ser idempotente: correrlo dos veces el mismo día MUST NOT duplicar alertas.

#### Scenario: Contrato dentro de la ventana de aviso

- **Given** un contrato `ACTIVO` con `fechaFin` en 10 días y aviso de 30
- **When** corre el script de alertas
- **Then** se crea una alerta `VENCIMIENTO_PROXIMO` para ese contrato y una segunda ejecución el mismo día no crea otra

#### Scenario: Contrato vencido hace tiempo no acumula alertas nuevas

- **Given** un contrato `ACTIVO` con `fechaFin` hace 45 días
- **When** corre el script de alertas
- **Then** no se crea alerta (fuera de la ventana de 30 días de antigüedad)

### Requirement: Deprecación de Vendor.contrato

El campo legacy `Vendor.contrato` MUST dejar de ser escrito por las rutas de proveedores mobile (create y update): un payload que lo incluya MUST ser ignorado. La lectura del campo se conserva mientras exista la columna y queda marcado `@deprecated` en el schema en favor de la relación `Contrato.vendorId`.

#### Scenario: Payload de proveedor con contrato legado

- **Given** la creación de un proveedor vía API mobile con `contrato: 'C-123'` en el payload
- **When** se procesa la creación
- **Then** el proveedor se crea y el campo `contrato` queda `null` (no se persiste el valor enviado)
