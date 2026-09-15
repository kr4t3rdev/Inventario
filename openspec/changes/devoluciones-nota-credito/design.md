# Design — DNC Devoluciones parciales y nota de crédito

## Modelo de datos

```prisma
enum EstadoDevolucion {
  REGISTRADA
  ANULADA // reservado: la reversión de devoluciones es un fast-follow fuera de alcance
}

model DevolucionVenta {
  devolucionId          String             @id @default(cuid())
  tenantId              String
  ventaId               String
  estado                EstadoDevolucion   @default(REGISTRADA)
  motivo                String?
  subtotal              Int // centavos, Σ items
  descuento             Int // centavos, prorrateo del descuento de la venta
  total                 Int // centavos, subtotal − descuento
  moneda                String             @default("CUP")
  tasaCambio            Decimal? // copia histórica de la factura origen (1 si no hay)
  facturaNotaCreditoId  String?            @unique
  anticipoId            String?            @unique
  turnoReembolsoId      String?
  montoAplicadoCxc      Int                @default(0) // centavos
  montoSaldoFavor       Int                @default(0)
  montoReembolsado      Int                @default(0)
  idempotencyKey        String?
  createdById           String
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt
  venta                 Venta              @relation(fields: [ventaId], references: [ventaId])
  facturaNotaCredito    Factura?           @relation(fields: [facturaNotaCreditoId], references: [idFactura])
  anticipo              Anticipo?          @relation(fields: [anticipoId], references: [anticipoId])
  turnoReembolso        TurnoPuntoVenta?   @relation(fields: [turnoReembolsoId], references: [id])
  items                 DevolucionVentaItem[]
  tenant                Tenant             @relation(fields: [tenantId], references: [tenantId])

  @@unique([tenantId, idempotencyKey])
  @@index([tenantId, ventaId])
  @@index([tenantId, turnoReembolsoId])
}

model DevolucionVentaItem {
  id                    String           @id @default(cuid())
  devolucionId          String
  ventaItemId           String
  productoId            String
  cantidad              Int
  precioUnitario        Int // centavos, copia del VentaItem (auditable)
  total                 Int // cantidad × precioUnitario
  costoUnitarioDevolucion Int // costo FIFO ponderado restaurado (auditoría/rentabilidad)
  tipoUbicacion         String // 'punto_venta' | 'almacen' (ubicación origen de la venta)
  ubicacionId           String
  devolucion            DevolucionVenta  @relation(fields: [devolucionId], references: [devolucionId], onDelete: Cascade)
  ventaItem             VentaItem        @relation(fields: [ventaItemId], references: [id])

  @@unique([devolucionId, ventaItemId]) // una línea por ventaItem por devolución
  @@index([ventaItemId])
}
```

Cambios anexos: `Venta.devoluciones DevolucionVenta[]`, `VentaItem.devoluciones ...`,
`Factura.devolucionesNC DevolucionVenta[]`, `Anticipo.devoluciones DevolucionVenta[]`,
`TurnoPuntoVenta.reembolsos DevolucionVenta[]`.
`Anticipo.contratoId` pasa a `String?` (relación `contrato Contrato?`) y
`ContextoAnticipo` gana `NOTA_CREDITO`.

### Unidades monetarias (decisión)

El mundo venta persiste **centavos como `Int`** (`VentaItem.precioUnitario/total`,
`Venta.total`) y `Factura` guarda **el mismo valor numérico en `Decimal`** (así lo hace el
`create` actual: `factura.total = totalVenta` sin conversión). Decisión: `DevolucionVenta*` en
`Int` centavos y la NC recibe el mismo número en `Decimal`, 1:1. Justificación: coherencia
total con los dos mundos existentes y aritmética exacta de enteros en los prorrateos.
Alternativa descartada: persistir la devolución en `Decimal` "porque la NC es Decimal" —
rompería la comparación directa con `VentaItem.total` sin ganar precisión.

### Por qué la NC cuelga de la devolución y no de la venta

