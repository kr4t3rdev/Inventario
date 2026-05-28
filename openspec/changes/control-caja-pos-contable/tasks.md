# Tasks: Control de Caja POS y Cuadre Contable Operativo

> **Base**: `design.md` (decisiones Q1-Q4 resueltas)
> **Orden**: Las fases se ejecutan secuencialmente. Dentro de cada fase, las tareas se ejecutan en el orden listado.
> **TDD**: Strict TDD mode activo. `pnpm run test:run` para pruebas.
> **Review**: Cada fase termina con `pnpm run build && pnpm run lint` exitoso.

---

## Fase 1: Schema + Migración

### 1.1 — Agregar modelos y enums al schema.prisma

**Archivos**: `prisma/schema.prisma`

**Qué hacer**:
- Agregar enum `EstadoTurno { ABIERTO, CERRADO }`
- Agregar enum `MetodoPagoVenta { EFECTIVO, TARJETA, TRANSFERENCIA, CREDITO, MIXTO }`
- Agregar model `TurnoPuntoVenta` con todos los campos del spec (sección 3.1)
- Agregar model `ArqueoCaja` con todos los campos del spec (sección 3.3)

**Validar**:
- `pnpm run build` pasa sin errores de tipo.
- `pnpm exec prisma validate` confirma schema válido.

### 1.2 — Extender Venta con turnoId, metodoPago y desglose

**Archivos**: `prisma/schema.prisma`

**Qué hacer**:
- Agregar a `model Venta`:
  - `turnoId String?` con relación a `TurnoPuntoVenta`
  - `metodoPago MetodoPagoVenta?`
  - `montoEfectivo Int?`
  - `montoTarjeta Int?`
  - `montoTransferencia Int?`
  - `montoCredito Int?`

**Validar**: `pnpm exec prisma validate`

### 1.3 — Extender PuntoDeVenta con tipoCaja, almacenId, cuentaContableId

**Archivos**: `prisma/schema.prisma`

**Qué hacer**:
- Agregar a `model PuntoDeVenta`:
  - `tipoCaja String? @default("PRINCIPAL")` — PRINCIPAL | SECUNDARIA | MOVIL
  - `almacenId String?` con relación a `Almacen`
  - `cuentaContableId String?`

### 1.4 — Generar migración + script backfill LEGACY

**Archivos**: `prisma/migrations/`, script SQL adjunto

**Qué hacer**:
- `pnpm exec prisma migrate dev --name control-caja-pos`
- Agregar en la migración el SQL de backfill (del spec sección 7.1):
  - Crear `turnos_punto_venta` LEGACY por cada (tenant, puntoDeVenta) con ventas
  - Asignar `turnoId` a ventas huérfanas
  - Setear `tipoCaja = 'PRINCIPAL'` en PuntoDeVenta donde sea NULL
- Crear índice parcial SQL nativo para validar turno único ABIERTO:
  ```sql
  CREATE UNIQUE INDEX idx_un_turno_abierto_por_pv
  ON turnos_punto_venta ("puntoDeVentaId")
  WHERE estado = 'ABIERTO';
  ```

**Validar**:
- `pnpm exec prisma migrate dev` ejecuta sin errores.
- Verificar en BD que las ventas existentes tienen `turnoId` asignado.
- `pnpm run build` pasa.

---

## Fase 2: Server Actions base

### 2.1 — Crear feature turnos-pos (schemas, types, barrel)

**Archivos**: 
- `src/features/turnos-pos/schemas.ts`
- `src/features/turnos-pos/types.ts`
- `src/features/turnos-pos/index.ts`

**Qué hacer**:
- `schemas.ts`: Zod schemas para `abrirTurnoSchema`, `cerrarTurnoSchema`, `listarTurnosSchema`
- `types.ts`: re-exportar tipos de Prisma
- `index.ts`: barrel export de actions

**Validar**: `pnpm run build`

### 2.2 — abrirTurnoAction

**Archivos**: `src/features/turnos-pos/actions.ts`

