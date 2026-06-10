# SDD Proposal: Corrección de bugs en ofertas, facturas, transferencias y mermas

## Business Problem

Cuatro módulos críticos del inventario contienen bugs de runtime y de lógica de stock que pueden producir datos inconsistentes, stock fantasma, y páginación incorrecta entre tenants. Los tests unitarios pasan porque usan mocks que no reflejan los nombres reales de campo en Prisma (tapados con `@ts-expect-error`), y la lógica de stock en transferencias no respeta la máquina de estados.

## Hallazgos (Evidence)

### H1 — Ofertas update: campo incorrecto en Prisma

**Archivo:** `src/features/ofertas/actions.ts:95-118`
**Problema:** `updateOfertaAction` usa `ofertaId` en `prisma.oferta.findFirst()` y `prisma.oferta.update()`, pero el modelo `Oferta` tiene el campo `id` (no `ofertaId`).
**Evidencia:**
- Línea 41: `getOfertaByIdAction` usa `where: { id, tenantId }` → correcto
- Línea 102: `where: { ofertaId, tenantId }` → incorrecto, tapado con `// @ts-expect-error`
- Línea 109: `where: { ofertaId }` → incorrecto, tapado con `// @ts-expect-error`
- **Impacto:** En runtime, Prisma lanza error porque `ofertaId` no existe en el modelo. El `@ts-expect-error` solo silencia TypeScript, no evita el error en ejecución.

### H2 — Facturas update: campo incorrecto en Prisma

**Archivo:** `src/features/facturas/actions.ts:60-74`
**Problema:** `updateFacturaAction` usa `facturaId` en `prisma.factura.findFirst()` y `prisma.factura.update()`, pero el modelo `Factura` tiene el campo `idFactura`.
**Evidencia:**
- Línea ~52: `getFacturaByIdAction` usa `where: { idFactura: id, tenantId }` → correcto
- Línea ~64: `where: { facturaId, tenantId }` → incorrecto, tapado con `// @ts-expect-error`
- Línea ~72: `where: { facturaId }` → incorrecto, tapado con `// @ts-expect-error`
- **Impacto:** Mismo que H1: runtime error al actualizar facturas.

### H3 — Transferencias delete: revierte stock sin verificar estado

**Archivo:** `src/features/transferencias/actions.ts:566-619`
**Problema:** `deleteTransferenciaAction` revierte stock (incrementa origen, decrementa destino) **siempre**, sin importar si la transferencia estaba `COMPLETADA` o si nunca movió stock (e.g., `PENDIENTE` o `APROBADA`).
**Impacto:** Stock fantasma en origen, stock negativo en destino. La transferencia se marca como `CANCELADA` pero los valores de stock quedan inconsistentes.

### H4 — Transferencias update: resincroniza stock sin verificar estado

**Archivo:** `src/features/transferencias/actions.ts:476-559`
**Problema:** `updateTransferenciaAction` re-sincroniza stock (revierte movimiento anterior, aplica movimiento nuevo) sin verificar si la transferencia estaba `COMPLETADA`. Si estaba `PENDIENTE` y se modifica origen/destino/cantidad, el stock nunca se había movido, pero el código intenta revertir un movimiento que nunca ocurrió.
**Impacto:** Stock fantasma en origen (por revertir salida que no existía) y en destino (por revertir entrada que no existía).

### H5 — Transferencias count: falta filtro tenantId

**Archivo:** `src/features/transferencias/actions.ts:143-145`
**Problema:** `prisma.transferencia.count()` solo filtra por `deletedAt: null`, omite `tenantId`. El `findMany` inmediatamente superior sí incluye `tenantId`.
**Evidencia:**
- Línea ~140: `findMany({ where: { tenantId, deletedAt: null }, ... })` → correcto
- Línea ~144: `count({ where: { deletedAt: null } })` → falta `tenantId`
- **Impacto:** El total de páginas es el conteo global de todas las transferencias de todos los tenants, no solo del tenant actual. Paginación incorrecta.

### H6 — Mermas update: no maneja cambio de almacén sin cambio de producto/cantidad

