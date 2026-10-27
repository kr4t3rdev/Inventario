# Delta de especificación: dimensiones de unidades

## ADDED Requirements

### Requirement: Configuración explícita y compatible

El sistema MUST aceptar únicamente `COUNT`, `MASS`, `VOLUME`, `LENGTH`, `AREA` y `UNKNOWN`. Las unidades nuevas MUST usar `UNKNOWN` cuando se omita el campo, sin impedir una clasificación conocida al crearlas.

#### Scenario: Creación sin dimensión
- **GIVEN** un usuario autorizado dentro de un tenant.
- **WHEN** crea una unidad sin indicar dimensión.
- **THEN** la unidad se guarda con `UNKNOWN`.

#### Scenario: Cliente antiguo actualiza metadatos
- **GIVEN** una unidad con una dimensión ya configurada.
- **WHEN** una actualización omite el campo de dimensión.
- **THEN** el sistema MUST conservarla y actualizar solo los campos solicitados.

### Requirement: Protección de unidades en uso

El sistema MUST considerar como uso los productos asociados y las conversiones donde la unidad sea de origen o base. Una unidad conocida en uso MUST NOT cambiar a otra dimensión ni volver a `UNKNOWN`.

#### Scenario: Clasificación heredada compatible
- **GIVEN** una unidad `UNKNOWN` y conversiones cuyos otros extremos tienen la dimensión solicitada.
- **WHEN** se solicita explícitamente esa clasificación.
- **THEN** el cambio MAY completarse sin modificar factores, existencias, costos ni registros históricos.

#### Scenario: Conversión incompatible o desconocida
- **GIVEN** una conversión no idéntica cuyo otro extremo es incompatible o sigue en `UNKNOWN`.
- **WHEN** se solicita clasificar la unidad.
- **THEN** la operación MUST rechazarse sin actualizar su dimensión.

#### Scenario: Identidad
- **GIVEN** una conversión donde origen y base son la misma unidad.
- **WHEN** se clasifica esa unidad.
- **THEN** esa referencia MUST NOT producir por sí sola una incompatibilidad entre dimensiones.

### Requirement: Lectura transaccional de solicitudes explícitas

Toda solicitud que incluya dimensión MUST bloquear y volver a leer la unidad propia dentro de la transacción antes de decidir si es un cambio o una operación sin cambios. Las escrituras y respuestas MUST limitarse al tenant; el guard de integridad MAY consultar únicamente booleanos de referencias al identificador global de esa unidad ya validada, sin exponer datos ajenos.

#### Scenario: Solicitud UNKNOWN obsoleta
- **GIVEN** una lectura inicial `UNKNOWN` y una clasificación concurrente ya confirmada a una dimensión conocida de una unidad en uso.
- **WHEN** continúa una solicitud explícita que intentaba guardar `UNKNOWN`.
- **THEN** el sistema MUST validar contra el valor vigente y rechazar la vuelta a `UNKNOWN`, en lugar de usar una ruta rápida basada en la lectura inicial.

#### Scenario: Clasificaciones simultáneas de una unidad usada
- **GIVEN** una unidad `UNKNOWN` en uso y dos solicitudes concurrentes hacia dimensiones conocidas distintas.
- **WHEN** ambas llegan a la escritura antes de que se confirme una clasificación.
- **THEN** el sistema MUST NOT confirmar ambas como exitosas; la otra operación se rechaza con `CONFLICT` tras la lectura vigente protegida, sin reintento automático.

#### Scenario: Asociación de producto confirmada primero
- **GIVEN** una transacción de asociación mantiene la comprobación FK de una unidad conocida.
- **WHEN** otra solicitud intenta cambiar su dimensión.
- **THEN** el guard MUST esperar; después de confirmar la asociación, MUST reconocer el uso y rechazar el cambio.

#### Scenario: Guard de dimensión obtiene el bloqueo primero
- **GIVEN** el guard tiene bloqueada una unidad todavía sin referencias y su clasificación es válida.
- **WHEN** llega un INSERT de producto que intenta asociarla.
- **THEN** la asociación MUST esperar al guard y continuar solo después de liberar su bloqueo.

#### Scenario: Asociación incompatible con la propiedad del catálogo
- **GIVEN** una referencia al identificador global de la unidad que no cumple la propiedad del tenant.
- **WHEN** se intenta cambiar la dimensión de esa unidad.
- **THEN** el sistema MUST rechazarlo de forma cerrada, sin devolver datos de otro tenant ni reparar referencias automáticamente.

### Requirement: Interfaz del catálogo

Los formularios MUST mostrar las dimensiones con etiquetas en español neutro, preservar la selección de edición y enviar la dimensión elegida. La selección en compras y la administración de factores no forman parte de esta capacidad.
