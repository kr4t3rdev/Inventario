# Plan: sincronización offline móvil

**Estado:** reconstruido desde la síntesis del Second Brain; borrador en ejecución
**Prioridad de clientes:** terminar iOS primero; iniciar Android después
**Última revisión:** 2026-11-23

## Objetivo

Permitir que las aplicaciones móviles consulten datos previamente sincronizados y
realicen operaciones offline controladas, manteniendo Next.js como API y autoridad
de negocio, y PostgreSQL como fuente oficial.

## Contexto verificado y límites

- El offline se limita a aplicaciones móviles. La aplicación web permanece online.
- Next.js conserva autenticación, permisos, validaciones y reglas de negocio.
- PostgreSQL es la fuente oficial; los datos locales pendientes no se presentan como
  confirmados por el servidor.
- Se extenderá el contrato existente `docs/openapi/mobile-v1.json`, no se creará un
  contrato paralelo. Revisar nuevamente el archivo y sus SDK generados antes de
  cambiarlo: las cantidades de operaciones y esquemas de la síntesis son históricas.
- El cliente Swift está en `/Users/arturo/financemdm-ios`. El proyecto Android aún
  no existe y se creará después de completar y aceptar iOS.
- La app iOS usa SwiftUI, iOS 17+, `APIClient`, `SessionManager` y XCTest. Su sesión
  valida `/auth/me` al restaurarse; si no puede validarla, elimina el estado local.
- Este plan es una propuesta de trabajo, no un OpenAPI completo ni autorización para
  despliegues ni escrituras offline de negocio.

## Decisiones actuales

1. Empezar en iOS con el catálogo de productos de solo lectura.
2. Mantener cualquier caché separada por origen del API, usuario y tenant.
3. No guardar el costo del producto en la caché offline.
4. No tratar el stock local como oficial: siempre indicar cuándo el catálogo está
   guardado localmente y cuándo se actualizó.
5. Ante logout, expiración de sesión o cambio de tenant, eliminar los datos locales.
6. No permitir escrituras offline hasta definir idempotencia, conflictos, límites de
   autorización y consecuencias de negocio.
7. No persistir credenciales ni extender la sesión para permitir reapertura offline
   hasta acordar política de autorización y caducidad.
8. Posponer ventas, compras, contabilidad, Go y Android hasta cumplir sus
   dependencias y terminar la etapa iOS.
9. Autorizado por el usuario: agregar el soporte de esquema necesario para un registro
   transaccional y tenant-scoped de cambios de productos/stock. La autorización no
   incluye aplicar migraciones en producción ni desplegar.

## Alcance excluido por ahora

- Offline para web.
- Crear o modificar productos, stock, ventas, compras, facturas o asientos contables
  mientras no haya conexión.
- Sincronización optimista que presente operaciones locales como confirmadas.
- Despliegues o llamadas contra producción.
- Iniciar el cliente Android antes de cerrar la etapa iOS.

## Criterios de aceptación

### AC-001 — Consulta local de productos

- **Escenario:** usuario autenticado con tenant y catálogo descargado previamente.
- **Acción:** falla la conexión al cargar productos.
- **Resultado:** iOS muestra el catálogo guardado y su fecha de última actualización.
- **No debe:** representar esa instantánea como dato recién confirmado por el servidor.
- **Verificación:** XCTest de fallback de red y revisión manual del estado visual.
- **Prioridad:** requerido para la primera entrega iOS.

### AC-002 — Aislamiento de datos locales

- **Escenario:** dos usuarios, tenants u orígenes usan la misma instalación.
- **Acción:** se intenta cargar la caché con un scope distinto.
- **Resultado:** no se devuelve la caché del otro scope.
- **No debe:** escribir identificadores de cuenta legibles en nombres de archivo ni
  persistir el costo del producto.
- **Verificación:** XCTest de aislamiento, inspección de archivos y comprobación de
  protección de archivos iOS.
