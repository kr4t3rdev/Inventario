# SDD Proposal: Reportes contables en la app móvil

## Business Problem

La pestaña Contabilidad del mobile tenía seis módulos y ninguno mostraba los resultados calculados del negocio. Los reportes contables (Resumen de turno, Movimientos, Análisis cambio, Facturas vencidas, Impacto de cambio, Transferencias) solo existían en web.

## Hallazgos

- `AccountingReportsApi` ya existe en el SDK vendado (`mobile-v1`) con endpoints listos.
- No había ningún wrapper en mobile ni superficie que los expusiera.

## Scope

### Incluye
- `accounting-reports-api.ts`: wrapper tipado de `AccountingReportsApi` (summary, movements, exchange, overdue, exchange impact, transfers).
- `AccountingReportsSurface`: summary + movements en la pestaña Contabilidad.
- Actualización de `AccountingShell` para incluir el nuevo módulo "Reportes".

### Excluye
- Exportación (PDF/Excel): los tipos con `_export?` existen pero el UI móvil no los necesita.
- Reporteadores avanzados (trend comparativo por período, charts históricos). Se documentarían como futuro.

## Rollback
Revert versión (mobile-only).