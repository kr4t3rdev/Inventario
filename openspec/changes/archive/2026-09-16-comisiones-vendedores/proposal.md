# CMV — Comisiones y metas de vendedores (Gap 5)

## Decisión ejecutiva

Se construyen comisiones de venta por empleado y metas mensuales, **minimalistas y a la cubana**:
% de comisión por empleado sobre ventas efectivamente cobradas, y una meta mensual con progreso
alcanzable. Sin scoring, sin equipo de venta, sin territorios (eso es Odoo Enterprise). NCs (no
solo ventas) y devoluciones reducen la comisión del período (autodefensa frente al fraude).

## Problema

- Odoo (Enterprise) ofrece comisiones; el gap en TCP es total y el marketing lo promete.
- Sin comisión, un dependiente rinde igual si vende 10 o 100; la rama de negocio no tiene
  incentivos alineables.

## Propuesta

1. **`Empleado.comisionPct`** (porcentaje entero, 0-100) + `Empleado.metaMensual` (entero,
   centavos) — configurables por manager.
2. **`ComisionEmpleadoModelo` – reporte computado**: período (año-mes) × empleado → ventas
   elegibles × NCs aplicables → comisión. Sin contabilidad extra: es derivación, no pago.
3. **`VentasComisionablesService`**: regla pura — ventas `FACTURADA` del período con
   `deletedAt null`, con `empleadoId` igual al empleado, menos `DevolucionVenta` de esas ventas
   y menos el desgaste por turno cancelado (no se paga por ventas de turnos inseguros).
4. **Metas**: `Empleado.metaMensual` editable; reporte de progreso `%` y badge al alcanzar.
5. **UI**: listado de empleados con comisión/meta actualizables, reporte de comisiones del mes y
   progreso de metas. Nada en el POS.
6. **Permisos nuevos**: `rrhh.comisiones.gestionar` (manager, sensitive) para la configuración y
   consulta del reporte; sin cambios de `ventas.*`.

## No-goals

- Sin pagos comisionados ni impacto en `Pagosalario` (eso sería otro plan).
- Sin fórmulas múltiples por rango/volumen/producto; una sola regla base.
- Sin proyecciones, sin leaderboard gamificado.
- Sin integración con `SalesAgentCommissionLedger` (eso es el programa de referidos de la
  plataforma, otro dominio distinto).

## Impacto sobre el sistema actual

| Elemento | Archivos | Cambio |
|---|---|---|
| Empleado | `prisma/schema.prisma` | 2 columnas opcionales |
| Servicio | `src/features/empleados/services/comision-service.ts` | regla pura + agregación |
| Acciones | `src/features/empleados/actions.ts` (o nuevo) | configuración + reporte |
| UI | Empleados | formularios + reporte mensual |
| Reportes | `src/features/reportes-financieros/` | entrada en cuadre/análisis (devoluciones ya netean) |

## Criterios de aceptación

1. Un empleado con ventas del mes muestra su comisión calculada según % configurado.
2. La comisión baja si una venta se devuelve parcialmente o al 100%.
3. El progreso de la meta se actualiza en tiempo real y el badge se muestra al llegar al 100%.
4. Sin permiso `rrhh.comisiones.gestionar` no se puede ver ni configurar el reporte.
5. Sin migración destructiva; campos nuevos con default neutro.
