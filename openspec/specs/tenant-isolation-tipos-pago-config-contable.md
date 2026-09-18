# Spec: Tenant Isolation — Configuración Contable

## Change

`tenant-isolation-tipos-pago-config-contable`

## Schema Changes

### Prisma: Modelo TipoPago

Se AGREGAN los siguientes campos al modelo `TipoPago`:

```prisma
model TipoPago {
  tipoId                   String                   @id @default(cuid())
  tenantId                 String                   // NUEVO
  nombre                   String
  descripcion              String?
  requiereCuenta           Boolean                  @default(true)
  cuentaDefecto            String?
  isActive                 Boolean                  @default(true)
  createdAt                DateTime                 @default(now())
  updatedAt                DateTime                 @updatedAt
  tenant                   Tenant                   @relation(fields: [tenantId], references: [tenantId]) // NUEVO
  reconciliacionesGasto    ReconciliacionGasto[]
  reconciliacionesServicio ReconciliacionServicio[]
  reconciliacionesVenta    ReconciliacionVenta[]

  @@index([tenantId]) // NUEVO
}
```

This is a non-nullable, required field. A `@@index([tenantId])` MUST be added.

### Migración de datos

Los TipoPago existentes NO tienen tenantId. La migración debe:

1. Hacer `tenantId` opcional inicialmente (nullable) para permitir el backfill.
2. Poblar `tenantId` mediante una estrategia que resuelva el tenant de cada `TipoPago` según sus reconciliaciones existentes o según cuentas bancarias de referencia (ver diseño para la estrategia exacta).
3. Hacer `tenantId` requerido (non-nullable) y agregar la FK e índice.

### Scenarios

#### Scenario 1: Listar tipos de pago (GWT)

```
Given un usuario autenticado del Tenant "A"
  And existen TipoPago en Tenant "A" y en Tenant "B"
When ejecuta getTiposPagoAction()
Then SOLO debe retornar los TipoPago del Tenant "A"
  And NO debe incluir ningún TipoPago del Tenant "B"
```

#### Scenario 2: Obtener tipo de pago individual (GWT)

```
Given un usuario autenticado del Tenant "A"
  And existe un TipoPago con ID "tp-1" perteneciente al Tenant "B"
When ejecuta getTipoPagoAction("tp-1")
Then debe lanzar ActionError con código 'PAYMENT_TYPE_NOT_FOUND'
  And NO debe revelar la existencia del registro
```

#### Scenario 3: Crear tipo de pago con tenant asignado

```
Given un usuario autenticado del Tenant "A"
When ejecuta createTipoPagoAction({ nombre: "Efectivo", requiereCuenta: false })
Then el TipoPago creado debe tener tenantId = "A"
  And el campo tenantId debe persistirse en la base de datos
```

#### Scenario 4: Validar nombre duplicado dentro del tenant

```
Given un usuario autenticado del Tenant "A"
  And existe un TipoPago con nombre "Efectivo" en Tenant "A"
  AND existe un TipoPago con nombre "Efectivo" en Tenant "B"
When ejecuta createTipoPagoAction({ nombre: "Efectivo" })
Then debe lanzar ActionError con código 'PAYMENT_TYPE_NAME_EXISTS'
  AND el TipoPago del Tenant "B" NO debe interferir con esta validación
```

#### Scenario 5: Validar nombre duplicado NO debe match entre tenants

```
Given un usuario autenticado del Tenant "A"
  And existe un TipoPago con nombre "Efectivo" en Tenant "B" (SOLO en B)
When ejecuta createTipoPagoAction({ nombre: "Efectivo" })
Then la creación debe ser EXITOSA
  AND el nuevo TipoPago debe pertenecer al Tenant "A"
```

#### Scenario 6: Actualizar tipo de pago con validación de tenant

```
Given un usuario autenticado del Tenant "A"
  And existe un TipoPago "tp-1" en Tenant "A"
When ejecuta updateTipoPagoAction({ id: "tp-1", nombre: "Efectivo Actualizado" })
Then el TipoPago debe actualizarse correctamente
```

#### Scenario 7: Actualizar tipo de pago de OTRO tenant debe fallar

