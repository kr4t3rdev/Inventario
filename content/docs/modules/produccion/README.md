# Producción

> Gestiona recetas y órdenes de producción, validando materiales, rendimiento y estado operativo del proceso.

## Qué hace

Este módulo separa dos piezas del flujo productivo: las recetas y las órdenes. Las recetas definen insumos, rendimiento e instrucciones. Las órdenes consumen esas recetas para programar una producción concreta, calcular costo de materiales y mover el proceso por estados de fabricación.

## Qué incluye

- listado y CRUD de recetas
- ingredientes por receta con cantidad, unidad y desperdicio
- listado y CRUD de órdenes de producción
- validación de disponibilidad de materiales
- cálculo de costo de materiales
- transición de estados productivos

## Cuándo usarlo

- Cuando querés estandarizar cómo se fabrica un producto compuesto.
- Cuando necesitás lanzar una orden concreta de producción.
- Cuando querés seguir una producción desde pendiente hasta completada.

## Reglas importantes

- El acceso depende de la feature `produccion`.
- Las órdenes nacen desde una receta válida del tenant.
- Los ingredientes y sus desperdicios son parte central del costo y de la disponibilidad.
- El módulo usa validaciones de materiales y estados productivos definidos por constantes compartidas.

## Qué conviene cuidar

- Si la receta está mal armada, toda la orden arrastra mal costo y consumo.
- Producción impacta stock y composición, así que no conviene tratarla como un simple checklist.
- Antes de completar una orden, revisá materiales y rendimiento real.

## Referencias útiles

- `src/app/busy/produccion/page.tsx`
- `src/features/produccion/actions.ts`
- `src/lib/utils/produccion.ts`

## En una frase

Convierte recetas en producción ejecutable con control de materiales, costo y estado.
