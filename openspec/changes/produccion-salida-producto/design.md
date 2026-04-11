# Design: Configuración de producto de salida para recetas de producción

## Resumen técnico

Se mantiene intacto el contrato actual de `completar orden`: una orden completada incrementa stock del `productoId` asociado a la receta. El cambio ocurre antes, en la configuración de la receta. La UI de recetas de producción debe ofrecer dos caminos explícitos para definir la salida: **usar producto existente** o **crear producto nuevo**. En ambos casos, la receta debe terminar con `productoId` resuelto antes de quedar operativa.

## Arquitectura

### 1. Selector de modo de salida

En `src/app/busy/produccion/page.tsx` se agrega un selector de modo:

- `existing`: usa el selector actual de productos
- `create`: abre o renderiza el formulario de alta de producto

La UI deja de presentar el producto final como “opcional” para flujos productivos.

### 2. Integración con catálogo

La creación del producto nuevo NO debe duplicar reglas. Se debe reutilizar el contrato existente de creación de productos del catálogo: mismo payload válido, mismas validaciones y mismos defaults. El resultado esperado es un producto persistido y un `id` reutilizable de inmediato por la receta.

### 3. Asociación automática a receta

Cuando el usuario crea un producto desde la receta:

1. se guarda primero el producto en catálogo;
2. se toma el `id` resultante;
3. se asigna como `productoId` de la receta;
4. luego la receta se crea o actualiza normalmente.

Si falla el alta del producto, la receta no debe guardarse con un vínculo roto.

### 4. Compatibilidad hacia atrás

Las recetas viejas sin `productoId` siguen existiendo, pero deben mostrarse como incompletas o bloquearse en flujos operativos. No se modifica la lógica de `/api/produccion/ordenes/[id]/completar/route.ts`; solo se fortalece la configuración previa y las validaciones de entrada.

## Decisiones

- **Mantener flujo de completado**: evita tocar una ruta crítica de inventario.
- **Reutilizar alta de catálogo**: evita duplicación de lógica y drift de validaciones.
- **Resolver producto antes de persistir receta**: garantiza consistencia transaccional a nivel de flujo.

## Riesgos

- El form estándar de productos puede requerir adaptación para embebido/modal.
- Si la creación inline no retorna una entidad normalizada, la receta podría necesitar mapeo extra.
- Las recetas legacy requerirán UX clara para reparación.
