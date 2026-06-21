# Plan de Ampliación: Ficha de Costo — Features 5-8

**Fecha**: 2026-06-20
**Status**: Planning
**Basado en**: 4 features completados (Reconciliación, Trazabilidad, Plantilla, Bulk Update)

---

## Features Completadas (1-4)

| # | Feature | Tests | Commits |
|---|---------|-------|---------|
| 1 | Reconciliación historial ↔ compras | 84 | 3 |
| 2 | Trazabilidad FIFO en ventas | 99 | 2 |
| 3 | Plantilla de ficha de costo | 123 | 3+1 fix |
| 4 | Actualización masiva de precios | 150 | 3+1 fix |

---

## Features Pendientes (5-8)

### Feature 5: Alertas de Margen Bajo
**Objetivo**: Notificar cuando el margen de un producto cae debajo de un umbral configurable.

**Alcance**:
- Umbral configurable por producto (default global)
- Cálculo en tiempo real del margen actual vs umbral
- Notificación visual en la ficha de costo (badge/alert)
- Lista de productos con margen bajo (dashboard de alertas)
- Opcional: notificación por email/notificación push

**Dependencias**: Features 1, 2 (CPP, FIFO)

**Prioridad**: Alta — visibilidad inmediata de problemas de rentabilidad

---

### Feature 6: Dashboard de Rentabilidad
**Objetivo**: Vista agregada de márgenes por producto/categoría con filtros temporales.

**Alcance**:
- Gráfico de barras: margen promedio por categoría
- Tabla: top/bottom productos por margen
- Evolución temporal: margen en los últimos 6 meses
- Filtros: por categoría, tipo de producto, rango de precios
- Exportación a CSV/PDF

**Dependencias**: Features 1, 2 (CPP, FIFO), Feature 5 (umbrales)

**Prioridad**: Alta — decisiones estratégicas de pricing

---

### Feature 7: Sugerencias de Precio
**Objetivo**: Precio sugerido automático basado en CPP + margen objetivo + datos de competencia y estacionalidad.

**Alcance**:
- Precio sugerido = CPP × (1 + margen_objetivo) × factor_estacional
- Factor estacional: basado en histórico de ventas por mes
- Factor competencia: input manual o scraping (futuro)
- Lista de sugerencias con diff vs precio actual
- Aprobación/rechazo individual o masivo
- Auditoría de cambios de precio sugeridos

**Dependencias**: Features 1, 2, 3 (CPP, plantilla)

**Prioridad**: Media — automatización de pricing

---

### Feature 8: Historial de Cambios de Precio
**Objetivo**: Vista de auditoría con gráficos de evolución de precioVenta y precioCosto en el tiempo.

**Alcance**:
- Línea de tiempo: cambios de precioCosto y precioVenta
- Gráfico de evolución (chart.js/recharts)
- Tabla con filtros: por fecha, tipo de cambio, usuario
- Detalle de cada cambio: old → new, motivo, usuario, fecha
- Exportación a CSV/PDF
- Comparación side-by-side: costo vs venta en el tiempo

**Dependencias**: `ProductoCostHistory` (ya existe), Feature 2 (FIFO)

**Prioridad**: Media — auditoría y compliance

---

## Orden de Implementación

```
Feature 5 (Alertas) → Feature 6 (Dashboard) → Feature 7 (Sugerencias) → Feature 8 (Historial)
```

**Razón**: Feature 5 es la de mayor impacto inmediato. Feature 6 se beneficia de los umbrales definidos en 5. Feature 7 usa datos de 5 y 6. Feature 8 es principalmente consulta sobre datos existentes.

---

## Stack Tecnológico (sin cambios)

- **Backend**: Server Actions con `withAction` wrapper
- **Database**: Prisma + PostgreSQL (sin nuevas migraciones)
- **Frontend**: React 19 + Tailwind + shadcn/ui
- **Gráficos**: recharts (ya instalado en el proyecto)
- **Tests**: Vitest + React Testing Library
- **Patrón**: TDD strict (RED→GREEN→REFACTOR)

---

## Constraints

- Multi-tenant: todas las queries con `tenantId`
- Manager role para mutations
- Plan features para features premium (a decidir con Arturo)
- Cero cambios de schema cuando sea posible
- Máximo 400 líneas por review (size-exception ok para features cohesivos)
- 3 work units por feature máximo
