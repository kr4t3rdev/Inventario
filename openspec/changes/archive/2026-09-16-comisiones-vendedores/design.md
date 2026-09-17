# Design — CMV Comisiones y metas de vendedores (Gap 5)

## Modelo de datos (mínimo)

```prisma
model Empleado {
  // ... existentes ...
  /// Porcentaje de comisión por ventas efectivamente cobradas (0-100).
  comisionPct          Int @default(0)
  /// Meta mensual de ventas en centavos (0 = sin meta).
  metaMensual          Int @default(0)
}
```

No hay tabla de "pago de comisión": la comisión es una derivación computada del
período. Si mañana se cortan liquidaciones, serán un modelo aparte con período y
estado; por ahora la base es el reporte mensual.

## Regla de la comisión (pura, testeable)

```
ventasElegibles(empleadoId, yyyymm) =
  total de ventas del período
    donde estado = 'FACTURADA' o 'ENTREGADA'
    y deletedAt = null
    y empleadoId = el empleado
    posteriormente se descuenta:
      - sum(devoluciones de esas ventas, estado REGISTRADA)
      - 0 si el turno de la venta está CERRADO_CON_ARQUEO_ERROR (impagos no cuentan)

comisionEmpleado = floor(ventasElegibles × comisionPct / 100)
```

Notas:
- La venta cuenta por su fecha `createdAt` (período), la NC la descuenta el mismo período
  (la NC se crea el día de la devolución; la venta sigue en su propio período y la comisión
  "engorda" por su cifra menos su NC — así el sistema resiste fraude vía devolución).
- Crédito CxC pagado después cuenta igual (la venta está `FACTURADA`; el cobro efectivo es
  asunto de la CxC, no de la comisión).

## Metas (derivadas)

- `Empleado.metaMensual` (centavos). Progreso = ventasElegibles / metaMensual.
- Badge en el reporte: "En camino" / "Cumplida" / "Superada"; sin castigos ni bono.
- Cambio de meta: inmediato, no se versiona (documentado para la auditoría futura).

## Flows

### Configuración (manager)

1. Lista de empleados → editar comisión/meta → guardar. Audit log cada cambio.
2. Regla: un manager no puede subir una comisión que él mismo no teme (sin jerarquía);
   la complejidad regulatoria queda afuera.

### Consumo

1. Reporte "Comisiones del mes": tabla con ventas elegibles, devoluciones, comisión %,
   meta, progreso. Solo lectura y filtrable.
2. El empleado mismo solo puede verse a sí mismo (su userId → su empleado vinculado;
   en caso contrario: el manager es quien lo consulta — esta es la única regla MVP).
3. Sin gráfico acumulado en esta fase.

## Guardas e invariants

- `comisionPct 0..100`, `metaMensual >= 0` (validación zod).
- Solo el manager configura; el dependiente solo lee su progreso.
- La regla pura vive en `src/features/empleados/services/comision-service.ts` (testable
  sin DB); la persistencia y las acciones son capas finas encima.

## Interacciones

- Con PVE: la venta cuenta en cuanto está ENTREGADA/FACTURADA (la FASE del pedido).
- Con DNC: la NC descuenta comisión (más abajo).
- Con arqueo: la comisión no resta caja (es gasto futuro eventual); el reporte avisa que
  es "comisión acumulada no pagada".
- Con facturación fiscal: ninguna. La comisión es interna.

## Métricas y reportes

Cuadre/reportes existentes no se ven afectados (la comisión es un gasto proforma
de RRHH; el revenue queda tal cual). En una fase futura se podría exportar a nómina.

## Riesgos

- **Doble conteo en NC misma venta**: la devolución la vemos reducir *independientemente*
  de la venta original; si una NC devuelve todo menos una parte, solo se cuenta el resto.
  La regla es correcta por diseño.
- **Costo de recomputar el período**: la computación del mes actual en un tenant grande
  (cientos de ventas/día) necesita un índice sobre `Venta(empleadoId, createdAt)`; el esquema
  ya tiene `@@index([tenantId, createdAt])` y que se pueda añadir otro específico queda
  notado.
- **Sin lock historical**: el reporte se deriva siempre del momento; una venta anulada
  posteriormente baja la comisión histórica (decisión deliberada: comisión = verdad actual).
