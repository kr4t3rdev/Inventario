# CT-1 — Integración de la capa formal de contabilidad (tareas y SHAs reales)

**Estado:** cerrado en `origin/main` el 2026-11-04.
**Plan:** `docs/plan-ct1-integracion-capa-formal-2026-10-27.md`
**Cierre:** `docs/ct1-cierre-integracion-capa-formal.md`
**Inventario de partida:** `docs/ct1-s0-inventario.md`

Este archivo reemplaza la lista de tareas de la rama de referencia
(`feat/contabilidad-capa-formal`, `d1d06c4`), que quedó atrás de `main`. Las
tareas que siguen son las que se ejecutaron de verdad, con el commit que las
resuelve.

## Reglas de la integración

- Un slice por commit, sobre `origin/main` actualizado, con push directo a
  `origin/main` y CI verde en el SHA.
- Ningún gate de rollout se enciende: `CONTABILIDAD_FORMAL_MODE` y
  `CONTABILIDAD_FORMAL_NO_CASH_MODE` siguen en `off`.
- Cada writer se integra con su test focal; cada slice deja evidencia en
  `content/docs/modules/contabilidad/capa-formal-emisor-no-cash.md`.
- La rama de referencia no se mezcló: todo se integró por adaptación
  funcional, no por merge global.

## Tareas ejecutadas

| # | Tarea | Estado | Commit | CI |
|---|---|---|---|---|
| 1 | S0 — Inventario del paquete, decisiones D1-D4 y registro en `docs/` | Hecho | `5c025f18`, `5a6bdd76`, `1648f326`, `bd521f67` | — |
| 2 | S4(a) — Reconocimiento formal de la venta de productos (`VENTA_CONTADO`, `VENTA_CREDITO`) | Hecho | `63dc2e83` | `41715514976` |
| 3 | S4(a)-2 — Devengo formal del costo FIFO de la venta (`COSTO_VENTA_DEVENGADO`) | Hecho | `84f8d617` | `41725826650` |
| 4 | S5 — Libros contables formales, conciliación cruzada y su interfaz | Hecho | `0ebf72ef` | `41671810424` |
| 5 | S4(b) — Reconocimiento formal de mermas y producción | Hecho | `68c26b26` | `41642227989` |
| 6 | S4(d) — Emisor formal de anticipos (recepción, aplicación, reverso y devolución) | Hecho | `7f50bf7c` + `ba3a8aff` | `41647462553` |
| 7 | S4(e) — Emisor formal de liquidaciones (`COBRO_CXC`, `COBRO_SERVICIO`, `PAGO_CXP`) y de la venta de servicios | Hecho | `07f289a9`, `c6ead5fc` | `41659296288` |
| 8 | S6(a) — Reversa formal con asiento inverso inmutable | Hecho | `8e589c99` | `41738507653` |
| 9 | S6(b) — Cierre formal del período contable | Hecho | `c732fd6f` | `41776774116` |
| 10 | S6(c) — Reversa formal en gastos reconciliados y nómina | Hecho | `bab9d7a6` | `41778830292` |
| 11 | S7 — Replay histórico gobernado (preflight, aprobación independiente, ejecución y verificación) | Hecho | `d0dfa212` | `41786262240` |
| 12 | S7b — Reconstructor de pagos, compras y servicios en el replay | Hecho | `6d224c0e` | `41789541385` |
| 13 | S8 — Ajustes bancarios e inyecciones de capital (ruta móvil incluida) | Hecho | `11cd1390` | `41795897719` |
| 14 | S7c — Replay de anticipos y métricas del outbox shadow | Hecho | `1cfa16e3` | `41799724819` |
| 15 | S9 — Activación del plan de cuentas (CTA-0) e infraestructura global conciliada contra `main` | Hecho | `7739ad05` | `41805169995` |
| 16 | S10 — Cierre: matriz R0.5 por fila, registro final, verificación completa y CI del SHA final | Hecho | (commit de cierre) | se anota al cerrar |

## Tareas que se descartaron

| Tarea | Motivo |
|---|---|
| S1 — Núcleo formal canónico | Ya estaba en `main` (PR #48, merge `2c86bde1`); solo se contrastó |
| S2 — Esquema y migraciones | Los modelos formales ya existían en `main`; no hubo migración nueva |
| S3 — Caja al día | Los tres puntos de posteo de caja ya existían; S4-S8 ampliaron los emisores |
| `DEVOLUCION_VENTA` | La plantilla existe pero la contrapartida (CxC, saldo a favor o reembolso) exige una decisión de producto |
| Apertura formal por traspaso | Bloqueada por `APERTURA_SALDOS_NO_VERIFICABLES` |

## Pendientes declarados

1. Decidir la contrapartida de `DEVOLUCION_VENTA` y escribir su writer.
2. Habilitar la apertura formal cuando exista evidencia verificable de saldos.
3. Persistir tasa e importe funcional en `InyeccionCapital` para el replay en
   moneda extranjera (requiere cambio de esquema).
4. Extender los failpoints físicos de rollback a los writers que hoy solo tienen
   rollback estructural.
5. Añadir el flag por tenant para `shadow`/`enforce`.
6. Construir el verificador forense autónomo del replay (CT-3).
