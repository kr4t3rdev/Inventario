# Design — Correcciones Urgentes 2 (datos)

Contexto de exploración (estado verificado en `main` @ 876b0d86):

- `deletePuntoDeVentaAction` (`src/features/puntos-venta/actions.ts:72-80`)
  solo verifica existencia + tenant. `Producto.puntoDeVenta`
  (`schema.prisma:528`) es Cascade con FK nullable; `Venta`, `TurnoPuntoVenta`
  y `ArqueoCaja` referencian PV con Restrict default; `Transferencia` con
  SetNull default.
- `deleteCategoriaAction` YA tiene guard (`CategoriaDeletionValidator`), pero
  `Producto.categoria` (`schema.prisma:525`, FK requerido) y `Categoria.parent`
  (`schema.prisma:22`) siguen Cascade: cualquier escritura que se salte el
  action destruye el catálogo a nivel BD.
- `POST /api/mobile/mermas` (`src/app/api/mobile/mermas/route.ts:70-143`)
  crea Merma con `costoTotal` y decrementa `StockUbicacion`, pero sin
  `creadoPorId` (aunque `authResult.user.userId` está disponible), sin
  `registrarMovimiento`, sin espejo y sin `notificarMerma`. El desktop
  (`createMermaAction`, `src/features/mermas/actions.ts:52-160`) hace los 4
  inline dentro de la transacción.
- `anularVentaPorEstado` (`venta-lifecycle-service.ts:450-686`): el claim
  atómico es `tx.venta.updateMany({ data: { estado: 'ANULADA', deletedAt } })`
  en la línea ~532-547; `ANULAR_SELECT` (79-100) no incluye `ofertaId`.
  `convertir-oferta-pedido.ts:56-69` tiene guarda que filtra
  `deletedAt: null`, por lo que la venta anulada es invisible y el
  `venta.create({ ofertaId })` explota con `P2002` sin capturar;
  `facturar-oferta-workflow.ts` ni siquiera tiene guarda.
- BUG-3 (`src/features/transferencias/actions.ts:37-48`): los dos
  `transferencia.aggregate` no filtran `deletedAt` ni estado. BUG-1/2/4/5 del
  change `fix-transferencias-bugs` ya están aplicados en código.
- `completarTransferenciaAction` (`transferencias/actions.ts:854-989`) solo
  llama `requireTenant`; aprobar/rechazar usan
  `requirePermission(user, 'inventario.transferencias.aprobar', ...)`
  (líneas 817 y 1000). Registry: `inventario.transferencias.gestionar`
  (manager, economico, dependiente) y `.aprobar` (solo manager).
- Períodos: guard server completo y probado
  (`src/lib/services/periodo-contable-guard.ts`,
  `with-period-validation.ts`, `validate-period-write.ts`) ya usado por
  contabilidad, compras-servicios, venta-servicios y restock. `GastosDE` no
  tiene campo `fecha`: usa `periodo String` ("YYYY-MM"). Ninguna action de
  `gastosDE` valida período; `POST /api/mobile/expenses` tampoco.

## Decisiones

### D1 — Guard de PV: bloquear con conteos, patrón Almacén

`deletePuntoDeVentaAction` contará (una sola vez, `Promise.all`, todo con
`tenantId`): productos (`producto.count { puntoDeVentaId }`), ventas,
turnos (`turnoPuntoVenta`), arqueos (`arqueoCaja`) y transferencias
(`OR puntoDeVentaOrigenId/puntoDeVentaDestinoId`). Si el total > 0 lanza
`ActionError('No se puede eliminar el punto de venta porque tiene registros
asociados: …', 'PUNTO_VENTA_EN_USO')` — mismo contrato que
`ALMACEN_EN_USO`; la UI ya muestra `result.error?.message`, no requiere
cambios de front.

Alternativa descartada: bloquear solo trazas financieras y desvincular
productos (SetNull vía action). Se descarta porque rompe la convención
fijada por el fix de Almacén (F-02) y oculta al usuario por qué cambió la
asignación de sus productos.

### D2 — Cascadas: defensa en profundidad en schema

- `Producto.puntoDeVenta` Cascade → **SetNull** (FK nullable: desvincular es
  no destructivo; si algún día se borra por otra vía, el producto sobrevive).
- `Producto.categoria` Cascade → **Restrict** (FK requerido: no hay valor
  nulo al cual recurrir; el guard ya impide borrar categoría con productos).
- `Categoria.parent` Cascade → **Restrict** (el guard de categoría ya bloquea
  con subcategorías; el borrado en cadena silencioso no es deseable).
- Se añade un test de contrato estático que lee `prisma/schema.prisma` y
  falla si reaparece una cascada destructiva en esas tres relaciones (mismo
  espíritu que `test-isolation-contract.test.ts`).

Se aplica con `db-push` en deploy; no hay datos que backfillear.

### D3 — Merma móvil: servicio compartido como punto único

Se extrae el núcleo del alta a
`src/features/mermas/services/registrar-merma-service.ts`:

```
registrarMermaEnTransaccion(tx, {
  tenantId, productoId, cantidad, motivo, almacenId, creadoPorId,
  costoUnitario, stockDisponibleAntes,
}): Promise<Merma>
```

que ejecuta en orden: `merma.create` (con `creadoPorId`), `upsertStockUbicacion`
(delta −cantidad), `registrarMovimiento` (kardex `SALIDA-0`,
`tipoOrigen: 'MERMA'`), espejo `ajusteInventario.create` (`estado: 'APLICADO'`,
`origenMermaId`, motivo mapeado con `mapearMotivoLegacy`).
`createMermaAction` conserva sus validaciones (Zod, producto, stock,
permisos) y delega el núcleo; la ruta móvil conserva su validación manual y
pasa `creadoPorId: authResult.user.userId`, y añade `notificarMerma` tras el
commit (igual que el desktop, try/catch no fatal).

