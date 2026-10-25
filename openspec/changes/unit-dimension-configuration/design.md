# Diseño implementado localmente

## Contratos y superficies

- `src/features/unidades/schemas.ts`: enum Zod reutilizable; valor predeterminado solo en creación; dimensión opcional en actualización.
- `src/features/unidades/actions.ts`: incluye dimensión en sus resultados y crea unidades con el valor validado. La actualización conserva el camino de metadatos cuando el campo está ausente.
- `src/features/unidades/components/unidad-form.tsx`: selector y estado inicial para creación/edición.
- `src/features/unidades/components/unidad-edit-page-client.tsx` y `src/app/busy/unidad/update/[id]/page.tsx`: propagan la dimensión hacia el formulario.

## Validación de cambios

Cuando el payload incluye dimensión, la Server Action abre una transacción `ReadCommitted` y primero bloquea la unidad del tenant con un `SELECT ... FOR UPDATE` parametrizado. Después vuelve a leerla y compara el valor vigente. Solo un no-op determinado después del bloqueo puede evitar la consulta de referencias. Una comparación contra la lectura externa permitiría que un payload `UNKNOWN` obsoleto deshiciera una clasificación concurrente.

Para un cambio real, se consultan conversiones donde la unidad sea origen o base. El uso por productos se reduce a booleanos de integridad sobre el identificador global de la unidad ya bloqueada y validada como propia; no se devuelven filas o identificadores de otros tenants. Cualquier asociación ajena o sin tenant falla de forma cerrada. Si la dimensión vigente es conocida y existen referencias, se rechaza el cambio. Para `UNKNOWN` a conocida, se validan las dimensiones de las contrapartes del mismo tenant; las referencias de identidad no crean una incompatibilidad dimensional. Las dos consultas parametrizadas están declaradas en `src/lib/db/raw-sql-allowlist.ts` y su contrato AS-03 pasa.

No se actualizan factores, productos, stock ni instantáneas históricas. No se añade un reintento automático de errores de serialización.

## Límites de concurrencia

La primera versión usaba solo `Serializable` y sus pruebas exigían `P2034`. La revisión previa a publicar encontró que esa prueba no cubría asociaciones de productos existentes con otra política de aislamiento. Tres regresiones reales fallaron antes de corregir el protocolo: referencias ajenas y los dos órdenes de asociación/clasificación.

El protocolo vigente usa el conflicto entre `FOR UPDATE` y los bloqueos `FOR KEY SHARE` de las comprobaciones FK. Si la asociación llega primero, el guard espera su confirmación y una sentencia posterior con snapshot fresco ve la referencia; si el guard llega primero, el INSERT espera su liberación. No basta con añadir el bloqueo a una transacción que conserve un snapshot antiguo. Esta decisión se apoya en la [documentación de bloqueos](https://www.postgresql.org/docs/17/explicit-locking.html), las [reglas de Read Committed](https://www.postgresql.org/docs/17/transaction-iso.html) y la [implementación FK de PostgreSQL 17](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/adt/ri_triggers.c).

Los dos archivos `unit-dimensions.test.ts` y `unit-dimension-product-references.test.ts` reenvían operaciones y transacciones reales mediante Proxy. Diez casos pasaron dos veces con observación de esperas del motor y resultados específicos: el clasificador perdedor devuelve `CONFLICT`, no cualquier error. La autenticación se simula y no se prueba el wrapper público de extremo a extremo. Los futuros escritores de conversiones siguen obligados a validar sus dimensiones y coordinar sus bloqueos; no hay garantía para escritores arbitrarios ni reintento automático.

## Compatibilidad documental

`openspec/changes/revisa-unidades-consolidacion/proposal.md` es un antecedente que describe unidades globales. No se adopta esa premisa: el modelo vigente es tenant-scoped. Ese cambio anterior y los archivos principales de especificación no se modifican ni se archivan mediante este registro.

## Unidades de revisión propuestas

1. Tracker draft/no-merge con documentación OpenSpec, dirigido a `main`.
2. Contratos de creación/lectura, pruebas y adaptación mínima de tipos del formulario existente; la creación acepta el input Zod opcional, no obliga a clientes antiguos a enviar dimensión.
3. Actualizaciones protegidas, allowlist SQL y pruebas de mutación; no anuncia aún un selector de interfaz.
4. Interfaz, carga de edición, documentación de selección y pruebas de componente.
5. Prueba PostgreSQL de las transiciones y clasificadores simultáneos.
6. Prueba PostgreSQL de asociaciones de productos en ambos órdenes y fallo cerrado por referencias ajenas.

La división del backend se resolvió en contratos de creación/lectura (69 líneas) y guard completo de actualización (393), sin retirar casos ni introducir rechazos transitorios. Los otros hijos son UI (227), PostgreSQL de transiciones (323) y PostgreSQL de referencias (391). Estas cifras suman adiciones y eliminaciones por base inmediata; el tracker documental se calcula aparte y también debe quedar bajo 400.

La revisión técnica independiente aprobó código y particiones. Antes de publicar se comprueban el snapshot documental, los hashes y cada diff exacto. La adaptación React Hook Form mantiene separados los tipos de entrada/salida de Zod; la creación del servidor acepta su input opcional, por lo que no se fuerza un campo nuevo al cliente antiguo. Ninguna publicación autoriza merge o despliegue.
