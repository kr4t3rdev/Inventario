# Spec delta — Capa de contabilidad formal

## ADDED Requirements

### Requirement: Plan de cuentas por tenant

Cada tenant con el flag `contabilidad-formal` activo MUST disponer de un plan de cuentas propio sembrado de forma idempotente (diarios, cuentas jerárquicas y mapeo de roles completo). Cada cuenta MUST tener código único por tenant, tipo (`ACTIVO|PASIVO|PATRIMONIO|INGRESO|COSTO|GASTO`) y naturaleza coherente (`DEUDORA` para activo/costo/gasto, `ACREEDORA` para pasivo/patrimonio/ingreso). Las cuentas con flag `aceptaMovimiento=false` MUST NOT recibir líneas de asiento.

#### Scenario: Activación del flag en un tenant nuevo

- **Given** un tenant sin plan de cuentas
- **When** se ejecuta `inicializarPlanContableAction`
- **Then** el tenant obtiene 7 diarios, el plan por defecto (~32 cuentas, 23 hojas con movimiento) y los 23 roles mapeados, y una segunda ejecución no crea duplicados

#### Scenario: Código duplicado

- **Given** un tenant con una cuenta `1.1.01`
- **When** se intenta crear otra cuenta `1.1.01`
- **Then** la operación es rechazada con error de unicidad

### Requirement: Generación de asientos desde eventos de negocio

Todo evento de negocio que hoy produce una escritura de reconciliación (venta, cobro, compra, pago, gasto, nómina, anticipo, préstamo, deuda, ajuste, transferencia, inyección de capital, merma, producción) MUST generar su asiento contable dentro de la misma transacción cuando el motor está en modo `enforce`. En modo `off` el motor MUST ser no-op; en modo `shadow` MUST intentar el asiento y MUST NOT propagar ninguna excepción al flujo de negocio.

#### Scenario: Venta al contado en modo enforce

- **Given** un tenant en modo `enforce` con plantilla `VENTA_CONTADO` mapeada
- **When** se confirma una venta cobrada
- **Then** en la misma transacción se persiste un asiento en el diario de ventas que carga caja/bancos y abona ventas por el total

#### Scenario: Error del motor en modo shadow

- **Given** un tenant en modo `shadow` con un rol de cuenta sin mapear
- **When** se confirma una venta
- **Then** la venta se completa con normalidad y el error queda registrado en el log del motor

### Requirement: Cuadre de partida doble

Un asiento MUST persistirse si y solo si la suma de `debe` iguala la suma de `haber` en moneda funcional, con comparación decimal exacta. Ninguna línea MUST tener `debe` y `haber` a la vez.

#### Scenario: Asiento descuadrado rechazado

- **Given** un evento cuya plantilla produce líneas que no cuadran
- **When** el motor intenta persistirlo en modo `enforce`
- **Then** la transacción falla con `ASIENTO_DESCUADRADO` y no queda asiento ni líneas huérfanas

### Requirement: Idempotencia por origen

Cada asiento MUST registrar `origenTipo` y `origenId` únicos por tenant. Reintentar el mismo evento MUST NOT crear un segundo asiento.

#### Scenario: Reintento de cobro

- **Given** un cobro CxC que ya generó su asiento
- **When** el mismo evento se reintenta (red, reintento de cliente)
- **Then** no existe un segundo asiento con el mismo `(tenantId, origenTipo, origenId)`

### Requirement: Gobernanza de períodos sobre asientos

Toda inserción de asiento MUST pasar por el guard de períodos. Un asiento con fecha en período cerrado MUST ser rechazado en modo `enforce` y el intento MUST quedar en `AuditoriaPeriodo` con evento `INTENTO_BYPASS`.

#### Scenario: Asiento contra período cerrado

- **Given** un período en estado `APROBADO`
- **When** un evento con fecha dentro de ese período intenta asentarse
- **Then** se rechaza con `PERIODO_CERRADO` y existe una fila `INTENTO_BYPASS` con actor y motivo

### Requirement: Integridad encadenada

Cada asiento MUST persistir `hash = SHA256(representación canónica de líneas + número + fecha + hashAnterior)`, formando una cadena por tenant. Debe existir un verificador que recomputa la cadena y detecta cualquier alteración.

