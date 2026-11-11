# Auditoría consolidada: TCP frente a Odoo

**Fecha de corte:** 2026-10-24  
**Baseline de código:** `origin/main` `988378358fbb8c32397def99a518f530b196f901`. La fuente de despliegue reporta un artefacto originado en ese SHA; el SHA/runtime servido por health no quedó establecido. Este documento no vuelve a verificar el despliegue, la base de datos ni la aceptación operativa.  
**Baseline externo:** documentación oficial de Odoo 19.0; no implica que sea la versión más reciente ni establece por sí sola la edición disponible para cada función.

## Dictamen ejecutivo

TCP ya cubre flujos importantes de inventario, venta, compra, contabilidad y operación multi-tenant. No hay evidencia para resumirlo como “paridad con Odoo”, asignarle un porcentaje global ni afirmar que las capacidades presentes en código estén todas desplegadas, probadas en producción o aceptadas por usuarios.

La lectura más precisa es: el reporte consolida avances desde septiembre, pero debe separar artefactos y planes históricos de capacidad integrada; corregir el alcance de la rama de brechas; y describir el contraste con Odoo por flujo, edición y evidencia. La rama `feat/sesion-f-brechas-odoo` completa **no** se integró. Sí existen slices integrados de la integración Sesión F, entre ellos merma tenant-scope y LP-1 (`5e37f30e`); `030ffa1a` cerró esa integración. Esto no incorpora F-1…F-9 como conjunto. La regeneración Graphify `c82971f8` no acredita integración funcional.

### Qué se ha hecho: trayectoria resumida

| Fecha / línea de trabajo | Resultado documentado | Límite de la afirmación |
|---|---|---|
| 2026-09-05 — auditoría urgente | Se corrigieron hallazgos de contratos, ofertas, almacenes, precios/servicios, mermas y lista de precios de cliente; el mapeo CU-01..CU-08 corresponde a subáreas, no a ocho defectos independientes demostrados. | Tareas/cambios históricos y presencia de código no equivalen a recertificación actual. |
| Detalle CU del borrador | CU-01/02: IDOR de contratos y numeración por tenant; CU-03/04: autorización de exportación de ofertas y `VentaItem` al facturar; CU-05: guard de almacén; CU-06/07: precio/totales de servidor y merma con autor/costo; CU-08: FK de lista de precios en cliente. | Se conserva el mapeo histórico del informe; los pares/números son etiquetas heredadas, no una nueva certificación por requisito. |
| 2026-09-12 y 2026-10-18 — precios | LP-0 re-resuelve precio en servidor y rechaza discrepancias; LP-1 unifica la prioridad cliente > punto de venta > default tenant > base. El POS usa el resolver; hay E2E para el flujo de lista de cliente. | LP-2..LP-6 siguen pendientes. La existencia del E2E no dice que se ejecutara en esta revisión. |
| 2026-09-26 — integridad de datos | Se abordaron borrado de PV, merma móvil, anulación de venta/oferta, agregados de transferencias, permisos de transferencia y período cerrado. | La reauditoría enumera fases F-1..F-5; no convertirlo en conteo independiente de “6/6” sin conservar ese mapeo. |
| Detalle de defectos de datos del borrador | PV: borrado protegió catálogo; merma móvil: registro en kardex/espejo con autor; anulación de venta: liberación de oferta; stock PV: excluir transferencias canceladas/eliminadas; transferencias: permiso de gestión; período cerrado: validación server-side. | El borrador agrupa seis en cinco fases; se conserva el mapeo sin presentarlo como nueva recertificación. |
| Septiembre-octubre — sesiones funcionales | Se desarrollaron flujos de contratos, transferencias y marco fiscal; las cifras históricas 36/36, 20/20 y 12/12 son conteos de tareas de sus respectivos cambios. | No significan que todos los escenarios de producto pasaron hoy ni que haya certificación fiscal. |
| Inventario, fases 0-3 | Feature gating, kardex auditable, ajustes/conteo y OC con recepción parcial/backorder/reabastecimiento. | Código/plan presente no demuestra paridad completa de inventario ni matching de pago. |
| Inventario, fase 7 | Propuesta de trabajo futuro: MRP multinivel, trazabilidad, putaway, valoración y forecast. | No iniciada según el plan referido; no se hizo aquí una auditoría completa de esas funciones/ediciones Odoo ni se confirma una ausencia global. |
| Octubre — hardening y operación | Dashboard, FX/caja, ciclo de ofertas, respaldos estructurados, vales, revisiones, tipos de contrato y mejoras fiscales/sidebar. | Evidencia de trabajo del repositorio; esta revisión no ejecutó pruebas, inspeccionó runtime ni confirmó restauraciones. |

