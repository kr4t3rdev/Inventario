# New Spec: contabilidad/prestamos-cash/comprobante

## Purpose

Generación e impresión de un comprobante PDF para préstamos cash. Dos copias: una para el cliente y otra para el usuario que otorga el préstamo.

## Requirements

### Requirement: Generación de Comprobante PDF

El sistema MUST generar un PDF de comprobante para préstamos cash accesible vía endpoint API, usando `pdf-lib` (patrón existente del proyecto).

#### Scenario: Generar comprobante de préstamo

- GIVEN un préstamo cash con id `{id}`, `idNumerico: 42`, cliente "Juan Pérez", montoCapital: 5000, moneda: "CUP"
- WHEN se solicita GET `/api/contabilidad/prestamos-cash/{id}/comprobante`
- THEN retorna PDF con Content-Type `application/pdf`
- AND filename: `comprobante-PREST-42.pdf`

#### Scenario: Préstamo no encontrado

- GIVEN un id inexistente
- WHEN se solicita el endpoint
- THEN retorna 404 con mensaje de error

### Requirement: Contenido del Comprobante — Copia Cliente

El PDF MUST contener una sección "Copia Cliente" con los siguientes datos:

| Campo | Fuente | Obligatorio |
|-------|--------|-------------|
| Número de comprobante | `PREST-{idNumerico}` | MUST |
| Nombre del cliente | `cliente.nombre` | MUST |
| Monto solicitado (capital) | `montoCapital` | MUST |
| Monto a pagar (con interés) | `cuentaPorCobrar.montoDeuda` | MUST |
| Moneda | `moneda` | MUST |
| Tasa de cambio | `tasaCambioAlCrear` | Solo si `moneda ≠ monedaPrincipal` |
| Fecha de otorgamiento | `fechaOtorgamiento` | MUST |
| Fecha de vencimiento | `fechaVencimiento` | Solo si existe |

#### Scenario: Comprobante con tasa de cambio

- GIVEN un préstamo en USD con tasaCambioAlCrear: 120
- WHEN se genera el comprobante
- THEN la copia cliente muestra "Tasa de cambio: 120 CUP/USD"

#### Scenario: Comprobante en moneda principal

- GIVEN un préstamo en CUP (moneda principal)
- WHEN se genera el comprobante
- THEN la copia cliente NO muestra campo de tasa de cambio

### Requirement: Contenido del Comprobante — Copia Prestamista

El PDF MUST contener una segunda sección "Copia Interna" con todos los campos de la copia cliente MÁS:

| Campo adicional | Fuente |
|-----------------|--------|
| Observaciones | `observaciones` del préstamo |

#### Scenario: Copia interna con observaciones

- GIVEN un préstamo con observaciones: "Cliente frecuente, aprobado por gerencia"
- WHEN se genera el comprobante
- THEN la copia interna muestra las observaciones
- AND la copia cliente NO muestra las observaciones

#### Scenario: Copia interna sin observaciones

- GIVEN un préstamo sin observaciones
- WHEN se genera el comprobante
- THEN la copia interna muestra "Sin observaciones" o campo vacío

### Requirement: Layout del PDF

El PDF MUST contener ambas copias en la misma página (o páginas separadas si no caben), con línea de corte separadora. Cada copia SHOULD incluir título identificador ("COMPROBANTE DE PRÉSTAMO — Copia Cliente" / "Copia Interna").

#### Scenario: Ambas copias en una página

- GIVEN un préstamo con datos estándar
- WHEN se genera el comprobante
- THEN el PDF contiene 2 secciones con línea de corte entre ellas
- AND cada sección tiene encabezado identificando el tipo de copia

### Requirement: Botón de Impresión en UI

El sistema MUST proveer un botón para descargar/imprimir el comprobante desde la tabla de cuentas por cobrar y/o la tabla de préstamos cash.

#### Scenario: Descargar comprobante desde tabla CxC

- GIVEN una fila de préstamo en la tabla de cuentas por cobrar
- WHEN el usuario hace clic en el botón de descargar comprobante (ícono documento)
- THEN se descarga el PDF del comprobante

#### Scenario: Préstamo pagado permite descargar comprobante

- GIVEN un préstamo con estado PAGADO
- WHEN se muestra en la tabla
- THEN el botón de descargar comprobante MUST seguir habilitado