#### Scenario: Detección de manipulación

- **Given** un tenant con asientos encadenados
- **When** una línea histórica se altera directamente en base de datos
- **Then** el verificador de cadena señala el asiento exacto donde la cadena se rompe

### Requirement: Valoración multimoneda heredada

Las líneas MUST registrar `montoOriginal`, `monedaOriginal`, `tasaCambio` y `fxEvidenceFingerprint` heredados de la escritura origen. La capa formal MUST NOT recalcular tasas de cambio ni emitir evidencia FX propia.

#### Scenario: Cobro en moneda extranjera

- **Given** una reconciliación en USD con evidencia FX
- **When** se genera su asiento
- **Then** las líneas muestran `debe/haber` en moneda funcional y conservan el fingerprint de la evidencia original

### Requirement: Diferencia cambiaria asentada

Cuando la tasa de cobro difiere de la tasa de reconocimiento, el motor MUST generar líneas en las cuentas `DIFERENCIA_CAMBIARIA_INGRESO` o `DIFERENCIA_CAMBIARIA_GASTO` según el signo de la diferencia.

#### Scenario: Cobro con tasa favorable

- **Given** una cuenta por cobrar reconocida a una tasa y cobrada a una tasa mayor
- **When** se registra el cobro
- **Then** el asiento incluye el abono del excedente en la cuenta de diferencia cambiaria de ingreso

### Requirement: Libros formales

El sistema MUST ofrecer por tenant: libro diario (asientos por período con líneas, filtros y paginación), libro mayor por cuenta (movimientos con saldo corrido según naturaleza) y balance de comprobación de 4 columnas cuyo total de saldos deudores MUST igualar el de acreedores.

#### Scenario: Comprobación cuadrada

- **Given** un período con asientos de varios diarios
- **When** se genera el balance de comprobación
- **Then** las columnas de sumas y de saldos cuadran y el reporte indica el período y la moneda funcional

### Requirement: Conciliación cruzada contra la base caja

El sistema MUST ofrecer un panel que compare, por rubro (efectivo, bancos, inventario, CxC, CxP, capital), el saldo por cuentas contra el saldo del balance calculado actual, mostrando divergencias con detalle.

#### Scenario: Divergencia visible

- **Given** un evento que falló en shadow y dejó la capa formal sin su asiento
- **When** se abre el panel de conciliación cruzada
- **Then** el rubro afectado muestra la divergencia con monto y enlace al detalle

### Requirement: Cierre y apertura formales

Al aprobarse un cierre de período MUST generarse el asiento de cierre (saldo de cuentas de resultado contra `RESULTADO_PERIODO`). Al abrirse el período siguiente MUST generarse el asiento de apertura desde los saldos de `AperturaPeriodo` y el traspaso de `RESULTADO_PERIODO` a `RESULTADOS_ACUMULADOS`. El resumen del cierre MUST incluir los totales del libro formal.

#### Scenario: Cierre aprobado

- **Given** un período `EN_CIERRE` con asientos del ejercicio
- **When** el segundo aprobador aprueba el cierre
- **Then** existe el asiento de cierre contabilizado en el diario `APERTURA_CIERRE` y los saldos de cuentas de resultado quedan en cero

### Requirement: Inmutabilidad de asientos contabilizados

Un asiento contabilizado MUST NOT editarse ni borrarse. La corrección MUST realizarse anulándolo mediante un asiento inverso (`revertidoPorId`), preservando la cadena de hash.

#### Scenario: Corrección de asiento

- **Given** un asiento contabilizado con un importe erróneo
- **When** el usuario solicita su anulación
- **Then** el asiento original queda en estado `ANULADO` y existe un asiento inverso nuevo que lo referencia

### Requirement: Aislamiento multi-tenant

Los modelos de la capa formal MUST estar clasificados como `scoped`; ningún asiento, cuenta, diario o libro de un tenant MUST ser legible ni modificable desde otro tenant.

#### Scenario: Lectura cruzada

- **Given** dos tenants con asientos contabilizados
- **When** un usuario del tenant A consulta el libro diario
- **Then** solo ve asientos del tenant A, aunque conozca identificadores del tenant B
