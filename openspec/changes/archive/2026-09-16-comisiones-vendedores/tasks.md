# Tasks — CMV Comisiones y metas de vendedores (Gap 5)

Plan SDD/TDD con RED→GREEN por fase, prisma mockeado en unitarios, review por fase
y commit selectivo.

## CMV-T1 — Modelo + permiso

- [x] **T1.1** `Empleado.comisionPct` + `Empleado.metaMensual` en el schema; migración
  con `migrate diff`; permiso nuevo `rrhh.comisiones.gestionar` (manager, sensitive) +
  fixture. Sin idempotencias raras.
- [x] RED paridad de permisos (test visible en la suite auth).
- Commit: `feat(empleados): configuración de comisiones y metas (CMV-T1)`

## CMV-T2 — Regla pura + servicio

- [x] **T2.1 RED.** `src/features/empleados/__tests__/comision-calc.test.ts`: la regla pura
  (ventas elegibles, resto por NC, % comisión, meta) con casos extremos (NC mayor que la
  venta, empleado sin meta, etc.).
- [x] **T2.2 GREEN.** `comision-service.ts`: funciones puras + acceso a DB (último paso
  del pipeline) — ventas del período por empleado, menos devoluciones, computa comisión y
  % de meta.
- Commit: `feat(empleados): regla de comisiones (CMV-T2)`

## CMV-T3 — Actions + UI

- [x] Actions: `updateComisionEmpleadoAction` (permiso+validación), `getComisionesMesAction`
  (reporte), `getMiComisionAction` (propia, si el usuario está ligado a un empleado).
- [x] UI: campos en la ficha del empleado, reporte del mes y progreso (badge/meta).
  Carga con skeletons y errores con toast.
- Commit: `feat(empleados): actions y UI de comisiones (CMV-T3)`

## CMV-T4 — Regresión y cierre

- [x] Suites tocadas (empleados, ventas, devoluciones) + typecheck + lint en archivos.
- [x] Memoria actualizada + change archivado.
- Commit: `docs(openspec): cerrar CMV comisiones y metas (Gap 5)`

## Fast-follows

- Liquidaciones cerradas (mes cerrado → comisión congelada en una entidad aparte).
- Integración con Pagosalario para que la nómina la considere como componente.
- Vista por equipo si en el futuro hay más de un responsable de venta.

### Implementación real (Gap 5, commiteado hoy)
- T1 `a7c48d24` | T2 `964b04f4` | T3 `0f806cbf` | T4 cierre `↘` (este commit).
- La regla pura está en services/comision-service.ts (testable sin DB); las actions montan
  el gate del permiso; la UI es una página de lectura /busy/empleados/comisiones (mes/año).
- Comisión se calcula sobre ventas ENTREGADA/FACTURADA y se descuenta por devoluciones del
  período (se topan al bruto, nunca negativas).
- Sin impacto en nómina, caja, arqueo ni contabilidad; los límites están documentados en
  design.md.
