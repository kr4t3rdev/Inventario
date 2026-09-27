# Diseño técnico — Sesión E: hardening de ofertas

Serie **E** (E-1..E-4). Base: `main` b4be12ba. TDD estricto por fase
(RED→GREEN→REFACTOR), commit por fase con stage selectivo.

## Arquitectura de la solución

```
createOfertaAction ─┐
updateOfertaAction ─┼─► resolver precios (getPrecioEfectivo / servicio.precio)
duplicarOferta ─────┘        │
                             ▼
                    calcularTotalesOferta (E-3, pura)
                             │
       crearOfertaConNumero (E-1, retry P2002 ×3)
                             ▼
                      prisma ($transaction cuando hay reemplazo de ítems)

getOfertas / getOfertaById / facturar / convertir ─► expirarOfertasVencidas (E-2)
updateOfertaAction ─► matriz de transiciones (E-2)
```

## §1 E-1 — Numeración con retry (patrón contratos)

Nueva lib `src/features/ofertas/lib/numero-oferta-generator.ts`, réplica del patrón
de `src/features/contratos/lib/numeroContratoGenerator.ts` (L39-60):

```ts
export async function generarProximoNumeroOferta(tenantId: string): Promise<number>
// findFirst({ where: { tenantId }, orderBy: { numeroOferta: 'desc' } }) → parseInt('OF-', 10) + 1

export async function crearOfertaConNumero<T>(input: {
  tenantId: string
  buildData: (numeroOferta: string) => T
  create: (data: T) => Promise<T>
}): Promise<T>
// for intento in 0..2: n = generar(); try create; catch P2002 → continue; throw
```

Decisiones:

- **DECISIÓN RESUELTA:** replicar el patrón (no advisory lock, no tabla contadora).
  El usuario pidió explícitamente "patrón ya existente en contratos"; la ventana de
  carrera residual se resuelve con el retry y el índice único sigue siendo la
  autoridad. Extraer a lib compartida es no-goal.
- Formato `OF-` + 6 dígitos (`padStart(6, '0')`), igual que hoy.
- `createOfertaAction` deja de calcular el número inline y llama al generador.
- Sin `$transaction`: igual que contratos, el `create` es el callback re-ejecutable.

## §2 E-2 — Estado VENCIDA + guardas

### Modelo

```prisma
enum EstadoOferta {
  PENDIENTE
  ACEPTADA
  RECHAZADA
  FACTURADA
  VENCIDA        // nuevo
}
```

Migración: `prisma/migrations/<fecha>_oferta_estado_vencida/migration.sql` con
`ALTER TYPE "EstadoOferta" ADD VALUE IF NOT EXISTS 'VENCIDA';` (aditiva, sin
backfill). Union TS en `src/app/models/ofertas.ts` y badges en
`ofertas-table.tsx:147-154` actualizados en la misma fase.

### Expiración perezosa

`src/features/ofertas/services/expiracion-ofertas-service.ts`:

```ts
export async function expirarOfertasVencidas(tenantId: string): Promise<number>
// prisma.oferta.updateMany({
//   where: { tenantId, estado: 'PENDIENTE', fechaVencimiento: { lt: new Date() } },
//   data: { estado: 'VENCIDA' },
// })
```

Se invoca al inicio de `getOfertasAction`, `getOfertaIdAction`, `facturarOfertaAction`
y `convertirOfertaAPedidoAction`. Ofertas sin `fechaVencimiento` nunca expiran.
No hay cron: la expiración ocurre al tocar el módulo.

### Matriz de transiciones

`src/features/ofertas/lib/transiciones-estado.ts`:

```ts
const TRANSICIONES_PERMITIDAS: Record<EstadoOferta, EstadoOferta[]> = {
  PENDIENTE: ['ACEPTADA', 'RECHAZADA'],
  ACEPTADA: [],   // FACTURADA solo vía facturarOfertaAction
  RECHAZADA: [],
  FACTURADA: [],
  VENCIDA: [],
}
```

- `updateOfertaAction`: si `estado` difiere del actual, la transición debe estar en
  la matriz; si no → `ActionError('La oferta en estado X no puede pasar a Y',
  'ESTADO_TRANSICION_INVALIDA')`. Actualizar solo `observaciones` sigue permitido
  en cualquier estado.
- `facturarOfertaAction`: `VENCIDA` se agrega al rechazo explícito junto a
  `FACTURADA`/`RECHAZADA` (la guarda atómica `updateMany` de facturación queda
  como red de seguridad de carrera).
- `convertirOfertaAPedidoAction`: `VENCIDA` en el rechazo temprano; el
  `updateMany` con `estado: { in: ['PENDIENTE','ACEPTADA'] }` ya excluye `VENCIDA`.
- `deleteOfertaAction`: nueva guarda server-side — `FACTURADA` →
  `ActionError('No se puede eliminar una oferta facturada', 'ESTADO_NO_ELIMINABLE')`.
  Las demás estados (incluida `VENCIDA`) permanecen eliminables (limpieza).

## §3 E-3 — Totales e impuestos recalculados en servidor

