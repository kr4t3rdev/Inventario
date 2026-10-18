# Delta spec — mermas (alta móvil alineada al desktop)

## MODIFIED Requirement: Alta de merma móvil

El registro de merma DEBE producir el mismo estado derivado sin importar el
canal (server action desktop o `POST /api/mobile/mermas`), delegando ambos en
un servicio compartido de transacción.

#### Scenario: merma móvil con trazabilidad completa

- **WHEN** un usuario autenticado registra una merma válida por la API móvil
- **THEN** dentro de una misma transacción se crea la `Merma` con
  `creadoPorId` del usuario autenticado y `costoTotal` calculado, se
  decrementa `StockUbicacion`, se registra el kardex `StockMoveLine`
  (`tipoOrigen: 'MERMA'`, secuencia `SALIDA-0`, idempotente) y se crea el
  espejo `AjusteInventario` (`estado: 'APLICADO'`, `origenMermaId`, motivo
  mapeado a valores legacy); tras el commit se envía `notificarMerma`.

#### Scenario: merma móvil sin stock suficiente

- **WHEN** la cantidad solicitada excede `cantidadDisponible` en el almacén
- **THEN** la API responde 409 `STOCK_INSUFICIENTE` y no se crea ningún
  registro (merma, kardex, espejo ni ajuste de stock).

#### Scenario: anulación móvil de merma

- **WHEN** `DELETE /api/mobile/mermas/[id]` elimina una merma
- **THEN** se restauran los efectos derivados igual que el desktop: kardex
  revertido, espejos `AjusteInventario` marcados `ANULADO` y stock
  restaurado.

## ADDED Requirement: Punto único de extensión contable

El servicio compartido de alta de merma DEBE ser el único punto donde se
agreguen efectos derivados posteriores (p. ej. el evento contable de la capa
formal), de modo que escritorio y móvil queden cubiertos sin duplicación.

#### Scenario: servicio compartido usado por ambos canales

- **WHEN** se inspeccionan `createMermaAction` y el route móvil de mermas
- **THEN** ambos invocan `registrarMermaEnTransaccion` y ninguno duplica la
  escritura de kardex/espejo inline.
