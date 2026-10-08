# Capa de contabilidad formal

> Plan de cuentas por tenant, asientos de partida doble y libros formales construidos como capa aditiva sobre la base caja. Fuente de verdad del cambio: `openspec/changes/contabilidad-capa-formal/` (proposal, spec, design, tasks y matriz de writers R0.5/R6).

## Qué es

Cada evento de negocio (venta, cobro, pago, gasto, nómina, anticipo, préstamo, deuda, ajuste, transferencia, inyección de capital, merma, producción, devolución) genera —además de su escritura operativa— un **asiento contable de partida doble** en la misma transacción. La base caja sigue siendo la fuente operativa; la capa formal es el registro auditable (libro diario, mayor, balance de comprobación) del que se derivan el Balance y el P&L con soporte línea a línea.

Invariantes (verificados por test, no por convención):

- El asiento se persiste solo si `Σdebe = Σhaber` con **Decimal exacto** (máximo 4 decimales, sin redondeo implícito; cualquier exceso de precisión se rechaza).
- Idempotencia por origen: `(tenantId, origenTipo, origenId)` es único; reintentar un evento no duplica el asiento.
- Cada asiento encadena un `hash` SHA-256 con el asiento anterior del tenant; el verificador permite señalar el punto exacto de alteración.
- Los asientos contabilizados no se editan ni se borran: la corrección es un **asiento inverso**.

## Modos de despliegue

| Modo (`CONTABILIDAD_FORMAL_MODE`) | Comportamiento |
|---|---|
| `off` (default) | El motor no escribe nada; la operación sigue igual. |
| `shadow` | El motor intenta el asiento dentro de un **savepoint de la transacción del writer**; cualquier error se registra como evidencia en un outbox transaccional visible solo tras el commit, y nunca rompe la operación. |
| `enforce` | El asiento es obligatorio: sin plan inicializado, sin rol mapeado o sin cuadre, la operación se rechaza y revierte. |

El modo habilita el motor; la UI y los gates se controlan aparte con el feature flag `contabilidad-formal` por plan/licencia del tenant. Un tenant sin flag **nunca** se ve afectado, incluso con modo enforce global.

## Plan de cuentas y apertura

- `inicializarPlanContableAction` siembra 7 diarios y el plan por defecto (~32 cuentas, 23 roles mapeados), idempotente.
- La **apertura inicial** de un tenant exige declaración manual con evidencia y revisión maker/checker (`financiero.apertura.presentar` + `financiero.apertura.aprobar`, actores distintos revalidados en transacción). Las revisiones presentadas quedan congeladas por triggers de base de datos; no se crean revisiones sustitutivas tras la aprobación — la corrección posterior se hace con asiento inverso (decisión de contrato del 2026-10-03).
- El **rollover** de un período nuevo solo procede si el período inmediatamente anterior está APROBADO y la apertura referencia ese período (`origenPeriodoId`); el traspaso de resultado se postea una sola vez.

## Cierre

- En `enforce`, ningún período pasa a `CERRADO`/`APROBADO` sin asiento formal de cierre; si no puede producirse, la transición se rechaza (política R3.10 confirmada por el usuario el 2026-09-30: el cierre de un período sin actividad es opcional, no se crea asiento en cero).
- El cierre vacía las cuentas de resultado contra `RESULTADO_PERIODO` (utilidad al haber, pérdida al debe), con importes no negativos y cuadre exacto; la apertura siguiente traspasa ese resultado a `RESULTADOS_ACUMULADOS`.

## Libros y conciliación

- Libro diario, mayor por cuenta y balance de comprobación (4 columnas cuadradas) se sirven por server actions con `requireFeature('contabilidad-formal')`.
- El panel de conciliación cruzada compara saldos por cuentas contra la base caja; un rubro sin contraparte comparable queda **NO_EVALUABLE** y bloquea el paso a `enforce` (regla R0.4).

## Replay histórico (opt-in)

- Dry-run persistido (`ReplayPreflight`) con digest SHA-256; la ejecución exige aprobación explícita de un **manager** (`ReplayApproval`) dentro de la **vigencia de 24 horas** del preflight y sin hallazgos bloqueantes.
- Ante incidente: volver el modo a `off` para el tenant, detener el replay, preservar asientos y evidencia (nada se borra), diagnosticar y repetir la ventana shadow antes de reactivar.

## Cobertura y límites declarados

La matriz de writers (`openspec/changes/contabilidad-capa-formal/matriz-writers-r0.5.md`) es el inventario vigente: 39 callsites en 24 archivos. Como cualquier evidencia por etiqueta `[x]`, las filas documentan cobertura observada por corrida — no reemplazan el gate operativo **R7.3** (≥7 días reales de shadow por tenant antes de enforce). Los cambios operativos siguen sin estar activados por defecto en producción.
