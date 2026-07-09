# Almacenes

> Administra las ubicaciones físicas de almacenamiento donde vive el stock del tenant.

## Qué hace

Este módulo define los almacenes disponibles y permite listarlos, crearlos, editarlos y eliminarlos. Aunque parezca simple, es una pieza base para stock por ubicación, compras, mermas y transferencias.

## Cuándo usarlo

- Cuando cargás nuevos productos, categorías o proveedores.
- Cuando querés revisar stock, precios o movimientos entre almacenes.
- Cuando necesitás corregir diferencias o mantener el inventario actualizado.
- Cuando abrís una nueva ubicación física para guardar mercadería.

## Reglas importantes

- Los almacenes son tenant-scoped.
- Su CRUD vive en Server Actions y refresca la UI con `revalidatePath`.
- Son insumo estructural para `StockUbicacion`, no solo una etiqueta visual.

## Qué conviene cuidar

- Elegir mal el almacén impacta compras, mermas y transferencias.
- Antes de eliminar, revisá dependencias operativas aunque la UI permita intentarlo.
- Si el tenant usa varias ubicaciones, conviene nombrarlas de forma inequívoca.

## Rutas y referencias

- `/busy/almacen`
- `/busy/almacen/new`
- `/busy/almacen/update/[id]`
- `src/features/almacenes/actions.ts`

## En una frase

Define en qué depósitos existe el stock y desde dónde se mueve la mercadería.
