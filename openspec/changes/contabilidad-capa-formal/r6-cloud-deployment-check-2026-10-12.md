# R6 — comprobación de despliegues reales

## Dirección de aceptación

El usuario señaló que la aceptación debe aprovechar producción Railway y staged
Vercel. El clon permite inyectar fallos SQL para verificar atomicidad; la aceptación
de build, configuración, autenticación HTTP y flujos desplegados requiere evidencia
del entorno cloud con identidad de código/base de datos comprobada.

## Comprobación fresca

| Entorno | Commit | Estado observado |
|---|---|---|
| Railway FinanceMDM / producción | `main/e6c20706e8658766187fb648fe6950c2f25dd249` | `SUCCESS`, deployment `46cd7a49-4711-4507-9d7c-13eb3e246c38` |
| Vercel finance-mdm-staging / último main READY | `e6c20706e8658766187fb648fe6950c2f25dd249` | `READY`, URL `finance-mdm-staging-axg0w9rbb-kr4t3rdevs-projects.vercel.app` |
| Vercel finance-mdm-staging / rama contable | `b04a5f8ecf8922901be5507bfe62be631067abab` | `ERROR`, URL `finance-mdm-staging-jemqrqayw-kr4t3rdevs-projects.vercel.app` |
| Vercel finance-mdm-staging / código publicado anterior | `a05bffb4deb9fd2bc5af2d7ecc0991dd7edda8b3` | `ERROR` |
| Vercel finance_tcp / rama contable | `b04a5f8ecf8922901be5507bfe62be631067abab` | `ERROR` |

Por tanto, el staged disponible de main no prueba el código de la rama contable.
La comprobación no desplegó ni ejecutó escrituras de negocio en producción.

Se confirmó que `finance-mdm-staging` tiene una `DATABASE_URL` configurada para
Preview y se comparó dentro del proceso, sin imprimir valores ni leer archivos de
entorno, el fingerprint de host+base de esa URL con la URL inyectada a Railway
`FinanceMDM` producción: **son distintos**. Esto excluye que ambos despliegues
usen el mismo endpoint PostgreSQL; todavía falta identificar la titularidad y
aislamiento de datos de Preview antes de ejecutar fixtures mutables.

## Causa del build fallido

El log de staged del 12-10 contiene:

```text
Running "install" command: pnpm install --no-frozen-lockfile
Failed to load config file "/vercel/path0" as a TypeScript/JavaScript module.
Error: ENOENT: no such file or directory, open '.env'
Command "pnpm install --no-frozen-lockfile" exited with 1
```

`postinstall` ejecuta `prisma generate`; `prisma.config.ts` llamaba
incondicionalmente a `process.loadEnvFile()`, aunque Vercel inyecta las variables
sin crear ese archivo. Se corrigió para aceptar exclusivamente `ENOENT` y
mantener las variables inyectadas; `EACCES` y otros errores siguen propagándose.

Reproducción aislada de la configuración: RED antes del cambio y GREEN después,
con loader simulado, conservación de ambas URLs y propagación de `EACCES`.
No se leyó ningún archivo `.env`. Se añadió
`scripts/ci/__tests__/prisma-config-env.test.ts`; su ejecución Vitest y la nueva
verificación cloud permanecen pendientes de dependencias/build disponible.

## Siguiente secuencia

1. Verificar identidad y aislamiento de la base usada por Preview/staged.
2. Publicar/revisar un corte coherente con la corrección de configuración y
   obtener un Preview READY de la rama contable.
3. Ejecutar en ese Preview las pruebas de autenticación, permisos, aislamiento,
   negocio, adapters HTTP y reintentos con fixtures sintéticos.
4. Ejecutar la inyección SQL exclusivamente contra la base aislada del ensayo.
5. Vincular los resultados al commit/deployment y completar las celdas pendientes.

Los 299 casos locales y la preservación del clon mantienen su alcance físico;
no sustituyen esta aceptación cloud ni habilitan la firma global.
