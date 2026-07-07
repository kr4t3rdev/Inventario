# Mermas

> Registra pérdidas de inventario por producto y almacén, ajustando stock y costo total de la merma.

## Qué hace

Este módulo sirve para llevar el inventario a la realidad cuando hay roturas, vencimientos, pérdidas o desperdicio. Al crear o editar una merma, el sistema valida stock disponible, descuenta la cantidad de la ubicación correcta y deja trazabilidad del costo involucrado.

## Qué incluye

- listado y detalle de mermas
- alta, edición y eliminación
- soporte por producto y almacén
- cálculo de costo total de la merma
- estadísticas agregadas por período
- notificaciones al registrar una merma

## Cuándo usarlo

- Cuando necesitás descontar inventario perdido o inutilizable.
- Cuando querés reflejar desperdicio real de operación.
- Cuando querés analizar cuánto se está perdiendo por mes.

## Reglas importantes

- Solo se puede crear una merma si hay stock suficiente en el almacén elegido.
- Editar una merma puede revertir stock anterior y volver a aplicarlo en otro producto o almacén.
- El borrado también revierte stock.
- El costo total se calcula usando el `precioCosto` del producto.

## Qué conviene cuidar

- Elegí bien el almacén porque la merma no afecta stock global abstracto, afecta una ubicación real.
- Si editás cantidad o producto, estás tocando stock histórico, no solo metadatos.
- Mirá las estadísticas de mermas si querés detectar fuga operativa recurrente.

## Rutas y referencias

- `/busy/mermas`
- `/busy/mermas/new`
- `/busy/mermas/edit/[id]`
- `src/features/mermas/actions.ts`

## En una frase

Mantiene el inventario honesto cuando la operación real pierde o deteriora stock.
