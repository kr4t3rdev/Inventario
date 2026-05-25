# UI de Gestión de Períodos

## Purpose

Define la interfaz de usuario para la gestión de períodos contables, incluyendo visualización de estados, acciones de apertura/cierre/reapertura, modal de motivo, y timeline de auditoría.

## Requirements

### Requirement: Panel de Períodos

El sistema DEBE proveer una vista `/contabilidad/periodos` que muestre todos los períodos contables del tenant con su estado visual.

#### Scenario: Lista de períodos con estados visuales

- GIVEN el usuario navega a `/contabilidad/periodos`
- WHEN la página carga
- THEN se muestra una tabla/lista con todos los períodos del tenant
- AND cada período muestra: tipo (DIARIO/MENSUAL/ANUAL), rango de fechas, estado, y acciones disponibles
- AND los estados se muestran con badges de color:
  - `BORRADOR`: gris
  - `ABIERTO`: verde
  - `EN_CIERRE`: amarillo/naranja
  - `CERRADO`: rojo
  - `APROBADO`: rojo oscuro con ícono de candado
  - `REABIERTO`: azul con ícono de advertencia

#### Scenario: Filtro por tipo de período

- GIVEN la lista de períodos muestra todos los tipos
- WHEN el usuario selecciona un filtro (DIARIO, MENSUAL, ANUAL)
- THEN la lista muestra solo los períodos del tipo seleccionado

#### Scenario: Filtro por estado

- GIVEN la lista de períodos muestra todos los estados
- WHEN el usuario selecciona un filtro de estado
- THEN la lista muestra solo los períodos con ese estado

### Requirement: Acciones por Estado

El sistema DEBE mostrar acciones disponibles según el estado actual del período:

| Estado | Acciones Disponibles |
|--------|---------------------|
| `BORRADOR` | Abrir |
| `ABIERTO` | Cerrar |
| `EN_CIERRE` | (ninguna, estado transitorio) |
| `CERRADO` | Aprobar |
| `APROBADO` | Reabrir |
| `REABIERTO` | Cerrar, Volver a Abrir |

#### Scenario: Botón de abrir en período BORRADOR

- GIVEN un período en estado `BORRADOR`
- WHEN el usuario ve el período en la lista
- THEN el botón "Abrir" está habilitado
- AND al hacer clic, el período cambia a `ABIERTO`
- AND se muestra toast de éxito

#### Scenario: Botón de cerrar en período ABIERTO

- GIVEN un período en estado `ABIERTO`
- WHEN el usuario ve el período en la lista
- THEN el botón "Cerrar" está habilitado
- AND al hacer clic, se solicita confirmación
- AND si confirma, el período pasa a `EN_CIERRE` y luego `CERRADO`

#### Scenario: Botón de aprobar en período CERRADO

- GIVEN un período en estado `CERRADO`
- WHEN el usuario ve el período en la lista
- THEN el botón "Aprobar" está habilitado
- AND al hacer clic, se solicita confirmación
- AND si confirma, el período cambia a `APROBADO`

#### Scenario: Botón de reaperturar en período APROBADO

- GIVEN un período en estado `APROBADO`
- WHEN el usuario ve el período en la lista
- THEN el botón "Reabrir" está habilitado
- AND al hacer clic, se abre un modal que exige motivo

### Requirement: Modal de Motivo para Reapertura

El sistema DEBE mostrar un modal que obligue al usuario a ingresar un motivo antes de reaperturar un período aprobado.

#### Scenario: Modal de reapertura con motivo obligatorio

- GIVEN un período en estado `APROBADO`
- WHEN el usuario hace clic en "Reabrir"
- THEN se abre un modal con:
  - Campo de texto obligatorio para el motivo
  - Botón "Confirmar Reapertura" (deshabilitado si motivo vacío)
  - Botón "Cancelar"

#### Scenario: Reapertura con motivo válido

- GIVEN el modal de reapertura está abierto
- WHEN el usuario ingresa un motivo no vacío y hace clic en "Confirmar"
- THEN el período cambia a `REABIERTO`
- AND se muestra toast de éxito: "Período reaperturado correctamente"
- AND el motivo queda registrado en auditoría

#### Scenario: Reapertura sin motivo — bloqueada

- GIVEN el modal de reapertura está abierto
- WHEN el campo de motivo está vacío
- THEN el botón "Confirmar Reapertura" está DESHABILITADO
- AND el usuario NO puede proceder sin motivo

### Requirement: Timeline de Auditoría

El sistema DEBE mostrar el historial de transiciones de un período en un panel de detalle.

#### Scenario: Timeline muestra todas las transiciones

- GIVEN un período que ha sido abierto, cerrado, aprobado y reaperturado
- WHEN el usuario abre el detalle del período
- THEN se muestra un timeline cronológico con:
  - Fecha/hora de cada transición
  - Usuario que ejecutó la acción
  - Tipo de acción (APERTURA, CIERRE, APROBACION, REAPERTURA)
  - Motivo (si aplica, para reaperturas)

#### Scenario: Timeline muestra metadatos del cierre

- GIVEN un período cerrado con snapshot
- WHEN el usuario ve el registro de cierre en el timeline
- THEN se muestra información adicional:
  - Cantidad de snapshots creados
  - Cantidad de operaciones en el período

### Requirement: Bloqueos Visuales en UI

El sistema DEBE mostrar indicadores visuales claros cuando una acción está bloqueada por un período cerrado.

#### Scenario: Formulario deshabilitado por período cerrado

- GIVEN un período mensual está `CERRADO`
- WHEN el usuario intenta acceder a un formulario de creación de gasto con fecha en ese período
- THEN el formulario muestra un banner de advertencia: "El período {mes} está cerrado. No se permiten nuevas operaciones."
- AND los campos de entrada están deshabilitados
- AND el botón de enviar está oculto o deshabilitado

#### Scenario: Toast de error por período cerrado

- GIVEN un período está `CERRADO`
- WHEN una acción es rechazada por el guard
- THEN se muestra un toast de error con el mensaje del guard
- AND el mensaje incluye el período y su estado

### Requirement: Indicador de Período Activo

El sistema DEBE mostrar en la barra de navegación o header el período contable activo actual.

#### Scenario: Header muestra período activo

- GIVEN el usuario está logueado
- WHEN navega por cualquier página del sistema
- THEN el header muestra el período contable activo (ej: "Marzo 2026 — ABIERTO")
- AND el color del indicador refleja el estado (verde para ABIERTO, rojo para CERRADO)
