# Planes de Suscripción — FinanceMDM

## Resumen

Definición de los planes **Básico**, **Profesional** y **Empresarial**. Los flags de cada plan se persisten en el campo JSON `Plan.features` y se propagan a cada tenant vía `TenantLicense.features` para hacer gating real en backend (`requireFeature`) y en UI (`SIDEBAR_FEATURE_MAP`).

**Fuente única de verdad**: el catálogo de features vive en `src/features/planes/feature-registry.ts` (51 features en 9 categorías). Cualquier feature nuevo debe agregarse ahí primero y recién después asignarse a un plan. El seed (`prisma/seed/plans-seed.ts`) y el panel admin (`/admin/planes`) leen de ese registro.

**Moneda**: los precios se manejan en **USD**. La conversión a CUP se hace en el frontend de la landing según la tasa vigente.

---

## Plan Básico — Arranque del Negocio

Para negocios que están empezando y necesitan la base operativa completa: productos, almacenes, POS, compras a proveedores, gastos y contabilidad básica en CUP.

### Límites

| Recurso | Límite |
|---------|--------|
| Usuarios | 3 |
| Almacenes | 2 |
| Puntos de Venta | 2 |
| Productos | 500 |
| Clientes | Ilimitado |
| Facturas/mes | Ilimitado |
| Contratos | No |
| Backups | Semanal |

### Feature Flags (`Plan.features`)

```json
{
  "productos": true,
  "productos-stock-masivo": false,
  "restock": true,
  "categorias": true,
  "categorias-ean13": false,
  "unidades": true,
  "listas-precios": false,
  "almacenes": true,
  "puntos-venta": true,
  "transferencias": true,
  "mermas": true,
  "ventas-pos": true,
  "ventas-factura": false,
  "turnos-pos": true,
  "arqueo-caja": true,
  "cuadre-diario": false,
  "ofertas": false,
  "clientes": false,
  "facturacion": false,
  "series-facturacion": false,
  "proveedores": true,
  "compras": true,
  "servicios": true,
  "gastos": true,
  "contabilidad": true,
  "multi-moneda": false,
  "rentabilidad-compra": true,
  "reportes-financieros": false,
  "cuentas-cobrar": false,
  "cuentas-pagar": false,
  "prestamos-cash": false,
  "deudas-cash": false,
  "anticipos": false,
  "analisis-estado-cuenta": false,
  "facturas-vencidas": false,
  "produccion": false,
  "reparaciones": false,
  "empleados": true,
  "vacaciones": false,
  "asistencia": false,
  "nomina": false,
  "multitenantmembership": false,
  "mi-empresa": true,
  "mi-empresa-ean13": false,
  "contratos": false,
  "gestion-usuarios": true,
  "notificaciones": false,
  "configuracion": true,
  "dashboard": true,
  "backups-semanal": true,
  "backups-diario": false,
  "backups-tiempo-real": false,
  "api-integraciones": false
}
```

### Features incluidas

#### Inventario y Productos
- CRUD completo de productos con fotos y código interno
- Categorías jerárquicas
- Unidades de medida (kg, unidad, L, etc.)
- Sugerencias de restock automático
- **Hasta 2 almacenes**
- **Transferencias** entre almacenes y PdV
- **Mermas**: registro de pérdidas y ajustes de stock
- Reporte de rentabilidad por compra (calculado al recibir mercadería)

#### Ventas y POS
- Ventas POS con múltiples métodos de pago (efectivo, tarjeta, transferencia, mixto)
- **Apertura y cierre de turnos POS** con arqueo automático al cierre
- (Sin cuadre diario, sin ofertas en este plan)

#### Compras y Proveedores
- Compras de productos con actualización de stock
- Compras de servicios
- Gestión de proveedores
- Gastos asociados a compras

#### Gastos y Contabilidad (Básica)
- Registro de gastos operativos
- Contabilidad en una sola moneda (CUP)
- Dashboard con KPIs principales

#### Recursos Humanos (Básico)
- CRUD de **empleados** con datos personales, cargo y salario base
- (Vacaciones, asistencia y nómina requieren el plan Empresarial)

#### Empresa y Configuración
- Datos de la empresa (Mi Empresa)
- Gestión de usuarios del negocio
- Configuración general
- Dashboard ejecutivo
- Backups semanales automáticos