## Cómo leer los estados

### Actualización de seguimiento — 2026-11-06

La tabla de esta auditoría conserva el corte histórico del 24 de octubre. En
`main` se integraron después las capacidades de UdM, lotes/FEFO, ubicaciones y
variantes (ver `openspec/changes/inventario-paridad-odoo/tasks.md`, fases 4–6).
Putaway se integró mediante los PR #130–#132; los reportes de valorizado,
rotación y forecast quedaron integrados con #111–#115 (último PR #168).

La rama original de la sesión F sigue siendo una fuente histórica, no una
lista de funcionalidades integradas. Para cerrar su alcance aún se necesita
revisar y llevar a `main`, según corresponda:

- F-1: el checklist de inventario documenta conversión por producto en recetas
  y consumo en unidad de stock (4.3). Contrastar sus pruebas y compatibilidad
  con recetas legacy; hay selectores en compra y POS, pero falta verificar todos
  los criterios históricos, incluida la visualización del factor.
- F-2: devolución a proveedor, sus movimientos y reversión, asiento formal e UI.
- F-3: catálogo/precios por proveedor, sincronización y vista 360.
- F-4: recurrencias, adjuntos y flujo completo de viáticos.
- F-5: configuración de nómina, vínculo usuario-empleado y sus interfaces.
- F-6: contrastar el estado de cuenta imprimible compuesto con el alcance de F.

Los nombres de modelos y acciones F-2–F-5 de la rama histórica no se localizaron
en el esquema/código revisado de `main`; esto no descarta funciones equivalentes
con otros nombres. Los checkboxes históricos de F no certifican su integración.
La matriz visual por plan y el estado de migraciones en el entorno de destino
siguen por verificar; véase el checklist de inventario.

- **Presente en código:** símbolo, modelo o flujo localizado en la referencia indicada. No asegura cobertura integral.
- **Integrado:** el cambio está contenido semánticamente en `origin/main`; no basta el nombre de una rama o el cierre de sus tareas.
- **Desplegado:** requiere evidencia de despliegue/runtime ligada a un SHA. Aquí producción en `9883783` es dato reportado, no una comprobación nueva.
- **Probado:** indicar tipo, entorno, resultado y fecha. Test existente, test histórico, unit, integración, E2E y carga no son intercambiables.
- **Aceptado:** requiere evidencia de operación/usuario; no se infiere de código ni de HTTP sano.
- **Brecha no revisada:** dimensión pendiente de evaluación, no carencia confirmada.

## Estado funcional consolidado en `origin/main`

