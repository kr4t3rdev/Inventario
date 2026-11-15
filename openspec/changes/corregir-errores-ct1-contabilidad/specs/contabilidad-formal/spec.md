# Contabilidad formal: errores de pruebas CT-1

## ADDED Requirements

### Requirement: Diagnóstico y manejo de período ausente

El sistema MUST manejar una operación formal sin período aplicable sin intentar
persistir una referencia inválida y sin perder la auditoría obligatoria. MUST
informar una causa accionable y preservar la atomicidad de la operación.

#### Scenario: Compra sin período aplicable
- **GIVEN** un tenant de pruebas sin período para la fecha de compra
- **WHEN** se intenta registrar una compra en el modo aplicable
- **THEN** el resultado MUST respetar el modo y la política de auditoría vigentes
- **AND** no MUST ocultar una referencia de período inválida como diagnóstico genérico
- **AND** una operación rechazada MUST dejar sin cambios sus efectos persistidos

### Requirement: Valoración de venta con evidencia

El sistema MUST resolver y validar la valoración monetaria de cada evento de
venta usando datos reales del tenant y la fecha, y MUST mantener la operación
atómica si falta evidencia requerida.

#### Scenario: Venta de prueba rechazada por valoración
- **GIVEN** una venta en efectivo de una unidad a 15 CUP y el contexto reproducido
- **WHEN** se registra la venta
- **THEN** MUST identificarse el emisor y el dato que causa «La valoración monetaria del evento no está disponible»
- **AND** el flujo válido MUST generar los efectos y asientos esperados con evidencia verificable
- **AND** si realmente falta evidencia, MUST rechazarse sin inventar moneda, costo o tasa

### Requirement: Moneda funcional coherente en apertura

El diálogo de apertura MUST mostrar la moneda de la política contable del tenant
activo cuando la consulta tenga éxito, y MUST distinguir ausencia y error de
consulta sin presentar un dato inferido como confirmado.

#### Scenario: Política CUP
- **GIVEN** una política contable CUP del tenant activo
- **WHEN** se abre el diálogo de apertura
- **THEN** MUST mostrar CUP cuando termine la consulta

### Requirement: Reproducción y verificación aisladas

Las correcciones MUST incluir pruebas relevantes de los casos reproducidos,
autorización y aislamiento de tenant cuando corresponda. La comprobación en
producción se reserva para la sesión de pruebas original.
