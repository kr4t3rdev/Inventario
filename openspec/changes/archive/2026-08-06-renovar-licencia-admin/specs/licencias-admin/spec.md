# Licencias Admin Specification

## Purpose

Gestión del ciclo de vida de `TenantLicense` desde el panel admin `/admin/licencias`, incluyendo la renovación de vigencia con cambio de plan opcional y registro de pago opcional. La comisión de renovación se acredita únicamente a gestores de ventas (`salesAgent`) cuando el tenant está referido por gestor; los tenants referidos por afiliado registran el pago sin comisión de renovación.

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

La página `/admin/licencias` MUST exponer un botón "Renovar" por fila que abre un dialog con plan seleccionable (default el actual), checkbox "Registrar pago" y un AlertDialog de confirmación con diff antes → después.

#### Scenario: Botón disponible
- GIVEN fila con licencia activa
- THEN la fila muestra un botón "Renovar" entre "Cambiar Plan" y "Overrides"

#### Scenario: Confirmación con resumen
- WHEN el admin completa el dialog y presiona "Continuar"
- THEN un AlertDialog muestra plan actual → nuevo, días, expiración actual → nueva, precio y comisión estimada
- AND el submit solo procede tras "Confirmar renovación"

### Requirement: Validación de tenant activo

El sistema MUST rechazar renovar un tenant sin membresías activas.

#### Scenario: Tenant sin miembros activos
- GIVEN tenant sin `TenantMembership` con `isActive: true` y `user.isActive: true`
- WHEN el admin renueva
- THEN la action rechaza con `TENANT_NOT_ACTIVE`
