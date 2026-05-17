# Spec: react-doctor-critical-fixes

## Requirements

### R1 — Extraer componente anidado

Extraer `StockChange` del cuerpo de `VentaInter` al scope del módulo para evitar que se re-cree en cada render.

- **Funcional**: El diálogo de cambio de stock debe funcionar exactamente igual que antes
- **No funcional**: El componente no debe re-crearse en cada render de `VentaInter`
- **Regresión**: El estado interno de `StockChange` (diálogo abierto/cerrado, loading, etc.) debe persistir entre renders de `VentaInter`

### R2 — Reemplazar index como key

Reemplazar `key={idx}` / `key={index}` / `key={i}` por una key estable basada en un ID único del item.

- **Funcional**: Las listas deben renderizar correctamente sin importar reordenamientos, filtros o mutaciones
- **No funcional**: No debe haber regresión visual ni funcional en ningún listado
- **Regresión**: El estado interno de elementos de lista (inputs, selects, acordeones) debe mantenerse correctamente después del cambio

### R3 — Agregar aria-controls a combobox

Agregar la propiedad requerida `aria-controls` a elementos con `role="combobox"`.

- **Funcional**: Screen readers deben poder navegar el combobox correctamente
- **No funcional**: Sin regresión visual o funcional
- **Regresión**: El comportamiento del combobox (selección, filtrado) debe ser idéntico

## Scenarios

### S1 — Componente anidado

**Antes**: `StockChange` definido dentro de `VentaInter`. Cada vez que `VentaInter` se renderiza (por cualquier cambio de estado/props), `StockChange` se vuelve a definir desde cero. Si el usuario abre el diálogo de stock change y ocurre un re-render de `VentaInter`, el diálogo se cierra.

**Después**: `StockChange` definido fuera de `VentaInter`. Los re-renders de `VentaInter` NO afectan la identidad de `StockChange`. El diálogo permanece abierto si el usuario lo abrió.

**Qué NO debe cambiar**: La UI del diálogo, el comportamiento de submit, el manejo de errores, el texto de los botones.

### S2 — Index como key

**Antes**:
```tsx
{items.map((item, idx) => (
  <tr key={idx}>...</tr>
))}
```
Si `items` se reordena (sort, filter), React reusa los mismos nodos DOM en el orden del índice anterior → los inputs/edit fields muestran datos incorrectos.

**Después**:
```tsx
{items.map((item) => (
  <tr key={item.id}>...</tr>
))}
```
Si `items` se reordena, React mueve los nodos DOM correctamente → cada item mantiene su estado visual.

**Qué NO debe cambiar**: El contenido visual de cada item, el orden en pantalla, los datos mostrados.

### S3 — ARIA combobox

**Antes**:
```tsx
<div role="combobox" aria-expanded={isOpen}>
```

**Después**:
```tsx
<div role="combobox" aria-expanded={isOpen} aria-controls={listboxId}>
```

**Qué NO debe cambiar**: La funcionalidad de selección, el filtrado, el comportamiento visual.

## Acceptance Criteria

- [ ] **AC1**: `StockChange` movido fuera de `VentaInter`. Componente compila sin errores. Diálogo funciona en test manual.
- [ ] **AC2**: Todos los `key={idx}` reemplazados por keys estables. Build pasa sin errores. No hay warnings de "key" en consola.
- [ ] **AC3**: Todos los `role="combobox"` tienen `aria-controls`. Build pasa sin errores. React Doctor no reporta más errores de `role-has-required-aria-props`.
- [ ] **AC4**: `pnpm run build` exitoso sin errores de TypeScript.
- [ ] **AC5**: `pnpm run lint` exitoso sin nuevos errores.
- [ ] **AC6**: Los 3 tests de React Doctor que pasaban a "error" ahora no aparecen más.

## Edge Cases

### Componente anidado
- **EC1**: `StockChange` puede estar usando variables del closure de `VentaInter` (props, state, funciones). Verificar y pasar explícitamente.
- **EC2**: `StockChange` puede tener dependencias de tipos definidos dentro de `VentaInter`. Mover tipos también.

### Index como key
- **EC1**: Algunas listas pueden no tener un campo `id` único. En ese caso, buscar `uuid`, `slug`, `codigo`, `ventaId`, `productoId`, o componer una key de campos múltiples.
- **EC2**: Listas anidadas donde `idx` se usa en múltiples niveles — verificar cada nivel por separado.
- **EC3**: Datos temporales (nuevos items no guardados) que no tienen ID — en ese caso usar un fallback como `temp-${idx}` combinado con un identificador.
- **EC4**: Fragmentos `<>...</>` o `React.Fragment` — la key va en el fragment o en el elemento contenedor.

### ARIA combobox
- **EC1**: El `listboxId` debe ser único en el DOM. Verificar que no haya colisiones de IDs.
- **EC2**: Si el combobox no tiene un listbox visible, `aria-controls` debe apuntar igual al elemento del listbox (aunque esté oculto).