- **Prioridad:** requerido.

### AC-003 — Limpieza de sesión

- **Escenario:** logout, expiración de sesión o cambio de tenant completado.
- **Acción:** SessionManager limpia o cambia la sesión.
- **Resultado:** se elimina la caché local de productos.
- **No debe:** servir datos de la sesión anterior.
- **Verificación:** XCTest de SessionManager y prueba manual del flujo de sesión.
- **Prioridad:** requerido.

### AC-004 — Contrato incremental de cambios

- **Escenario:** el cliente pide cambios desde un cursor válido o inicia una carga.
- **Acción:** Next.js atiende la operación de sincronización.
- **Resultado:** retorna una página estable, autorizada por tenant y con cursor
  reanudable; las escrituras web relevantes aparecen en el feed.
- **No debe:** permitir saltar el tenant, perder cambios entre páginas ni publicar
  escrituras sin confirmar.
- **Verificación:** contrato OpenAPI, pruebas de autorización, paginación, cambios
  concurrentes e integración con escritura online.
- **Prioridad:** requerido antes de sincronización incremental en iOS.

### AC-005 — Operaciones móviles pendientes

- **Escenario:** el producto y las reglas offline correspondientes están aprobados.
- **Acción:** el cliente envía una operación offline al reconectar.
- **Resultado:** el servidor acepta, rechaza o devuelve conflicto de forma explícita;
  reintentar la misma clave no duplica efectos.
- **No debe:** sobrescribir saldos, saltarse permisos ni marcar una operación local
  como oficial antes de la aceptación del servidor.
- **Verificación:** pruebas de idempotencia, concurrencia, autorización y reconciliación.
- **Prioridad:** bloqueado por decisiones de negocio.

### AC-006 — Paridad iOS/Android

- **Escenario:** la implementación y aceptación funcional de iOS están cerradas.
- **Acción:** se inicia el proyecto Android nativo.
- **Resultado:** reproduce el mismo contrato y garantías de aislamiento,
  autorización, cursores y resolución de errores.
- **No debe:** divergir el contrato ni adelantar reglas de negocio no aprobadas.
- **Verificación:** pruebas del SDK/contrato compartido y suites nativas Android.
- **Prioridad:** posterior a iOS.

## Fases y tareas

### Fase 0 — Revalidar contrato y decisiones

- [ ] Comparar `docs/openapi/mobile-v1.json`, manifiesto de SDK y cliente iOS con
  `origin/main`/checkout actual.
- [ ] Identificar endpoints de productos, paginación, tenant y cambios; no asumir
  que los datos de octubre siguen vigentes.
- [ ] Definir con el usuario seguridad de dispositivo, expiración de autorización
  offline, retención y recuperación.
- [ ] Definir política fiscal y de inventario antes de permitir ventas offline.

### Fase 1 — iOS: catálogo de productos de solo lectura (en curso)

- [x] Crear worktree aislado `feat/offline-ios-products-cache`.
- [x] Añadir pruebas de persistencia, separación por usuario/tenant, borrado y
  fallback de catálogo con aviso de antigüedad.
- [x] Guardar catálogo mínimo con protección de archivos; excluir costo.
- [x] Borrar caché al cerrar/expirar sesión y al cambiar tenant.
- [x] Ejecutar XCTest en el iPhone 16 Pro Max: 147 aprobadas, 0 fallidas.
- [ ] Revisar visualmente accesibilidad y estado vacío/desactualizado.
- [ ] Aceptación del usuario de esta primera entrega iOS.

**Límite provisional:** la caché solo está disponible dentro de una sesión ya
validada. Si la app se reinicia sin conexión, la restauración actual limpia la
sesión/caché; no se sorteará este comportamiento hasta acordar autenticación offline.

### Fase 2 — Backend: feed de sincronización