| Área | Capacidad observada | Brecha o límite sustentable |
|---|---|---|
| Inventario | Fases 0-3 descritas arriba; transferencias con despacho/recepción parcial; asignación FIFO de existencias en los flujos revisados. | UdM con factor de conversión, lotes/FEFO, ubicaciones de nivel 1 y variantes no aparecen implementados como los flujos F revisados. MRP avanzado, putaway y forecast pertenecen a trabajo futuro, no a una brecha ya auditada exhaustivamente. |
| Ventas/POS | Ciclo de oferta/venta, devoluciones/NC en modelo, comisiones base, vuelto, listas de precio por cliente/PV/default/base, crédito/anticipos y consulta de cuenta. | Modelo o capability base no prueban workflow completo de liquidación de comisiones ni cada reporte/permiso. LP-2..LP-6 pendientes. |
| Compras | Orden de compra, recepción parcial, backorder, factura asociada y reabastecimiento. | Asociación factura-OC no demuestra un **3-way match** ni bloqueo del pago por cantidad recibida, precio y política. Devolución a proveedor y pricelist/360 del proveedor son parciales o no están integradas como F. |
| Contabilidad | Informes, FX, CxC/CxP, caja, ajustes e inyección de capital; hay motor formal de contabilización en código. | `postEvento` tiene tres call-sites identificados en el servicio de operaciones de caja (dos pagos y creación de deuda); no es hook universal de toda deuda/préstamo. Registro operativo no demuestra contabilización formal y conciliación integral. |
| Facturación fiscal | Framework FE-T1..T5 y orquestación/modelos documentados. | Adaptador por país, XML productivo, cancelación normativa y recepción de autoridad no están certificados aquí. No equivale a cumplimiento de Cuba u otro país. |
| CRM/contratos | Gestión operativa de clientes; contratos con máquina de estados, configuración/alertas y capacidades de firma reportadas. | Pipeline/scoring y renovación automática no se deben describir como equivalentes; no afirmar que una función carece de equivalente global en Odoo Community sin comparar el workflow y edición concretos. |
| Empleados/gastos | Operaciones base de empleados, pagos, vacaciones, gastos y viáticos. | Nómina formal/reglas legales no demostradas. `NominaConfig`/vínculo de usuario, recurrencias, adjuntos y algunas vistas de la rama F no están integradas como esos workflows. |
| Seguridad/tenant | RBAC y aislamiento por tenant en código; catálogo actual de permisos contiene 94 claves. | 94 es el registro, no cobertura efectiva de rutas/roles. Shadow histórico no prueba 40 días limpios hoy ni habilita `enforce`; AS-06 requiere evidencia técnica vigente, plan de rollback y autorización. Multi-tenant SaaS no equivale a multi-company intercompañía de Odoo. |

### Rama de brechas F: rescatar por slices, no merge completo

La rama fuente `feat/sesion-f-brechas-odoo` está divergida de `origin/main`. El checkout local `HEAD c40c4cf0` tiene dos commits exclusivos locales y cinco exclusivos de `origin/main`; no usar su relación como “40 commits detrás”. La ancestry confirma que la rama F no es ancestro de `origin/main`, pero los slices ya integrados requieren evaluación semántica aparte.

