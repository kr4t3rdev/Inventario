# Planes de Suscripción — FinanceMDM

## Resumen

Definición de los planes **Básico** y **Profesional** mapeando cada feature del sistema a su tier correspondiente. Estos planes reemplazan los datos estáticos del landing page y se conectan al modelo `Plan` + `TenantLicense.features` (JSON) para gating real en backend y UI.

---

## Plan Básico — Operaciones Esenciales

Para negocios pequeños que necesitan control operativo básico.

### Límites

| Recurso | Límite |
|---------|--------|
| Usuarios | 2 |
| Almacenes | 1 |
| Puntos de Venta | 1 |
| Productos | 100 |
| Clientes | 200 |
| Facturas/mes | 200 |
| Backups | No |

### Feature Flags (`TenantLicense.features`)

```json
{
  "productos": true,
  "categorias": true,
  "unidades": true,
  "almacenes": true,
  "ventas": true,
  "venta-servicios": true,
  "clientes": true,
  "facturas": true,
  "series-facturacion": true,
  "gastos": true,
  "dashboard": true,
  "reportes-basicos": true,
  "puntos-venta": true,
  "turnos-pos": true,
  "arqueo-caja": true,
  "cuadre-diario": true,
  "perfil": true,
  "mi-empresa": true,
  "configuracion": true,
  "servicios": true,
  "notificaciones": true,
  "ofertas": true,
  "contabilidad": false,
  "empleados": false,
  "pago-salario": false,
  "compras": false,
  "vendors": false,
  "mermas": false,
  "transferencias": false,
  "produccion": false,
  "reparaciones": false,
  "contratos": false,
  "listas-precios": false,
  "reportes-financieros": false,
  "backups": false,
  "cuentas-cobrar": false,
  "cuentas-pagar": false,
  "prestamos-cash": false,
  "deudas-cash": false,
  "anticipos": false,
  "multi-moneda": false
}
```

### Features incluidas

#### Inventario y Productos
- CRUD completo de productos con fotos, códigos EAN13/internos
- Categorías jerárquicas con clasificador CLAS
- Unidades de medida
- Control de stock mínimo/máximo
- Historial de cambios de costo
- **1 almacén**

#### Ventas y Facturación
- POS (Punto de Venta) con múltiples métodos de pago (efectivo, tarjeta, transferencia, crédito, mixto)
- Ventas de servicios
- Facturación con series y numeración consecutiva
- Gestión de series de facturación
- Ofertas/presupuestos a clientes
- Gestión de clientes con historial de compras

#### Caja y Operaciones
- 1 Punto de Venta
- Turnos POS (apertura/cierre)
- Arqueo de caja con conteo de billetes y diferencias
- Cuadre diario de operaciones

#### Gastos
- Registro de gastos operativos
- Desglose por concepto y elemento de gasto

#### Reportes Básicos
- Dashboard principal con KPIs y gráficos
- Reportes operativos esenciales (venta diaria, inventario básico)

#### Empresa y Configuración
- Datos de la empresa (nombre, dirección, datos fiscales, logo)
- Perfil de usuario (cambio de contraseña, datos personales)
- Configuración general del sistema
- Notificaciones del sistema

---

## Plan Profesional — PYME en Crecimiento

Para negocios que requieren automatización, contabilidad, RRHH y control avanzado.

### Límites

| Recurso | Límite |
|---------|--------|
| Usuarios | 10 |
| Almacenes | 5 |
| Puntos de Venta | 5 |
| Productos | 5,000 |
| Clientes | Ilimitado |
| Facturas/mes | Ilimitado |
| Contratos | 50 |
| Backups | Diario automático |

### Feature Flags (`TenantLicense.features`)

```json
{
  "productos": true,
  "categorias": true,
  "unidades": true,
  "almacenes": true,
  "ventas": true,
  "venta-servicios": true,
  "clientes": true,
  "facturas": true,
  "series-facturacion": true,
  "gastos": true,
  "dashboard": true,
  "reportes-basicos": true,
  "puntos-venta": true,
  "turnos-pos": true,
  "arqueo-caja": true,
  "cuadre-diario": true,
  "perfil": true,
  "mi-empresa": true,
  "configuracion": true,
  "servicios": true,
  "notificaciones": true,
  "ofertas": true,
  "contabilidad": true,
  "empleados": true,
  "pago-salario": true,
  "compras": true,
  "vendors": true,
  "mermas": true,
  "transferencias": true,
  "produccion": true,
  "reparaciones": true,
  "contratos": true,
  "listas-precios": true,
  "reportes-financieros": true,
  "backups": true,
  "cuentas-cobrar": true,
  "cuentas-pagar": true,
  "prestamos-cash": true,
  "deudas-cash": true,
  "anticipos": true,
  "multi-moneda": true
}
```

