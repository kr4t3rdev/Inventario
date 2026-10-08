# ADR PRE-GO — Frontera TypeScript de productos

- Estado: **decisión de ubicación aprobada**; implementación pendiente.
- Fecha: 2026-09-23.
- Alcance: PRE-GO/0 documental y PRE-GO/1 lectura de productos exclusivamente.

## Contexto

El backend Next combina transporte, identidad y Prisma. `getProductosAction()` y `GET /api/mobile/v1/products` comparten hoy `ProductoService.list`, pero tienen contratos distintos. No hay `pnpm-workspace.yaml` y el alias `@/*` apunta a `src/*`. El antiguo preplan sugería elegir un paquete por configuración del workspace; el usuario ya decidió la ubicación.

## Decisión

**`src/dominio` es la única ubicación del núcleo TypeScript**, sin alternativa `packages/domain`. Dentro de él, `domain/` alojará únicamente reglas deterministas que el slice necesite; `application/` alojará casos de uso y puertos mínimos por capacidad. En /1 el caso de uso deberá orquestar consulta y stock batch; no será un wrapper de `ProductoService.list` ni una extracción solo de funciones puras.

Los adaptadores Next son dueños de autenticación, identidad/membresía comprobadas, construcción del actor, validación de transporte, errores de action versus status/body HTTP y serialización. El caso de uso comprueba las invariantes de tenant y autorización pertinente sobre ese actor, sin confiar en tenant enviado por cliente. Adaptador Prisma y composition root viven **fuera** de `src/dominio` (bajo `src/features/productos/adapters/`); Prisma fuerza tenant verificado también en la consulta de stock. El núcleo no importa `next/*`, Prisma, `src/app`, adaptadores ni módulos transitivamente acoplados a efectos de request.

PRE-GO/0 solo prepara inventario, ADR, gate y baseline; **no crea `src/dominio`, no mueve lógica ni cambia runtime**. PRE-GO/1, tras cerrar /0, extraerá solo lectura web/móvil conservando sus contratos y reversa a `ProductoService.list`. Ningún piloto de escritura está seleccionado: exige inventario y decisión posterior. Go reimplementará bajo pruebas de paridad; **no puede importar TypeScript**.

## Consecuencias y reversa

`src/dominio` aprovecha el alias actual pero no garantiza aislamiento por sí solo: gate de imports directos/transitivos y test de importabilidad sin Next/DB son obligatorios en fases posteriores. Mantener servicio legacy y entradas actuales para ensayo de reversa de /1; sin schema, UI ni tráfico Go en este ADR. Ante falso positivo en /0, retirar solo el gate, conservando ADR, inventario y evidencia.
