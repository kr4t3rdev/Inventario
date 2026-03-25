# Proposal: Módulo de Producción

## Summary

Crear un nuevo módulo de producción para gestionar el proceso de manufactura, incluyendo recetas para productos elaborados (similar a las elaboraciones pero para productos del inventario), órdenes de producción, vales de salida de productos por conceptos, y costos de producción.

## Intent

Permitir a la empresa gestionar su proceso de producción de manera integrada con el inventario existente, calculando automáticamente necesidades de materiales, costos, generando productos terminados que aparecen en el clasificador, y registrando salidas de productos por diversos conceptos.

## Affected Areas

- inventory (integración con productos, categorías/clasificador, movimientos de inventario)
- contabilidad (costos de producción, conceptos derivados de GastosDE)
- restaurante (recetas existentes - expandir para productos)

## Scope

### In Scope

- Crear y gestionar recetas para productos elaborados
- El producto final debe aparecer en el inventario existente (no en clasificador)
- Crear, aprobar y completar órdenes de producción
- Registrar consumo de materia prima
- Calcular costos de producción (materiales y mano de obra)
- Vales de salida de productos por conceptos (derivados de GastosDE)
- Historial de estados de producción y vales de salida

### Out of Scope

- Programación avanzada de producción (MRP)
- Gestión de maquinaria y capacidad
- Control de calidad

## Approach

Se expandirá el sistema existente de Recetas/OrdenProduccion (actualmente vinculado solo a Plato) para también vincularse a Productos del inventario. Los vales de salida usarán los tipos de GastosDE como conceptos disponibles.

## Example Production Flow

```
Entrada:
- Refresco Instantáneo 20g x 1 = 1
- Producto: Refresco Instantáneo 1L Sin marca
- Rendimiento: 1

Salida (inventario):
- El producto generado aparece en el inventario existente
```

## Vale de Salida Conceptos

Los conceptos para los vales de salida se derivarán de los tipos de GastosDE existentes:
- Arrendamiento
- Mantenimiento
- Telefonía
- Servicios
- Otros (opción libre)
