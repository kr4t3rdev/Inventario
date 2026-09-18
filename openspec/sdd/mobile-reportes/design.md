# Design: Reportes contables en la app móvil

## Enfoque técnico

1. `accounting-reports-api.ts` cmó el SDK vendado (`AccountingReportsApi`) con firma compatible con el contrato (`fetchApi` propio para inyección).
2. `AccountingReportsSurface` con summary + movements; solo se cnifica.
3. `AccountingShell` invoca la heurística algún widget "reports" que llama `reports.summary/movements`.

## Archivos

- `mobile/src/accounting-reports-api.ts` (nuevo)
- `mobile/src/AccountingReportsSurface.tsx` (nuevo)
- `mobile/src/AccountingShell.tsx` (extiende módulos)
- `mobile/src/accounting-clients.ts` (agrega `reports`)
- `mobile/src/BusinessShell.tsx` (cableado)

## Riesgos

- Los formatos de reporte son estructurales complejos (movimientos con paginación). La superficie no trunca eso; solo muestra conteos.

## RFC 2119
- "DEBE" obligatorio.