**Qué hacer**:
- Action que recibe `{ puntoDeVentaId, empleadoId?, fondoInicialCup?, fondoInicialUsd? }`
- Validar que no exista otro turno ABIERTO en el mismo POS (consulta explícita en la app)
- Validar `fondoInicialCup >= 0`, `fondoInicialUsd >= 0`
- Crear `TurnoPuntoVenta` con estado ABIERTO
- Devolver el turno creado
- `revalidatePath('/busy/puntosDeVenta')`
- `revalidatePath('/busy/sales')`

### 2.3 — getTurnosAction

**Archivos**: `src/features/turnos-pos/actions.ts`

**Qué hacer**:
- Action con filtros opcionales: `puntoDeVentaId`, `fecha`, `estado`
- Query con `where` dinámico
- Incluir puntoDeVenta y arqueo (si existe) en la respuesta

### 2.4 — cerrarTurnoAction

**Archivos**: `src/features/turnos-pos/actions.ts`

**Qué hacer**:
- Action que recibe `{ turnoId, forzar?: boolean }`
- Validar que el turno existe, está ABIERTO y pertenece al tenant
- Si `forzar=false` y no hay arqueo: devolver `{ warning: true, message: 'No hay arqueo registrado' }` sin cerrar
- Si `forzar=true`: cerrar sin arqueo, registrar `observaciones: 'Cerrado sin arqueo'`
- Setear `fechaCierre = now()`, `estado = CERRADO`

### 2.5 — Turno automático para POS MOVIL/SECUNDARIA

**Archivos**: `src/features/turnos-pos/actions.ts`

**Qué hacer**:
- Action interna (no expuesta como API pública) o lógica dentro de `abrirTurnoAction`
- Si `puntoDeVenta.tipoCaja` es `MOVIL` o `SECUNDARIA`:
  - Crear turno automático con `fondoInicialCup = 0`, `fondoInicialUsd = 0`, `tipo = 'AUTO'`
  - Asignar `empleadoId` del usuario autenticado si está disponible
- Función separada `getOrCreateTurnoActivo(puntoDeVentaId, user)` usada por `createVentaAction`

### 2.6 — Extender createVentaSchema con metodoPago

**Archivos**: `src/features/ventas/schemas.ts`

**Qué hacer**:
- Agregar al schema `createVentaSchema`:
  - `turnoId: z.string().optional()` (opcional para compatibilidad LEGACY)
  - `metodoPago: z.nativeEnum(MetodoPagoVenta).optional()`
  - `montoEfectivo: z.number().int().min(0).optional()`
  - `montoTarjeta: z.number().int().min(0).optional()`
  - `montoTransferencia: z.number().int().min(0).optional()`
  - `montoCredito: z.number().int().min(0).optional()`
- Validación custom: si `metodoPago = MIXTO`, la suma de montos desglosados DEBE ser exactamente igual al total de la venta. Usar `.refine()` en Zod.
- Si `metodoPago = EFECTIVO`, entonces `montoEfectivo` SHOULD ser igual al total.
- Exportar `CreateVentaInput` actualizado.

### 2.7 — Extender createVentaAction

**Archivos**: `src/features/ventas/actions.ts`

**Qué hacer**:
- Si no se provee `turnoId`:
  - Llamar a `getOrCreateTurnoActivo(puntoDeVentaId, user)` (de 2.5)
  - Si el POS es PRINCIPAL y no hay turno ABIERTO, rechazar con error
- Si se provee `metodoPago`:
  - Guardar en la Venta los campos nuevos
  - Si es MIXTO, validar que la suma de montos == total
- Mantener compatibilidad con LEGACY: si no hay turno y no se puede crear, asignar al turno LEGACY del POS.

---

## Fase 3: Arqueo

### 3.1 — Crear feature arqueo-caja (schemas, types, barrel)

**Archivos**:
- `src/features/arqueo-caja/schemas.ts`
- `src/features/arqueo-caja/types.ts`
- `src/features/arqueo-caja/index.ts`

**Qué hacer**:
- `schemas.ts`: Zod schema para `realizarArqueoSchema` con todos los campos de conteo (billetes 1000/500/200/100/50/20 CUP, billetes USD, monedas, totales tarjeta/transferencia/credito)
- Validación: montos individuales >= 0
- `types.ts`: re-exportar tipos de Prisma + `ArqueoInput`