**Archivo:** `src/features/mermas/actions.ts:136-208`
**Problema:** Si `updateMermaAction` recibe solo `almacenId` diferente (sin cambiar `productoId` ni `cantidad`), la condición `productoId !== mermaActual.productoId || cantidad !== mermaActual.cantidad` es `false`, por lo que cae en la rama que solo actualiza el campo `motivo` — no mueve stock entre almacenes ni actualiza `almacenId`.
**Impacto:** La merma queda registrada con el almacén equivocado, y el stock no se descuenta del almacén correcto ni se restituye al original.

## Target Users

- Usuarios que actualizan ofertas y facturas (operaciones cotidianas)
- Usuarios que gestionan transferencias entre almacenes/PdV
- Usuarios que registran mermas de inventario
- **Impacto directo:** cualquier usuario en cualquier tenant que use estas funcionalidades

## Non-Goals

- No refactorizar la arquitectura de las Server Actions
- No cambiar los modelos de datos Prisma
- No agregar nuevas funcionalidades
- No modificar el esquema de validación Zod (a menos que sea necesario para H6)
- No cubrir tests de integración E2E (solo unitarios existentes)
- No cambiar `createOfertaAction`, `createFacturaAction`, `createTransferenciaAction`, `createMermaAction` (solo están rotos los update/delete)

## Solution Sketch

6 fixes independientes, aplicables en orden:

1. **H1 (Ofertas):** Cambiar `ofertaId` → `id` en `updateOfertaAction`.
2. **H2 (Facturas):** Cambiar `facturaId` → `idFactura` en `updateFacturaAction`.
3. **H5 (Transferencias count):** Agregar `tenantId` al where del `count()`.
4. **H3 (Transferencias delete):** Verificar que `estado === "COMPLETADA"` antes de revertir stock. Si está `PENDIENTE` o `APROBADA`, solo cancelar sin tocar stock.
5. **H4 (Transferencias update):** Solo resincronizar stock si `estado === "COMPLETADA"`. Si está `PENDIENTE`, solo validar y actualizar datos sin tocar stock. Si está `APROBADA`, decidir si se permite update (actualmente no hay aprobación como estado transicional definido).
6. **H6 (Mermas update):** Refactorizar la lógica condicional para detectar cambio de `almacenId` independientemente de producto/cantidad, moviendo stock correctamente.

## Risk Assessment

| Riesgo | Nivel | Mitigación |
|--------|-------|------------|
| H1-H2: nombres de campo incorrectos ya en producción | Alto | Son bugs de runtime que impiden update. El fix es directo: cambiar nombre de campo. |
| H3: transferencias COMPLETADA canceladas con stock revertido dos veces | Medio | Si alguien canceló manualmente stock y luego se ejecuta delete, se revertiría otra vez. Agregar guard: si `estado === "CANCELADA"`, ya se verificó arriba. |
| H4: transferencias PENDIENTES con stock fantasma por updates previos | Medio | El fix evita nuevos casos. Datos existentes pueden requerir reconciliación manual. Documentar. |
| H6: mermas con almacén incorrecto ya registradas | Bajo | El fix evita nuevos casos. Mermas existentes con almacén incorrecto no se corrigen automáticamente. |
| Tests existentes usan mocks con campos incorrectos | Medio | Los tests de ofertas y facturas pueden usar `ofertaId`/`facturaId` en los mocks y pasar igual. Hay que actualizar tests para que reflejen los nombres reales. |

## Acceptance Criteria

- [ ] `updateOfertaAction` ejecuta `findFirst` y `update` con `id` — sin `@ts-expect-error`, sin runtime error
- [ ] `updateFacturaAction` ejecuta `findFirst` y `update` con `idFactura` — sin `@ts-expect-error`, sin runtime error
- [ ] `getTransferenciasAction` retorna `total` correcto por tenant (no global)
- [ ] `deleteTransferenciaAction` sobre transferencia `PENDIENTE` → cancela sin tocar stock
- [ ] `deleteTransferenciaAction` sobre transferencia `COMPLETADA` → cancela y revierte stock correctamente
- [ ] `updateTransferenciaAction` sobre transferencia `PENDIENTE` → actualiza datos sin tocar stock
- [ ] `updateTransferenciaAction` sobre transferencia `COMPLETADA` → valida stock y resincroniza
- [ ] `updateMermaAction` con cambio solo de `almacenId` → mueve stock entre almacenes correctamente
- [ ] Todos los `@ts-expect-error` de ofertas y facturas se eliminan (ya no son necesarios)
- [ ] Tests existentes siguen pasando (o se actualizan para reflejar nombres reales)