- [x] Autorizar soporte de esquema para el registro transaccional de cambios.
- [ ] Diseñar snapshot inicial y pull incremental por cursor en el OpenAPI móvil.
- [ ] Definir orden total, cursores opacos, reanudación, expiración y paginación.
- [ ] Asegurar aislamiento por tenant y autorización por operación.
- [ ] Registrar los cambios de dominio y los realizados desde web en el mismo
  límite transaccional apropiado; definir estrategia de retención/reconstrucción.
- [ ] Añadir pruebas de contrato, aislamiento, concurrencia y recuperación antes de
  activar el endpoint.
- [ ] Regenerar SDKs solo tras validar el contrato.

### Fase 3 — iOS: sincronización incremental de lectura

- [ ] Consumir snapshot y feed con cursor persistido.
- [ ] Aplicar páginas de manera repetible y atómica en la base local.
- [ ] Recuperar cursor expirado mediante snapshot completo sin perder el catálogo
  anterior hasta terminar la sustitución.
- [ ] Mostrar estado y fecha de sincronización, errores recuperables y reintento.

### Fase 4 — iOS: escrituras offline por módulo

- [ ] Definir y aprobar operaciones permitidas, caducidad y comportamiento sin
  autorización vigente.
- [ ] Implementar outbox transaccional, identificador de idempotencia y estados
  pendiente/aceptado/rechazado/conflicto.
- [ ] Empezar por movimientos de inventario; nunca sobrescribir saldos directamente.
- [ ] Diseñar ventas únicamente después de decidir stock, precio, facturación y
  requisitos fiscales; evitar doble movimiento en recepción de compras.
- [ ] Excluir contabilidad y cierres hasta aprobación explícita.

### Fase 5 — Android

- [ ] Crear aplicación Android nativa después de la aceptación de iOS.
- [ ] Reutilizar el contrato OpenAPI móvil; base local, cursor y outbox con garantías
  equivalentes a iOS.
- [ ] Ejecutar paridad de contrato y flujos críticos antes de habilitar offline.

## Evidencia inicial

- La síntesis de Second Brain localizada en
  `wiki/17-projects/tcp/offline-mobile-plan-2026-10.md` indica Next.js como API,
  PostgreSQL como autoridad, prioridad Swift/Kotlin y productos como primer módulo.
- La suite XCTest pasó en el iPhone 16 Pro Max: 147 aprobadas, 0 fallidas, 0 omitidas
  (iOS 27.2; xcresult en DerivedData local).
- El OpenAPI móvil actual expone GET `/products` como listado completo, sin cursor ni
  operación de sincronización.
- `Producto.updatedAt` no cubre cambios en `StockUbicacion`, que alimentan el stock
  derivado mostrado por el endpoint; `Producto` tampoco tiene `deletedAt`. Por eso el
  cursor requiere capturar las mutaciones de producto y stock, incluyendo borrados.
- El equipo CodeGraph CLI no está instalado en esta máquina; se consultó el grafo
  Codebase Memory disponible y luego se verificaron los archivos relevantes.
- El checkout iOS original ya tenía modificaciones locales en `graphify-out/`;
  se dejaron intactas y la implementación se aisló en un worktree separado.

## Decisiones pendientes que bloquean escritura offline

- ¿Qué operaciones y roles pueden operar sin red?
- ¿Cuánto tiempo puede usarse una autorización offline y cómo se revoca?
- ¿Cómo se protegen, retienen y borran los datos en dispositivos compartidos,
  perdidos o comprometidos?
- ¿Qué política aplica a precios, reservas de stock, ventas, facturación e impuestos
  cuando el servidor no puede validar el estado actual?
- ¿Qué periodo de retención y mecanismo de recuperación tendrá el feed/cursor?

**Retención del feed:** pendiente de decisión. Hasta definirla, no agregar una tarea de
purga ni hacer despliegues; el MVP local conserva los eventos para no invalidar cursores.