### 3.2 — getEsperadosArqueoAction

**Archivos**: `src/features/arqueo-caja/actions.ts`

**Qué hacer**:
- Action que recibe `turnoId`
- Obtiene el turno con sus ventas
- Calcula:
  - `esperadoEfectivoCup = turno.fondoInicialCup + sum(ventas.montoEfectivo where metodoPago in (EFECTIVO, MIXTO))`
  - `esperadoEfectivoUsd = turno.fondoInicialUsd`
  - `esperadoTarjeta = sum(ventas.montoTarjeta)`
  - `esperadoTransferencia = sum(ventas.montoTransferencia)`
  - `esperadoCredito = sum(ventas.montoCredito)`
- Devuelve los esperados para que el UI los muestre antes del arqueo

### 3.3 — realizarArqueoAction

**Archivos**: `src/features/arqueo-caja/actions.ts`

**Qué hacer**:
- Action que recibe `{ turnoId, ...conteo }`
- Validar que el turno existe, ABIERTO, del tenant
- Calcular totales físicos:
  - `totalEfectivoCup = billetes1000*100000 + billetes500*50000 + billetes200*20000 + billetes100*10000 + billetes50*5000 + billetes20*2000 + monedasCup`
  - `totalEfectivoUsd = billetes100*10000 + billetes50*5000 + ... + monedasUsd` (en centavos de USD)
- Obtener esperados (reusa lógica de 3.2)
- Calcular diferencias:
  - `diferenciaCup = totalEfectivoCup - esperadoEfectivoCup`
  - `diferenciaUsd = totalEfectivoUsd - esperadoEfectivoUsd`
- Crear ArqueoCaja
- Cerrar el turno (estado = CERRADO, fechaCierre = now())
- Si diferencia > 0 (umbral configurable): advertencia en la respuesta
- `revalidatePath('/busy/puntosDeVenta')`

---

## Fase 4: Integración contable

### 4.1 — integrarArqueosEnPeriodoAction

**Archivos**: `src/features/contabilidad/actions-periodos.ts`

**Qué hacer**:
- Action que recibe `periodoId`
- Obtiene periodo y verifica que pertenece al tenant
- Busca todos los arqueos del periodo con `contabilizado = false`
- Acumula arqueos y ventas por metodoPago en `detalleJson`
- Upsert en `AperturaPeriodo.detalleJson`
- Marca `ArqueoCaja.contabilizado = true`
- Devuelve `{ arqueosIntegrados: number }`

### 4.2 — Trigger en cerrarPeriodoAction

**Archivos**: `src/features/contabilidad/actions-periodos.ts`

**Qué hacer**:
- En `cerrarPeriodoAction`, antes de cambiar el estado del periodo, llamar a la lógica de `integrarArqueosEnPeriodo`
- Si hay arqueos sin contabilizar y no se pudieron integrar, rechazar el cierre con error claro
- Agregar el resultado al `resumenJson` del periodo

---

## Fase 5: UI de Turno

### 5.1 — AperturaTurnoDialog

**Archivos**: `src/features/turnos-pos/components/apertura-turno-dialog.tsx`

**Qué hacer**:
- Diálogo modal que extiende `Dialog` de shadcn
- Campos:
  - Selector de empleado (cajero) — usar `getEmpleadosAction`
  - Input numérico para `fondoInicialCup` (formateado como moneda, ej: $500.00)
  - Input numérico para `fondoInicialUsd`
  - Textarea para observaciones (opcional)
- Al submit: llama a `abrirTurnoAction`
- Maneja estados loading, error, success

### 5.2 — CabeceraTurno

**Archivos**: `src/features/turnos-pos/components/cabecera-turno.tsx`

**Qué hacer**:
- Componente que recibe `turno: TurnoPuntoVenta`
- Muestra:
  - Indicador 🟢/🔴 según estado
  - Número de turno (ID corto)
  - Nombre del empleado/cajero
  - Fondo inicial formateado
  - Total de ventas del turno (suma calculada)
  - Cantidad de tickets (ventas.length)
- Botones: [Cerrar Turno] → abre `CierreTurnoDialog`, [Ver Arqueo] → navega a arqueo

### 5.3 — CierreTurnoDialog

