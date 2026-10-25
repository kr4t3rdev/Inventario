# Verificación — 2026-10-25

## Resultado: PARCIAL, implementación local

El incremento fuente existe sin commit en `codex/unit-dimension-configuration`, basado en `f7268390eae45c631c92660347b7751f66507b6d`. El issue #32 está abierto y aprobado. La publicación en cadena para validar CI está autorizada por el usuario. La revisión independiente de código y particiones técnicas pasó; este informe captura la evidencia local y debe acompañarse del estado exacto de los PRs, no interpretarse como CI aprobada o permiso de merge/despliegue. No se han modificado esquema, datos ni configuración de producción.

## Evidencia registrada durante esta ejecución

| Comprobación | Resultado |
| --- | --- |
| RED inicial de acciones | 30 pruebas pasaron y 4 fallaron antes de implementar las transiciones |
| RED de carrera de no-op | 2 regresiones fallaron antes de corregir la ruta rápida con lectura obsoleta |
| Acciones e interfaz, revisión de bloqueo vigente | 49/49 pasaron (43 acciones y 6 de formulario) |
| Contrato de allowlist SQL AS-03 | 3/3 pasaron |
| Cobertura de acciones | 97,6 % sentencias/líneas; 88,15 % ramas; 100 % funciones |
| Cobertura de esquemas | 100 % en todas las métricas |
| Cobertura de formulario | 100 % sentencias/líneas; 94,28 % ramas; 83,33 % funciones |
| ESLint enfocado | Pasó |
| TypeScript del proyecto | Pasó con heap de 4 GB, también en esta continuación; excluye los archivos `*.test.ts` y `*.test.tsx` |
| Revisión previa a publicar | Código y particiones técnicas aprobados independientemente después de las correcciones de tipado, FK y documentación; verificar snapshot documental antes de publicar |
| PostgreSQL 17.11 real, protocolo vigente | 10/10, dos ejecuciones con observación de bloqueos y resultados específicos; 146 migraciones aplicadas |
| Revisión de pruebas PostgreSQL | La versión ampliada y sus resultados específicos forman parte de la revisión final de código aprobada |
| Lint de la prueba PostgreSQL | Pasó |
| Build predeterminado | Falló antes de compilar por el enlace externo de `node_modules` |
| Build alternativo Webpack | Terminó con `SIGKILL`; no aprobado |
| Regresión unitaria completa | Interrumpida por `SIGKILL`; no aprobada |

Los primeros tests de interfaz se añadieron después de su implementación inicial. Se demostró su RED al invertir temporalmente solo el diff propio del formulario y su GREEN al restaurarlo. Las pruebas adicionales cubren comportamiento existente; no se atribuye retrospectivamente TDD a esa primera implementación de interfaz.

Comandos enfocados usados:

```sh
pnpm exec vitest run src/features/unidades/__tests__/actions.test.ts
pnpm exec vitest run src/features/unidades/components/unidad-form.test.tsx
pnpm exec vitest run src/features/unidades/__tests__/actions.test.ts --coverage.enabled --coverage.include=src/features/unidades/actions.ts --coverage.include=src/features/unidades/schemas.ts --coverage.reporter=text
pnpm exec vitest run src/features/unidades/components/unidad-form.test.tsx --coverage.enabled --coverage.include=src/features/unidades/components/unidad-form.tsx --coverage.reporter=text
NODE_OPTIONS=--max-old-space-size=4096 pnpm exec tsc --noEmit
pnpm exec vitest run --config vitest.integration.config.mjs src/features/unidades/__integration__/unit-dimensions.test.ts src/features/unidades/__integration__/unit-dimension-product-references.test.ts
```

## Seguridad del entorno de prueba

Se reutilizaron las dependencias instaladas. Se regeneró únicamente el cliente Prisma ignorado desde el esquema vigente con Prisma 6.19.1 instalado, configuración temporal explícita, URL loopback y carga de archivos de entorno desactivada según la salida del CLI. Se eliminó la configuración temporal. Esa generación no conectó a una base de datos; la validación PostgreSQL posterior utilizó únicamente bases locales desechables propias.

Una invocación inicial de tests no quedó limitada al archivo solicitado; se detuvo y una auditoría independiente verificó que no quedaban procesos antes de continuar con comandos enfocados.

## Prueba con PostgreSQL real

La primera revisión usaba Serializable y su carrera exigía P2034. Esa evidencia histórica no demuestra el protocolo vigente: una revisión posterior reprodujo tres fallos reales antes del ajuste de bloqueo (3/3 RED), relacionados con referencias y los dos órdenes de asociación/clasificación.