`Factura.ventaId` es `@unique`: la venta ya tiene su FACTURA. Además, una venta puede tener
N devoluciones (y por tanto N NC). Por eso `DevolucionVenta.facturaNotaCreditoId @unique`
apunta a la NC y la NC llega a la venta a través de la devolución. La NC lleva
`clienteId` (requerido en `Factura`), `subtotal/descuento/total` de la devolución,
`tipoDocumento: NOTA_CREDITO`, `tasaCambio` copiada de la factura origen (o `1` si la venta
no tiene factura) y `estado: PAGADA` — la NC no es un documento por cobrar: su efecto ya
quedó materializado en CxC/anticipo/reembolso en la misma transacción. Alternativa
considerada: estado nuevo `APLICADA` en `EstadoFactura`; descartada por no añadir información
(la traza está en la devolución) y obligar a revisar cada query que filtra por estado.

### Serie propia `NC-`

`SerieFacturacion` ya garantiza numeración por tenant con `@@unique([tenantId, prefijo])`.
Al emitir la primera NC se hace upsert de `{ prefijo: 'NC', descripcion: 'Notas de crédito' }`
(no `esPorDefecto`) y se numera con el mismo patrón `update({ consecutivo: increment 1 })`
ya usado en `create` → `NC-000001`. Justificación: la numeración independiente es requisito
fiscal habitual y separa limpiamente las NC de las FV en reportes. Alternativa descartada:
compartir la serie FV (mezclaría corrientes documentales).

## Flujo de la devolución

1. **Contexto** (`getDevolucionContextoAction`): venta activa + items con
   `disponible = ventaItem.cantidad − Σ devoluciones activas`, CxC pendiente de la venta,
   NC previas, estado del turno actual del PV (para habilitar/no el reembolso).
2. **Selección**: el operador elige cantidades por ítem (0 ≤ cantidad ≤ disponible),
   motivo obligatorio, y preferencia financiera del excedente (`SALDO_FAVOR` default |
   `REEMBOLSO_EFECTIVO` si hay permiso y turno abierto).
3. **Registro** (`DevolucionVentaService.registrar`, una sola tx `Serializable`):

   a. `SELECT ... FOR UPDATE` sobre la venta (mismo patrón que `cancel`).
   b. Guardas: tenant, `deletedAt == null` (si PVE ya está desplegado, también
      `estado IN ('ENTREGADA','FACTURADA')`), ítems pertenecen a la venta, cantidades >
      0 y ≤ disponible acumulado.
   c. Claim idempotente: si `idempotencyKey` ya existe → se devuelve la devolución
      existente (replay seguro tras timeout de red o doble click).
   d. Efectos por ítem: `upsertStockUbicacion` (delta +) a **la ubicación origen de la
      venta** (`venta.puntoDeVentaId`, o `producto.almacenId` en datos legacy), entrada de
      kardex positiva con costo FIFO restaurado y reducción parcial de
      `PurchaseAllocation` (ver siguiente sección).
   e. Serie `NC-` + `Factura` NC (si el plan tiene `facturacion`; sin él, la devolución
      queda completa pero sin documento — mismo criterio que el `create` actual).
   f. Cascada financiera (sección siguiente).
   g. `AuditLogService.logStrict` con ítems, montos, NC, destino financiero y usuario.

### Kardex parcial: sin enum nuevo

Decisión: la línea de reintegro usa `tipoOrigen: 'VENTA'` con `origenId = devolucionId` y
`secuencia: 'ITEM-<i>'`, vía `registrarMovimiento` existente (idempotente por
`eventoKey`). Justificación: (1) el saldo del kardex neta solo — sumas por `VENTA` quedan
"ventas netas" sin tocar un solo reporte; (2) añadir `DEVOLUCION` al enum
`TipoOrigenMovimiento` obliga a revisar kardex UI, filtros y el change
`reportes-movimientos-nuevos-tipos` por una etiqueta; (3) el documento se identifica igual
de bien por su `origenId` (la devolución). Alternativa documentada y descartada: enum nuevo
(revisión amplia, ganancia cosmética).

### Costo histórico: FIFO restaurado, no `precioCosto` actual

Nuevo helper en `src/lib/services/fifo-allocation.ts`:
`restaurarAllocacionesFifo(tx, { tenantId, ventaItemId, cantidad })` → recorre las
allocations del ítem en orden cronológico ASC, descuenta `cantidad` (decrementa la fila;
la borra si llega a 0) y devuelve `{ restaurado, costoTotal }`. El costo de la línea de
kardex es `round(costoTotal / restaurado)` (`costoUnitarioDevolucion` del ítem).

