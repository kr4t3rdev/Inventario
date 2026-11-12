# Delta: nomina-config — F-5

## ADDED Requirements

### Requirement: NominaConfig por tenant

The system MUST modelar `NominaConfig` con `tenantId String @id` (1:1 por
tenant, patrón `TenantAccountingPolicy`) y campos: `tarifaHoraExtra Float
@default(1.5)`, `horasMensualesEstandar Int @default(192)`, `monedaPago
String @default("CUP")`, `updatedAt`, `updatedBy String?`. (Ajuste verificado
al ejecutar: `horasMensualesEstandar` en vez de `jornadaDiariaHoras`, porque
la fórmula vigente divide el salario entre las horas del mes.) Las fórmulas
de payroll MUST aceptar la config opcional y sin config el comportamiento es
idéntico byte-a-byte al actual (defaults 1.5 / 192).

#### Scenario: Tarifa de HE desde config

* GIVEN un tenant con `NominaConfig.tarifaHoraExtra = 2.0` y
  `horasMensualesEstandar = 192`
* WHEN se registra un pago con 40 horas extra y salario base 1920
* THEN el monto de horas extra es `40 × (1920 / 192) × 2.0 = 800` usando la
  config del tenant, no el default 1.5 (que daría 600).

#### Scenario: Sin config usa defaults

* GIVEN un tenant sin `NominaConfig`
* WHEN se calculan horas extra
* THEN el resultado es idéntico al cálculo actual (fallback 1.5 / 192).

#### Scenario: Config inválida no inventa dinero

* GIVEN una config con `horasMensualesEstandar = 0` o `tarifaHoraExtra` negativa
* WHEN se calculan horas extra
* THEN el monto es 0 (fail-closed), no cae a defaults silenciosamente.

#### Scenario: Guardar la config requiere permiso de nómina

* GIVEN un usuario con rol dependiente (sin `rrhh.nomina.configurar`)
* WHEN intenta ejecutar `upsertNominaConfigAction`
* THEN falla con `FORBIDDEN`; un manager del tenant la guarda con `updatedBy`
  registrado.

### Requirement: Empleado.userId único y validado

`Empleado` MUST ganar `userId String? @unique` (relación User,
`onDelete: SetNull`), `ci String?`, `email String?`, `banco String?`. La
vinculación (`updateEmpleadoAction`) MUST validar que el `User` existe,
pertenece al tenant (membership) y no está vinculado a otro empleado
(`EMPLEADO_USER_TOMADO`). `userId: null` MUST desvincular sin validaciones
adicionales.

#### Scenario: Vincular usuario a empleado

* GIVEN un `User` del tenant sin empleado vinculado
* WHEN se asigna a un `Empleado`
* THEN `Empleado.userId` queda seteado y el usuario aparece en la ficha.

#### Scenario: Usuario ya vinculado rechazado

* GIVEN un `User` ya vinculado a otro `Empleado`
* WHEN se intenta asignar a un segundo empleado
* THEN falla con `EMPLEADO_USER_TOMADO` sin mutar registros.

#### Scenario: Usuario ajeno al tenant rechazado

* GIVEN un `User` sin membership en el tenant
* WHEN se intenta vincular a un `Empleado` del tenant
* THEN falla con `NOT_FOUND` sin mutar registros.
