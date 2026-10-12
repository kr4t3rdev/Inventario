# R6 — Regresión heredada y paquete Prisma reproducible

## Corte guardado y enviado

El commit `4be1b3b0f7b41224077359c9c7646e4f7d36128a` guarda el baseline, reparación,
alineación y evidencias anteriores. Push aprobado a `origin/feat/contabilidad-capa-formal`;
incluye los cuatro commits locales previos. Producción sigue separada en main.

La continuación está guardada y enviada en
`a05bffb4deb9fd2bc5af2d7ecc0991dd7edda8b3`. Se reconstruyó su paquete dos veces desde
ese commit publicado y se aplicó a otra copia nueva: deploy/replay/status exit 0,
diff vacío, 23 guards, 148 checksums coincidentes y 123 filas originales completas
del historial conservadas (152 totales). Las rutas Git `src`, `prisma`, package.json,
pnpm-lock.yaml, config/setup de integración y tsconfig.json son idénticas al snapshot
que pasó los 80 casos. No se atribuyen pruebas del checkout sucio al commit publicado.
Vínculo: `r6-published-commit-package-2026-10-12.json`.

## Hallazgos de la revisión desde Git fijo

Se exportó el commit, sin archivos de entorno ni cambios compartidos del checkout.
El primer paquete reconciliado desplegó correctamente, pero su diff detectó la columna
`InyeccionCapital.payloadFingerprint` existente en el baseline y ausente del schema.

La migración `20261008130000_capital_idempotency_payload_fingerprint` **ya estaba
aplicada en producción** y está en el commit main capturado. Se recupera su SQL exacto
y se versiona su declaración en la rama contable. No es una nueva migración pendiente.
La migración compartida de creación idempotente de Venta no se incorpora a este corte;
el código Git fijo de este corte tampoco depende de ella.

La primera regresión produjo 21/21 en caja/bancos y 50/59 en negocio. Se corrigieron
causas verificadas de fixture, conservando la lógica de negocio versionada:
- Compras: mock de action raw frente a assertions de respuesta envuelta; se usa el
  wrapper real y solo se simula getCurrentUser. Además faltaba sembrar las plantillas
  globales: la suite dependía de una base presembrada o de otro test anterior.
- Venta: consulta de una factura desde un resultado inexistente en la fila Venta;
  ahora se busca la factura real mediante tenant/venta.
- Servicios FX: tasa del fixture con vigencia enero, superada por la tasa heredada;
  se crea una tasa con vigencia actual y se elimina solo su tasaId al limpiar.
  El cleanup anterior borraba todas las tasas USD/CUP de la copia. La copia de esa
  corrida se conserva como evidencia fallida y no se usa para preservar el baseline.

## Regresión corregida desde snapshot Git inmutable

Snapshot precommit privado: `b5d866d1b6e552d5372c4223d75a5c6eeee84687`.
Árbol y hashes se registran en `r6-release-candidate2-validation-2026-10-12.json`.
Es un objeto Git de validación, no un commit desplegado o una rama enviada.
Una exportación aislada genera su propio Prisma Client 6.19.1, usando configuración
sin carga de `.env`, y aplica el paquete a una copia nueva del baseline original.

Base: `tcp_test_r6_candidate_b5d866d1`, loopback/5433. Resultado: **80/80, 9 suites**.

| Suite | Casos |
|---|---:|
| Caja G5: actions, legacy/móvil, replay/cierre/conflictos y rollback | 16 |
| Bancos/capital: HTTP, sesión Bearer real y concurrencia | 5 |
| Gastos R6: fuentes y adapters con rollback físico | 24 |
| Compras: contado/crédito, FX, anticipos y reversos/rollback | 7 |
| Servicios CxC: liquidación FX y canal HTTP | 4 |
| Servicios: devengo directo | 2 |
| Ventas: shadow, COGS, anulación y fallos físicos | 10 |
| Facturación: workflow y CxC | 8 |
| Apertura: revisión/aprobación | 4 |

Los conteos corresponden únicamente a la corrida final. No se suman los reintentos
ni las corridas solapadas. Son fixtures sintéticos ejecutados sobre el estado heredado;
no acciones sobre clientes o documentos originales. Se conservan los mocks específicos
de cada suite: inventario en compras, auth simulado en algunas actions y auditoría
externa simulada en operaciones HTTP. La evidencia no afirma ausencia de mocks.