**Archivos**: `src/features/turnos-pos/components/cierre-turno-dialog.tsx`

**Qué hacer**:
- Diálogo que muestra resumen del turno antes de cerrar
- Si NO hay arqueo: muestra advertencia `⚠️ No se ha realizado arqueo` y permite cerrar con flag `forzar: true`
- Llamada a `cerrarTurnoAction`
- Botones: [Cancelar], [Cerrar sin arqueo] (forzar), [Ir a Arqueo]

### 5.4 — Integrar CabeceraTurno en pv-interface.tsx

**Archivos**: `src/features/ventas/components/pv-interface.tsx`

**Qué hacer**:
- Al cargar el POS (cuando cambia `selectedPuntoVenta`), obtener el turno activo via `getTurnosAction({ puntoDeVentaId, estado: 'ABIERTO' })`
- Si hay turno activo: mostrar `CabeceraTurno` arriba del grid de productos
- Si no hay turno activo Y tipoCaja = PRINCIPAL: mostrar botón "Abrir Turno" que abre `AperturaTurnoDialog`
- Si no hay turno activo Y tipoCaja = MOVIL/SECUNDARIA: crear turno automático (no requiere UI)

### 5.5 — Estado de turno en punto de venta (flujo completo)

**Archivos**: `src/features/ventas/components/pv-interface.tsx`

**Qué hacer**:
- Al seleccionar un POS, verificar estado del turno
- Si el turno se cierra durante la sesión, recargar estado
- Si el turno se abre desde el diálogo, refrescar cabecera
- Integrar botón de cierre en cabecera que abre `CierreTurnoDialog`

---

## Fase 6: UI de Arqueo

### 6.1 — ConteoBilletes

**Archivos**: `src/features/arqueo-caja/components/conteo-billetes.tsx`

**Qué hacer**:
- Componente reutilizable que renderiza filas de denominación + input de cantidad
- Props: `denominaciones: Array<{ valor: number, label: string, campo: string }>`, `onChange`, `moneda: 'CUP' | 'USD'`
- Calcula subtotal por denominación en tiempo real (cantidad × valor)
- Muestra total de la moneda en tiempo real
- Estilo: inputs numéricos con increment/decrement buttons

### 6.2 — ResumenDiferencias

**Archivos**: `src/features/arqueo-caja/components/resumen-diferencias.tsx`

**Qué hacer**:
- Componente que recibe `esperados: {...}` y `contados: {...}`
- Tabla comparativa por concepto (Efectivo CUP, Efectivo USD, Tarjeta, Transferencia, Crédito)
- Cada fila: Concepto | Contado | Esperado | Diferencia | Indicador ✅/⚠️/🔴
- Diferencia se colorea: verde si = 0, amarillo si |diferencia| < umbral, rojo si excede

### 6.3 — ArqueoForm

**Archivos**: `src/features/arqueo-caja/components/arqueo-form.tsx`

**Qué hacer**:
- Pantalla/diálogo completo de arqueo
- Carga los esperados via `getEsperadosArqueoAction(turnoId)` al montar
- Sección Efectivo CUP: usa `ConteoBilletes` con denominaciones cubanas
- Sección Efectivo USD: usa `ConteoBilletes` con denominaciones americanas
- Inputs para totalTarjeta, totalTransferencia, totalCredito (pre-cargados con esperados)
- Resumen de diferencias en vivo usando `ResumenDiferencias`
- Botón [Confirmar Arqueo] que llama a `realizarArqueoAction`
- Si hay diferencias significativas: confirmación extra antes de enviar

---

## Fase 7: Cuadre Diario mejorado

### 7.1 — Extender getCuadreDiarioAction

**Archivos**: `src/features/cuadre-diario/actions.ts`

**Qué hacer**:
- En lugar de `efectivoInicial: 0` y `efectivoFinal: 0`:
  - Obtener turnos del día con sus fondos iniciales
  - Obtener arqueos del día
  - Calcular `efectivoInicial = sum(turnos.fondoInicialCup)`
  - Calcular `efectivoFinal = sum(arqueos.totalEfectivoCup)` (si hay arqueo) o usar esperados
