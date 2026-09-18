# Design: Tenant Isolation — Configuración Contable

## Change

`tenant-isolation-tipos-pago-config-contable`

## Strategy

El aislamiento sigue el mismo patrón ya establecido en `CuentaBancaria`:
- `tenantId` como campo obligatorio en el modelo Prisma
- `requireTenant(user)` al inicio de cada Server Action
- `scopedWhere(tenantId, ...)` para queries de listado/lectura
- `assertTenantAccess()` para verificar que recursos existentes pertenecen al tenant antes de modificar/eliminar
- Pasar `tenantId` como parámetro al ReadService

## Architecture

### 1. Schema (Prisma Migration)

```prisma
model TipoPago {
  tipoId                   String                   @id @default(cuid())
  tenantId                 String
  // ... resto igual ...
  tenant                   Tenant                   @relation(fields: [tenantId], references: [tenantId])
  // ... relaciones existentes ...

  @@index([tenantId])
}
```

### 2. Estrategia de Backfill

Los `TipoPago` existentes no tienen `tenantId`. Para poblarlos:

**Primera opción (preferida):** Si hay pocos registros globales (típico en configuración contable), buscar el tenant a través de las reconciliaciones existentes:

```sql
-- Para cada TipoPago sin tenantId:
-- 1. Buscar reconciliaciones que lo referencian
-- 2. Obtener el tenantId de esas reconciliaciones
-- 3. Si hay múltiples tenants (caso borde), usar el más frecuente
-- 4. Si no hay reconciliaciones, asignar al primer tenant encontrado (tabla Tenant)
```

Implementación en `prisma/seed/backfill-tipos-pago-tenant.ts` como script one-shot ejecutable con `tsx`.

**Alternativa (si pocos registros):** Asignar todos los TipoPago existentes a los tenants que tengan al menos una `ReconciliacionVenta`, `ReconciliacionServicio` o `ReconciliacionGasto`. Si un TipoPago queda huérfano, se le asigna a un tenant por defecto (el primer tenant de la tabla).

### 3. Server Actions (`actions-tipos-pago.ts`)

Cada action debe:

```typescript
// Patrón para cada Server Action:
const tenantId = requireTenant(user);

// Listar: agregar tenantId al where
const tipos = await prisma.tipoPago.findMany({
  where: { 
    ...filters,
    tenantId  // ← NUEVO
  },
  ...
});

// Leer individual: validar con scopedWhere
const tipo = await prisma.tipoPago.findFirst({
  where: { tipoId: id, tenantId }, // ← findFirst con tenantId
  ...
});
if (!tipo) throw new ActionError('Tipo de pago no encontrado', 'PAYMENT_TYPE_NOT_FOUND');

// Crear: asignar tenantId desde el usuario
await prisma.tipoPago.create({
  data: { ...parsed, tenantId },
  ...
});

// Actualizar: assertTenantAccess + update con where que incluya tenantId
const existing = await prisma.tipoPago.findFirst({ where: { tipoId: id, tenantId } });
if (!existing) throw new ActionError('Tipo de pago no encontrado', 'PAYMENT_TYPE_NOT_FOUND');

// Eliminar: mismo patrón
const existing = await prisma.tipoPago.findFirst({ where: { tipoId: id, tenantId } });
if (!existing) throw new ActionError('Tipo de pago no encontrado', 'PAYMENT_TYPE_NOT_FOUND');
```

**Validación de nombre duplicado:** El `findFirst` para verificar duplicado de nombre debe incluir `tenantId`:

```typescript
const dup = await prisma.tipoPago.findFirst({ 
  where: { 
    nombre: { equals: parsed.nombre }, 
    tenantId  // ← NUEVO: solo verifica dentro del tenant
  } 
});
```

**Validación de cuenta predeterminada:** La búsqueda de `cuentaBancaria` debe verificar que pertenece al tenant:

```typescript
if (parsed.cuentaDefecto) {
  const cuenta = await prisma.cuentaBancaria.findFirst({ 
    where: { cuentaId: parsed.cuentaDefecto, tenantId } // ← NUEVO: filtro por tenant
  });
  if (!cuenta) throw new ActionError('La cuenta por defecto especificada no existe', 'DEFAULT_ACCOUNT_NOT_FOUND');
  if (!cuenta.isActive) throw new ActionError('...', 'DEFAULT_ACCOUNT_INACTIVE');
}
```