## Preservación del estado heredado

Tras la corrida final se contrastaron las columnas originales de las 142 tablas
originales de negocio, excluyendo _prisma_migrations: **1.353 filas originales,
0 ausentes o modificadas**. Comparación multiset en UTC mediante hashes de proyecciones
JSON; permite adiciones de fixtures con tenant propio y detecta eliminación/cambio de
filas heredadas. MD5 se usa como detector de cambios, no firma criptográfica.

Las suites append-only conservan sus fixtures propios: no se afirma que la base quede
sin nuevas filas. La comparación verifica la preservación de las filas heredadas.
Prueba: `r6-release-candidate2-preservation-2026-10-12.json`.

## Constructor reproducible versionado

`scripts/ops/build-accounting-inherited-package.py` recibe root, commit y output nuevo.
Lee exclusivamente blobs Git del commit fijo. Para las 15 variantes históricas usa el
SQL exacto del crosswalk versionado y verifica su SHA-256 contra el historial aplicado;
no necesita reflogs ni los commits históricos originales locales para esas variantes.
El manifiesto conserva el commit de procedencia como atribución. Otras entradas ausentes
del target requieren el commit main capturado disponible; una procedencia/hash inválida
aborta antes de crear el paquete. No consulta ni escribe bases.

Ejemplo, usando un commit aprobado explícito y un destino inexistente:

```bash
python3 scripts/ops/build-accounting-inherited-package.py \
  --commit <SHA_APROBADO> --output <DIRECTORIO_PRIVADO_NUEVO>
```

Resultado del corte ensayado:
- **148 migraciones**, 119 históricas y **29 pendientes**, incluida la alineación.
- 133 SQL desde el target, 15 desde el crosswalk exacto versionado.
- Schema desde Git fijo; config sin `process.loadEnvFile()`.
- Dos reconstrucciones con manifiestos y bytes SQL/schema idénticos.
- Los bytes coinciden con el paquete que pasó el deploy y el diff vacío.

El número difiere del trial7 (149): aquel contenía la migración compartida de Venta
todavía ajena a este corte. No se confunden los hashes ni el schema de ambos paquetes.

Para ejecutar el CLI desde fuera del repositorio se requiere acceso a las dependencias
instaladas del lockfile; el ensayo usa un enlace node_modules y configuración explícita.
El paquete generado no incluye credenciales, dump, dependencias o artefactos Next.js.
No ejecutarlo con la config del checkout, que carga archivos de entorno.

Pruebas del constructor: reproducibilidad pese a checkout sucio, recuperación sin
commit histórico disponible, rechazo de checksum inválido y protección de destino
existente. **3/3**, más **3/3** del comparador de catálogo. ESLint/typecheck aprobados.

Comando reproducible del corte publicado:

```bash
python3 scripts/ops/build-accounting-inherited-package.py \
  --commit a05bffb4deb9fd2bc5af2d7ecc0991dd7edda8b3 \
  --output <DIRECTORIO_PRIVADO_NUEVO>
```

## Cadena posterior con reparación

Trial8 deriva de la copia que pasó los 80 casos, preservando el origen del ensayo.
Repair: **2 tipos propios, 13 referencias, 15 AuditLog sintéticos**; replay **0 cambios**.
Guards **23/23**, historial **152 filas**, reconciliaciones **0 diferencias de tenant**.
La reparación sigue exclusivamente local y fuera de las migraciones automáticas.

## Revisión previa al segundo commit

Contexto: `design.md`, decisiones explícitas anteriores y revisión del baseline R6.
Se revisaron los cambios staged de fixtures, el schema/SQL histórico de capital y el
constructor: sin hallazgos críticos/altos. No se introducen cambios en los writers.
La selección de tasa usa el catálogo real del snapshot con un fixture vigente y el
cleanup no elimina tasas heredadas. El constructor valida todos los hashes antes
de escribir; el destino nuevo protege trabajo existente.

## Límites de aceptación

Este bloque cierra la regresión seleccionada de 9 suites y la reproducibilidad del
paquete Prisma del baseline capturado. No acredita todas las combinaciones R6
31 × 8, lectura/escritura de documentos originales mediante todos los adapters,
bootstrap vacío, build completo de aplicación, Preview, despliegue o rollback cloud.
El snapshot de producción no fue refrescado en esta sesión. R6/R0.5 global y la ventana
operacional A9/R7 siguen abiertos.
