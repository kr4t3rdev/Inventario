# Licencias

> Administra licencias por tenant, incluyendo demos, filtros paginados, vencimientos y features habilitadas por plan u override.

## Qué hace

Este módulo trabaja sobre `tenantLicense`, no sobre licencias sueltas por usuario. Desde acá se controla qué plan tiene cada empresa, si está activa, cuándo vence y qué capacidades reales quedan habilitadas.

## Operaciones principales

- listar licencias con paginación, búsqueda y ordenamiento
- filtrar por plan, estado y tipo (`demo` o real)
- ver métricas agregadas: total, activas, expiradas, demos y por vencer
- activar, revocar o eliminar licencias
- crear tenants demo con seed automático según plan
- limpiar demos expiradas
- convertir una demo en plan pago sin perder el tenant
- aplicar `featureOverrides` contables sobre una licencia concreta

## Cuándo usarlo

- Cuando una empresa quedó sin acceso por vencimiento.
- Cuando querés crear un entorno demo para ventas o soporte.
- Cuando necesitás pasar una demo a producción real.
- Cuando un tenant requiere habilitaciones especiales no cubiertas por el plan base.

## Qué conviene cuidar

- Las demos usan la misma entidad de licencia, pero con `isDemo=true`.
- Al convertir una demo a plan pago se actualizan vencimiento, límites y features del tenant.
- Los overrides contables se fusionan con los existentes; no reemplazan todo ciegamente.
- Las métricas del admin respetan los mismos filtros de la tabla paginada.

## Relación con otros módulos

- **Admin**: la gestión principal vive en `/admin/licencias`.
- **Planes**: define límites y features base.
- **Auth**: una licencia vencida puede bloquear acceso.
- **Referidos**: los créditos pueden impactar el costo final de una licencia.

## Referencias útiles

- `src/app/admin/licencias/page.tsx`
- `src/features/admin/actions.ts`
- `src/features/admin/actions-licencias.ts`

## En una frase

Define qué puede usar cada empresa, por cuánto tiempo y bajo qué reglas especiales.
