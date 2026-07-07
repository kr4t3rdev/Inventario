# Ficha de Costo

> Analiza costo, margen, variación, merma, historial y sugerencias de precio para productos y servicios.

## Qué hace

Este módulo es una capa analítica profunda sobre catálogo y compras. Para productos simples calcula CPP, para compuestos calcula costo compuesto desde receta, y para servicios toma compras de servicio históricas cuando la moneda es consistente. Además agrega alertas de margen bajo, plantillas, cambios masivos y dashboards de rentabilidad.

## Qué incluye

- ficha individual por producto o servicio
- cálculo de costo consolidado
- margen y variación contra precio/costo cargado
- mermas de los últimos 30 días
- historial de costos y cambios de precio
- composición de costo
- ventas asociadas
- plantillas y sugerencias de precio
- acciones bulk y dashboard de rentabilidad

## Cuándo usarlo

- Cuando querés decidir si un producto se vende con margen sano o a pérdida.
- Cuando necesitás revisar costo real antes de cambiar precios.
- Cuando querés comparar productos simples, compuestos y servicios desde una misma lógica financiera.

## Reglas importantes

- Para productos simples se apoya en CPP e historial de compras.
- Para productos compuestos usa receta y costo compuesto server-side.
- Para servicios exige compras con moneda histórica consistente para calcular costo confiable.
- Genera advertencias por margen bajo o negativo.

## Qué conviene cuidar

- Si compras, recetas o precioCosto están mal, la ficha también queda mal.
- El módulo sirve para decidir precios, así que conviene leerlo junto a ventas y mermas.
- Una ficha sin datos suficientes no es un error visual: suele indicar falta de trazabilidad real.

## Rutas y referencias

- `/busy/ficha-costo`
- `/busy/ficha-costo/[id]`
- `/busy/ficha-costo/bulk`
- `src/features/ficha-costo/actions.ts`
- `src/features/ficha-costo/actions-ficha.ts`
- `src/features/ficha-costo/actions-alertas.ts`

## En una frase

Es el laboratorio de rentabilidad del sistema para saber cuánto cuesta de verdad lo que vendés.
