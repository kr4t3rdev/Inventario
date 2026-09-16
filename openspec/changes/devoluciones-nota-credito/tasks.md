# Tasks — DNC Devoluciones parciales y nota de crédito

Plan SDD/TDD. Reglas: RED con fallo guardado → GREEN mínimo → REFACTOR; prisma mockeado en
unitarios (contrato MM-B vigente: DB real inalcanzable, integración solo en
`__integration__/` con `pnpm test:integration`); rutas explícitas al correr vitest; code
review con typescript-reviewer y commit por fase con **stage selectivo** (el worktree vive
sucio: jamás `git add -A`). Evidencias en `evidence/` dentro de este change
(`evidence/DNC-Tx-RED.txt`, `evidence/DNC-Tx-GREEN.txt`).

## DNC-T1 — Modelo de datos + permisos ✅

- [x] **T1.1 Spike documentado** (ver sección "Resultado del spike T1.1" en design.md):
  consumidores de `anticipo.contrato` null-safe; `Factura.tipoDocumento` sin cambios;
  `Anticipo.facturaId` confirmado libre/único.
- [x] **T1.2 Schema + migración.** `DevolucionVenta`, `DevolucionVentaItem`,
  `EstadoDevolucion`, `ContextoAnticipo.NOTA_CREDITO`, `Anticipo.contratoId` opcional y
  back-relations; migración `20260914240000_add_devoluciones_nota_credito` (generada con
  `migrate diff` offline por falta de DATABASE_URL en la shell del agente) + `prisma generate`.
  Nota de operación: un edit intermedio se detectó corrupto vía `prisma validate`
  (`references: [productoId]` en VentaItem) y se revirtió antes de commit — sin efecto residual.
  Regresión anticipos/ventas: 123 archivos / 1062 tests verdes.
- [x] **T1.3/T1.4 Permisos.** `ventas.devolucion.registrar` (manager/economico, sensitive) y
  `ventas.devolucion.reembolso` (manager, sensitive) con RED de paridad auténtico
  (`evidence/DNC-T1-RED.txt`) y fixture actualizado; suite auth 77/77 (`DNC-T1-GREEN.txt`).
- [x] **T1.5 Schema Zod.** `registrarDevolucionSchema` + `devolucion-schema.test.ts` (6/6).
- Commit: `feat(ventas): modelo DevolucionVenta, serie NC y permisos de devoluciones (DNC-T1)`

## DNC-T2 — Motor de dominio puro ✅

- [x] **T2.1 RED.** `devolucion-calculo.test.ts` (18 casos). Evidencia `evidence/DNC-T2-RED.txt`.
- [x] **T2.2 GREEN.** `src/features/ventas/services/devolucion-calculo.ts` puro:
  `calcularDisponibles`, `calcularMontosDevolucion` (con cap adicional por subtotal del ítem,
  detectado en diseño de tests: descuento degenerado nunca hace total negativo) y
  `resolverTratamientoFinanciero` (conserva el total; reembolso con permiso + turno abierto).
  Evidencia `evidence/DNC-T2-GREEN.txt`.
- [x] **T2.3 Review** typescript-reviewer: (aprobado sin bloqueantes; ver commit).
- Commit: `feat(ventas): cálculo puro de devoluciones y cascada financiera (DNC-T2)`

## DNC-T3 — Servicio transaccional de registro ✅

- [x] **T3.1 RED unitario** (`devolucion-service.test.ts`, 14 casos) + T3.4 integración real
  multi-lote pasando contra Postgres 17 local. Evidencia `evidence/DNC-T3-RED.txt`.
- [x] **T3.2 GREEN.** `devolucion-venta-service.ts` (tx Serializable + FOR UPDATE; replay por
  key con verificación de venta → IDEMPOTENCIA_CONFLICTO; NC con serie NC- vía upsert real;
  cascada CxC multi-cuenta + saldo a favor (createAnticipoDevolucion, contexto NOTA_CREDITO) +
  reembolso ligado al turno ABIERTO actual). `restaurarAllocacionesFifo` (orden FIFO ASC,
  costo ponderado) con tests propios. Venta sin cliente con excedente → CLIENTE_REQUERIDO
  orientativo (H1 del review). Nota: PVE ya desplegado en esta rama → la guarda usa
  `estado IN (ENTREGADA, FACTURADA)` desde ya (el TODO(PVE) quedó resuelto).
- [x] **T3.3 Arqueo.** `getReembolsosTurnoCup` aplicado en getEsperadosArqueoAction,
  realizarArqueoAction y ruta mobile; test cubriendo resta y caso sin reembolsos.