| Capacidad F | Estado de `origin/main` observado | Precisión |
|---|---|---|
| F-1 UdM con factor | **Integrado** (revisión 2026-10-26/27: PRs #21-#38 y #33-#38 en `origin/main` `f7268390`→`e15017d1`; conversión de unidades, trazabilidad de unidad en compras, dimensiones de producto) | Actualización: estaba "Parcial/no" al corte del 2026-10-24. |
| F-2 devolución a proveedor | No localizada | No generalizar a ausencia de gestión de proveedor. |
| F-3 pricelist/proveedor 360 | Parcial | Hay proveedor, compras e historial; no el flujo F de precio preferente/sync/autocompletado. |
| F-4 recurrencias, adjuntos y viáticos | Parcial | Gastos/viáticos básicos existen; no el workflow F completo. |
| F-5 NominaConfig y vínculo validado | Parcial/no | Existen empleados/fórmulas/pagos base; no esa configuración/vinculación específica. |
| F-6 estado de cuenta PDF | Parcial | Hay consulta contable; no se encontró la exportación compuesta de F. |
| F-7 lotes/FEFO | No localizado | No confundir FIFO de asignación de costo/existencia con lotes o FEFO. |
| F-8 ubicaciones nivel 1 | No localizado | Se refiere a estructura y movimientos de ubicaciones, no a almacenes en general. |
| F-9 variantes por plantilla | No localizado | No inferir incapacidad de catálogo más amplia. |

El `tasks.md` de F marca 93/101 checks completados: es estado documental histórico, **no** 93 pruebas verdes actuales ni readiness de producto. Los ocho pendientes consignados allí incluyen UIs mínimas, asiento formal de devolución, conversor legacy de producción y selector de unidad POS. No se ejecutaron pruebas de esa rama en esta revisión.

El detalle de los ocho checks sin marcar en `feat/sesion-f-brechas-odoo:openspec/changes/sesion-f-brechas-odoo/tasks.md` es:

1. **1.9:** adaptar el conversor legacy de recetas de producción con símbolos libres masa/volumen; se difirió por riesgo de cambiar semántica del flujo existente.
2. **1.10:** integrar conversión de unidades en acciones y rutas de recetas de producción.
3. **1.13:** UI de selector de unidad en compra y POS, con factor/unidades del tenant.
4. **2.7-2.8:** asiento formal de devolución a proveedor, sujeto a integrar la capa `contabilidad-formal`.
5. **2.13:** UI mínima para listar/crear devoluciones de compra y permiso asociado.
6. **3.11:** página de detalle 360 del proveedor con pestañas y enlace desde la tabla.
7. **4.11:** UI de gastos recurrentes, generación, adjuntos y selección de empleado.
8. **5.7:** UI de datos del empleado y configuración de nómina; las actions de servidor se describen como listas en la tarea.

## Comparación externa: alcance y matices

La base comparativa es documentación oficial Odoo 19.0. Comunidad/Enterprise, configuración, hosting, país y versión deben especificarse por función; no se hizo aquí un benchmark de precios/ROI ni un catálogo exhaustivo de ediciones.

- **Compra:** factura vinculada a OC no equivale a 3-way match. Odoo documenta política de control de factura según cantidades recibidas y condición para pagar. Comparar recepción, factura y bloqueo de pago por separado. [Control de facturas](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/purchase/manage_deals/control_bills.html) · [Política de control](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/purchase/manage_deals/manage.html).
- **Valoración:** FIFO de asignación/remoción, FEFO y valoración contable son conceptos distintos. La valoración de inventario y el momento de generar asientos dependen de configuración; en Odoo 19, inventario puede reflejar movimientos físicos, mientras contabilidad puede actualizarse por cierre o contabilización de factura en modalidad perpetua. No afirmar “asiento anglosajón por movimiento” como supuesto general de Odoo. [Valoración contable](https://www.odoo.com/documentation/19.0/applications/finance/accounting/get_started/inventory_valuation.html) · [Uso de valoración](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/inventory_valuation/using_inventory_valuation.html).
- **Inventario:** lotes/series, FEFO, ubicaciones, UoM y variantes son capacidades configurables distintas. Describir el flujo requerido y edición, no una brecha binaria “inventario completo”. [Trazabilidad/lotes](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/lots.html) · [Supply Chain](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp.html).
- **Manufactura y contratos:** no atribuir toda manufactura a Enterprise ni afirmar falta global de contratos en Community. Comparar BOM, PLM, acuerdos de venta/compra, suscripciones y workflows concretos; revisar la matriz de edición antes de afirmarlo. [Manufactura](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing.html) · [PLM](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/plm.html) · [Suscripciones](https://www.odoo.com/documentation/19.0/applications/sales/subscriptions.html) · [Ediciones](https://www.odoo.com/page/editions).
- **Fiscalidad y entrega:** la localización española documentada no acredita cumplimiento para TCP ni Cuba. Odoo diferencia Community/Enterprise, SaaS y opciones de hosting; no comparar precio puntual sin fecha, moneda, usuarios, hosting y alcance. [España](https://www.odoo.com/documentation/19.0/applications/finance/fiscal_localizations/spain.html) · [Localizaciones](https://www.odoo.com/documentation/19.0/es_419/applications/finance/fiscal_localizations.html) · [Administración](https://www.odoo.com/documentation/19.0/es_419/administration.html) · [Precios](https://www.odoo.com/pricing).

## Precios pendientes

El plan de precios distingue explícitamente LP-0/LP-1 terminados de estas extensiones planeadas:

| ID | Extensión pendiente | Dependencia / estado |
|---|---|---|
| LP-2 | Vigencias (`fechaInicio`/`fechaFin`) por precio | Política H4 de redondeo/precisión debe resolverse antes de diseñar el cambio. |
| LP-3 | Escalones por cantidad (`cantidadMinima`) | H4; modelado pendiente. |
| LP-4 | Moneda por lista | H4 y dependencias contables; pendiente. |
| LP-5 | Descuento por línea | `VentaItem` aún no tiene ese campo en la auditoría referida; diseño pendiente. |
| LP-6 | Tasas/impuestos por producto | Track fiscal propio; modelo/reglas pendientes. |

## Correcciones trazables al borrador anterior

| Afirmación anterior | Corrección de esta versión |
|---|---|
| “Verificada contra main (HEAD c40c4cf0)” | Baseline explícita `origin/main` SHA `9883783`; el checkout no es idéntico. Producción en ese SHA es dato reportado, no verificación nueva. |
| Rama F “nunca se integró” | La rama completa no se integró; hubo slices parciales (merma tenant-scope/LP-1) y cierre `030ffa1a`. |
| “133 commits de drift”, “mayor retorno” | Se elimina conteo dependiente de base y ranking sin rúbrica. Recomendar rescatar slices revisados, no mergear toda la rama. |
| “93 tareas verificadas con TDD” / “93/101” como garantía | 93/101 checks históricos cerrados en tasks; no implica pruebas actuales, aceptación ni readiness. |
| “3-way factura vinculada” | Asociación OC-factura separada de match por recepción/cantidad/precio y bloqueo de pago. |
| 61 permisos; shadow limpio >40 días; AS-06 solo aprobación | Catálogo observado: 94 claves; conteo no es cobertura. Telemetría no verificada; enforce necesita gate técnico, rollback y autorización. |
| “marco fiscal 12/12” como cierre de capacidad | Conteo de tareas de marco; no certificación país, XML productivo ni aceptación de autoridad. |
| CRM/contratos/no clonados y MRP Enterprise como ausencias definitivas | Reexpresar como alcance no incluido/no demostrado hasta comparar workflow, edición y decisión aprobada. |
| “5.059 ventas y listo para producción” | Prueba histórica limitada; no certifica capacidad en producción. El registro CI conocido de `988` tuvo fallos en shards unitarios 1, 2 y 4; OpenAPI, lint/typecheck e integración PostgreSQL reportados como pasados no convierten el CI total en verde. No se repitieron pruebas aquí. |

## Prioridades siguientes

1. Vincular cada afirmación de estado productivo a SHA, despliegue y aceptación reciente; resolver/explicar el estado CI antes de presentar readiness general.
2. Revisar F-1…F-9 por slices contra modelos, acciones, migraciones y pruebas del target; validar dependencias y recuperar evidencia histórica, sin auto-merge ni activación automática de enforcement.
3. Resolver H4/redondeo y política monetaria antes de diseñar LP-2/3/4; LP-5/6 mantienen su propia definición funcional/fiscal.
4. Validar fiscalidad por país y edición cuando exista un país objetivo; no inferir certificación del framework actual.
5. Tratar MRP multinivel, conversión/migración de datos, accesibilidad, concurrencia negativa, localización, retención/auditoría y operación backup/restore como dimensiones pendientes de revisión, no como defectos confirmados.

## Referencias internas

- `docs/auditoria-listas-precios-vs-odoo.md` — LP-0..LP-6 y decisión H4.
- `openspec/changes/inventario-paridad-odoo/` — fases de inventario; fases 0-3.
- `openspec/changes/aislamiento-sistemico-tenant/` — AS-01..AS-06; tareas documentales históricas deben contrastarse con código.
- `openspec/changes/archive/2026-09-16-facturacion-fiscal-electronica/` — marco FE-T1..T5.
- `docs/informe-produccion-2026-10-22.md` y `docs/auditoria-load-testing-2026-10-05.md` — evidencia histórica de carga, con límites.

**Alcance de esta revisión:** síntesis documental de tres revisiones read-only y fuentes citadas. No se ejecutaron tests, builds, consultas DB, inspecciones nuevas de proveedor/runtime ni acciones de despliegue. No se verificaron hoy aceptación, restauración de backups, telemetría shadow ni readiness general.
