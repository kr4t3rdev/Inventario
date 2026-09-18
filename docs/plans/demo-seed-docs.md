# Sistema de Demos — FinanceMDM

> Documentación del sistema de provisioning, seeding y limpieza de tenants demo.

## Arquitectura

```
Admin (createDemoTenantAction)
        │
        ▼
demo-tenant-factory.ts
  ├── Crea User demo (email temporal, password temporaria)
  ├── Crea Tenant
  ├── Crea TenantMembership (manager)
  ├── Crea TenantLicense (isDemo:true, duración 6 días)
  └── Retorna credenciales
        │
        ▼
demo-seed.ts (orquestador)
  ├── seedBaseDemoData()     ← común a todos
  ├── seedProfessionalExtras() ← si plan Profesional+
  └── seedEnterpriseExtras()   ← si plan Empresarial
        │
        ▼
Cron cada 1h ──→ cleanupExpiredDemoLicenciasAction
```

## Componentes

### demo-tenant-factory.ts
**Ruta:** `src/lib/services/demo-tenant-factory.ts`
**Crea:** Usuario demo + Tenant + Membership + License en una transacción.
- Email: `{slug}.{uuid}@demo.local`
- Password: `Demo-{uuid}` (temporal, hasheada con bcrypt)
- Duración: 6 días por defecto (configurable via `durationDays`)
- `isDemo: true`, `createdBy: user.userId` del admin

### demo-seed.ts (Orquestador)
**Ruta:** `src/lib/services/demo-seed.ts`
**Resuelve perfil:** `basic` | `professional` | `enterprise` según nombre del plan.
**Ejecuta:** Base siempre + extras según perfil.
**Usa:** `prisma.$transaction()` para atomicidad.

### Seeds por Plan

| Archivo | Plan | Contenido |
|---------|------|-----------|
| `prisma/seed/demo/base-seed.ts` | Básico | 20 productos, 1 almacén, 1 PV, 3 clientes, 1 proveedor, CUP+USD |
| `prisma/seed/demo/professional-seed.ts` | Profesional | +25 productos, +1 almacén, +1 PV, EUR, ventas demo |
| `prisma/seed/demo/enterprise-seed.ts` | Empresarial | +50 productos, +2 almacenes, +2 PVs, MXN, compras, transferencias, stock ubicación |

### cleanupExpiredDemoLicenciasAction
**Ruta:** `src/features/admin/actions.ts`
**Busca:** `isDemo:true AND activa:true AND expiracion < now()`
**Acción:** `updateMany` → `activa: false`
**Flags:** `dryRun` para preview sin modificar

### Cron Job
- **ID:** aff7764c22ef
- **Schedule:** cada 1h
- **Modo:** agente LLM con fallback si Railway CLI bloqueado
- **Script:** `scripts/deactivate-expired-demos.ts`

## Auditoría

- `createdBy`: ID del admin que ejecutó `createDemoTenantAction`
- `createdAt`: timestamp automático de Prisma
- `isDemo:true`: permite filtrar demos de métricas reales

## Filtros en Admin

Los siguientes queries excluyen `isDemo:true` automáticamente:
- `getAdminSystemHealthAction` → KPIs del dashboard
- `getAdminTenantsAction` → listado de tenants
- `getLicenciasAction` → listado de licencias
- `getAdminSubscriptionRevenueAction` → revenue MRR/ARR

## Conversión a Plan Pagado

Usar `convertDemoToPaidPlanAction` en el panel admin para migrar una demo a licencia real sin perder datos del tenant.