Lib pura `src/features/ofertas/lib/totales-oferta.ts` (sin imports de Prisma ni
server-actions; testeable unitaria):

```ts
interface LineaResuelta { cantidad: number; precioUnitario: number }
interface ResultadoTotales {
  ok: true
  lineas: { cantidad: number; precioUnitario: number; total: number }[]
  subtotal: number
  impuestos: number
  total: number
}
type CalculoTotales = ResultadoTotales | { ok: false; code: 'TAX_INVALID'; message: string }

export function calcularTotalesOferta(
  lineas: LineaResuelta[],
  impuestosDeclarados: number,
): CalculoTotales
```

Reglas:

- `total` de línea = `redondear2(cantidad × precioUnitario)` — el `total` del
  payload jamás se persiste.
- `subtotal` = Σ lineas; `impuestos` = `impuestosDeclarados` (declaración del
  usuario, no alícuota — no existe infraestructura de tasas en el schema; ver
  no-goals de la propuesta).
- Validación: `0 ≤ impuestos ≤ subtotal`; fuera de rango →
  `{ ok: false, code: 'TAX_INVALID' }` (acción lo traduce a `ActionError`).
- `total = subtotal + impuestos`.

Consumo: `createOfertaAction`, edición de ítems (E-4) y duplicación (E-4)
reemplazan su aritmética inline por la calculadora. El `parsed.impuestos` del
schema Zod pasa a ser la única entrada fiscal del cliente y queda acotada.

## §4 E-4 — Edición de ítems y duplicación

### Edición de ítems

- `ofertaUpdateSchema` gana `items: z.array(ofertaItemInputSchema).optional()`
  (misma forma que en creación: `productoId`/`servicioId` + `cantidad`; los campos
  `precioUnitario`/`total` del payload se aceptan por compatibilidad y nunca son
  autoridad).
- `updateOfertaAction`: si `items` presente →
  1. oferta debe estar `PENDIENTE`; si no → `ActionError(..., 'ITEMS_NO_EDITABLES')`.
  2. en `$transaction`: re-resolver precios (`getPrecioEfectivo` / `servicio.precio`,
     producto/servicio tenant-scoped), `calcularTotalesOferta`, `ofertaItem.deleteMany`,
     `ofertaItem.createMany`, `oferta.update` con nuevos montos.
  3. El reemplazo completo es intencional (no hay patch de líneas: la UI manda el
     conjunto final de ítems).

### Duplicación

`duplicarOfertaAction(ofertaId)`:

- feature guard + tenant-scoped; `NOT_FOUND` si no coincide tenant.
- Re-resuelve **hoy** el precio de cada ítem (`getPrecioEfectivo` / `servicio.precio`).
- `impuestos` original se conserva como declaración y se valida con la calculadora:
  si supera el nuevo subtotal → `TAX_INVALID` con mensaje accionable (decisión:
  rechazar en vez de clampear silenciosamente).
- Número nuevo vía `crearOfertaConNumero`; estado `PENDIENTE`;
  `fechaEmision = now`; `fechaVencimiento` se conserva solo si sigue futura
  (si venció → `null`); `observaciones` se copian sin cambios.

### UI mínima

Botón "Duplicar" en la tabla (`ofertas-table.tsx`) y/o detalle
(`oferta-detail-content.tsx`): llama `duplicarOfertaAction`, toast de éxito/error y
refresh. La edición de ítems queda expuesta por acción de servidor; el wire-up de
formulario de edición se decide en fase según la reusabilidad real de
`OfertaForm` (tarea marcada en tasks.md).

## §5 Pruebas y contrato de mocks

- Comandos: `pnpm exec vitest run src/features/ofertas` (+ rutas específicas por
  fase). Suite completa solo al cierre con `--maxWorkers=4`.
- Contrato (idéntico a `__tests__/actions.test.ts` existente):
  - `vi.mock('@/lib/server-actions/get-current-user')` — `withAction` NO se mockea.
  - `vi.mock('@/lib/prisma')` con objeto estático (helper `vi.hoisted`);
    `$transaction: vi.fn((cb) => cb(mockTx))`.
  - Servicios externos mockeados a nivel módulo (FIFO, stock, turnos, anticipos,
    facturación-cobro, audit-log).
  - `revalidatePath: vi.fn()` (next/cache).
- Nuevos archivos de test: `numero-oferta-generator.test.ts` (colisión P2002 con
  `mockRejectedValueOnce`, propagación de no-P2002, formato), `totales-oferta.test.ts`
  (pura: redondeo, TAX_INVALID, líneas), `expiracion-estado.test.ts` (expiración +
  matriz + guardas), `edicion-duplicado.test.ts`.

## §6 Despliegue

- Migración aditiva del enum (se aplica al deploy; Railway corre migraciones en
  deploy, con `db-push` como fallback histórico — 1 línea SQL inocua en ambos).
- Sin backfill ni scripts post-deploy.
- Orden de merge: esta rama es independiente de la Sesión A (revertida en main);
  el limbo `Venta.ofertaId` se re-integra con la Sesión A.
