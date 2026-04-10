## Exploration: Nuevo comportamiento de unidades en el módulo de producción

### Current State
Hoy el backend de recetas valida compatibilidad de unidades por **categoría** (`mass`, `volume`, `unit`, `unknown`) en `src/lib/validators/production-units.ts`, no por símbolo exacto. Eso significa que `kg` y `g` se consideran compatibles, igual que `L` y `ml`.

En `src/app/api/produccion/recetas/[id]/ingredientes/route.ts`, si hay incompatibilidades la API **igualmente guarda** los ingredientes y solo devuelve `unitWarnings`. Después convierte cantidades a unidad base con `convertToBase()` para recalcular costo.

En `src/app/busy/produccion/page.tsx`, la UI bloquea **crear receta nueva** si detecta warnings en los items cargados localmente, pero el flujo de **editar receta** no aplica el mismo guard. O sea: el comportamiento hoy no es uniforme entre create/edit ni entre frontend/backend.

Además, la spec de `openspec/changes/production-error-handling/SPEC.md` dice: “si producto catálogo usa `kg`, ingrediente debe especificar `kg`”, pero el código real HOY permite `kg` ↔ `g`. Hay una inconsistencia de negocio que hay que resolver antes de implementar más cambios.

### Affected Areas
- `src/lib/validators/production-units.ts` — define la regla central de compatibilidad y warnings.
- `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` — hoy persiste ingredientes aunque sean incompatibles y recalcula costo.
- `src/app/busy/produccion/page.tsx` — bloquea creación, pero no edición; la UX no es consistente.
- `src/lib/utils/unit-converter.ts` — convierte a base para costos; depende de que la semántica de compatibilidad esté clara.
- `src/lib/utils/produccion.ts` — calcula costo unitario usando cantidades ya convertidas.
- `src/lib/redux/services/produccionApi.ts` — contrato actual asume respuesta exitosa con `unitWarnings`.
- `src/lib/validators/production-units.test.ts` — codifica el comportamiento actual por categorías.
- `src/app/busy/produccion/__tests__/unit-validation-e2e.test.ts` — verifica la UX actual de warning/bloqueo.
- `openspec/changes/production-error-handling/SPEC.md` — expresa una regla más estricta que la implementación actual.

### Approaches
1. **Compatibilidad por categoría con bloqueo consistente** — mantener la lógica actual (`kg` con `g`, `L` con `ml`) pero volverla consistente en backend y frontend.
   - Pros: aprovecha `convertToBase()`, es flexible, requiere menos cambios de datos y menos fricción operativa.
   - Cons: contradice la spec actual; deja ambigüedad semántica si el negocio quiere “misma unidad declarada”.
   - Effort: Medium

2. **Coincidencia exacta de símbolo** — exigir que receta y catálogo usen exactamente el mismo símbolo (`kg` solo con `kg`, `g` solo con `g`).
   - Pros: regla simple de explicar, evita interpretaciones, alinea con la spec actual.
   - Cons: es más rígida, rompe casos hoy considerados válidos (`kg`/`g`, `L`/`ml`), aumenta fricción de carga y mantenimiento de catálogo.
   - Effort: Medium

3. **Compatibilidad por categoría + unidad canónica por producto** — permitir equivalencias físicas, pero exigir que cada producto tenga una “unidad operativa canónica” y que la UI sugiera/normalice automáticamente al guardar.
   - Pros: conserva flexibilidad técnica, baja errores humanos, deja una base sólida para stock/costo/auditoría.
   - Cons: requiere más diseño: normalización, migración de UX, posible backfill de catálogo y mensajes más sofisticados.
   - Effort: High

### Recommendation
Recomiendo la **opción 3** como comportamiento objetivo y la **opción 1** como paso intermedio si querés iterar sin romper flujos existentes.

¿Por qué? Porque el problema real NO es solo “validar unidades”; es definir la semántica operativa del módulo. Si inventario, recetas y costos trabajan con unidades distintas sin una convención canónica, tarde o temprano terminás con reglas parcheadas. La opción 3 ordena el dominio: el producto tiene una unidad oficial, la receta puede capturarse con equivalencias compatibles, y el sistema normaliza antes de persistir o calcular.

Si necesitás un cambio rápido, la opción 1 permite cerrar la inconsistencia actual: misma regla en create/edit/backend, respuesta explícita de error o warning según severidad, y spec actualizada para reflejar compatibilidad por categoría.

### Risks
- Cambiar a coincidencia exacta puede invalidar recetas existentes que hoy funcionan con conversión legítima.
- Mantener warnings solo en frontend sigue dejando huecos si otro cliente consume la API.
- `null`/sin unidad hoy cae en categoría `unit`; eso puede generar falsos incompatibles y requiere una definición de negocio explícita.
- Si no se corrige la spec, el equipo puede seguir implementando contra reglas contradictorias.

### Ready for Proposal
Yes — listo para propuesta, pero con una decisión previa MUY concreta: **¿el negocio quiere igualdad exacta de símbolo o equivalencia física con normalización canónica?** La propuesta debe arrancar resolviendo esa contradicción.
