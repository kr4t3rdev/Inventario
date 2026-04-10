# Design: Production Canonical Unit Normalization

**Status**: Design Phase  
**Last Updated**: 2026-04-10

## Technical Approach

La implementación adopta el producto del catálogo como **fuente de verdad** para la unidad operativa. La UI puede capturar una unidad equivalente; el backend valida la categoría física, convierte a la unidad canónica del producto y recién después persiste ingredientes y recalcula costo.

Esto reemplaza la ambigüedad actual:
- hoy la validación es por categoría, pero la spec exigía igualdad exacta;
- hoy create bloquea por warnings y edit no;
- hoy la API guarda con warnings en vez de decidir explícitamente entre normalización o rechazo.

## Architecture Decisions

### Decision: Normalizar en backend, no solo advertir
**Choice**: el backend convierte y persiste en unidad canónica.  
**Alternatives considered**: warning sin conversión; coincidencia exacta de símbolo.  
**Rationale**: la verdad del dominio debe vivir en la API; warnings solos no garantizan consistencia.

### Decision: Mantener validación por categoría física
**Choice**: `mass ↔ mass`, `volume ↔ volume`, `unit ↔ unit`.  
**Alternatives considered**: símbolo exacto.  
**Rationale**: el convertidor existente ya soporta equivalencias seguras y evita fricción innecesaria.

### Decision: Tratar `null` como inválido para magnitudes medibles
**Choice**: `null`/vacío solo es válido cuando el producto canónico es discreto (`unidad`/`pieza`).  
**Alternatives considered**: seguir mapeando `null` a `unit` siempre.  
**Rationale**: hoy esa heurística mezcla ausencia de dato con unidad discreta y produce errores semánticos.

### Decision: Unificar feedback de create/edit
**Choice**: la misma función de validación/preview alimenta ambos flujos.  
**Alternatives considered**: mantener reglas separadas.  
**Rationale**: la UX actual es inconsistente y permite editar estados que create prohíbe.

## Data Flow

```text
UI item (cantidad + unidad ingresada)
  -> preview local de compatibilidad
  -> POST /recetas/[id]/ingredientes
     -> cargar producto + unidad canónica
     -> validar categoría
     -> convertir cantidad a base
     -> convertir desde base a unidad canónica
     -> persistir unidad canónica + cantidad normalizada
     -> recalcular costo de receta
     -> devolver unitNormalizations / unitErrors
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/validators/production-units.ts` | Modify | Separar compatibilidad, bloqueos y payload de normalización. |
| `src/lib/validators/production-units.test.ts` | Modify | Cubrir canonical normalization, `null` inválido en mass/volume y errores estructurados. |
| `src/lib/utils/unit-converter.ts` | Modify | Agregar helper para convertir entre unidad origen y unidad canónica vía unidad base. |
| `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` | Modify | Validar, normalizar, bloquear incompatibles y devolver `unitNormalizations` / `unitErrors`. |
| `src/app/busy/produccion/page.tsx` | Modify | Unificar create/edit; mostrar preview de normalización y bloqueo consistente. |
| `src/app/busy/produccion/__tests__/unit-validation-e2e.test.ts` | Modify | Verificar create/edit con normalización y bloqueo. |
| `src/app/models/model.ts` | Modify | Tipar nuevas respuestas `unitNormalizations` y `unitErrors`. |
| `src/lib/redux/services/produccionApi.ts` | Modify | Ajustar contratos RTK Query a la nueva respuesta. |

## Interfaces / Contracts

```ts
interface UnitNormalization {
  productoId: string;
  productoNombre: string;
  providedUnit: string | null;
  canonicalUnit: string | null;
  originalCantidad: number;
  normalizedCantidad: number;
}

interface UnitError {
  productoId: string;
  productoNombre: string | null;
  providedUnit: string | null;
  canonicalUnit: string | null;
  reason: 'incompatible_category' | 'missing_unit' | 'unknown_unit' | 'missing_product';
}
```

Respuesta exitosa:
```ts
{ ...receta, unitNormalizations?: UnitNormalization[] }
```

Respuesta bloqueante:
```ts
{ error: string; unitErrors: UnitError[] }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | conversión origen -> canónica | Vitest sobre helper nuevo en `unit-converter.ts` |
| Unit | validación `null` y categorías | Vitest en `production-units.test.ts` |
| Integration | persistencia atómica normalizada | test API `recetas/[id]/ingredientes/route.ts` |
| Integration | contrato `unitErrors` | test API con incompatibles |
| E2E | create/edit con preview + bloqueo | actualizar `unit-validation-e2e.test.ts` |

## Migration / Rollout

No migration required. Las recetas existentes se siguen leyendo igual; la nueva regla aplica en altas y ediciones futuras. Si aparecen recetas viejas con unidades no canónicas, la UI las mostrará pero la próxima edición las normalizará.

## Open Questions

- [ ] Si una receta existente tiene `unidadSimbolo` incompatible con el catálogo actual, ¿la UI debe bloquear edición total o solo bloquear guardar hasta corregir?
