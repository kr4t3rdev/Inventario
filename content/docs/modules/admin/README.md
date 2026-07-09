# Administración

> Es el panel global del sistema para monitorear tenants, licencias, finanzas, auditoría, backups y operaciones sensibles.

## Qué hace

Este módulo concentra las vistas y acciones reservadas a perfiles `admin` globales. No es un panel de negocio diario: es una consola de supervisión y gobierno del sistema.

## Áreas principales

- **Panel general**: KPIs de tenants, usuarios, sesiones, ingresos y licencias por vencer.
- **Tenants**: listado de empresas, filtros, exportación y métricas por tenant.
- **Licencias**: control de demos, licencias activas, expiradas, conversión de demo a plan pago y overrides de features.
- **Finanzas**: visión consolidada de ingresos, gastos y resultado neto.
- **Referidos**: conciliación de comisiones, créditos y perks.
- **Audit logs**: seguimiento de acciones sensibles.
- **Backups y migraciones**: tareas operativas del sistema.
- **Salud operativa**: matrices específicas para ventas, facturación, contabilidad y maestros.

## Cuándo usarlo

- Cuando necesitás revisar el estado general de la plataforma.
- Cuando querés auditar empresas, usuarios o licencias.
- Cuando tenés que intervenir sobre demos, suscripciones o migraciones.
- Cuando hace falta validar números globales fuera del contexto de un tenant puntual.

## Qué conviene cuidar

- Muchas acciones del admin afectan datos cross-tenant y no solo una empresa.
- El panel mezcla vistas operativas, financieras y comerciales; conviene entrar con un objetivo claro.
- Los módulos de licencias y referidos tienen reglas propias y merecen revisión separada.
- La información del dashboard se refresca desde Server Actions, no desde APIs legacy.

## Rutas clave

- `/admin`
- `/admin/tenants`
- `/admin/licencias`
- `/admin/finanzas`
- `/admin/referidos`
- `/admin/audit-logs`
- `/admin/backups`
- `/admin/migraciones`

## Referencias útiles

- `src/app/admin/page.tsx`
- `src/app/admin/tenants/page.tsx`
- `src/app/admin/licencias/page.tsx`
- `src/features/admin/actions.ts`
- `src/features/admin/actions-licencias.ts`

## En una frase

Es la consola central para gobernar la plataforma completa, no solo una empresa.