La revisión vigente usa Read Committed con bloqueo de la unidad propia FOR UPDATE antes de volver a leer y consultar referencias. Diez casos pasaron dos veces: los siete de transición y tres de referencias de productos. El caso producto-primero observa una espera real del guard y rechaza con CONFLICT después del commit del INSERT; el caso dimensión-primero observa que el INSERT espera a la liberación del guard. La carrera entre clasificadores exige un único éxito y un perdedor con CONFLICT. No se acepta cualquier error como prueba de seguridad.

Hashes de la revisión comprobada:
- `src/features/unidades/actions.ts`: `b21bc7a1e365b3d7f461521ad20368d6bb0a021954153ba9691bfebb427d34a3`.
- `unit-dimensions.test.ts`: 323 líneas; `8189236a2fcc60cf0599bb8d97dc3a4f945ca70425d16969a74ea5b7e94741d7`.
- `unit-dimension-product-references.test.ts`: 391 líneas; `c415b155117d3c76d5cd7290b2c6925a366bda97d5b64f4cec6c518cdb6730ee`.

PostgreSQL 17.11 ejecutó las 146 migraciones vigentes, incluidas las tres de F1. Los guards verificaron bases desechables y endpoints loopback explícitos; nunca se usaron direcciones de producción. La autenticación se simula, pero las lecturas, escrituras y transacciones se reenvían a Prisma real. Se verificaron cero fixtures, bloqueos y triggers/funciones de prueba; todos los clústeres propios y configuraciones temporales fueron detenidos/eliminados.

Una invocación anterior del script de integración no quedó limitada al archivo. Una auditoría independiente confirmó el endpoint local y que no había procesos de prueba activos antes de continuar con el comando directo. Se corrigieron defectos de fixtures, valores SQL void y spies sobre delegates; esos fallos no se presentan como regresiones de producción.

## Build local

`pnpm run build` se detuvo antes de compilar: Next.js 16.2.4/Turbopack rechazó el `node_modules` enlazado al checkout principal, situado fuera de la raíz del worktree. No se cambió la configuración ni se instalaron dependencias.

Una ejecución alternativa con el flag instalado `--webpack` terminó con salida 1 después de aproximadamente 17 minutos: el worker recibió `SIGKILL`. El agente no envió esa señal y no se confirmó su causa; no se afirma que haya sido un error de memoria o del código. No se produjo un build aprobado ni un recuento de páginas. Los procesos propios terminaron y el diff quedó intacto. Tampoco un build Webpack satisfactorio sustituiría la verificación del build predeterminado en CI.

## Pendientes y limitaciones

- La regresión unitaria completa se intentó una sola vez con `pnpm exec vitest run --maxWorkers=2`. Terminó con `SIGKILL` tras aproximadamente 73 segundos; el último progreso era 99/760 archivos y 669 pruebas aprobadas con 2 omitidas. Son cifras parciales, no el resultado final ni un pase de suite. No se confirmó la causa de la señal y no se repitió la carga pesada.
- El TypeScript de la aplicación pasó con 4 GB de heap en la revisión fuente vigente. La partición vigente de creación/lectura (69 líneas) pasó aislada con 30/30 pruebas de acciones y TypeScript de 4 GB, sin depender de cambios de UI o guard posteriores. La validación del hijo de actualización protegida en CI sigue pendiente. Se reutilizaron dependencias y cliente Prisma ignorados sin instalar ni modificar dependencias compartidas. La configuración excluye los tests; este resultado no se presenta como chequeo estático de las pruebas de integración.
- No se ejecutó un E2E de navegador. La prueba PostgreSQL no valida autenticación real ni todos los escritores posibles.
- Los futuros escritores de conversiones deberán participar en el protocolo de validación transaccional; no están implementados aquí.
- La cadena pendiente de revisión usa un tracker draft/no-merge con OpenSpec a main y, en orden, contratos de creación/lectura, actualizaciones protegidas, UI y dos unidades de pruebas PostgreSQL. El backend se separó en contratos de 69 líneas y guard de 393; UI suma 227 y las pruebas PostgreSQL 323 y 391, por base inmediata. Cada diff por base inmediata debe mantenerse por debajo de 400, incluir tests y documentación de su comportamiento, enlazar el issue #32 y llevar una sola etiqueta type:*. La documentación de selección de UI solo corresponde al hijo que añade el selector. Ningún merge ni despliegue está autorizado.
- La estructura de los seis artefactos, los espacios y el YAML de estado se comprobaron localmente. El CLI de OpenSpec no está instalado en este entorno; no se afirma que una validación estricta de ese CLI haya pasado.
