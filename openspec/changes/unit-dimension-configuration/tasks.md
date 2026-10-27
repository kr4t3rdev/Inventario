# Tareas

## 1. Política y servidor
- [x] Registrar la aprobación explícita de la clasificación heredada y la protección de unidades conocidas en uso.
- [x] Añadir dimensión a los contratos y resultados de `src/features/unidades/schemas.ts` y `actions.ts`.
- [x] Bloquear primero la unidad propia y validar referencias con lecturas frescas Read Committed, incluyendo el fallo cerrado de metadatos de integridad y conversiones de origen/base.
- [x] Preservar la omisión en el tipo de entrada de creación mediante UnidadFormInput; no forzar clientes antiguos a enviar el campo.
- [x] Registrar las dos consultas parametrizadas en la allowlist AS-03; su contrato 3/3 pasó.
- [x] Preservar la omisión del campo y decidir no-op desde una lectura transaccional vigente.
- [x] Agregar regresiones RED/GREEN en `src/features/unidades/__tests__/actions.test.ts`.

## 2. Interfaz
- [x] Añadir y propagar el selector mediante `unidad-form.tsx`, `unidad-edit-page-client.tsx` y la página de edición.
- [x] Probar valores iniciales, selección, payloads y estados de respuesta en `unidad-form.test.tsx`.
- [x] Actualizar `content/docs/modules/unidades/README.md` en español neutro.

## 3. Verificación
- [x] Ejecutar 43 pruebas de acciones y 6 de interfaz, incluidas creación explícita y omisión heredada.
- [x] Medir cobertura enfocada de acciones, esquemas y formulario: todas las métricas medidas superan el 80 %.
- [x] Ejecutar ESLint enfocado y TypeScript completo con límite de heap explícito.
- [x] Corregir la carrera de no-op identificada por la revisión del padre.
- [x] Obtener revisión independiente final del código de bloqueo y de sus particiones técnicas; las correcciones de tipado y referencias se comprobaron antes de preparar los PRs.
- [x] Crear y ejecutar `src/features/unidades/__integration__/unit-dimensions.test.ts` contra PostgreSQL local desechable, incluyendo escritores concurrentes reales: 10/10 en dos archivos, dos veces, con bloqueos FK observados y aserciones específicas `CONFLICT`.
- [x] Revisar independientemente la prueba de concurrencia, corregir la aceptación de errores arbitrarios y verificar la limpieza de recursos propios.
- [x] Ejecutar lint de la prueba PostgreSQL y volver a comprobar los tipos de la aplicación; ambos pasaron. El tsconfig del proyecto excluye los archivos de test.
- [x] Verificar los contratos aislados de creación/lectura del child 1 (69 líneas) con la adaptación de tipos React Hook Form: 30/30 pruebas y TypeScript de 4 GB pasaron.
- [ ] Completar build y regresión unitaria completa en un entorno válido: el build predeterminado falló por el enlace de dependencias y tanto Webpack como la suite completa terminaron con `SIGKILL`; no se consideran aprobados.

## 4. Registro y entrega
- [x] Guardar propuesta, especificación delta, diseño, tareas, verificación y estado en OpenSpec a petición del usuario.
- [ ] Validar el cambio con el CLI de OpenSpec cuando esté disponible; no se instala ninguna herramienta en esta ejecución.
- [x] Verificar issue #32 abierto con etiqueta `status:approved`; no reutilizar el issue #20 cerrado.
- [x] Definir Feature Branch Chain: tracker draft/no-merge y cinco hijos dirigidos a la base inmediata, todos bajo 400 líneas.
- [x] Obtener revisión independiente del código y las particiones técnicas. Antes de publicar, comprobar los hashes y límites del snapshot documental corregido.
- [ ] Publicar tracker draft y cinco PR hijos; no fusionar ninguno.
- [ ] Revisar los checks de CI de cada PR; no desplegar ni escribir en DB/proveedores.

No archivar este cambio ni trasladar su delta a las especificaciones principales hasta completar sus gates de verificación y entrega.
