# Proposal: Alertas de Margen Bajo — Ficha de Costo

**Change**: `ficha-costo-alertas-margen`  
**Date**: 2026-06-20  
**Status**: Proposed  

## Why

Los managers necesitan saber inmediatamente cuando un producto deja de ser rentable. Hoy el margen se calcula y se muestra en la ficha individual, pero no hay una vista agregada ni alertas proactivas. Un producto con margen bajo puede pasar desapercibido semanas, erosionando la rentabilidad del negocio.

## What Changes

### 1. Widget "Margen Bajo" en Dashboard
- Nueva card en `/busy/dashboard` con tabla de productos con margen < 10%
- Sigue el patrón de `StockBajoTable` existente
- Columnas: Producto | Precio Venta | Precio Costo | Margen % | Estado
- Badge de estado: 🟢 Saludable (≥10%) | 🟡 Bajo (0-10%) | 🔴 Pérdida (<0%)
- Ordenado por margen ascendente (peores primero)
- Límite de 10 productos para mantener el dashboard ligero

### 2. Notificaciones de Margen Bajo
- Batch notification: cuando un producto cae debajo del 10% de margen, se crea una notificación
- Dedup 24h: no notificar el mismo producto dos veces en 24 horas
- Sigue el patrón de `verificar-stock.ts`
- Tipo de notificación: `margen_bajo`
- Solo para productos con `precioVenta > 0`

### 3. Server Action
- `getProductosMargenBajoAction({ limit?: number })` — retorna lista de productos con margen bajo
- Cálculo: `margen = ((precioVenta - precioCosto) / precioVenta) * 100`
- Filtro: `margen < 10 AND precioVenta > 0`
- Multi-tenant: filtrado por tenantId
- Sin dependencia de CPP (cálculo simple, rápido)

## Out of Scope
- Threshold configurable por producto → Feature futura
- Email notifications → Feature futura
- Gráficos de evolución → Feature 8 (Historial)
- Scheduled jobs automáticos → las notificaciones se generan on-demand

## Impact
- **Nuevos archivos**: `actions-alertas.ts`, `components/margen-bajo-table.tsx`, `__tests__/actions-alertas.test.ts`, `__tests__/margen-bajo-table.test.tsx`
- **Modificados**: `dashboard/page.tsx` (agregar widget), `lib/notificaciones-utils.ts` (nuevo helper), `panel-notificaciones.tsx` (nuevo icono)
- **Sin migraciones**: cero cambios de schema
- **Sin nuevas dependencias**: recharts ya instalado

## Risks & Mitigations
| Riesgo | Mitigación |
|--------|-----------|
| Cálculo simple no refleja CPP real | Aceptable para alertas tempranas; el detalle está en la ficha |
| Falsos positivos (productos nuevos sin precioCosto) | Filtrar `precioCosto > 0` |
| Dashboard ya tiene 8+ queries | Agregar 1 más es marginal; usar Promise.all |
| Notificaciones sin tenantId | Seguir patrón de `verificar-stock.ts` |