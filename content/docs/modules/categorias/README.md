# Categorías

> Organiza la taxonomía del catálogo y soporta modo CLAS/EAN-13 cuando el tenant trabaja con clasificación oficial.

## Qué hace

Este módulo define cómo se agrupan los productos dentro del sistema. En modo normal trabaja con categorías y subcategorías. En modo EAN-13 cambia a secciones y específicos CLAS, alterando labels, validaciones y parte del comportamiento del catálogo.

## Qué incluye

- CRUD completo de categorías del tenant
- vista jerárquica con conteo de productos
- validación de unicidad, jerarquía y borrado
- soporte de modo EAN-13 / CLAS
- labels dinámicos según configuración de empresa

## Cuándo usarlo

- Cuando querés ordenar el catálogo en grupos reutilizables.
- Cuando el negocio necesita clasificar productos por CLAS y EAN-13.
- Cuando productos, filtros y formularios dependen de una taxonomía consistente.

## Reglas importantes

- Si el plan incluye `categorias-ean13` y Mi Empresa tiene `usaCodigoEan13=true`, la categoría pasa a representar sección CLAS y la subcategoría pasa a representar específico CLAS.
- El clasificador oficial se parsea desde `public/clasificador.md`.
- Los nombres pueden autocompletarse según el específico CLAS seleccionado.
- La eliminación valida dependencias y puede requerir reasignación dentro del árbol.

## Qué conviene cuidar

- Si la taxonomía está mal planteada, productos, EAN-13 y filtros quedan incoherentes.
- El modo EAN-13 no es solo visual: cambia reglas de negocio reales.
- Conviene mantener una jerarquía clara antes de cargar grandes volúmenes de productos.

## Rutas y referencias

- `src/features/categorias/actions.ts`
- `src/features/categorias/lib/category-labels.ts`
- `src/lib/clas-classifier.ts`
- `src/lib/categoria-validation.ts`

## En una frase

Es la estructura que le da sentido al catálogo, tanto en modo normal como en modo CLAS/EAN-13.
