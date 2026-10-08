# PRE-GO — Extracción incremental del núcleo TypeScript

## Objetivo y límite

Separar reglas de negocio y casos de uso del transporte Next.js **antes** de portar dominios a Go. Esta fase cambia la organización interna, no los contratos públicos, el esquema de datos ni el comportamiento de las pantallas. Las Server Actions y API routes siguen funcionando como adaptadores. El paquete TypeScript es una referencia ejecutable para el port; Go no puede importarlo ni compartir su implementación.

No comenzar con una extracción masiva. Cada slice entra solo cuando su contrato, dependencias, efectos y dueño están inventariados. Ventas financieras, cierres y capa formal quedan fuera del piloto mientras R-4 y las ediciones concurrentes no estén estabilizadas.

## Puertas de entrada

1. Confirmar estado Git y trabajo concurrente. No mover ni reescribir archivos ajenos; obtener baseline de tests para cada slice.
2. La ubicación única aprobada es `src/dominio` ([ADR de frontera](./adr-pre-go-frontera.md)); verificar `package.json`, `tsconfig.json`, alias `@/*`, `use server`, resolución de imports y build para proteger esa frontera, no para elegir otro paquete. `pnpm-workspace.yaml` no existe actualmente; no es prerrequisito de `src/dominio`.
3. Construir mapa versionado de operación → action/route → consumidor web/mobile → firma/input/output/error → auth/tenant/permiso → tablas/efectos → pruebas → candidato de caso de uso. No tratar una action como endpoint HTTP.
4. Piloto /1 aprobado solo para lectura de productos por tenant (action web y GET móvil); verificar primero callers y contrato real. Cualquier piloto de escritura queda **pospuesto a una decisión posterior**, tras inventario de transacciones y efectos; no se selecciona en este plan.

## Límite de dependencias

```text
Next action / API route ──► application use case ──► port interfaces
        │                           │                      ▲
        │                           └──► domain rules      │
        └──► composition root ───────────────────► Prisma/side-effect adapters
```

- `domain/`: entidades, value objects, cálculos, invariantes y errores deterministas. Sin IO ni acceso a identidad global.
- `application/`: commands/queries y casos de uso con puertos pequeños para repositorio, transacción, reloj, IDs y efectos. `ActorContext` entra como valor verificado desde el adaptador; el caso de uso revalida autorización e invariantes sensibles.
- Adaptadores Next: autenticación, lectura de cookies/headers, validación de transporte, traducción de errores/status, serialización y `revalidatePath` **después** del commit.
- Adaptadores Prisma: mapeo de filas, tenant scope, transacciones, aislamiento y orden de locks. Ningún Prisma model se filtra a `domain` o al contrato público.
- Prohibir imports directos **y transitivos** de `next/*`, Prisma, `src/app`, adaptadores, globals de request y módulos con efectos en el núcleo. Gate automático en CI; test que importe el núcleo sin runtime Next ni DB.

**No confundir “independiente de Next” con “todo síncrono/puro”.** Una regla del dominio sí puede ser pura; un caso de uso que coordina persistencia es testeable mediante puertos, pero tiene efectos observables. Evitar una interfaz genérica de repositorio para todas las tablas: cada puerto representa la capacidad mínima del caso de uso.

## Secuencia TDD por slice

| Paso | Entrega verificable |
|---|---|
| 1. Caracterizar | Capturar entradas, salida, errores, permisos, caché y estado DB de la implementación actual; registrar tests y baseline. Tests verdes de caracterización o fallas preexistentes **no son RED**. |
| 2. Diseñar frontera | DTOs de aplicación sin tipos Next/Prisma, puertos mínimos, actor/tenant verificados y lista explícita de efectos. |
| 3. Extraer | Para la frontera nueva, escribir primero un test RED reproducible por capacidad ausente, luego GREEN y REFACTOR con regresión; crear reglas deterministas solo cuando el caso las exija y orquestar consulta y stock en application. Mantener firma y comportamiento de la action/route. |
| 4. Adaptar | Crear adaptador Prisma y composition root; dejar auth, serialización y caché en Next. En escrituras, invalidar caché después del commit y no repetir una mutación financiera por fallos de caché. |
| 5. Verificar | Unit con fake ports, integración en `DATABASE_URL_TEST` aislada, contrato action/API, caso E2E crítico, tenant negativo, build y lint de imports. |
| 6. Revertir | Probar reversa del wiring del slice sin perder datos ni reintroducir una segunda regla de negocio divergente. |

En escrituras comparar no solo el JSON: transacción, estado de tablas relacionadas, idempotencia, lock order, errores, efectos externos y precisión monetaria. No usar DB de producción ni fixtures mutadas compartidas. Preservar semántica de `scoped`, `child` y `global` al mapear persistencia.

## Orden de entregas

1. **PRE-GO/0 — Mapa y frontera decidida:** inventario de operaciones y consumidores, [ADR `src/dominio`](./adr-pre-go-frontera.md), comando de import-lint, baseline de pruebas. Sin mover lógica ni crear el núcleo.
2. **PRE-GO/1 — Piloto de lectura:** un caso de consulta por tenant; action/API delegan al mismo caso de uso; pruebas RED→GREEN→REFACTOR de la frontera y contrato sin cambios.
3. **Escritura futura, sin piloto seleccionado:** requiere inventario de transacciones/efectos y decisión explícita posterior; no queda autorizada por /0 ni /1.
4. **PRE-GO/3 — Plantilla y expansión:** documentar patrón probado, priorizar otros slices por acoplamiento/riesgo, sin convertir “extraer las 172 actions” en bloqueo global. GO-0 funcional puede iniciar al cumplirse la puerta de salida, y la extracción restante continúa por dominio antes de cada port.

Cada entrega modifica solo los archivos del slice y sus pruebas; revisión fresca del diff antes de commit. No crear commits, push ni despliegues automáticamente por este preplan.

## Puerta de salida hacia GO-0

- Como mínimo el piloto de lectura completo de extremo a extremo; escritura sujeta a inventario y decisión posterior, no es una tarea aprobada de este plan.
- Contratos web/mobile, códigos de error, permisos y tenant sin regresiones; pruebas RED guardadas, GREEN y revisión del diff.
- Núcleo importable sin Next/Prisma ni dependencias transitivas prohibidas; use cases probables con fake ports y adaptadores con DB aislada.
- Mapa de migración actualizado, reversa ensayada y riesgos pendientes asignados. Esta puerta habilita fundaciones Go, **no** autoriza el corte de un dominio: cada corte conserva sus golden tests y ventana de observación.

## Riesgos explícitos

- Extraer un “service” que aún llama a `cookies()` o Prisma desde una dependencia oculta solo cambia la carpeta, no la arquitectura.
- Pasar `tenantId` recibido del cliente como `ActorContext` fabrica autoridad; el contexto lo establece auth/membresía verificada.
- Mover reglas financieras durante cambios CTA/R-4 puede falsear pruebas de paridad; coordinar o posponer esos slices.
- La extracción TS facilita la especificación del port, pero no garantiza que cambiar de framework o lenguaje cueste días; medir esfuerzo real tras el piloto.
