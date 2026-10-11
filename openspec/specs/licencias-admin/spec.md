# Licencias Admin Specification

## Purpose

Gestión del ciclo de vida de `TenantLicense` desde el panel admin `/admin/licencias`, incluyendo la renovación de vigencia con cambio de plan opcional y registro de pago opcional. La renovación es una operación atómica e idempotente: licencia, sincronización de usuarios, pago/comisión, auditoría y recibo se comprometen en una sola transacción. La comisión de renovación se acredita únicamente a gestores de ventas (`salesAgent`) cuando el tenant está referido por gestor; los tenants referidos por afiliado registran el pago sin comisión de renovación.

## Requirements

### Requirement: Renovación de licencia

El sistema MUST permitir al admin renovar la vigencia de una `TenantLicense` sumando la duración del plan a la `expiracion` actual, preservando los días pendientes.

#### Scenario: Renovación activa sin cambio de plan ni pago
- GIVEN licencia activa con `expiracion: 2026-03-12` y plan `duracionDias: 30`
- WHEN el admin renueva con el mismo plan y `registerPayment: false`
- THEN `expiracion` pasa a `2026-04-11` y `activa` permanece `true`
- AND `planId`, `max*` y `featureOverrides` no cambian

#### Scenario: Renovación con cambio de plan
- GIVEN licencia con plan Básico y `plan.duracionDias: 30`
- WHEN el admin renueva seleccionando plan Profesional (`duracionDias: 90`)
- THEN `planId`, `maxUsuarios`, `maxAlmacenes`, `maxProductos`, `maxClientes` se sincronizan con Profesional
- AND `expiracion` se extiende en 90 días desde la expiración actual
- AND `features` se resetea a los del nuevo plan y `featureOverrides` se vacía

#### Scenario: Renovación de licencia revocada/expirada
- GIVEN licencia con `activa: false` o `expiracion < now`
- WHEN el admin renueva
- THEN `activa` se establece en `true` y `expiracion` se calcula desde `now` (no desde el vencimiento pasado)

#### Scenario: Descuento por referido conservado sin pago
- GIVEN tenant referido (gestor o afiliado) con licencia `finalPriceUsd` inferior al precio de lista
- WHEN el admin renueva con `registerPayment: false`
- THEN la detección de referido corre dentro de la transacción, independiente del pago
- AND `listPriceUsd`/`finalPriceUsd` se recalculan con el descuento por referido del plan destino

### Requirement: Idempotencia de la operación de renovación

Cuando el request incluye `idempotencyKey`, el sistema MUST proteger la renovación completa con un recibo inmutable (`LicenseRenewalOperation`, único por `tenantId + keyHash`): los replays devuelven el outcome original sin re-extender la vigencia ni repetir pago/comisión/auditoría. Las renovaciones sin clave preservan el contrato legado (no idempotentes).

#### Scenario: Replay de la misma operación
- GIVEN renovación confirmada con `idempotencyKey: K` y outcome persistido
- WHEN se reintenta con la misma clave y el mismo payload
- THEN se retorna el outcome original con `duplicate: true`, sin nuevas escrituras (sin segunda extensión, pago, comisión ni auditoría)

#### Scenario: Misma clave con payload distinto
- GIVEN clave `K` ya usada para otra licencia, plan, variante de pago o monto
- WHEN se renueva con `K`
- THEN la action rechaza con `IDEMPOTENCY_CONFLICT` antes de escribir nada

#### Scenario: Clave ajena persistida como pago
- GIVEN `TenantLicensePayment` legado (pre-recibos) con clave `K` de otra licencia/tenant
- WHEN se renueva con `registerPayment: true` y clave `K`
- THEN la action rechaza con `IDEMPOTENCY_CONFLICT`; si el pago pertenece a la misma licencia, se retorna `duplicate: true` con el ciclo persistido sin extender

#### Scenario: Concurrencia con la misma clave
- GIVEN dos renovaciones simultáneas con la misma clave sobre la misma licencia
- WHEN ambas transacciones compiten (lock de fila `SELECT ... FOR UPDATE` + unique del recibo)
- THEN exactamente una extiende y la otra hace replay del recibo; un solo pago y una sola comisión

### Requirement: Atomicidad de pago y comisión

El sistema MUST comprometer licencia, usuarios, pago presencial y comisión del gestor en la misma transacción: si la comisión falla (p. ej. `SALES_AGENT_NOT_ACTIVE`), la renovación se revierte por completo.

### Requirement: Sincronización de usuarios del tenant

El sistema MUST sincronizar `expiresAt` de los usuarios con membresía activa del tenant con la nueva `expiracion`.