- [x] **T3.4 Integración real.** Dos lotes a distinto costo, venta cruzada, devolución parcial:
  stock/kardex ponderado/allocations/NC/cascada/replay verificados en `tcp_test_local`.
  NOTA operativa: el sandbox carecía de test DB viva; se creó `tcp_test_local` en el Postgres
  local (sin docker). Ci solo la verá con `migrate deploy` propiamente.
- [x] **T3.5 Review typescript-reviewer** → APROBAR con observaciones; fixes aplicados: H1
  (cliente requerido para saldo a favor), M1 (upsert serie NC), M2 (fingerprint por ventaId),
  M3 (facturación evaluada post-lock), sentinel de ubicación eliminado. Suites scoped:
  485/485 verdes + integración real verde + typecheck limpio + lint limpio.
  Evidencia `evidence/DNC-T3-GREEN.txt`.
- Commit: `feat(ventas): registro transaccional de devoluciones con nota de crédito (DNC-T3)`

## DNC-T4 — Actions, UI y bloqueo de anulación ✅

- [x] **T4.1 Actions** `src/features/ventas/actions-devoluciones.ts` (contexto con
  disponibilidad por ítem, saldo CxC y turno abierto; registrar; listar por venta) +
  `devoluciones-actions.test.ts` (4). Evidencia `evidence/DNC-T4-GREEN.txt` (184/184 scoped).
- [x] **T4.2 UI.** `devolucion-wizard.tsx` (ítems con máximo disponible, motivo, resumen
  financiero con prorrateo de descuento del motor, radios con motivos de deshabilitación,
  idempotencyKey por apertura, submit bloqueado sin canal válido); botón Devolver + badge "NC"
  en la tabla de ventas; filtro `NOTA_CREDITO` en facturas (page → action → read-service).
- [x] **T4.3 Bloqueo de anulación.** Guarda `VENTA_CON_DEVOLUCIONES` dentro de la tx (tras el
  lock, antes del claim) en `anularVentaPorEstado` + test; PEDIDO exento. Mocks
  `devolucionVenta.count` añadidos a las suites existentes (regresión verde).
- [x] **T4.4 Review** typescript-reviewer: BLOQUEO por cast `as unknown` del badge (HIGH, tipo
  real añadido a `Venta`) + MEDIUM del wizard (efecto estable, prorrateo en preview, default
  financiero sin cliente, input entero) — todos corregidos en la misma fase.
- Commit: `feat(ventas): wizard de devoluciones, filtro NC y bloqueo de anulación (DNC-T4)`

## DNC-T5 — Reportes, review final y cierre

- [ ] **DNC-T5.1 Inventario de consumidores.** Grep de lecturas de ventas con
  `deletedAt: null` (cuadre diario/turno, reportes de ventas, rentabilidad FIFO, dashboard);
  lista anotada en la evidencia de la fase.
- [ ] **DNC-T5.2 Neteo.** Línea "Devoluciones" y "Ventas netas" en cuadre y reporte de
  ventas; rentabilidad resta `Σ cantidad × costoUnitarioDevolucion` usando el campo
  persistido (sin recalcular FIFO en el reporte). Tests donde el patrón del archivo lo
  permita; ajuste mínimo por consumidor.
- [ ] **DNC-T5.3 Review global typescript-reviewer** del diff completo del change; fixes
  bloqueantes dentro de la fase, fast-follows documentados.
- [ ] **DNC-T5.4 Regresión.** Suites `src/features/ventas src/features/arqueo-caja
  src/features/turnos-pos src/features/facturas src/lib/services src/lib/auth
  src/app/api/mobile/pos` verdes; `tsc --noEmit` limpio; `pnpm run lint` sin errores en
  archivos tocados; quistes pre-existentes anotados como en LP-0.
  Evidencia `evidence/DNC-T5-GREEN.txt`.
- [ ] **DNC-T5.5 Smoke manual post-deploy** (checklist, sin E2E): venta a crédito con CxC →
  devolución parcial → CxC reducida + NC lista; venta de contado → devolución con saldo a
  favor → anticipo usable en el POS; reembolso con turno abierto → arqueo descuenta;
  anulación bloqueada con devoluciones; tenant sin `facturacion` devuelve sin NC.
- [ ] **DNC-T5.6 Archivo.** Mover el change a
  `openspec/changes/archive/2026-09-14-devoluciones-nota-credito/` y actualizar memorias.
- Commit: `feat(ventas): neteo de devoluciones en reportes y cuadre (DNC-T5)` +
  `docs(openspec): cerrar DNC devoluciones y nota de crédito`