---

## Plan Profesional — PYME en Crecimiento

Para negocios que necesitan facturación, multi-moneda, clientes, empleados y herramientas de control diario. Hereda todo lo del Básico y suma automatización.

### Límites

| Recurso | Límite |
|---------|--------|
| Usuarios | 5 |
| Almacenes | 5 |
| Puntos de Venta | 5 |
| Productos | 5.000 |
| Clientes | Ilimitado |
| Facturas/mes | Ilimitado |
| Contratos | 50 |
| Backups | Diario |

### Features añadidas vs Básico

```jsonc
{
  // …todo lo del Básico, más:
  "listas-precios": true,
  "cuadre-diario": true,
  "ofertas": true,
  "clientes": true,
  "facturacion": true,
  "series-facturacion": true,
  "multi-moneda": true,
  "reportes-financieros": true,
  "empleados": true,
  "notificaciones": true,
  "ventas-factura": true,
  "backups-semanal": false,
  "backups-diario": true
}
```

### Capacidades diferenciales

#### Ventas y Facturación
- **Turnos POS** con apertura/cierre y arqueo automático
- **Cuadre diario** consolidado de ventas
- **Ofertas y promociones** por producto
- **Clientes** con historial de compras
- **Facturación electrónica** con series fiscales configurables
- **Ventas con factura / crédito** automáticas
- **Multi-moneda** (CUP + USD) con tasas de cambio y conversión automática

#### Control Operativo
- **Listas de precios** múltiples con asignación por cliente

#### Reportes
- **Reportes financieros avanzados** exportables
- Notificaciones automáticas del sistema

#### Recursos Humanos (Básico, igual al Plan Básico)
- CRUD de **empleados** con datos personales, cargo y salario base
- (Vacaciones, asistencia y nómina requieren el plan Empresarial)

#### Backups
- **Backups diarios** automáticos con retención configurable

---

## Plan Empresarial — Máxima Potencia

Para negocios consolidados con producción, manufactura, cuentas por cobrar/pagar, nómina y operaciones críticas que requieren point-in-time recovery.

### Límites

| Recurso | Límite |
|---------|--------|
| Usuarios | 10 |
| Almacenes | Ilimitado (999) |
| Puntos de Venta | Ilimitado (999) |
| Productos | Ilimitado (999.999) |
| Clientes | Ilimitado |
| Facturas/mes | Ilimitado |
| Contratos | Ilimitado (999) |
| Backups | Cada hora + restauración point-in-time |

### Features añadidas vs Profesional

```jsonc
{
  // …todo lo del Profesional, más:
  "productos-stock-masivo": true,
  "categorias-ean13": true,
  "produccion": true,
  "nomina": true,
  "vacaciones": true,
  "asistencia": true,
  "mi-empresa-ean13": true,
  "contratos": true,
  "cuentas-cobrar": true,
  "cuentas-pagar": true,
  "prestamos-cash": true,
  "deudas-cash": true,
  "anticipos": true,
  "analisis-estado-cuenta": true,
  "facturas-vencidas": true,
  "multitenantmembership": true,
  "backups-diario": false,
  "backups-tiempo-real": true
}
```

### Capacidades diferenciales

#### Inventario Avanzado
- **Stock mínimo masivo**: actualizar el mínimo de stock de toda una lista en una sola operación
- **Prefijos y configuración EAN-13** por categoría
- **Generación de EAN-13** desde Mi Empresa

#### Producción (Manufactura)
- Recetas de producción (BOM) con ingredientes y unidades
- Órdenes de producción con seguimiento de estados
- Vales de salida de materiales desde almacén
- Cálculo de cantidades requeridas y validación de stock
- Conversión de unidades en producción

#### RRHH Completo
- **Empleados** (igual que Básico/Profesional)
- **Vacaciones**: solicitudes, acumulación automática y aprobación
- **Asistencia**: checkin/checkout con horarios semanales
- **Nómina**: pago de salarios, comisiones y liquidación

#### Cuentas por Cobrar / Pagar
- **Cuentas por Cobrar** con seguimiento de deudas de clientes
- **Cuentas por Pagar** a proveedores
- **Préstamos cash** otorgados a clientes (con interés, cuotas, estado)
- **Deudas cash** con proveedores
- **Anticipos** de pago y cobro
- **Análisis de Estado de Cuenta** con antigüedad de saldos
- **Reporte de Facturas Vencidas** por antigüedad de deuda