- **Por qué ASC** (devolver a los lotes más antiguos primero): preserva el orden FIFO —
  esas unidades vuelven a "estar disponibles" en el lote de donde salieron y se revenderán
  antes que las de lotes nuevos, manteniendo estable el costo reportado.
- Sin allocations (venta legacy o producto sin compras): fallback `producto.precioCosto`,
  el mismo último recurso que ya usa la anulación total.
- La anulación total sigue borrando todas las allocations del ítem; la devolución **reduce**
  — por eso una venta con devoluciones no puede anularse después (ver sección dedicada).

## Tratamiento financiero (decisión central)

Cascada automática sobre `total` de la devolución:

```
pendiente = total
1. CxC: si la venta tiene CuentaPorCobrar con saldo (montoDeuda − montoPagado) > 0
   → aplicado = min(pendiente, saldo); montoPagado += aplicado; estado recalculado
   (PAGADA si cubre, PARCIAL si no). pendiente −= aplicado.
2. Excedente → preferencia del operador:
   a. SALDO_FAVOR (default): Anticipo tipo COBRO, sin contrato, montoOriginal =
      saldoDisponible = pendiente, moneda 'CUP', facturaId = NC (campo @unique que hoy
      está libre), estado RESERVADO → aparece de inmediato en el selector de anticipos
      del POS (pv-invoice-dialog) y en applyAnticipoAllocations.
   b. REEMBOLSO_EFECTIVO: requiere permiso sensitive `ventas.devolucion.reembolso` y un
      turno ABIERTO en el PV donde se ejecuta; se persiste `turnoReembolsoId` y el
      esperado del arqueo de ESE turno descuenta el monto.
```

- **Por qué CxC primero**: es la reducción de deuda legal de la NC (Odoo hace lo mismo:
  la NC reconcilia contra la factura abierta). `montoDeuda` se conserva intacto como hecho
  histórico; el residuo vivo es `montoDeuda − montoPagado`, que es exactamente lo que las
  pantallas de CxC muestran hoy. Alternativa descartada: reducir `montoDeuda` — reescribe
  el documento origen y rompe auditorías comparativas ya emitidas.
- **Búsqueda de la CxC**: la anulación actual consulta por `facturaId = ventaId` **o**
  `facturaId = factura.idFactura` (doble vínculo legacy). La cascada usa el mismo criterio
  para no perder CxCs históricas.
- **Saldo a favor vía `Anticipo`**: hoy `createAnticipo` exige `contratoId` de un contrato
  ACTIVO (`src/lib/services/anticipos-workflow.ts:81`), lo que lo hace inutilizable para un
  crédito espontáneo de mostrador. Se añade `createAnticipoDevolucion(tx, {...})` en el mismo
  módulo: valida cliente + monto, omite contrato (schema lo hace opcional), fija
  `facturaId` = NC y escribe el primer `AnticipoMovimiento` (`CREACION_RESERVA`,
  `contexto: NOTA_CREDITO`, `idempotencyKey = devolucionId`). Justificación: reutiliza el
  ledger con `saldoAntes/Despues`, la idempotencia y la UI de consumo ya existentes; crear
  un modelo `CreditoCliente` paralelo duplicaría todo eso. **Riesgo asociado**: hacer
  `contratoId` opcional exige auditar consumidores de `anticipo.contrato` (T1 incluye grep
  exhaustivo y defaults defensivos en listados).
- **Reembolso**: el dinero sale de la caja de **hoy**, no de la del turno histórico de la
  venta (esa ya se contó y se cerró). Por eso `turnoReembolsoId` apunta al turno abierto
  actual y `getEsperadosArqueoAction` / `realizarArqueoAction` (y la ruta mobile de
  esperados) restan `Σ montoReembolsado` de sus devoluciones REGISTRADAS. Sin turno abierto,
  el reembolso se rechaza con mensaje orientando a saldo a favor o a abrir turno.
  Alternativa descartada: prohibir reembolsos de ventas de turnos cerrados — inviable en
  retail (la devolución típica es al día siguiente).
