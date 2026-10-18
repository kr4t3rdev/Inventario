# Design — Transferencias: cierre de flujo (Sesión B)

## Contexto

`Transferencia.estado` es un `String` de Prisma (sin enum de BD), con máquina
de estados solo implícita en las actions. Hoy en main:

- `createTransferenciaAction` crea por producto con
  `estado: parsed.estado ?? 'COMPLETADA'` (acepta cualquiera de los 6 estados,
  incluidos absurdos como `RECHAZADA`).
- `aprobarTransferenciaAction`: PENDIENTE → APROBADA (permiso
  `inventario.transferencias.aprobar`), sin movimiento de stock.
- `completarTransferenciaAction`: {APROBADA, EN_TRANSITO} → COMPLETADA,
  calcula `esParcial` pero persiste siempre `COMPLETADA` (fantasma), mueve
  `cantidadRecibida`, y no exige permiso.
- `EN_TRANSITO` no tiene productor: es inalcanzable.
- `updateTransferenciaSchema.estado` se parsea y jamás se lee (input muerto).
- El kardex (`registrarMovimiento`) es idempotente por clave de evento
  (tenant, origen, producto, ubicación, secuencia): una segunda escritura con
  la misma secuencia es ignorada silenciosamente.

## Decisiones

### D1 — Máquina de estados objetivo

```
PENDIENTE ─aprobar(jefatura)→ APROBADA ─despachar(operación)→ EN_TRANSITO ─┐
     │                                      └──────completar(directo)──────┤
     └rechazar→ RECHAZADA                                                  ├→ COMPLETADA
                                                  EN_TRANSITO/PARCIAL ─completar(parcial)→ PARCIAL
```

- `despachar` es operativo (`inventario.transferencias.gestionar`), no mueve
  stock (la salida física se registra al recibir, igual que hoy).
- `completar` sigue aceptando `APROBADA` (despacho y recepción en un paso,
  compatibilidad) y además `PARCIAL` (recepciones adicionales).

### D2 — PARCIAL acumulativo sobre la misma fila

`cantidadRecibida` del input pasa a significar *unidades recibidas en esta
recepción*. Dentro de la transacción:

- `previa = transferencia.cantidadRecibida ?? 0`
- `pendiente = cantidad - previa`; rechazar si `input > pendiente`.
- `acumulado = previa + input`
- `acumulado < cantidad` → persistir `estado: 'PARCIAL'`,
  `cantidadRecibida: acumulado`, descripción con evidencia.
- `acumulado === cantidad` → persistir `estado: 'COMPLETADA'`,
  `cantidadRecibida: cantidad`; si hubo recepciones previas, la descripción
  queda como evidencia del cierre (si no, no se toca, compatibilidad).

### D3 — Claim condicional para serializar recepciones concurrentes

El `updateMany` de claim incluye el valor previo conocido:

```ts
where: { transferenciaId, tenantId, deletedAt: null,
          estado: { in: ['APROBADA','EN_TRANSITO','PARCIAL'] },
          cantidadRecibida: previa === 0 ? null : previa },
```

Con dos recepciones concurrentes, solo la primera gana el claim; la segunda
cae al camino de conflicto (ya no puede duplicar delta de stock). El delta de
stock es `acumulado - previa`, nunca el total enviado.

### D4 — Kardex con secuencia por recepción

Antes de registrar, se cuentan las líneas `ENTRADA` del documento
(`getMovimientosDeOrigen`) y se usa `ENTRADA-n`/`SALIDA-n` con ese `n`:
primera recepción → `SALIDA-0`/`ENTRADA-0` (idéntico a hoy, tests y datos
compatibles), segunda → `-1`, etc. La idempotencia por clave de evento se
conserva.

### D5 — Cancelación y edición de PARCIAL

- `deleteTransferenciaAction` revierte stock y kardex también cuando el estado
  es `PARCIAL` (delta = `cantidadRecibida` recibida hasta el momento);
  `revertirMovimientosDeOrigen` ya compensa todas las líneas del documento.
- `updateTransferenciaAction` rechaza editar transferencias `EN_TRANSITO` o
  `PARCIAL` (mercancía en camino o recepción iniciada). El resto de los
  comportamientos de edición (incluida la resincronización de COMPLETADA) no
  se tocan.

### D6 — Permisos simétricos

`completar` y `despachar` exigen `inventario.transferencias.gestionar`
(existente en el registry). Esto cierra la asimetría del hallazgo #5 y coincide
con lo hecho en Sesión A (A-4): al re-integrar esa rama vía revert-del-revert,
la línea idéntica se auto-resuelve en el merge.

### D7 — Sin migración de base de datos

`estado` es `String`; `PARCIAL` ya está en `EstadoTransferencia` (capa UI) y
se agrega a `TRANSFERENCIA_ESTADOS` de Zod. No hay `ALTER TYPE` ni backfill:
no existen filas PARCIAL históricas (el estado era inalcanzable) y las filas
fantasma `COMPLETADA` con `cantidadRecibida < cantidad` se dejan como están
(evidencia conservada en descripción); opcionalmente un backfill futuro puede
recategorizarlas.

### D8 — Creación con estados coherentes

`createTransferenciaSchema.estado` se restringe a `PENDIENTE | COMPLETADA`
(los únicos dos que la UI envía y los únicos coherentes al crear). Cierra la
creación directa en `EN_TRANSITO`/`RECHAZADA`/`CANCELADA`/`PARCIAL`.

### D9 — Retiro del input muerto

`updateTransferenciaSchema` pierde `estado`; `UpdateTransferenciaInput` se
reduce. Zod strips la clave desconocida, así que payloads viejos que la envíen
siguen funcionando sin efecto.

### D10 — Higiene de logs

Se eliminan los `console.log('=== ...')` y `console.error` con datos de
negocio de `createTransferenciaAction`. Se conservan solo: el `console.warn`
de reintento por colisión de numeración (sin datos) y un `console.error`
genérico si falla la notificación.

### D11 — Checklists openspec

Verificar ítem por ítem contra el código actual antes de marcar; los no
cumplidos se dejan abiertos y se nota en el change. Luego ambos changes se
mueven a `openspec/changes/archive/2026-09-26-<nombre>/` (convención de
prefijo de fecha del repo).

## UI

- Tabla: item "Despachar" (icono Truck) para `APROBADA`; "Confirmar Recepción"
  también para `PARCIAL`; la columna cantidad muestra `recibida/enviada` en
  filas PARCIAL. Helpers puros `puedeDespachar`/`puedeConfirmarRecepcion` en
  `src/features/transferencias/lib/estados.ts` (testeables sin render).
- Diálogo de recepción: para una fila PARCIAL prellena el faltante
  (`cantidad - cantidadRecibida`), muestra "ya recibidas X de Y" y el tope es
  el pendiente. El listado necesita `cantidadRecibida` → se agrega al select
  y al mapeo de `getTransferenciasAction`.

## Riesgos / interacciones

- **Sesión A (re-integración futura)**: toca el mismo `actions.ts` (BUG-3:
  agregados de stock sin filtro de estado + permiso de completar). El permiso
  idéntico se auto-resuelve; los agregados NO se tocan aquí. Limitación
  conocida: un aggregate de stock de PV cuenta `cantidad` completa de una fila
  PARCIAL (dominio BUG-3, queda para la Sesión A, que deberá además considerar
  `cantidadRecibida` en el cálculo).
- **Consumidores externos**: no hay usos de estas actions/schemas fuera del
  feature (verificado por grep).
