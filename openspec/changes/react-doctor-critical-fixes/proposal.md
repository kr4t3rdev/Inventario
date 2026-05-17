# Proposal: react-doctor-critical-fixes

## Intent

Corregir los bugs de **corrección** detectados por React Doctor que pueden causar errores en runtime, pérdida de estado en componentes, y problemas de accesibilidad. Este es el primer cambio de una serie planificada para abordar los 5,023 diagnostics del análisis.

El criterio de selección es **riesgo real para el usuario**: bugs que ya están afectando el comportamiento actual de la aplicación.

## Scope

### In scope

1. **Componente anidado** (ERROR, 1 archivo)
   - `StockChange` definido dentro de `VentaInter` en `venta-Inter.tsx:69`
   - Causa: cada render de `VentaInter` recrea `StockChange` desde cero, perdiendo todo su estado interno (useState, useEffect, etc.)
   - Fix: Extraer `StockChange` a módulo independiente o al scope del módulo

2. **Index como key en listas** (58 instancias, ~30 archivos)
   - Uso de `key={idx}`, `key={index}` en lugar de una ID estable (item.id, item.slug, etc.)
   - Causa: cuando la lista se reordena, filtra o modifica, React re-renderiza elementos incorrectos porque el índice ya no corresponde al mismo item. State visual (inputs, selects, acordeones abiertos) se pierde o se asigna al elemento equivocado.
   - Fix: Reemplazar con `key={item.id}` o equivalente único estable

3. **ARIA combobox sin aria-controls** (ERROR, 3 archivos)
   - Roles `combobox` sin la propiedad requerida `aria-controls`
   - Causa: screen readers no pueden asociar el combobox con su listbox, rompiendo la navegación por teclado
   - Fix: Agregar `aria-controls` apuntando al ID del listbox asociado

### Out of scope (próximos cambios)

- Next.js metadata faltante (109 pages)
- Performance: useRef en vez de useState (85), useReducer (82)
- Bundle: LazyMotion (172 imports)
- Render: fetch en useEffect (36)
- Effects: cascading setState (66), derived useState (30)
- Accesibilidad: labels sin asociación (35)
- Tailwind cleanup: size shorthand, palette, gap, bold headings (~3,500 diagnostics)

## Approach

### 1. Componente anidado (`venta-Inter.tsx`)

**Diagnóstico**: `StockChange` es un componente con estado interno que renderiza un diálogo de cambio de stock. Está definido dentro del cuerpo de `VentaInter`.

**Fix**: Mover la definición de `StockChange` al nivel del módulo (fuera de `VentaInter`). Si necesita props de `VentaInter`, pasarlas explícitamente.

**Riesgo**: Bajo. El componente ya existe y funciona — solo cambia dónde está definido. Asegurarse de que todas las props que usa desde el closure de `VentaInter` se pasen explícitamente como props.

### 2. Index como key (58 instancias)

**Diagnóstico**: Uso generalizado de `key={idx}` / `key={index}` en `.map()`.

**Fix**: Identificar la propiedad única en cada dataset (`id`, `ventaId`, `productoId`, `slug`, etc.) y reemplazar el key.

**Riesgo**: Medio-Bajo. Cada cambio es pequeño y localizado. El riesgo está en equivocar el nombre de la propiedad key (usar una que no es única). Mitigación: revisar el tipo de datos para identificar la PK/ID real.

**Estrategia**: Procesar archivo por archivo, no todos de golpe, para minimizar riesgo. Idealmente 2-3 archivos por commit para que sea revisable.

### 3. ARIA combobox (3 archivos)

**Diagnóstico**: `combobox` role sin `aria-controls`.

**Fix**: Agregar `aria-controls={listboxId}` donde `listboxId` es el ID del elemento que contiene las opciones.

**Riesgo**: Muy bajo. Solo se agregan atributos HTML, no cambia lógica.

## Risk Assessment

| Issue | Riesgo | Qué podría romperse | Mitigación |
|-------|--------|---------------------|------------|
| Componente anidado | Bajo | Si el componente usa variables del closure, esas variables ya no estarán disponibles | Pasar todo como props explícitas |
| Index como key | Medio | Si se usa una key no única, React va a mezclar elementos o dar warning. Si la key correcta no es obvia, puede elegirse mal. | Revisar tipo de datos, buscar campo ID, probar con listas cortas |
| ARIA combobox | Muy bajo | Solo atributos HTML adicionales | Ninguna necesaria |

## Dependencies

Ninguna. Este cambio es independiente.

## Estimated Effort

Small-Medium: ~30-60 minutos con revisión.

- Componente anidado: 5 min
- Index as key: 25-45 min (58 instancias distribuidas)
- ARIA combobox: 5 min
- Testing y verificación: 10 min