#### Contratos
- Versionado de contratos
- Firmas digitales y aprobación multi-nivel
- Archivos adjuntos y alertas de vencimiento
- Tipos de contrato personalizables

#### Backups de Alta Disponibilidad
- **Backups cada hora** con **restauración point-in-time**

#### Membresía Multi-Tenant
- **Un mismo usuario puede pertenecer y trabajar en varias empresas simultáneamente** (gateado por `multitenantmembership` en `admin/actions.ts:955`)

#### Features NO incluidas (en ningún plan)
- `reparaciones` — Taller de reparaciones con seguimiento de equipos
- `api-integraciones` — Endpoints públicos para integraciones externas

---

## Resumen Comparativo

| Feature | Básico | Profesional | Empresarial |
|---------|:-:|:-:|:-:|
| **Precio mensual (USD)** | $30 | $70 | $100 |
| **Usuarios** | 3 | 5 | 10 |
| **Almacenes** | 2 | 5 | Ilimitado |
| **Puntos de Venta** | 2 | 5 | Ilimitado |
| **Productos** | 500 | 5.000 | Ilimitado |
| **Clientes** | Ilimitado | Ilimitado | Ilimitado |
| **Contratos** | ❌ | 50 | Ilimitado |
| **Productos con código** | ✅ | ✅ | ✅ |
| **Stock mínimo masivo** | ❌ | ❌ | ✅ |
| **Categorías + EAN-13 config** | ❌ | ❌ | ✅ |
| **Restock sugerido** | ✅ | ✅ | ✅ |
| **Almacenes** | ✅ | ✅ | ✅ |
| **Transferencias** | ✅ | ✅ | ✅ |
| **Mermas** | ✅ | ✅ | ✅ |
| **Listas de precios** | ❌ | ✅ | ✅ |
| **POS / Ventas** | ✅ | ✅ | ✅ |
| **Ventas con factura** | ❌ | ✅ | ✅ |
| **Turnos POS** | ✅ | ✅ | ✅ |
| **Arqueo de caja** | ✅ | ✅ | ✅ |
| **Cuadre diario** | ❌ | ✅ | ✅ |
| **Ofertas / Promociones** | ❌ | ✅ | ✅ |
| **Clientes** | ❌ | ✅ | ✅ |
| **Facturación electrónica** | ❌ | ✅ | ✅ |
| **Series fiscales** | ❌ | ✅ | ✅ |
| **Proveedores** | ✅ | ✅ | ✅ |
| **Compras** | ✅ | ✅ | ✅ |
| **Servicios** | ✅ | ✅ | ✅ |
| **Gastos** | ✅ | ✅ | ✅ |
| **Contabilidad** | ✅ | ✅ | ✅ |
| **Multi-moneda (USD)** | ❌ | ✅ | ✅ |
| **Rentabilidad por compra** | ✅ | ✅ | ✅ |
| **Reportes financieros** | ❌ | ✅ | ✅ |
| **Cuentas por Cobrar** | ❌ | ❌ | ✅ |
| **Cuentas por Pagar** | ❌ | ❌ | ✅ |
| **Préstamos cash** | ❌ | ❌ | ✅ |
| **Deudas cash** | ❌ | ❌ | ✅ |
| **Anticipos** | ❌ | ❌ | ✅ |
| **Análisis Estado de Cuenta** | ❌ | ❌ | ✅ |
| **Facturas Vencidas** | ❌ | ❌ | ✅ |
| **Producción** | ❌ | ❌ | ✅ |
| **Empleados** | ✅ | ✅ | ✅ |
| **Vacaciones** | ❌ | ❌ | ✅ |
| **Asistencia** | ❌ | ❌ | ✅ |
| **Nómina** | ❌ | ❌ | ✅ |
| **Contratos** | ❌ | ❌ | ✅ |
| **Membresía multi-tenant** | ❌ | ❌ | ✅ |
| **Generación EAN-13** | ❌ | ❌ | ✅ |
| **Mi Empresa** | ✅ | ✅ | ✅ |
| **Gestión de usuarios** | ✅ | ✅ | ✅ |
| **Notificaciones** | ❌ | ✅ | ✅ |
| **Configuración** | ✅ | ✅ | ✅ |
| **Dashboard** | ✅ | ✅ | ✅ |
| **Backups semanales** | ✅ | ❌ | ❌ |
| **Backups diarios** | ❌ | ✅ | ❌ |
| **Backups cada hora + PIT** | ❌ | ❌ | ✅ |
| **API e integraciones** | ❌ | ❌ | ❌ |
| **Taller de reparaciones** | ❌ | ❌ | ❌ |