Nota sobre evento contable: en `main` no existe infraestructura de eventos
contables (verificado); el gancho CTA de la rama de contabilidad queda
colocado en el desktop. Con este cambio, cuando contabilidad se integre, el
evento se engancha UNA sola vez en el servicio compartido y cubre móvil y
desktop sin duplicación. La spec lo deja anotado como requisito futuro.

El DELETE móvil (`/api/mobile/mermas/[id]`) restaura stock pero no revierte
kardex ni anula espejo: se corrige también (alinea con `deleteMermaAction`)
porque dejarlo a medias mantiene la corrupción simétrica.

### D4 — Limbo de ofertas: liberar al anular + guarda activa + P2002 traducido

1. `ANULAR_SELECT` pasa a incluir `ofertaId`.
2. El claim atómico añade `ofertaId: null` (los NULL no colisionan con el
   unique, la limpieza es atómica con el claim).
3. Dentro de la misma transacción, si `ofertaId` estaba presente y la oferta
   existe: `tx.oferta.updateMany({ where: { id, tenantId, estado: { in:
   ['ACEPTADA', 'FACTURADA'] } }, data: { estado: 'ACEPTADA' } })` — una
   oferta FACTURADA cuya venta se anuló debe poder re-facturarse.
4. Guarda de venta vinculada en `facturarOfertaWorkflow` (igual que la de
   `convertirOfertaAPedido`): bloquea si existe venta con `ofertaId` y
   `deletedAt: null` → `VALIDATION_ERROR` amigable.
5. Red de seguridad: ambas rutas capturan `P2002` sobre el unique de
   `ofertaId` y lo traducen a error de negocio en vez de 500.

Consecuencia documentada: tras anular una venta de oferta, la conversión es
reintentable; la guarda impide doble venta solo mientras exista venta viva.

### D5 — BUG-3: filtros mínimos, sin migrar a StockUbicacion (aún)

`getStockDisponibleEnPuntoVenta` añade a ambos aggregates:
`deletedAt: null` y `estado: { notIn: ['CANCELADA', 'RECHAZADA'] }`.
La migración a `StockUbicacion` como fuente única (propuesta original del
change `fix-transferencias-bugs`) queda para la Sesión B porque implica
revisar `createTransferenciaAction` y sus validaciones de stock.

### D6 — Permiso de completar: operación física, no decisión de jefatura

`completarTransferenciaAction` añade
`requirePermission(user, 'inventario.transferencias.gestionar', 'completar
transferencias')`. Justificación: aprobar/rechazar son decisiones de
jefatura (`.aprobar`, solo manager); completar es recepción operativa y el
propio mapping móvil usa `transfers → inventario.transferencias.gestionar`
(`route-permissions.ts:89`). Queda simétrico con el flujo y no rompe el caso
de uso dependiente-recibe-mercancía.

### D7 — Período cerrado: un helper uniforme sobre `PeriodoGuard.assertWritable`

- **Implementación final**: helper `assertPeriodoGastoEscritable(periodo,
  tenantId)` en `gastosDE/actions.ts` que mapea el `periodo` ("YYYY-MM" →
  `Date.UTC(y, m-1, 1)`, vía `extraerFechaDeBody`) y llama
  `PeriodoGuard.assertWritable`; si no es permitido lanza `ActionError` con
  el código del guard. Se invoca en el handler de las seis acciones:
  `create` (tras resolver el mes default), `update` (período origen del
  gasto Y destino si cambia), `delete` y `deleteBulk` (antes del claim y de
  revertir efectos; en bulk el throw dentro de la transacción hace rollback
  atómico), `aprobar` y `rechazar`.
  Nota: se prefirió el helper explícito al wrapper `withPeriodValidation`
  porque el período del gasto se resuelve dentro del handler (campo
  `periodo` con default al mes actual) y así un solo mecanismo cubre las
  acciones con y sin input de fecha.
- **Ruta móvil** `POST /api/mobile/expenses`: `validarEscrituraPeriodo`
  (patrón de `src/app/api/contabilidad/reconciliacion/gastos/route.ts`)
  usando la `fecha` del body (el route ya calcula `periodo` desde esa fecha).
- Config respetada: el guard honra `PERIODO_GUARD_ENABLED` y los modos
  `audit-only`/`disabled`; en `enforce` (default) bloquea con los códigos
  existentes (`PERIODO_CERRADO`, `PERIODO_APROBADO`, `PERIODO_EN_CIERRE`,
  `PERIODO_NO_EXISTE`).
- Queda anotado como gap fuera de alcance: `createCompraProductoAction`
  (`GastoCompra`) y `createProductoAction` (stock inicial) sin wrapper; se
  abordan en la Sesión C/G para no mezclar con compras-productos aquí.

## Riesgos

- Cambios de `onDelete` en schema: verificados como no destructivos (SetNull
  para FK nullable, Restrict solo con guards previos). `db-push` en Railway
  los aplica al deploy.
- El servicio compartido de mermas cambia el lugar donde `createMermaAction`
  crea registros: los tests desktop existentes mockean `prisma`/`tx` y deben
  seguir verdes; se ajustan solo si el mock necesita el nuevo import.
- `withPeriodValidation` en create/update de gastos añade una lectura
  cacheada de período (TTL 30s en `periodo_cache`): impacto de rendimiento
  despreciable.
