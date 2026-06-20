# Dashboard

> **Feature**: `src/features/dashboard/`
> **Ruta**: `/busy`

---

## Descripción

Panel ejecutivo principal del sistema. Muestra indicadores clave en tiempo real: ventas del día, productos con stock bajo, rentabilidad, actividad reciente. Los datos se calculan via `getDashboardStatsQuery()` y se cachean en servidor.

## Funcionalidades

### Stats del Dashboard (`getDashboardStatsAction`)

**Descripción**: Calcula y retorna métricas agregadas del tenant: total de productos, ventas del día, productos con stock bajo, etc.

### Wanda Dashboard

**Descripción**: Dashboard alternativo con visualizaciones animadas y gráficos. `getWandaDashboardHandler` y `invalidateWandaCacheHandler` manejan la caché específica de Wanda.

### Invalidez de Caché

**Descripción**: `invalidateDashboardCacheHandler` permite forzar la recarga de datos del dashboard cuando ocurren cambios.

## Server Actions

| Action | Propósito |
|--------|-----------|
| `getDashboardStatsAction` | Métricas principales del dashboard |
| `invalidateDashboardCacheAction` | Invalidar caché del dashboard |
| `getWandaDashboardAction` | Dashboard Wanda con animaciones |
| `invalidateWandaCacheAction` | Invalidar caché de Wanda |

## Integraciones

| Módulo | Relación |
|--------|----------|
| `productos` | Stock bajo, total de productos |
| `ventas` | Ventas del día, rentabilidad |
| `contabilidad` | Resumen financiero |

## Permisos

| Acción | Rol |
|--------|-----|
| Ver dashboard | `admin`, `manager`, `economico`, `dependiente` |