---

## Pricing

| Plan | Precio mensual (USD) |
|------|----------------------|
| Básico | $30 |
| Profesional | $70 |
| Empresarial | $100 |

> El cobro es mensual. La conversión a CUP se muestra en la landing según la tasa vigente del mercado. El `duracionDias` del plan es 30.

---

## Implementación Técnica

### 1. Modelo Prisma (`prisma/schema.prisma`)

El modelo `Plan` ya tiene todos los campos necesarios:

```prisma
model Plan {
  planId         String   @id @default(cuid())
  nombre         String
  descripcion    String?
  precio         Decimal  @default(0)        // USD
  duracionDias   Int                          // 30
  maxUsuarios    Int      @default(1)
  maxAlmacenes   Int      @default(1)
  maxProductos   Int      @default(100)
  maxClientes    Int      @default(200)      // 0 = ilimitado
  maxPuntosVenta Int      @default(1)
  maxFacturasMes Int      @default(200)      // 0 = ilimitado
  maxContratos   Int      @default(0)        // 0 = no habilitado
  incluyeBackups Boolean  @default(false)
  features       Json     @default("{}")     // Feature flags por plan
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  licencias      Licencia[]
  tenantLicenses TenantLicense[]
}
```

El modelo `TenantLicense` (multi-tenant) replica los flags por tenant para poder customizarlos sin tocar el `Plan` base:

```prisma
model TenantLicense {
  tenantLicenseId String   @id @default(cuid())
  tenantId        String
  planId          String?
  activa          Boolean  @default(true)
  inicio          DateTime @default(now())
  expiracion      DateTime
  maxUsuarios     Int      @default(1)
  maxAlmacenes    Int      @default(1)
  maxProductos    Int      @default(100)
  features        Json?    // Override por tenant
  plan            Plan?    @relation(fields: [planId], references: [planId])
  tenant          Tenant   @relation(fields: [tenantId], references: [tenantId], onDelete: Cascade)
}
```

### 2. Feature Registry (`src/features/planes/feature-registry.ts`)

Catálogo central con 51 features organizadas en 9 categorías (`inventario`, `operaciones`, `ventas`, `compras`, `financiero`, `produccion`, `rrhh`, `config`, `infra`). Es la fuente de verdad: cualquier feature nuevo debe declararse acá antes de poder asignarse a un plan.

```typescript
export const FEATURE_REGISTRY: FeatureDef[] = [
  { key: "productos",            label: "Productos",          category: "inventario" },
  { key: "listas-precios",       label: "Listas de precios",  category: "inventario" },
  { key: "ventas-pos",           label: "Ventas POS",         category: "ventas"     },
  { key: "contabilidad",         label: "Contabilidad",       category: "financiero" },
  // ... 47 más
];
```

Helpers exportados:
- `getFeatureByKey(key)` — buscar un feature por su clave.
- `getFeaturesGrouped()` — agrupar por categoría para la UI admin.
- `getEnabledFeatures(features)` — filtrar los que están `true` en un objeto de flags.
- `getEnabledFeatureLabels(features)` — solo los labels habilitados (usado en landing y reseñas).

### 3. Gating en Server Actions y API Routes

`requireFeature()` en `src/lib/services/tenant-scope.ts:34` se llama al inicio de cada acción que necesita un feature pago. Los usuarios con rol `admin` global la bypasean; el resto debe tener `planFeatures[featureKey] === true`.

```typescript
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';

export const createCompraAction = withAction(async (input, user) => {
  const tenantId = requireTenant(user);
  await requireFeature(user, 'compras', 'crear compras');
  // ... resto del código
});
```

