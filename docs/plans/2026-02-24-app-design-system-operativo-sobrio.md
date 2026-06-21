# Design System Unificado - Operativo Sobrio

Fecha: 2026-02-24
Estado: aplicado en capa base UI

## Objetivo

Unificar el look and feel de toda la aplicacion con una direccion visual operativa,
sobria y orientada a productividad para contextos ERP/POS/Inventario.

## Principios visuales

- Priorizar legibilidad de datos sobre decoracion.
- Contraste alto y jerarquia tipografica clara.
- Superficies neutras con acento azul institucional.
- Componentes compactos pero tactiles (altura base 40px).
- Estados interactivos consistentes: hover, focus, disabled, selected.

## Paleta y tokens

- Fondo: neutro frio claro.
- Primario: azul institucional (no morado).
- Superficies: escala gris-azulada para tarjetas, tablas y paneles.
- Bordes: suaves pero visibles para separar bloques de datos.
- Soporte dark mode con el mismo lenguaje de color.

Tokens principales centralizados en `src/app/globals.css`.

## Componentes base unificados

Se normalizo la capa base en `src/components/ui/*` para que el cambio impacte en toda
la aplicacion sin refactor grande por pantalla.

- `table.tsx`: estilo unico de tabla (contenedor, header, row, cell, selected).
- `button.tsx`: variantes coherentes con alturas y radios estandarizados.
- `input.tsx`, `textarea.tsx`, `select.tsx`: campos de formulario consistentes.
- `card.tsx`: superficies de contenido estandar.
- `badge.tsx`: semantica de estado compacta y uniforme.
- `dialog.tsx`: modales con estructura y jerarquia unificada.
- `data-table.tsx`: tabla tanstack alineada con el nuevo lenguaje visual.

## Patron unico de tablas

Regla de proyecto:

1. Para tablas custom: usar `@/components/ui/table` (Table, TableHeader, TableRow, etc).
2. Para tablas con sorting/filter/pagination: usar `@/components/data-table`.
3. Evitar crear nuevas variantes de estilos de tabla fuera de esos componentes.

## Reglas para nuevos componentes

- Reusar primitives de `src/components/ui` en lugar de estilos locales ad hoc.
- Mantener clases utilitarias enfocadas en layout, no en look base.
- Evitar gradientes llamativos en flujos operativos internos.
- Usar `font-medium` para etiquetas y `font-semibold` solo para valores clave.

## Migracion incremental sugerida

1. Reemplazar tablas HTML puras (`<table>`) en vistas operativas por `ui/table`.
2. Consolidar componentes `*table.tsx` que repitan toolbar/paginacion en `DataTable`.
3. Auditar formularios legacy y eliminar overrides visuales conflictivos.
4. Documentar variantes semanticas de `Badge` por estado de negocio.

## Criterio de done UI

Una vista se considera alineada al design system cuando:

- Usa primitives `ui/*` para controles base.
- Usa `ui/table` o `DataTable` para datos tabulares.
- No introduce colores de marca alternos en componentes operativos.
- Mantiene spacing y densidad consistentes con la capa base.
