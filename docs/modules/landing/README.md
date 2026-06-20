# Landing Page

> **Feature**: `src/features/landing/`
> **Ruta**: `/` (página pública)

---

## Descripción

Página pública de aterrizaje del sistema. Muestra información institucional, características del producto, beneficios, planes de suscripción y FAQ. No requiere autenticación.

## Funcionalidades

### Secciones de la Landing

| Componente | Propósito |
|-----------|-----------|
| `LandingHeader` | Navegación pública |
| `LandingHero` | Hero principal con CTA |
| `LandingFeatures` | Grid de características del sistema |
| `LandingBenefits` | Beneficios del producto |
| `LandingFaq` | Preguntas frecuentes |

### Planes Públicos

**Descripción**: La landing consume `getPlansPublicActionV2()` para mostrar los planes de suscripción disponibles con sus features y precios.

## Server Actions

No tiene Server Actions propias. Consume `getPlansPublicActionV2` del módulo `planes`.

## Integraciones

| Módulo | Relación |
|--------|----------|
| `planes` | Muestra planes públicos |
| `auth` | Links a login/register |

## Permisos

| Acceso | Requisito |
|--------|-----------|
| Landing | Público (sin autenticación) |
