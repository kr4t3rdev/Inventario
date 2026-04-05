# Tasks: recetas-ingredientes-unidades

> Spec: `openspec/changes/recetas-ingredientes-unidades/specs/produccion/spec.md`
> Req refs: REQ-01 a REQ-08

---

## Phase 1 — Schema + Migración

- [x] **1.1** Agregar campo `unidadSimbolo String?` al modelo `RecetaIngrediente` en `prisma/schema.prisma`
- [x] **1.2** Ejecutar `pnpm dlx prisma db push` para sincronizar la DB (acepta data-loss = `false`, solo agrega columna nullable)
- [x] **1.3** Ejecutar `pnpm dlx prisma generate` para regenerar el cliente

---

## Phase 2 — Utilidad de Conversión

- [x] **2.1** Crear `src/lib/utils/unit-converter.ts` con:
  - Constantes `MASS_TO_GRAMS` y `VOLUME_TO_ML`
  - Función `convertToBase(cantidad, simbolo)` → retorna número en unidad base
  - Función `formatIngrediente(cantidad, simbolo, nombre)` → string `"2 lb Arroz"`
  - Función `formatIngredientesList(ingredientes, maxVisible?)` → string con truncado
  - Export `MASS_UNITS` y `VOLUME_UNITS` (arrays de strings) para el Select del UI
- [x] **2.2** Escribir tests unitarios en `src/lib/__tests__/produccion.test.ts`:
  - `convertToBase`: `lb→g`, `kg→g`, `oz→g`, `L→ml`, `cup→ml`, `null→pass-through`, `'unidad'→pass-through`
  - `formatIngrediente`: con unidad, sin unidad, cantidad decimal
  - `formatIngredientesList`: lista corta, lista larga (truncado `+N más`), lista vacía

---

## Phase 3 — Backend: ingredientes/route.ts

- [x] **3.1** Actualizar schema Zod en `src/app/api/produccion/recetas/[id]/ingredientes/route.ts`:
  - Agregar `unidadSimbolo: z.string().optional().nullable()` al objeto de ingrediente
- [x] **3.2** En el `createMany` de ingredientes, incluir `unidadSimbolo: ing.unidadSimbolo ?? null`
- [x] **3.3** Corregir fórmula de `costoUnitario`:
  - Importar `convertToBase` de `@/lib/utils/unit-converter`
  - Calcular `cantidadBase = convertToBase(ing.cantidad, ing.unidadSimbolo)`
  - Acumular `costoTotal += precioCosto × cantidadBase × (1 + desperdicio)`
  - Al final: `costoUnitario = costoTotal / (recetaExistente.rendimiento || 1)`
- [x] **3.4** En el `include` de `recetaActualizada` agregar `unidadSimbolo` al select de `RecetaIngrediente`

---

## Phase 4 — Backend: ordenes/aprobar/route.ts

- [x] **4.1** Localizar el endpoint `POST /api/produccion/ordenes/[id]/aprobar`
- [x] **4.2** Importar `convertToBase` de `@/lib/utils/unit-converter`
- [x] **4.3** Al iterar ingredientes para descontar stock, calcular:
  - `cantidadBase = convertToBase(ing.cantidad, ing.unidadSimbolo)`
  - `totalDescontar = cantidadBase × orden.cantidad`
  - Usar `totalDescontar` en el `decrement` de stock (en vez de `ing.cantidad × canton`)

---

## Phase 5 — Frontend: Dialog Crear Receta

- [x] **5.1** Agregar estado `nuevoItems: Array<{ productoId: string; cantidad: number; desperdicio: number; unidadSimbolo: string | null }>` en `page.tsx`
- [x] **5.2** Agregar handlers `agregarItemNuevo`, `actualizarItemNuevo`, `eliminarItemNuevo` (misma lógica que `edit-` variants)
- [x] **5.3** En `handleCrearReceta`: después de `createReceta().unwrap()`, si `nuevoItems.length > 0`, llamar `setIngredientes({ recetaId, ingredientes: nuevoItems })`; luego resetear `nuevoItems = []`
- [x] **5.4** En el JSX del dialog "Nueva Receta" agregar sección "Ingredientes":
  - Título + botón "Agregar ingrediente"
  - Por cada item en `nuevoItems`: `[Select producto] [Input cantidad] [Select unidad] [Input desperdicio%] [Trash]`
  - Select de unidad: opciones agrupadas (Masa: g, kg, lb, oz | Volumen: ml, L, fl oz, tsp, tbsp, cup | Sin conversión: unidad, pieza)
  - Item vacío: `{ productoId: '', cantidad: 1, desperdicio: 0, unidadSimbolo: null }`

