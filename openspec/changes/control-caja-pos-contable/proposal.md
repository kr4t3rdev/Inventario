# Proposal: Control de Caja POS y Cuadre Contable Operativo

## Intent

Cerrar las grietas contables entre el punto de venta operativo y la contabilidad formal: fondo en caja al abrir turno, trazabilidad de efectivo, arqueo diario por POS, e integración con el cuadre diario existente y los periodos contables.

## Grieta 1 — No existe el concepto de "Turno POS"

El sistema no registra cuándo un punto de venta abre o cierra. Las ventas se crean contra `puntoDeVentaId` pero no hay un `turnoId` que las agrupe, ni `empleadoId` que identifique al cajero responsable.

```prisma
// Hoy no existe nada como esto:
model TurnoPuntoVenta {
  id              String   @id @default(cuid())
  tenantId        String
  puntoDeVentaId  String
  empleadoId      String?  // Cajero responsable
  fechaApertura   DateTime @default(now())
  fechaCierre     DateTime?
  fondoInicialCup Int      @default(0)   // Efectivo en CUP que se deja en caja al abrir
  fondoInicialUsd Int      @default(0)   // Efectivo en USD/MLC
  estado          String   @default(ABIERTO)  // ABIERTO | CERRADO
  ventas          Venta[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Consecuencia**: No se puede responder "¿cuánto efectivo debería haber en la caja del POS ahora?" ni "¿quién abrió y cerró la caja?".

## Grieta 2 — Las ventas no registran método de pago

`Venta` no tiene campo `metodoPago`. El `TipoPago` solo se usa posteriormente en `ReconciliacionVenta` (un paso contable separado).

**Consecuencia**: El cuadre diario no puede desglosar ventas por efectivo, tarjeta, transferencia desde el origen. No se puede controlar el efectivo esperado en caja.

## Grieta 3 — No hay arqueo de caja

No existe un registro de conteo físico: billetes, monedas, tarjetas, transferencias. El cuadre diario calcula totales desde los datos del sistema, pero no compara contra lo que realmente hay en caja.

**Consecuencia**: No se pueden detectar sobrantes o faltantes. No hay pista de auditoría para diferencias.

## Grieta 4 — El Cuadre Diario no captura saldos iniciales/finales

El endpoint `getCuadreDiarioAction` devuelve `efectivoInicial: 0` y `efectivoFinal: 0` — valores dummy. No hay conexión entre el fondo que se puso al abrir el turno y lo que se espera tener al final.

**Consecuencia**: El reporte diario es informativo pero no permite validación contable real.

## Grieta 5 — PuntoDeVenta no tiene datos contables

`PuntoDeVenta` no tiene cuenta contable asociada, ni almacén por defecto, ni tipo de caja (principal/secundaria/móvil).

**Consecuencia**: No se puede integrar POS con el plan de cuentas contable ni con los periodos formales.

## Scope

### Incluye

1. **Modelo `TurnoPuntoVenta`** — Apertura/cierre de caja por POS con fondo inicial.
2. **Relación Venta → TurnoPuntoVenta** — Cada venta pertenece a un turno.
3. **Método de pago en Venta** — `efectivo` | `tarjeta` | `transferencia` | `credito` | `mixto` con desglose por tipo.
4. **Modelo `ArqueoCaja`** — Conteo físico al cierre del turno: billetes, monedas, tarjetas, diferencias.
5. **Cuadre Diario mejorado** — Conectar turnos + arqueo al resumen diario; saldos iniciales y finales reales.
6. **PuntoDeVenta extendido** — Agregar `cuentaContableId`, `tipoCaja`, `almacenId` por defecto.

### Excluye
- Integración con `PeriodoContable` / `AperturaPeriodo` — eso va en tanda posterior cuando los turnos y arqueos estén consolidados.
- Reportes históricos de caja por periodo contable.
- Corte de caja Z (cierre fiscal) — es más avanzado y depende de regulaciones locales.
- Múltiples cajeros simultáneos en el mismo turno.

## Cambios Propuestos

| # | Mejora | Prioridad | Complejidad | Archivos Afectados |
|---|--------|-----------|-------------|-------------------|
| 1 | Modelo `TurnoPuntoVenta` + migración | Crítica | Media | `prisma/schema.prisma`, `src/features/puntos-venta/` |
| 2 | Turno por defecto al crear venta (backfill para existentes) | Crítica | Alta | `src/features/ventas/actions.ts`, `src/features/ventas/schemas.ts` |
| 3 | Método de pago en `Venta` + `VentaItem` | Alta | Media | `prisma/schema.prisma`, `src/features/ventas/actions.ts`, `pv-interface.tsx` |
| 4 | Modelo `ArqueoCaja` | Alta | Media | `prisma/schema.prisma`, nueva feature `arqueo-caja` |
| 5 | Cuadre Diario conectado a turnos y arqueo | Alta | Alta | `src/features/cuadre-diario/actions.ts`, `components/` |
| 6 | PuntoDeVenta extendido | Media | Baja | `prisma/schema.prisma`, actions/schemas de puntos-venta |
| 7 | UI de apertura/cierre de turno POS | Alta | Alta | Nueva sección en POS, dialogo de apertura/cierre |
| 8 | Resumen de cierre: totales del turno | Alta | Media | Componente Post-venta, reporte de cierre |

## Riesgos

| Item | Riesgo | Mitigación |
|------|--------|-----------|
| Migración con ventas existentes | Ventas sin turno ni metodoPago | Crear turno "legacy" por tenant, asignar todas las ventas existentes a ese turno |
| Ventas sin metodoPago | Datos históricos incompletos para cuadre | metodoPago nullable, reportes ignoran null con nota |
| Flujo de apertura/cierre friction | Usuarios pueden olvidar abrir turno | Turno automático opcional (abre al crear primera venta del día) |
| Cierre de turno forzado | Ventas después del cierre sin turno abierto | Bloquear ventas si no hay turno abierto |