- **Moneda**: la NC copia la `tasaCambio` histórica de la factura origen; saldo a favor y
  reembolso se denominan en la moneda de la venta (CUP). Sin conversión nueva en ningún
  punto (idéntico criterio a la anulación, que revierte montos persistidos sin recalcular
  FX).

### Prorrateo del descuento de la venta

`Venta.descuento` es global a la venta; la NC no puede ignorarlo (devolvería más de lo
cobrado) ni prorratear ingenuamente (la suma de varias parciales podría excederlo).
Regla determinista en el módulo puro:

```
bruto = Σ VentaItem.total
prorrateo_i = floor(venta.descuento × devSubtotal_i / bruto)        // 0 si bruto = 0
aplicado_i  = min(prorrateo_i, venta.descuento − descuentoYaDevuelto)
total_i     = devSubtotal_i − aplicado_i
```

Monótono, acotado (la suma de devoluciones nunca excede el descuento original) y con
redondeo absorbido por el floor. La implementación añade un tercer cap (`aplicado_i ≤
subtotal_i`) para descuentos degenerados (> subtotal de la venta): el total de la NC nunca
queda negativo. `cargoTransporte` nunca se devuelve en DNC.

## Guardas e idempotencia

| Caso | Comportamiento |
|---|---|
| Doble submit / retry de red | `@@unique([tenantId, idempotencyKey])` + replay de la devolución existente; la UI genera la key al abrir el wizard y deshabilita el botón mientras envía |
| Devolver más de lo disponible | Validación final dentro de la tx serializable tras el lock: `CANTIDAD_EXCEDIDA`, sin efectos parciales (rollback completo) |
| Venta anulada | `VALIDATION_ERROR` ("venta anulada") |
| Venta de turno cerrado / con arqueo | **Permitido** (divergencia deliberada de la anulación): la devolución es append-only, crea documentos nuevos con fecha actual y no toca reconciliaciones ni arqueos históricos. Solo el reembolso exige turno abierto — el de hoy |
| Producto compuesto (`esCompuesto`) | Se reintegra el producto terminado (la venta descuenta el terminado; los ingredientes solo se consumen en producción). Documentado, sin lógica extra |
| Tenant sin `facturacion` | Devolución completa (stock, kardex, financiero) sin NC; consistente con `create` |
| Concurrencia devolución ∥ anulación | Mismo lock `FOR UPDATE`: quien llega segundo ve `deletedAt != null` (anulación ganó) o devoluciones activas (devolución ganó → anulación rechazada) |

## Interacción con la anulación total

Decisión: `VentaMutationService.cancel` rechaza con `VENTA_CON_DEVOLUCIONES` si la venta
tiene devoluciones en estado REGISTRADA. Justificación: la anulación reintegra el 100% de
stock, borra el 100% de allocations y revierte el 100% del kardex; con devoluciones previas
eso reintegraría dos veces las mismas unidades. Implementar una "anulación neta" (100% −
devuelto) es código extra para un caso que la propia devolución ya cubre mejor: una
devolución del 100% deja la venta activa con NC total, trazabilidad completa y reportes
consistentes. La UI guía al operador ("complete la devolución del resto") en lugar de
ofrecer dos caminos destructivos distintos.

## Coexistencia con PVE

Guarda de admisión escrita en una función única `assertVentaDevolvible(venta)`:

- Hoy (PVE no desplegado): `deletedAt == null`.
- Tras PVE: además `estado IN ('ENTREGADA','FACTURADA')` (un PEDIDO no tiene stock
  descontado: devolverlo no tendría sentido; cancelarlo sí).

El punto de extensión queda marcado con `TODO(PVE)` en el servicio y en tasks de DNC-T3.
Cuando exista `venta-lifecycle-service.ts`, la devolución se registra como efecto del
ciclo de vida sin cambiar el contrato de DNC.

## Permisos y gates

```ts
{ key: 'ventas.devolucion.registrar', defaultRoles: ['manager', 'economico'],
  sensitive: true, category: 'ventas' } // registrar devoluciones
{ key: 'ventas.devolucion.reembolso', defaultRoles: ['manager'],
  sensitive: true, category: 'ventas' } // entregar efectivo en devoluciones
```