```
Given un usuario autenticado del Tenant "A"
  And existe un TipoPago "tp-2" en Tenant "B"
When ejecuta updateTipoPagoAction({ id: "tp-2", nombre: "Hackeado" })
Then debe lanzar ActionError con código 'PAYMENT_TYPE_NOT_FOUND'
  AND el TipoPago "tp-2" NO debe modificarse
```

#### Scenario 8: Eliminar tipo de pago con validación de tenant

```
Given un usuario autenticado del Tenant "A"
  And existe un TipoPago "tp-1" en Tenant "A" sin reconciliaciones
When ejecuta deleteTipoPagoAction("tp-1")
Then el TipoPago debe eliminarse correctamente
```

#### Scenario 9: Eliminar tipo de pago de OTRO tenant debe fallar

```
Given un usuario autenticado del Tenant "A"
  And existe un TipoPago "tp-2" en Tenant "B"
When ejecuta deleteTipoPagoAction("tp-2")
Then debe lanzar ActionError con código 'PAYMENT_TYPE_NOT_FOUND'
  AND el TipoPago "tp-2" NO debe eliminarse
```

#### Scenario 10: Cuenta predeterminada validada contra el tenant

```
Given un usuario autenticado del Tenant "A"
  And existe CuentaBancaria "cb-1" en Tenant "A" (activa)
  And existe CuentaBancaria "cb-2" en Tenant "B" (activa)
When ejecuta createTipoPagoAction({ 
  nombre: "Transferencia", 
  requiereCuenta: true, 
  cuentaDefecto: "cb-1" 
})
Then la creación debe ser EXITOSA
```

#### Scenario 11: Cuenta predeterminada de OTRO tenant debe fallar

```
Given un usuario autenticado del Tenant "A"
  And existe CuentaBancaria "cb-2" en Tenant "B" (activa)
When ejecuta createTipoPagoAction({ 
  nombre: "Transferencia", 
  requiereCuenta: true, 
  cuentaDefecto: "cb-2" 
})
Then debe lanzar ActionError con código 'DEFAULT_ACCOUNT_NOT_FOUND'
```

#### Scenario 12: getAvailableAccounts filtra por tenant

```
Given un usuario autenticado del Tenant "A"
  And existen CuentaBancaria en Tenant "A" y en Tenant "B"
When se invoca AccountingConfigReadService.getAvailableAccounts()
Then SOLO debe retornar cuentas del Tenant "A"
  AND las estadísticas (totalCuentas, cuentasPorMoneda, cuentasPorTipo) deben reflejar SOLO el Tenant "A"
```

#### Scenario 13: Mobile endpoint payment-types retorna solo datos del tenant

```
Given una request autenticada con tenantId = "A"
When GET /api/mobile/v1/accounting/payment-types
Then la respuesta debe contener solo TipoPago del Tenant "A"
```

#### Scenario 14: Mobile endpoint available-accounts retorna solo cuentas del tenant

```
Given una request autenticada con tenantId = "A"
When GET /api/mobile/v1/accounting/payment-types/available-accounts
Then la respuesta debe contener solo CuentaBancaria del Tenant "A"
  AND estadísticas deben reflejar solo Tenant "A"
```

#### Scenario 15: Reconciliaciones existentes funcionan sin cambios

```
Given existe ReconciliacionVenta que referencia TipoPago "tp-1" en Tenant "A"
When la reconciliación se consulta o procesa
Then funciona correctamente (solo se agregó tenantId al TipoPago)
```

#### Scenario 16: Backfill de TipoPago existentes

```
Given existen TipoPago sin tenantId en la base de datos
When se ejecuta la migración con backfill
Then todo TipoPago debe tener tenantId poblado
  AND ningún TipoPago debe quedar con tenantId NULL
```

## Validation Rules

- `scopedWhere(tenantId)` MUST usarse en cada query de lectura/escritura sobre `TipoPago`.
- `assertTenantAccess()` MUST usarse en recursos existentes (update/delete).
- El schema del DTO de crear/actualizar NO cambia (sigue recibiendo los mismos campos del form). El `tenantId` se asigna desde `requireTenant(user)`.
- `getAvailableAccounts()` en `AccountingConfigReadService` MUST aceptar `tenantId` como parámetro requerido.

## Constraints

- No se cambian las props del frontend (formularios, hooks, componentes de UI).
- Los tests deben pasar SIN necesidad de DB real (mocks de Prisma).
- La migración debe funcionar tanto para entornos vacíos como para producción con datos reales.