### Todo lo del Plan Básico (con límites superiores)
- Mismos módulos que Básico, pero con límites de recursos 5x-50x mayores
- Múltiples almacenes (hasta 5)
- Múltiples puntos de venta (hasta 5)

### Contabilidad Completa
- Cuentas bancarias múltiples con historial de transacciones
- Períodos contables (apertura, cierre, reapertura, aprobación, bloqueo)
- Cierres contables
- **Reconciliación bancaria** de ventas, servicios y gastos
- **Multi-moneda**: CUP/USD con tasas de cambio, conversión automática
- Inyecciones de capital (aportes de socios)
- Ajustes bancarios manuales
- Transferencias entre cuentas bancarias

### Cuentas por Cobrar / Pagar
- Cuentas por Cobrar (clientes deudores)
- Cuentas por Pagar (deudas a proveedores)
- Pagos de cuentas por pagar
- Préstamos Cash a clientes (con interés, cuotas, estado)
- Deudas Cash con proveedores
- Anticipos de pago/cobro

### Recursos Humanos
- CRUD de empleados (datos personales, cargo, salario base)
- **Asistencia**: checkin/checkout con horarios semanales
- **Vacaciones**: solicitudes, acumulación automática, aprobación
- **Nómina**: pago de salarios, liquidación
- Programación de horarios por empleado

### Compras y Proveedores
- Compras de productos físicos con actualización de stock
- Compras de servicios
- Compras multi-item (documento de compra)
- Gestión de proveedores (Vendors) con vendor code
- Gastos asociados a compras

### Control de Inventario Avanzado
- **Transferencias** entre almacenes y PdV
- **Mermas**: registro de pérdidas (roturas, vencimientos), ajuste de stock
- **Listas de precios** múltiples con asignación por cliente
- Alertas de stock mínimo

### Producción (Manufactura)
- Recetas de producción (BOM) con ingredientes y cantidades
- Órdenes de producción con seguimiento de estados
- Vales de salida de materiales desde almacén
- Cálculo de cantidades requeridas
- Validación de disponibilidad de materiales
- Conversión de unidades en producción

### Taller de Reparaciones
- Órdenes de reparación con equipos y técnicos
- Catálogo de defectaciones
- Piezas con costos por complejidad
- Materiales usados por orden

### Contratos
- Gestión de contratos con versionado
- Firmas digitales
- Aprobación multi-nivel
- Archivos adjuntos
- Alertas de vencimiento
- Tipos de contrato personalizables

### Reportes Financieros Avanzados
- Reportes por ubicación y categoría
- Reporte de venta diaria
- Movimientos de inventario
- Reportes financieros generales
- Reportes programados (ScheduledReport)

### Backups Automáticos
- Backup programado diario (full/tenant/config)
- Configuración de retención
- Restoration desde panel

---

## Resumen Comparativo

| Feature | Básico | Profesional |
|---------|--------|-------------|
| **Productos** | Hasta 100 | Hasta 5,000 |
| **Almacenes** | 1 | 5 |
| **Puntos de Venta** | 1 | 5 |
| **Usuarios** | 2 | 10 |
| **Clientes** | Hasta 200 | Ilimitado |
| **Ventas POS** | ✅ | ✅ |
| **Facturación** | ✅ | ✅ |
| **Gastos** | ✅ | ✅ |
| **Ofertas** | ✅ | ✅ |
| **Caja / Turnos / Arqueo** | ✅ | ✅ |
| **Cuadre Diario** | ✅ | ✅ |
| **Contabilidad** | ❌ | ✅ |
| **Multi-moneda** | ❌ | ✅ |
| **Empleados / Asistencia** | ❌ | ✅ |
| **Nómina** | ❌ | ✅ |
| **Vacaciones** | ❌ | ✅ |
| **Compras** | ❌ | ✅ |
| **Proveedores** | ❌ | ✅ |
| **Transferencias** | ❌ | ✅ |
| **Mermas** | ❌ | ✅ |
| **Producción** | ❌ | ✅ |
| **Reparaciones** | ❌ | ✅ |
| **Contratos** | ❌ | ✅ |
| **Listas de Precios** | ❌ | ✅ |
| **CxC / CxP** | ❌ | ✅ |
| **Préstamos Cash** | ❌ | ✅ |
| **Deudas Cash** | ❌ | ✅ |
| **Anticipos** | ❌ | ✅ |
| **Reportes Financieros** | ❌ | ✅ |
| **Backups** | ❌ | ✅ |