`requireFeature` lanza `ActionError` con código `FEATURE_NOT_AVAILABLE` cuando el plan no incluye el feature. El wrapper `withAction` lo serializa para el cliente, donde se muestra un toast pidiendo actualizar el plan.

### 4. Gating en UI (`src/components/app-sidebar2.tsx`)

El sidebar oculta items según el plan del usuario:

```typescript
const SIDEBAR_FEATURE_MAP: Record<string, string> = {
  "Listas de Precios":      "listas-precios",
  "Gestión de Facturas":    "facturacion",
  "Gestión de Empleados":   "empleados",
  "Nómina":                 "nomina",
  "Producción":             "produccion",
  "Clientes":               "clientes",
  "Cuentas por Cobrar":     "cuentas-cobrar",
  "Cuentas por Pagar":      "cuentas-pagar",
  "Anticipos":              "anticipos",
  "Préstamos en Efectivo":  "prestamos-cash",
  "Deudas en Efectivo":     "deudas-cash",
  "Exchange":               "multi-moneda",
  "Cuadre Financiero":      "cuadre-diario",
  "Reportes":               "reportes-financieros",
  "Notificaciones":         "notificaciones",
  "Analisis Estado Cuenta": "analisis-estado-cuenta",
  "Facturas Vencidas":      "facturas-vencidas",
};
```

`canSeeSidebarItem(title)` consulta el mapa y oculta el item si `planFeatures[featureKey] === false`.

### 5. Carga de features en sesión

`getCurrentUser()` y `authenticateUser()` en `src/lib/auth-middleware.ts` leen `TenantLicense.features` y lo propagan al `AuthenticatedUser.planFeatures`, que termina disponible en cada Server Action y en el cliente vía sesión.

```typescript
// src/lib/auth-middleware.ts
let planFeatures: Record<string, boolean> | undefined;
if (license.features) {
  planFeatures = license.features as Record<string, boolean>;
}
```

### 6. Landing dinámica

La landing usa `PricingDynamic` (`src/features/reviews/components/pricing-dynamic.tsx`), que consulta los planes reales desde la BD vía `getPlanesActivosAction` y los renderiza con los features habilitados usando `getEnabledFeatureLabels`. Los precios en `data.ts` son fallback estático (no se usan cuando la BD responde).

### 7. Seed (`prisma/seed/plans-seed.ts`)

El seed crea los 3 planes con spread incremental (`PLAN_PROFESIONAL_FEATURES = { ...PLAN_BASICO_FEATURES, ... }`) para mantener la jerarquía de tiers. Es idempotente: si ya existen planes, no los duplica.

```typescript
export async function seedPlans() {
  const existing = await prisma.plan.count();
  if (existing > 0) {
    console.log(`Ya existen ${existing} planes. Se omite seed.`);
    return;
  }
  await prisma.plan.createMany({ data: [ /* Básico, Profesional, Empresarial */ ] });
}
```

Para ejecutarlo:

```bash
npx tsx prisma/seed/plans-seed.ts
```

### 8. Administración desde panel

`/admin/planes` (`src/app/admin/planes/page.tsx`) permite crear, editar y asignar features a planes sin tocar código. Usa `FEATURE_REGISTRY` para listar los features disponibles agrupados por categoría.

---

## Cómo agregar un feature nuevo

1. **Declarar en el registry** (`src/features/planes/feature-registry.ts`): agregar `{ key, label, description, category }`.
2. **Asignar a planes** en el panel admin (`/admin/planes`) o actualizar el seed (`prisma/seed/plans-seed.ts`).
3. **Proteger el código** con `requireFeature(user, 'feature-key', 'descripción')` en cada Server Action / API route que lo use.
4. **Gating en UI** (si corresponde): agregar entrada en `SIDEBAR_FEATURE_MAP` (`src/components/app-sidebar2.tsx:530`).
5. **Tests**: extender `src/lib/services/__tests__/tenant-scope.test.ts` con casos para el nuevo flag.

## Cómo agregar un plan nuevo

1. **Definir features** (heredar del tier anterior con spread + agregar nuevos).
2. **Seed**: agregar entrada en `prisma/seed/plans-seed.ts` con nombre, precio, límites y features.
3. **Panel admin**: el plan aparece automáticamente en `/admin/planes`.
4. **PricingDynamic**: no requiere cambios — consume directo de la BD.