### 4. Read Service (`accounting-config-read-service.ts`)

`getPaymentTypes()` debe recibir `tenantId` como parámetro requerido:

```typescript
async getPaymentTypes(tenantId: string, filters: PaymentTypeFilters = {}) {
  const where: Record<string, unknown> = { tenantId }; // ← NUEVO
  // ...filtros adicionales...
}
```

`getAvailableAccounts()` debe recibir `tenantId` como parámetro requerido:

```typescript
async getAvailableAccounts(tenantId: string, filters: AvailableAccountsFilters = {}) {
  const where: Record<string, unknown> = { isActive: true, tenantId }; // ← NUEVO
  // ...misma lógica...
}
```

Las estadísticas (groupBy) deben incluir `where: { isActive: true, tenantId }`.

### 5. Enrichment de cuentaDefecto

El `enrichPaymentTypes()` que busca la cuenta bancaria de cuentaDefecto debe verificar que exista en el mismo tenant. Actualmente busca por `cuentaId` global. Se debe agregar el `tenantId` como filtro adicional.

Sin embargo, como `CuentaBancaria` ya tiene `tenantId`, agregar el filtro es redundante desde la perspectiva de Prisma (findUnique solo por cuentaId siempre retorna una sola cuenta). Pero para mantener el principio de aislamiento explícito, se cambia `findUnique` por `findFirst` con `cuentaId AND tenantId`.

### 6. Endpoints Mobile API

Ambos endpoints (`payment-types/route.ts` y `available-accounts/route.ts`) deben extraer el `tenantId` del usuario autenticado y pasarlo al servicio:

```typescript
const { user } = authResult; // authenticateUser ya retorna user con tenantId
const result = await AccountingConfigReadService.getPaymentTypes(user.tenantId, { ... });
```

### 7. Mobile endpoint: extraer tenantId

`authenticateUser()` retorna `{ user: AuthenticatedUser }` donde `user.tenantId` ya está disponible. Se debe extraer del authResult y pasar al service.

## Data Flow

```
[Formulario/Browser] → Server Action → requireTenant(user) → tenantId
  → scopedWhere(tenantId, filters) → Prisma query → Response filtrada

[Mobile App] → HTTP GET → Route Handler → authenticateUser() → user.tenantId
  → AccountingConfigReadService.getPaymentTypes(tenantId, filters)
  → scopedWhere(tenantId, filters) → Prisma query → Response JSON
```

## Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Server Actions                         │
│  ┌──────────────┐  ┌───────────────────────────────┐    │
│  │ requireTenant│  │ scopedWhere / assertTenantAccess│   │
│  └──────┬───────┘  └──────────────┬────────────────┘    │
│         │                         │                       │
│  ┌──────▼─────────────────────────▼────────────────┐    │
│  │              Prisma queries                      │    │
│  │  tipoPago.findMany({ where: { tenantId, ... } }) │    │
│  │  cuentaBancaria.findFirst({ where: { tenantId }})│    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               Read Service                              │
│  getPaymentTypes(tenantId, filters)                      │
│  getAvailableAccounts(tenantId, filters)                  │
│    → todas las queries incluyen tenantId                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               Mobile API Routes                          │
│  GET /payment-types        → pasa tenantId del user      │
│  GET /available-accounts   → pasa tenantId del user      │
└─────────────────────────────────────────────────────────┘
```

## Migration Script

Se crea `prisma/seed/backfill-tipos-pago-tenant.ts` que:

1. Busca TipoPago con tenantId NULL
2. Para cada uno:
   a. Busca reconciliaciones que lo referencian → extrae tenantId
   b. Si encuentra tenants, usa el más frecuente
   c. Si no hay reconciliaciones, usa el primer tenant de la tabla Tenant
3. Actualiza el registro con el tenantId resuelto
4. Si todos los registros tienen tenantId, muestra mensaje de éxito

El script se ejecuta manualmente entre dos migraciones:
- Migración 1: `ALTER TABLE TipoPago ADD COLUMN tenantId TEXT`, hacerlo nullable, agregar índice y FK
- Ejecutar script de backfill
- Migración 2: Hacer tenantId NOT NULL