- Agregar al resumen:
  - `ventasPorMetodoPago: Record<string, number>` — desglose desde Venta.metodoPago
  - `turnosDelDia: TurnoResumen[]` — lista de turnos con su estado, fechas, cajero
  - `arqueosDelDia: ArqueoResumen[]` — lista con diferencias
  - `saldoEfectivoEsperado: number` — fondo inicial + ventas efectivo - retiros
  - `diferenciaTotalCup: number` — suma de diferencias de arqueos

### 7.2 — Actualizar UI CuadreDiarioFinanciero

**Archivos**: `src/features/cuadre-diario/components/cuadre-diario.tsx`

**Qué hacer**:
- Agregar sección "Saldos de Caja" con:
  - Efectivo Inicial (del día)
  - Efectivo Final (arqueado)
  - Diferencia
- Agregar sección "Ventas por Método de Pago" con gráfico de barras o pastel
- Agregar sección "Turnos del Día" con tabla colapsable
- Agregar sección "Resumen de Arqueos" con tabla de diferencias
- Mantener todas las secciones existentes (resumen financiero, gastos, etc.)

---

## Fase 8: Tests

### 8.1 — Tests de abrirTurnoAction

**Archivos**: `src/features/turnos-pos/__tests__/actions.test.ts`

**Qué probar**:
- Abrir turno en POS sin turno activo → éxito
- Abrir turno con fondoInicialCup = 50000 → fondo registrado correctamente
- Abrir turno cuando ya hay uno ABIERTO → error
- Abrir turno con fondo negativo → error de validación

### 8.2 — Tests de createVentaAction con metodoPago y turno

**Archivos**: `src/features/ventas/__tests__/actions.test.ts`

**Qué probar**:
- Venta con metodoPago EFECTIVO y montoEfectivo = total → éxito
- Venta con metodoPago MIXTO y desglose que suma al total → éxito
- Venta MIXTO con desglose que NO suma al total → error
- Venta sin turno en PRINCIPAL → error
- Venta sin turno en MOVIL → turno automático creado + venta exitosa
- Venta LEGACY (turnoId explicito al turno LEGACY) → éxito

### 8.3 — Tests de realizarArqueoAction

**Archivos**: `src/features/arqueo-caja/__tests__/actions.test.ts`

**Qué probar**:
- Arqueo donde contado = esperado → éxito, diferencia 0
- Arqueo con faltante (contado < esperado) → éxito con advertencia
- Arqueo con sobrante (contado > esperado) → éxito con advertencia
- Arqueo en turno que no existe → error
- Arqueo en turno ya cerrado → error

### 8.4 — Tests de integrarArqueosEnPeriodoAction

**Archivos**: `src/features/contabilidad/__tests__/actions-periodos.test.ts` o nuevo file

**Qué probar**:
- Integrar arqueos de un periodo con datos → arqueos contabilizados = true
- detalleJson contiene los arqueos y ventasPorMetodoPago
- Llamar dos veces integra solo los nuevos (contabilizado = false)
- Periodo no encontrado → error

### 8.5 — Tests de migración (backfill LEGACY)

**Archivos**: `src/__tests__/production/migracion-legacy.test.ts`

**Qué probar**:
- Simular BD con ventas sin turnoId
- Ejecutar script de backfill
- Verificar que se crearon turnos LEGACY
- Verificar que las ventas tienen turnoId asignado
- Verificar que no quedan ventas con turnoId NULL

---

## Resumen de esfuerzo

| Fase | Tareas | Archivos nuevos | Archivos modificados | Estimación |
|------|--------|----------------|---------------------|-----------|
| F1: Schema | 5 | 0 | 3 | 3-4h |
| F2: Actions base | 7 | 4+ | 3+ | 4-5h |
| F3: Arqueo | 3 | 4+ | 0 | 4-5h |
| F4: Contable | 2 | 0 | 1 | 2-3h |
| F5: UI Turno | 5 | 3 | 2 | 4-6h |
| F6: UI Arqueo | 3 | 3 | 0 | 5-6h |
| F7: Cuadre | 2 | 0 | 2 | 3-4h |
| F8: Tests | 5 | 4 | 1 | 4-5h |
| **Total** | **32** | **18+** | **12+** | **29-38h** |
