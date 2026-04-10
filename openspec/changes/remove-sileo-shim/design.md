# Design: Remove Sileo Shim

## 1. Objetivo técnico

Eliminar `src/lib/sileo-shim.ts` y converger todo `src/` a imports directos desde `sonner`, manteniendo equivalencia visible de toasts y sin introducir una nueva capa de abstracción.

## 2. Estado actual relevante

El proyecto ya está en estado híbrido: muchas pantallas usan `toast` desde `sonner`, mientras un grupo residual de componentes, formularios y utilidades importa `sileo` desde `@/lib/sileo-shim`. El shim no contiene lógica de negocio; solo adapta una API basada en objeto hacia Sonner. El `Toaster` ya está montado en `src/app/busy/layout.tsx`, por lo que la infraestructura de renderizado no requiere cambios. También hay utilidades compartidas, como `src/components/contabilidad/toast-notifications.tsx`, que hoy centralizan mensajes pero todavía dependen del shim.

## 3. Decisiones de diseño

La migración usará mapeo directo de la API existente del shim a la API nativa de Sonner, archivo por archivo. El contrato será:

- `sileo.success({ title, ...options })` -> `toast.success(title, options)`
- `sileo.error({ title, ...options })` -> `toast.error(title, options)`
- `sileo.warning({ title, ...options })` -> `toast.warning(title, options)`
- `sileo.info({ title, ...options })` -> `toast.info(title, options)`
- `sileo.dismiss(id)` -> `toast.dismiss(id)`
- `sileo.clear()` -> `toast.dismiss()`

La clave es preservar `description`, `icon`, `duration`, `action`, `className` y cualquier otro `ExternalToast` sin reinterpretarlo; el único cambio estructural es separar `title` como primer argumento. Si un helper o función hoy retorna el resultado del shim, debe seguir retornando el resultado de Sonner para no alterar el manejo de ids de toast.

No se creará un nuevo wrapper, hook ni alias local. Los módulos de conveniencia ya existentes pueden seguir existiendo, pero deben importar `toast` desde `sonner` y llamar su API real.

Conviene migrar por lotes lógicos dentro del mismo cambio, no en una sola tanda ciega. Hay demasiados usos residuales y algunos helpers compartidos; hacer cortes pequeños reduce regresiones y permite validar rápido cada grupo antes de borrar el shim.

## 4. Estrategia de implementación por etapas

Primero se migran los módulos compartidos que concentran notificaciones, en especial `src/components/contabilidad/toast-notifications.tsx`, porque fijan el patrón final y reducen repetición. Después se migran los componentes y páginas que todavía importan `@/lib/sileo-shim`, reemplazando cada llamada por su equivalente directo en Sonner sin refactors laterales. Luego se ajustan tests y mocks para reflejar la firma real de `toast`. Recién cuando `src/` quede sin referencias ejecutables al shim se elimina `src/lib/sileo-shim.ts`.

El criterio de corte entre lotes es técnico, no funcional: helpers compartidos, luego formularios/componentes, luego tests, y al final borrado del archivo.

## 5. Impacto en tests y mocks

Los tests que mockean `@/lib/sileo-shim` deben pasar a mockear `sonner`. La forma del mock debe seguir el patrón de uso del archivo afectado: en la mayoría de los casos `toast` se consume como objeto con métodos (`success`, `error`, `warning`, `info`, `dismiss`). Los asserts también deben adaptarse a la firma nativa: donde antes podía validarse un objeto con `title`, ahora corresponde verificar `toast.metodo(titulo, options)`.

Los tests que ya mockean `sonner` siguen siendo la referencia válida, pero algunos pueden requerir ampliar el mock si el archivo migrado usa `warning`, `info` o `dismiss` además de `success` y `error`.

## 6. Riesgos y mitigaciones

El riesgo principal es romper comportamiento por una migración mecánica incompleta de la firma, especialmente en helpers con `description` o retorno de id. Se mitiga migrando primero los módulos compartidos y revisando que cada llamada extraiga `title` y preserve el resto de opciones intacto.

Otro riesgo es dejar referencias residuales en `src/` o en mocks de pruebas, lo que impediría cerrar el cambio. Se mitiga con búsqueda explícita de `sileo-shim` antes del borrado final y con actualización de mocks en el mismo lote del archivo probado.

## 7. Validación de cierre

El cierre técnico requiere tres controles: búsqueda con cero referencias a `sileo-shim` dentro de `src/`, `pnpm typecheck` sin errores atribuibles a la migración y ejecución de pruebas focalizadas sobre los archivos con mocks o flujos de toast tocados mediante `pnpm test:run -- <ruta>` o nombres de test equivalentes. Si un lote pasa esas validaciones parciales, se avanza al siguiente; el borrado del shim solo ocurre cuando la búsqueda residual ya es cero.