---

## Phase 6 — Frontend: Dialog Editar Receta

- [x] **6.1** Actualizar el tipo de `editItems` para incluir `unidadSimbolo: string | null`
- [x] **6.2** Al abrir el dialog de edición (`setRecetaEdit`), mapear `receta.RecetaIngrediente` incluyendo `unidadSimbolo`
- [x] **6.3** En el JSX del dialog de edición agregar el Select de unidad (mismo patrón que 5.4)
- [x] **6.4** En `handleGuardarEdicion`, pasar `unidadSimbolo` en los items de ingredientes

---

## Phase 7 — Frontend: Tabla de Recetas

- [x] **7.1** Importar `formatIngredientesList` de `@/lib/utils/unit-converter`
- [x] **7.2** Columna "Ingredientes": reemplazar `receta.ingredientes?.length || 0` por `formatIngredientesList(receta.RecetaIngrediente ?? receta.ingredientes ?? [])`
- [x] **7.3** Columna "Producto Asociado": reemplazar `receta.producto?.nombre || '-'` por lista de nombres de ingredientes:
  ```tsx
  const insumos = (receta.RecetaIngrediente ?? []).map((i: any) => i.Producto?.nombre).filter(Boolean)
  insumos.length > 0 ? insumos.slice(0, 2).join(', ') + (insumos.length > 2 ? ` +${insumos.length - 2}` : '') : '-'
  ```

---

## Phase 8 — Frontend: Dialog Ver Receta

- [x] **8.1** Agregar la unidad al render de cada ingrediente en el dialog "Ver Receta":
  - Formato: `"2 lb Arroz (5% desperdicio)"` usando `formatIngrediente`
- [x] **8.2** Mostrar `costoUnitario` ya calculado en el footer del dialog (ya existe, verificar que usa valor actualizado)

---

## Phase 9 — Verificación

- [x] **9.1** Correr `pnpm run test:run` y documentar estado del suite
  - Resultado: el suite global reporta fallas preexistentes fuera de alcance.
  - Verificación focalizada del cambio: `pnpm vitest run src/lib/__tests__/produccion.test.ts` pasa (incluye tests de `unit-converter`).
- [x] **9.2** Verificar manualmente:
  - Crear receta con 2 ingredientes distintos y unidades diferentes → costoUnitario correcto
  - Tabla: "Ingredientes" muestra texto descriptivo, "Producto Asociado" muestra insumos
  - Aprobar una orden → stock descontado correctamente con conversión
  - Evidencia (script E2E contra rutas reales):
    - `costoUnitarioEsperado=199.79023999999998`, `costoUnitarioActual=199.79024`
    - `textoIngredientes="2 lb Arroz ..., 500 g Sal ..."`, `insumos=[Arroz..., Sal...]`
    - `decrementoStockA=1996`, `decrementoStockB=1000`

---

## Dependencies

```
Phase 1 (schema) → Phase 2 (util) → Phase 3 (backend ingredientes)
Phase 1 (schema) → Phase 4 (backend aprobar)
Phase 2 (util) → Phase 3, 4, 7, 8
Phase 3 (backend) → Phase 5, 6 (frontend dialogs)
Phase 5, 6, 7, 8 → Phase 9 (verificación)
```

## File Map

| Archivo | Phases |
|---------|--------|
| `prisma/schema.prisma` | 1.1 |
| `src/lib/utils/unit-converter.ts` | 2.1 (nuevo) |
| `src/lib/__tests__/produccion.test.ts` | 2.2 |
| `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` | 3.1–3.4 |
| `src/app/api/produccion/ordenes/[id]/aprobar/route.ts` | 4.1–4.3 |
| `src/app/busy/produccion/page.tsx` | 5.1–8.2 |
