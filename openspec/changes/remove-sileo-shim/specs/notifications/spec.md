# Spec: Eliminación de sileo-shim y convergencia a Sonner directo

## 1. Nombre de la spec

Eliminación de sileo-shim y convergencia a Sonner directo.

## 2. Contexto

El proyecto mantiene hoy una convivencia de imports directos desde `sonner` y imports desde `@/lib/sileo-shim`, además del archivo `src/lib/sileo-shim.ts`. El cambio aprobado busca retirar esa capa intermedia y dejar una única vía de notificaciones basada en Sonner directo, sin degradar el comportamiento visible de los toasts para el usuario.

## 3. Requerimientos funcionales

### RF-1. Eliminación del shim

El sistema DEBE dejar de depender de `src/lib/sileo-shim.ts` como punto de acceso a notificaciones.

### RF-2. Migración de imports residuales

Todo archivo dentro de `src/` que actualmente importe desde `@/lib/sileo-shim` DEBE pasar a consumir Sonner directo mediante imports válidos desde `sonner`.

### RF-3. Regla de cero referencias al shim en src

La validación final DEBE confirmar cero referencias a `sileo-shim` dentro de `src/`, incluyendo imports, reexports, mocks y cualquier uso ejecutable.

### RF-4. Equivalencia visible de comportamiento

Los flujos que hoy muestran toasts de éxito, error, advertencia o información DEBEN seguir mostrando una notificación visible y semánticamente equivalente para el usuario después de la migración.

### RF-5. Ajuste de pruebas y mocks

Toda prueba automatizada o mock afectado por la eliminación del shim DEBE actualizarse para apuntar al punto de integración final en Sonner, preservando la capacidad de verificar invocaciones de toasts en los casos cubiertos.

## 4. Requerimientos no funcionales

### RNF-1. Validación por typecheck

La migración DEBE cerrar sin errores de typecheck atribuibles al reemplazo de `@/lib/sileo-shim` por imports directos de Sonner.

### RNF-2. Pruebas focalizadas

Cuando existan pruebas unitarias o de componente que cubran archivos afectados, DEBEN ejecutarse de forma focalizada y pasar con la nueva integración de Sonner.

### RNF-3. Alcance acotado

El cambio NO DEBE introducir alteraciones funcionales ajenas al sistema de notificaciones ni refactors no necesarios fuera de los archivos impactados por el shim.

## 5. Escenarios de aceptación

### Escenario A: Archivo migrado desde el shim

- DADO un archivo en `src/` que importa desde `@/lib/sileo-shim`
- CUANDO se completa la migración
- ENTONCES el archivo importa directamente desde `sonner`
- Y no conserva referencias ejecutables al shim

### Escenario B: Verificación residual del código fuente

- DADO el árbol `src/`
- CUANDO se ejecuta una búsqueda por `sileo-shim`
- ENTONCES el resultado es cero coincidencias

### Escenario C: Toast de éxito existente

- DADO un flujo ya cubierto que antes mostraba un toast de éxito mediante el shim
- CUANDO el flujo se ejecuta después de la migración
- ENTONCES el usuario sigue viendo un toast de éxito equivalente

### Escenario D: Toast de error existente

- DADO un flujo ya cubierto que antes mostraba un toast de error mediante el shim
- CUANDO el flujo falla después de la migración
- ENTONCES el usuario sigue viendo un toast de error equivalente

### Escenario E: Mocks y pruebas afectadas

- DADO un test o mock que dependía de `@/lib/sileo-shim`
- CUANDO se actualiza al contrato final con Sonner
- ENTONCES la prueba puede seguir afirmando que el toast esperado fue invocado

### Escenario F: Cierre técnico del cambio

- DADO el conjunto de archivos impactados por la migración
- CUANDO se ejecuta typecheck y las pruebas focalizadas aplicables
- ENTONCES ambos controles finalizan sin fallas atribuibles a la eliminación del shim

## 6. Casos borde / exclusiones

- No es objetivo de esta spec reemplazar usos directos ya existentes de Sonner que no dependan del shim.
- No es objetivo rediseñar estilos, posición, duración o apariencia visual de los toasts más allá de preservar comportamiento equivalente.
- Comentarios o artifacts históricos fuera de `src/` pueden seguir mencionando `sileo-shim` si no participan en ejecución ni en validación residual del código fuente.
- Si un test no cubre comportamiento de toast ni depende del shim, no requiere ajustes por este cambio.