Gates de plan: `requireFeature(user, 'ventas-pos')` para devolver (hermana de la venta) y
`requireFeature(user, 'facturacion')` solo para la emisión de la NC. El saldo a favor usa
internamente el motor de anticipos **sin** exigir la feature `anticipos` (eso gatea la UI de
gestión de anticipos a proveedores; bloquear la devolución por eso dejaría fuera a planes
básicos sin razón). Fixture de paridad actualizado con ambas claves.

## UI

- Origen: detalle de venta / `ventas-table.tsx` → acción "Devolver…" (visible con
  `ventas.devolucion.registrar`), deshabilitada con tooltip cuando la venta está anulada o
  todo lo vendido ya está devuelto.
- `devolucion-wizard.tsx` (Dialog, 2 pasos, <200 líneas por componente): (1) ítems con
  máximo = disponible y subtotal en vivo; (2) resumen financiero — muestra la aplicación
  automática a CxC si existe, y radio saldo a favor / reembolso (este último deshabilitado
  sin permiso o sin turno abierto, con motivo visible). Motivo obligatorio.
- Vista de NC: filtro `tipoDocumento = NOTA_CREDITO` en el listado de facturas + detalle
  con la devolución vinculada (ítems, destino financiero, anticipo/turno afectado).
- Badge en la venta: "Devolución parcial"/"Devolución total" derivado de
  Σ devuelto vs vendido; el detalle enlaza sus NC.
- Sin voseo; textos nuevos en español neutro ("Devolver…", "Nota de crédito emitida",
  "Saldo a favor del cliente", "Reembolso en efectivo").

## Reportes y cuadre (alcance T5)

- Cuadre diario/turno y reporte de ventas: se añade línea "Devoluciones" y "Ventas netas"
  (`Σ ventas activas − Σ devoluciones del período`); las cifras brutas no cambian.
- Rentabilidad FIFO: resta `Σ cantidad × costoUnitarioDevolucion` (campo persistido, no hay
  que recalcular nada en el reporte).
- T5 incluye el inventario exhaustivo de consumidores (`deletedAt: null` sobre ventas) antes
  de tocar agregados, con ajuste mínimo por consumidor y tests donde el patrón lo permita.

## Riesgos

- **`Anticipo.contratoId` opcional**: consumidores que asuman contrato no nulo (listados,
  detalle, PDFs). Mitigación: grep exhaustivo en T1, defaults defensivos, tests de regresión
  del feature anticipos. Es el cambio de mayor blast radius del change.
- **Arqueo con reembolsos**: si un consumidor del esperado queda sin actualizar, el arqueo
  del turno mostrará faltante fantasma. Mitigación: helper único
  `getReembolsosTurno(turnoId)` consumido por las tres rutas de cálculo + tests.
- **Deriva de costos FIFO**: la reducción parcial de allocations es código nuevo sobre un
  invariante delicado (Σ allocations ≤ cantidad comprada). Mitigación: test de integración
  real multi-lote (dos compras a distinto costo, venta que cruza ambos, devolución parcial
  que restaura solo al primero) + invariante verificado en el propio test.
- **TOCTOU entre venta y devolución**: aceptado y mitigado igual que en anulación
  (Serializable + FOR UPDATE + validación final dentro de la tx). Sin locks adicionales.

## Resultado del spike T1.1 (ejecutado)

- **Consumidores de `Anticipo.contrato`/`contratoId`**: `actions-anticipos.ts` ya trata
  `contratoId` como opcional en su schema (línea 26) y solo hace `connect` condicional;
  `anticipo-detail.tsx:132` y `anticipos-columns.tsx:155` renderizan `contratoId || '-'`
  (null-safe). La UI del formulario (`anticipo-form.tsx`) lo exige solo para anticipos
  manuales (no afecta a los creados por NC). `tsc --noEmit` tras `contratoId String?`: 0 errores.
- **`Factura.tipoDocumento`**: `NOTA_CREDITO` ya existe en el enum; consumidores
  (facturas actions/schemas/read-service, contabilidad, reparaciones) lo tratan como
  valor opaco. Sin cambios requeridos.
- **`Anticipo.facturaId`**: confirmado `@unique` y no usado por otro flujo de creación;
  queda libre para apuntar a la NC de la devolución.
- Regresión con `contratoId` opcional: `src/features/ventas src/features/contabilidad
  src/lib/services` → 123 archivos / 1062 tests (1060 ok, 2 todo) sin fallos.