#### Scenario: Usuarios sincronizados
- GIVEN tenant con 3 miembros activos cuyos `expiresAt` vencen antes que la nueva `expiracion`
- WHEN se ejecuta la renovación
- THEN los 3 usuarios tienen `expiresAt` igual a la nueva `expiracion` e `isActive: true`

### Requirement: Registro opcional de pago

El sistema MAY permitir registrar un `TenantLicensePayment` confirmado como parte de la renovación, de forma idempotente, acreditando comisión si el tenant es referido.

#### Scenario: Pago con tenant referido por sales-agent
- GIVEN licencia de tenant referido por gestor de ventas activo, monto exigible `finalPriceUsd: 100`
- WHEN el admin marca `registerPayment: true`, `amountPaidUsd: 100`, `idempotencyKey: 'renewal:tenantX:2026-04'`
- THEN se crea `TenantLicensePayment` con `status: 'confirmed'`, `paymentKind: 'renewal'`, `paymentCycleEndsAt: newExpiracion`
- AND se acredita comisión al gestor y se notifica

#### Scenario: Pago con monto inválido
- GIVEN monto exigible `100`
- WHEN el admin envía `amountPaidUsd: 90`
- THEN la action rechaza con `PAYMENT_AMOUNT_MISMATCH`

#### Scenario: Idempotencia por clave duplicada
- GIVEN `idempotencyKey: 'renewal:tenantX:2026-04'` ya persistido
- WHEN se reintenta con la misma clave
- THEN se retorna el resultado existente sin nuevo crédito (`duplicate: true`)

#### Scenario: Pago en tenant no referido
- GIVEN tenant sin referencia de gestor/afiliado
- WHEN el admin marca `registerPayment: true`
- THEN se persiste `TenantLicensePayment` sin comisión asociada

### Requirement: Auditoría

El sistema MUST registrar un `AuditLog` con el diff de la renovación.

#### Scenario: Log de renovación
- WHEN la renovación se completa
- THEN existe un `AuditLog` con `accion: 'UPDATE'`, `entidad: 'TENANT_LICENSE'`, `entidadId`, `usuarioId`, y `detalles` conteniendo `previousExpiracion`, `newExpiracion`, `previousPlanId`, `newPlanId`, `registeredPaymentId` (si aplica)

### Requirement: UI de renovación

La página `/admin/licencias` MUST exponer un botón "Renovar" por fila que abre un dialog con plan seleccionable (default el actual), checkbox "Registrar pago" y un AlertDialog de confirmación con diff antes → después. El dialog siempre envía una `idempotencyKey` (con o sin pago) generada por licencia, plan, variante y ventana de segundos, de modo que cada sesión del dialog sea una intención nueva y los reintentos de una sesión reusen la misma clave.

#### Scenario: Botón disponible
- GIVEN fila con licencia activa
- THEN la fila muestra un botón "Renovar" entre "Cambiar Plan" y "Overrides"

#### Scenario: Confirmación con resumen
- WHEN el admin completa el dialog y presiona "Continuar"
- THEN un AlertDialog muestra plan actual → nuevo, días, expiración actual → nueva, precio y comisión estimada
- AND el submit solo procede tras "Confirmar renovación"

#### Scenario: Replay reportado al admin
- GIVEN una renovación ya aplicada con la misma clave
- WHEN el reintento devuelve `duplicate: true`
- THEN la UI informa "ya estaba aplicada" en lugar de un toast de éxito genérico

### Requirement: Cotización de servidor del monto exigible

El monto exigible mostrado en el dialog MUST provenir de una cotización de servidor (`quoteRenewalLicenciaAction`) que aplica la misma lógica de pricing, duración y fechas que la ejecución: precio del plan SELECCIONADO con el descuento por referido detectado en servidor, nunca el precio viejo de la licencia. El botón de continuar permanece deshabilitado mientras la cotización está en vuelo o falla.

#### Scenario: Cambio de plan cotizado
- GIVEN licencia con plan Básico ($40) y admin que selecciona plan Profesional ($80) en el dialog
- WHEN la cotización de servidor resuelve
- THEN el dialog muestra `$80.00` como monto exigible (con descuento por referido si aplica)
- AND la confirmación y el pago persistido coinciden con el monto mostrado

### Requirement: Validación de tenant activo

El sistema MUST rechazar renovar un tenant sin membresías activas.

#### Scenario: Tenant sin miembros activos
- GIVEN tenant sin `TenantMembership` con `isActive: true` y `user.isActive: true`
- WHEN el admin renueva
- THEN la action rechaza con `TENANT_NOT_ACTIVE`
