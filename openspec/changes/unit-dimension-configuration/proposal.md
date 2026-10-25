# Configuración explícita de dimensiones de unidades

## Estado y autorización

Registro del incremento local iniciado el 25 de octubre de 2026, solicitado en OpenSpec al finalizar la ejecución. La política y la publicación de PRs para CI fueron aprobadas por el usuario; este registro es la semilla documental de la cadena, no una aceptación de CI ni autorización de merge o despliegue. El issue #20 permanece cerrado: entregó la conversión del servidor para compras directas, no esta interfaz de configuración. El issue #32 está abierto y aprobado para esta entrega.

## Objetivo

Permitir configurar la dimensión de las unidades del tenant sin recalcular existencias, costos ni documentos históricos. Las unidades heredadas pueden pasar explícitamente de `UNKNOWN` a una dimensión conocida si sus conversiones siguen siendo compatibles. Una dimensión conocida no puede cambiar ni volver a `UNKNOWN` mientras la unidad tenga productos o conversiones asociados.

## Alcance

- Validación de creación/actualización y resultados de Server Actions.
- Validación transaccional de referencias de productos y de ambos extremos de las conversiones.
- Selector de dimensión en los formularios existentes de creación y edición.
- Compatibilidad con llamadas antiguas que omiten el campo, pruebas y documentación del módulo.

## Fuera de alcance

Administración de factores por producto, selector de unidad en compras, órdenes/recepciones, POS, ventas, clasificación automática, reasignación de unidad base, migraciones y modificaciones de producción.

## Entrega y riesgos

La estrategia aprobada es Feature Branch Chain. El tracker draft/sin merge contiene estos seis artefactos y apunta a `main`. Cinco hijos apuntan, respectivamente, al tracker y a su padre inmediato:

| Posición | Unidad | Adiciones + eliminaciones |
| --- | --- | --- |
| 1 | Contratos de creación/lectura, compatibilidad de tipos y pruebas | 65 + 4 = 69 |
| 2 | Actualizaciones protegidas, allowlist, pruebas y política backend | 383 + 10 = 393 |
| 3 | Selector de interfaz, carga de edición, documentación de selección y pruebas | 216 + 11 = 227 |
| 4 | Prueba PostgreSQL de transiciones y clasificadores | 323 + 0 = 323 |
| 5 | Prueba PostgreSQL de asociaciones de productos y orden FK | 391 + 0 = 391 |

El tracker documental debe permanecer también por debajo de 400 líneas. Los presupuestos se recalculan por base inmediata antes de publicar; no hay excepción de tamaño ni permiso para fusionar el agregado. Cada PR incluye inicio/fin, dependencia, seguimiento, fuera de alcance, diagrama con `📍`, enlace al issue #32, una sola etiqueta `type:*` y checklist estándar. El issue está aprobado. La revisión independiente del código y de las particiones técnicas pasó; el snapshot documental corregido debe verificarse antes de commit/push/apertura. Ningún PR se fusiona y no se inicia ningún despliegue manual ni se modifica producción.

La validación vigente con PostgreSQL 17.11 real pasó dos veces, con diez casos por ejecución. Las carreras observan bloqueos reales de asociación de productos y exigen resultados específicos; el clasificador perdedor devuelve `CONFLICT` después de la lectura vigente protegida. Esto verifica los caminos actuales, no escritores arbitrarios ni futuros CRUD de conversiones. El build predeterminado y la CI siguen siendo gates distintos de publicación.

## Reversión

No hay cambios de esquema ni transformación de datos en este incremento. Antes de publicar, la reversión consiste en retirar sus cambios de código. Después de publicar, debe conservarse el valor de las dimensiones ya configuradas; no se propone una reclasificación masiva para revertir la interfaz.