---

## Pricing Sugerido

| Plan | Precio mensual (CUP) | Precio mensual (USD) |
|------|---------------------|---------------------|
| Básico | 1,500 CUP | $15 USD |
| Profesional | 4,500 CUP | $45 USD |
| Empresarial | A medida | A medida |

---

## Implementación Técnica

### 1. Modelo Plan

Agregar nuevos campos al modelo `Plan` en Prisma:

```prisma
model Plan {
  // ... campos existentes
  maxClientes      Int      @default(200)
  maxPuntosVenta   Int      @default(1)
  maxFacturasMes   Int      @default(0)     // 0 = ilimitado
  maxContratos     Int      @default(0)
  maxBackups       Int      @default(0)
  incluyeBackups   Boolean  @default(false)
  features         Json     @default("{}")   // Feature flags default del plan
}
```

### 2. Feature Flags Schema

Usar el campo `features` (JSON) existente en `TenantLicense`. Definir un tipo TypeScript:

```typescript
// src/lib/services/plan-features.ts
export interface PlanFeatures {
  // Core
  productos: boolean
  categorias: boolean
  unidades: boolean
  almacenes: boolean
  clientes: boolean
  // Ventas
  ventas: boolean
  'venta-servicios': boolean
  facturas: boolean
  'series-facturacion': boolean
  ofertas: boolean
  // Caja
  'puntos-venta': boolean
  'turnos-pos': boolean
  'arqueo-caja': boolean
  'cuadre-diario': boolean
  // Gastos
  gastos: boolean
  // Contabilidad
  contabilidad: boolean
  'cuentas-cobrar': boolean
  'cuentas-pagar': boolean
  'prestamos-cash': boolean
  'deudas-cash': boolean
  anticipos: boolean
  'multi-moneda': boolean
  // RRHH
  empleados: boolean
  'pago-salario': boolean
  // Compras
  compras: boolean
  vendors: boolean
  // Inventario avanzado
  transferencias: boolean
  mermas: boolean
  'listas-precios': boolean
  // Producción
  produccion: boolean
  // Taller
  reparaciones: boolean
  // Contratos
  contratos: boolean
  // Reportes
  'reportes-basicos': boolean
  'reportes-financieros': boolean
  // Sistema
  backups: boolean
  notificaciones: boolean
  configuracion: boolean
  'mi-empresa': boolean
  perfil: boolean
  dashboard: boolean
  servicios: boolean
}
```

### 3. Gating en Server Actions

```typescript
import { requireFeature } from '@/lib/services/plan-features'

export const createCompraAction = withAction(async (input, user) => {
  const tenantId = requireTenant(user)
  await requireFeature(tenantId, 'compras')
  // ... resto del código
})
```

### 4. Gating en UI

```typescript
'use client'
import { usePlanFeatures } from '@/hooks/use-plan-features'

function SidebarNav() {
  const features = usePlanFeatures()
  if (!features.compras) return null
  return <NavItem href="/busy/compras" label="Compras" />
}
```

### 5. Seed Data

```typescript
// prisma/seed/plans.ts
export const DEFAULT_PLANS = [
  {
    nombre: 'Básico',
    descripcion: 'Operaciones esenciales para pequeños negocios',
    precio: 1500,
    duracionDias: 30,
    maxUsuarios: 2,
    maxAlmacenes: 1,
    maxProductos: 100,
    maxClientes: 200,
    maxPuntosVenta: 1,
    maxFacturasMes: 200,
    maxContratos: 0,
    incluyeBackups: false,
    features: { /* Básico feature flags */ },
  },
  {
    nombre: 'Profesional',
    descripcion: 'PYME en crecimiento con automatización y control total',
    precio: 4500,
    duracionDias: 30,
    maxUsuarios: 10,
    maxAlmacenes: 5,
    maxProductos: 5000,
    maxClientes: 0,     // 0 = ilimitado
    maxPuntosVenta: 5,
    maxFacturasMes: 0,  // ilimitado
    maxContratos: 50,
    incluyeBackups: true,
    features: { /* Profesional feature flags */ },
  },
]
```
