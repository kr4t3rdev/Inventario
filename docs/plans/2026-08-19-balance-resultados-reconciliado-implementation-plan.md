# Plan de Implementación: Balance y Resultados Reconciliado

**Fecha**: 2026-08-19
**Estado**: Planning
**Prioridad**: Crítica
**Modo de interfaz**: Operate
**Método**: TDD estricto, RED -> GREEN -> REFACTOR por fase

## Objetivo

Convertir Balance y Resultados en un reporte financiero trazable y confiable, con movimientos
del período basados en dinero reconciliado, saldos auxiliares consistentes con una fecha de corte,
moneda funcional explícita y una primera pantalla que comunique cobertura, procedencia y calidad
de cada cifra.

La misma fuente canónica se reutilizará progresivamente en los demás reportes de contabilidad.

## Decisiones Contables No Negociables

1. `Resultado reconciliado` y `flujo neto reconciliado` no se llamarán `utilidad neta contable`.
2. El efectivo y los movimientos del período procederán exclusivamente de reconciliaciones
   contabilizadas y normalizadas a la moneda funcional.
3. Inventario, cuentas por cobrar y cuentas por pagar se mostrarán como saldos auxiliares a una
   fecha de corte. No se presentarán como movimientos bancarios.
4. Las compras de inventario no serán gasto del resultado. Se mostrarán como salida de caja y se
   reconocerán en resultados mediante el costo de la mercancía asociada a ingresos reconciliados.
5. Ninguna suma combinará monedas sin una conversión y procedencia de tasa verificables.
6. Ninguna consulta financiera podrá ejecutarse sin un `tenantId` efectivo. Un administrador
   global deberá seleccionar una empresa.
7. Los períodos usarán rangos semiabiertos: `fecha >= inicio && fecha < inicioSiguientePeriodo`.
8. Los datos incompletos no se convertirán silenciosamente en cero. Se devolverán cobertura,
   incidencias y estado de confiabilidad.
9. El reporte no forzará artificialmente la ecuación contable. Mostrará la diferencia real y las
   partidas que impiden cuadrarla.
10. Los cierres aprobados serán inmutables y consultables desde snapshots versionados.

## Definiciones Del Reporte

```text
Ingresos reconciliados
= cobros de ventas operativas contabilizados
+ cobros de servicios contabilizados

Egresos operativos reconciliados
= salarios pagados
+ gastos generales pagados
+ servicios recibidos pagados
+ costo de servicios vendidos pagado
+ otras partidas operativas expresamente clasificadas

Flujo neto reconciliado
= todos los cobros operativos reconciliados
- todos los pagos operativos y de inventario reconciliados

Resultado reconciliado
= ingresos reconciliados
- costo histórico asociado proporcionalmente a los ingresos reconciliados
- egresos operativos reconciliados

Total activos
= efectivo reconciliado a fecha de corte
+ inventario a costo histórico
+ cuentas por cobrar activas

Total pasivos
= deuda externa pendiente
+ cuentas por pagar activas
+ demás obligaciones reconocidas

Patrimonio registrado
= capital aportado
+ resultados acumulados de cierres aprobados
+ resultado del período

Diferencia contable
= total activos - total pasivos - patrimonio registrado
```

## Contrato De Reconciliación

Una reconciliación será contabilizable cuando cumpla todas estas condiciones:

- Pertenece al tenant solicitado.
- Tiene una fecha de reconciliación dentro del período.
- Tiene importe positivo y moneda identificada.
- Está efectivamente pagada o contabilizada según su tipo.
- Puede expresarse en la moneda funcional sin inventar una tasa.
- No corresponde a una operación anulada, cancelada o eliminada.
- Tiene clasificación operativa, financiera o patrimonial explícita.

`ReconciliacionVenta` deberá excluir de ingresos operativos los desembolsos y cobros de préstamos,
deudas cash y cualquier otro financiamiento. Esos movimientos aparecerán en flujo financiero.

Para `ReconciliacionGasto`, `PENDIENTE` no contará como dinero salido. `PARCIAL` contará solo por
el importe efectivamente pagado y `PAGADA` por el importe contabilizado.

## Política TDD Estricta

Cada fase debe seguir este orden y conservar evidencia del resultado:

1. Escribir primero tests de comportamiento e invariantes.
2. Ejecutar únicamente los tests de la fase y comprobar que fallan por la razón esperada.
3. Implementar el mínimo código necesario para pasar.
4. Ejecutar los tests y comprobar GREEN.
5. Refactorizar sin cambiar comportamiento.
6. Repetir los tests de la fase y sus regresiones directas.
7. Verificar al menos 80% de cobertura en líneas, ramas, funciones y statements del código nuevo.
8. Ejecutar typecheck y lint sobre el alcance antes de cerrar la fase.

Comandos base:

```bash
CI=1 pnpm exec vitest run <archivos-de-la-fase>
CI=1 pnpm exec vitest run --coverage <archivos-de-la-fase>
pnpm run typecheck
pnpm run lint
```

Reglas:

- No escribir implementación antes de observar RED.
- No cambiar el test para hacer pasar una implementación incorrecta.
- No usar tests omitidos, `.skip`, `.todo` o snapshots visuales sin aserciones semánticas.
- Los tests de fórmulas usarán importes diseñados para descubrir doble conteo y errores de signo.
- Cada bug descubierto deberá quedar representado por una prueba de regresión.
- Los tests no dependerán del reloj real, locale del equipo ni zona horaria local.
- No ejecutar `pnpm run test:run -- <archivo>` para una fase, porque el script puede lanzar la
  suite completa. Usar directamente `pnpm exec vitest run <archivo>`.

## Estructura Objetivo

**Crear**

- `src/features/contabilidad/domain/financial-report-types.ts`
- `src/features/contabilidad/domain/reconciliation-policy.ts`
- `src/features/contabilidad/domain/reconciled-result-calculator.ts`
- `src/features/contabilidad/domain/balance-calculator.ts`
- `src/features/contabilidad/services/balance-results-report-service.ts`
- `src/features/contabilidad/actions-balance-results.ts`
- `src/features/contabilidad/components/balance-results/financial-report-header.tsx`
- `src/features/contabilidad/components/balance-results/reconciliation-coverage.tsx`
- `src/features/contabilidad/components/balance-results/accounting-equation.tsx`
- `src/features/contabilidad/components/balance-results/balance-breakdown.tsx`
- `src/features/contabilidad/components/balance-results/results-summary.tsx`
- `src/features/contabilidad/components/balance-results/monthly-results-chart.tsx`
- Tests unitarios junto a cada dominio y componente.
- `e2e/contabilidad/balance-resultados.spec.ts`
- Script auditable de diagnóstico/backfill para conversiones históricas si resulta necesario.

**Modificar**

- `src/features/contabilidad/api/exchange-handlers.ts`
- `src/app/api/contabilidad/balance-financiero/route.ts`
- `src/app/busy/contabilidad/balance-resultados/page.tsx`
- `src/app/busy/contabilidad/balance-resultados/page.test.tsx`
- `src/lib/services/periodo-snapshot-service.ts`
- `src/lib/services/fecha-operacion-registry.ts`
- `src/features/contabilidad/api/__tests__/exchange-handlers.test.ts`
- Flujos de escritura de reconciliaciones que no normalicen consistentemente `montoConvertido`.
- Exportaciones CSV/PDF y reportes contables que mantengan agregaciones paralelas.

El servicio compartido será la fuente de verdad. La Server Action atenderá la web y la API legacy
se conservará como adaptador del mismo servicio mientras tenga consumidores activos.

## Fase 0: Guardas De Empresa Y Período

**Objetivo**: Cerrar primero los dos defectos transversales que pueden contaminar cualquier fórmula:
consultas sin empresa y períodos mensuales incompletos.

### RED

- [x] Test que rechaza un administrador sin tenant seleccionado.
- [x] Test que demuestra que un rango semiabierto incluye el último día completo del mes.

Resultado RED esperado: los tests fallan contra `getBalanceFinanciero` actual.

### GREEN

- [x] Exigir un `tenantId` efectivo para administradores y usuarios.
- [x] Sustituir límites `lte` a medianoche por `lt` al inicio del mes siguiente.
- [x] No cambiar aún reconciliaciones ni fórmulas de producción.

### REFACTOR

- [x] Simplificar filtros tenant ahora que nunca pueden ser opcionales.
- [x] Aplicar el mismo rango mensual a todas las fuentes legacy hasta sustituirlas.

### Salida

- Ninguna consulta puede agregar varias empresas por ausencia de tenant.
- Ninguna operación válida del último día queda fuera del período.

## Fase 1: Dominio Puro Y Política De Clasificación

**Objetivo**: Separar reglas financieras de Prisma y React.

**Estado**: Completada. La migración de las clasificaciones legacy del reporte se realizará en las
fases 6 y 9 para no modificar consumidores antes de contar con contratos de servicio y paridad.

### RED

- [x] Tests de clasificación de reconciliaciones operativas, financieras y patrimoniales.
- [x] Tests de estados `PENDIENTE`, `PARCIAL`, `PAGADA`, anulada y cancelada.
- [x] Tests para préstamos, deuda cash, transferencias, capital y ajustes.
- [x] Tests de signos para entradas, salidas y reversos.
- [x] Tests de cobertura completa, parcial e indeterminada.

### GREEN

- [x] Implementar `reconciliation-policy.ts` con constantes y funciones exhaustivas.
- [x] Implementar tipos discriminados, evitando strings libres en el dominio nuevo.
- [x] Devolver una incidencia explícita ante tipos desconocidos.

### REFACTOR

- [x] Centralizar las clasificaciones en una política única sin modificar todavía consumidores.
- [x] Documentar cada fórmula y clasificación con JSDoc.

### Salida

- Dominio puro con cobertura de ramas >= 90%.
- Ningún tipo desconocido entra silenciosamente en ingresos o gastos.

## Fase 2: Moneda Funcional Y Normalización

**Objetivo**: Garantizar que cada total se expresa en una sola moneda conocida.

**Estado**: Completada. La integración del dominio con todas las lecturas y escrituras legacy se
realizará en las fases 6 y 9, junto con sus contratos de servicio y pruebas de paridad.

### RED

- [x] CUP sin tasa usa el importe original.
- [x] Moneda extranjera usa `montoConvertido` persistido y su tasa histórica.
- [x] Moneda extranjera sin conversión queda excluida y genera incidencia de cobertura.
- [x] Saldos bancarios en varias monedas se convierten por separado.
- [x] La tasa cero, negativa o futura se rechaza.
- [x] La misma reconciliación no puede convertirse dos veces.

### GREEN

- [x] Centralizar `normalizeAccountingAmount`.
- [x] Proteger la escritura unificada de pagos de gastos contra conversiones incompletas.
- [x] Añadir diagnóstico histórico en modo dry-run.
- [x] Planificar backfill solo cuando exista una tasa histórica determinista.
- [x] Mantener pendientes los registros que requieran decisión humana.

### REFACTOR

- [x] Sustituir el fallback inseguro del workflow de gastos por el helper canónico.
- [x] Eliminar el helper duplicado no utilizado en el servicio de reconciliación.
- [x] Migrar las demás escrituras y añadir metadatos al contrato del reporte en las fases 6 y 9.

### Salida

- Prohibido sumar importes de monedas distintas.
- Cobertura monetaria visible y verificable.

## Fase 3: Resultado Reconciliado Correcto

**Objetivo**: Reemplazar la utilidad defectuosa por indicadores con significado preciso.

**Estado**: Completada. El reporte usa hasta nueve consultas de fuentes contables por ejecución,
independientemente de la cantidad de meses, incluyendo saldos previos de documentos del período.

### RED

- [x] Ingresos solo desde reconciliaciones de venta y servicio contabilizadas.
- [x] Cobros de préstamos y deuda no se reconocen como ingreso operativo.
- [x] Pagos parciales se distribuyen sin superar el total del documento.
- [x] COGS FIFO se reconoce proporcionalmente al ingreso reconciliado.
- [x] Fallback de costo actual queda marcado como estimación, no como dato histórico.
- [x] Compra de inventario aparece en flujo de caja, no en gasto del resultado.
- [x] Costo de servicio `costo * cantidad` se reconoce una sola vez.
- [x] Salarios incluyen salario, bonificaciones y horas extra según el importe pagado.
- [x] Mermas se muestran como ajuste no monetario separado y no como dinero reconciliado.
- [x] Totales mensuales suman exactamente el anual, incluyendo COGS.
- [x] Enero y diciembre cubren correctamente límites y zonas horarias.

### GREEN

- [x] Implementar `reconciled-result-calculator.ts` como función pura.
- [x] Consultar reconciliaciones por rango semiabierto en un número acotado de queries.
- [x] Calcular ingresos, COGS, margen bruto, gastos operativos, resultado reconciliado y flujo neto.
- [x] Exponer estimaciones e incidencias junto al importe afectado.

### REFACTOR

- [x] Eliminar del handler la iteración de 12 meses con consultas por categoría.
- [x] Agrupar en memoria o base de datos después de una lectura acotada del período.

### Salida

- Cero doble conteo de compras.
- Resultado reconstruible desde su desglose.
- Máximo definido de queries independiente de la cantidad de meses.

## Fase 4: Balance Actual Confiable

**Objetivo**: Construir un balance actual completo, consistente y explicable.

**Estado**: Completada. El balance actual usa siete consultas tenant-scoped, costos FIFO
remanentes, estados activos compartidos y cobertura explícita sin forzar la ecuación.

### RED

- [x] Caja y bancos respetan tenant, moneda funcional y cuentas con saldo.
- [x] Inventario usa costos históricos remanentes y reporta fallbacks.
- [x] CxC incluye solo estados activos y limita saldos negativos.
- [x] CxP excluye anuladas/eliminadas e incluye saldos pendientes.
- [x] Deuda externa usa saldo pendiente y no mezcla monedas.
- [x] Capital respeta fecha de corte y conversión histórica.
- [x] Resultados acumulados proceden de cierres aprobados.
- [x] La ecuación devuelve estado `CUADRADO`, `DIFERENCIA` o `INCOMPLETO`.

### GREEN

- [x] Implementar `balance-calculator.ts`.
- [x] Incorporar CxP y resultados acumulados.
- [x] Sustituir `capital + utilidad anual` como patrimonio total implícito.
- [x] Devolver diferencia real y partidas no cubiertas.

### REFACTOR

- [x] Compartir filtros de estados activos entre servicios de CxC/CxP y reportes.
- [x] Evitar revalorizar inventario histórico con el precio actual sin advertencia.

### Salida

- La interfaz puede explicar cada componente del balance.
- Una diferencia nunca se oculta ni se fuerza a cero.

## Fase 5: Fecha De Corte Y Snapshots Históricos

**Objetivo**: Evitar que un año histórico muestre saldos actuales.

**Política de captura**: el balance aprobado se congela al momento del cierre (`cutoffAt`),
mientras el resultado reconciliado conserva el fin temporal del período (`resultThrough`).
El esquema actual no conserva historial suficiente para reconstruir todos los saldos auxiliares
a una fecha pasada; una reconstrucción temporal completa queda fuera de esta fase.

### RED

- [x] El balance actual declara explícitamente su fecha y hora de corte.
- [x] Un período cerrado devuelve su snapshot aprobado, no datos actuales recalculados.
- [x] Un período abierto se identifica como provisional.
- [x] Modificaciones posteriores no cambian un snapshot aprobado.
- [x] Snapshots legacy v1 continúan siendo legibles o se marcan como incompletos.

### GREEN

- [x] Versionar el snapshot para incluir balance, resultado, cobertura y moneda funcional.
- [x] Guardar hash de integridad y fuentes agregadas.
- [x] Permitir consulta histórica solo para cierres disponibles.
- [x] No ofrecer años o fechas para los que no existe evidencia histórica suficiente.

### REFACTOR

- [x] Reutilizar `fecha-operacion-registry.ts` como única política temporal.
- [x] Añadir fecha de operación específica a ajustes si requiere migración.

### Salida

- Ninguna pantalla mezcla saldo actual con resultado histórico sin advertencia.

## Fase 6: Servicio Compartido, API Y Rendimiento

**Objetivo**: Centralizar el cálculo y eliminar el handler monolítico.

### RED

- [x] Tests de servicio con tenant obligatorio, permisos y empresa inexistente.
- [x] Tests de contrato para éxito, cobertura parcial y error de validación.
- [x] Test de API legacy que comprueba paridad con el servicio.
- [x] Test de Server Action con `withAction` y `requireTenant`.
- [x] Test que limita el número de consultas principales.

### GREEN

- [x] Implementar `balance-results-report-service.ts`.
- [x] Implementar `actions-balance-results.ts` para la web.
- [x] Convertir `getBalanceFinanciero` en adaptador del servicio.
- [x] Validar período, fecha de corte y moneda con Zod.
- [x] Añadir logs contextuales sin importes sensibles innecesarios.

### REFACTOR

- [x] Retirar fórmulas antiguas del handler.
- [ ] Cargar balance y resultados por separado cuando la vista no necesita ambos.

### Salida

- [x] Una sola implementación de fórmulas para web, API, exportaciones y futuros clientes.

## Fase 7: Primera Pantalla Y Correcciones Impeccable

**Objetivo**: Reorganizar la primera pantalla alrededor de confianza y acción.

### RED

- [x] El encabezado muestra título consistente, fecha de corte y moneda funcional.
- [x] El filtro tiene etiqueta accesible y cambia según la pestaña.
- [x] La cobertura de reconciliación siempre es visible.
- [x] La ecuación muestra diferencia y estado textual, no solo color.
- [x] Los ceros sin fuentes generan estado vacío, no un balance válido aparente.
- [x] Un error al cambiar período no presenta datos anteriores bajo el período nuevo.
- [x] Carga y actualización usan `role=status` o región `aria-live` adecuada.
- [x] Errores usan alerta accesible y reintento no destructivo.
- [x] La tabla tiene caption, encabezados semánticos y cifras tabulares.
- [x] La versión móvil no obliga a interpretar una tabla horizontal extensa.
- [x] Las acciones tienen targets táctiles de al menos 44 x 44 px.
- [x] `prefers-reduced-motion` conserva jerarquía y feedback.

### GREEN

- [x] Eliminar breadcrumb y botón Volver duplicados cuando el shell ya navega.
- [x] Unificar el nombre en `Balance general y resultados`.
- [x] Mostrar `Fecha de corte`, `Moneda funcional`, `Actualizado` y estado del período.
- [x] Añadir banda de cobertura y acceso `Revisar pendientes`.
- [x] Añadir bloque principal `Activos = Pasivos + Patrimonio`.
- [x] Añadir tarjetas de efectivo, inventario, CxC, CxP y patrimonio con procedencia.
- [x] Añadir desglose con fuente, estado de calidad y saldo.
- [x] Añadir panel de metodología y alertas accionables.
- [x] Derivar períodos disponibles desde datos reales, sin años hardcodeados.
- [x] Preservar datos anteriores únicamente con etiqueta explícita de obsolescencia.

### REFACTOR

- [x] Dividir el componente actual de más de 400 líneas en componentes cohesivos.
- [x] Sustituir colores hardcodeados por tokens semánticos y `--chart-*`.
- [x] Usar encabezados `h1`, `h2` y `h3` con jerarquía real.
- [x] Mantener copy en español neutro internacional.

### Verificación Impeccable

- [ ] Cargar `reference/craft-floor.md` inmediatamente antes de editar UI.
- [ ] Ejecutar una inspección conjunta desktop y mobile al terminar la edición.
- [ ] Corregir todos los defectos observados en un único lote.
- [ ] Ejecutar una sola ronda final de confirmación visual.
- [x] Ejecutar el detector una vez sobre los archivos modificados:

```bash
node /Users/arturo/.agents/skills/impeccable/scripts/detect.mjs --json \
  src/app/busy/contabilidad/balance-resultados/page.tsx \
  src/features/contabilidad/components/balance-results
```

### Salida

- Auditoría Impeccable objetivo >= 17/20.
- WCAG AA en controles, estados, tablas y comunicación de color.
- Primera pantalla utilizable en 320 px, tablet y escritorio.

## Fase 8: Estado De Resultados Y Gráfica

**Objetivo**: Hacer reconstruible y comparable el resultado reconciliado.

**Estado**: Completada. El estado de resultados presenta tabla reconstruible con COGS, gastos operativos y compras separados, gráfico de barras + línea con referencia en cero, carga bajo demanda y moneda funcional visible.

### RED

- [x] La tabla permite reconstruir el resultado de cada mes.
- [x] COGS, gastos operativos y compras de caja se presentan separados.
- [x] Valores negativos tienen texto y posición comprensibles sin depender del color.
- [x] La gráfica tiene alternativa textual y tabla equivalente.
- [x] El eje y tooltip indican moneda funcional.
- [x] La gráfica no se carga antes de activar la pestaña.

### GREEN

- [x] Cambiar a barras de ingresos/gastos y línea de resultado.
- [x] Destacar la línea cero y meses con pérdida.
- [x] Cargar Recharts y datos mensuales bajo demanda.
- [ ] Añadir comparación contra período anterior cuando exista snapshot comparable.

### REFACTOR

- [x] Reutilizar tokens y formatters financieros compartidos.
- [x] Evitar estilos inline dependientes del tema.

### Salida

- La segunda pestaña no penaliza la carga inicial.
- Cada total es explicable desde el detalle mensual.

## Fase 9: Exportaciones Y Demás Reportes Contables

**Objetivo**: Impedir que otros reportes sigan usando fórmulas paralelas.

### RED

- [x] Tests de paridad entre pantalla, CSV, resumen y cierre contable.
- [x] Tests que detectan agregaciones directas de documentos no reconciliados.
- [x] Tests de filtros de tenant, período, moneda y estado contabilizable.
- [x] Tests de exclusión de préstamos y transferencias de ingresos operativos.

### GREEN

- [x] Migrar `AccountingReportsService` a la política canónica.
- [x] Migrar `SnapshotService` y `cierreContableService` al mismo dominio.
- [x] Migrar reportes de resumen, movimientos, flujo de caja y analítica.
- [x] Incluir metadatos de cobertura y moneda en las exportaciones de resumen y movimientos.

### REFACTOR

- [x] Eliminar cálculos duplicados de las rutas web de resumen y movimientos después de verificar consumidores.
- [x] Documentar qué reportes son caja reconciliada y cuáles contienen saldos auxiliares.

### Clasificación De Reportes

- **Caja reconciliada**: `AccountingReportsService.getSummaryReport`,
  `AccountingReportsService.getMovementsReport`, `getReconciledResultForYear` y los
  snapshots financieros. Solo agregan reconciliaciones y exponen cobertura de conversión.
- **Resultado operativo**: `balance-results-report-service` y el dominio de resultado
  reconciliado. Ventas y servicios contabilizados forman ingresos; préstamos, deudas,
  transferencias y capital permanecen fuera del resultado operativo.
- **Saldos auxiliares**: el cierre contable conserva deudas de clientes/proveedores,
  inventario vendido, mermas y stock final como métricas auxiliares; no deben mezclarse con
  ingresos o egresos operativos reconciliados.
- **Transferencias y ajustes**: se muestran como movimientos de caja y estadísticas, pero
  no se clasifican como ingresos operativos.

### Salida

- Mismo importe para el mismo concepto, tenant, período y moneda en todos los reportes.

## Fase 10: E2E, Integridad Y Liberación

**Objetivo**: Verificar el flujo completo con datos financieros representativos.

### RED

- [x] E2E con empresa sin datos.
- [x] E2E con cobertura parcial y acceso a pendientes.
- [x] E2E con balance cuadrado.
- [x] E2E con diferencia contable.
- [x] E2E con dos monedas y una conversión faltante.
- [x] E2E al cambiar período con respuesta tardía y error de red.
- [x] E2E mobile para navegación, tablas y metodología.

### GREEN

- [x] Crear fixtures deterministas sin depender de producción.
- [x] Añadir trazabilidad desde cada cifra hasta movimientos fuente.
- [ ] Añadir telemetría de incidencias de cobertura sin registrar información sensible.

> Los escenarios están implementados en `e2e/contabilidad/balance-resultados.spec.ts` con
> respuestas HTTP deterministas. La ejecución requiere que la base de datos E2E configurada
> esté disponible para sembrar/autenticar el usuario de pruebas.

### Verificación Final

```bash
CI=1 pnpm exec vitest run \
  src/features/contabilidad/domain \
  src/features/contabilidad/services/__tests__/balance-results-report-service.test.ts \
  src/features/contabilidad/api/__tests__/exchange-handlers.test.ts \
  src/app/busy/contabilidad/balance-resultados/page.test.tsx
pnpm exec playwright test e2e/contabilidad/balance-resultados.spec.ts --project=chromium
pnpm run typecheck
pnpm run lint
pnpm run build
graphify update .
```

### Salida

- Todos los tests nuevos y regresiones directas en verde.
- Cobertura >= 80% en código nuevo y >= 90% en calculadores financieros puros.
- Sin `.skip`, `.todo` ni errores conocidos en el alcance.
- Build de producción exitoso.
- Auditoría Impeccable repetida y documentada.

## Matriz De Correcciones De La Auditoría

| Hallazgo | Fase |
|---|---:|
| Resultados no reconciliados | 1-3 |
| Compras y COGS duplicados | 3 |
| Costo de servicios omitido | 3 |
| Ventas anuladas incluidas | 0-3 |
| Último día del mes excluido | 0, 3 |
| Monedas mezcladas | 2 |
| Balance actual con resultado histórico | 5 |
| Admin sin tenant mezcla empresas | 0, 6 |
| CxP omitidas | 4 |
| Patrimonio y resultados acumulados incompletos | 4-5 |
| Ecuación contable no validada | 4, 7 |
| Datos viejos tras error de período | 7 |
| Ceros ambiguos y cobertura ausente | 6-7 |
| Filtro sin etiqueta accesible | 7 |
| Loading/error no anunciados | 7 |
| Navegación duplicada | 7 |
| Terminología inconsistente | 7 |
| Años hardcodeados | 5, 7 |
| Tabla deficiente en móvil | 7 |
| Gráfica sin alternativa accesible | 8 |
| Colores hardcodeados | 7-8 |
| Carga inicial de Recharts | 8 |
| Exceso de queries mensuales | 3, 6 |

## Criterios Globales De Aceptación

- Cada importe indica tenant, período o fecha de corte y moneda funcional.
- Cada importe permite identificar su fuente y estado de cobertura.
- Ningún documento no reconciliado afecta los movimientos de caja del reporte.
- Ninguna compra de inventario se reconoce simultáneamente como compra y COGS.
- La interfaz distingue resultado reconciliado, flujo de caja y ajustes no monetarios.
- La ecuación contable y su diferencia están siempre visibles en el balance.
- Los períodos históricos provienen de snapshots aprobados e inmutables.
- Los demás reportes consumen el mismo dominio antes de retirar cálculos legacy.
- La primera pantalla cumple la auditoría Impeccable, responsive y WCAG AA.

## Riesgos Y Controles

| Riesgo | Control |
|---|---|
| Histórico sin tasa de cambio | Excluir, marcar incidencia y resolver mediante backfill auditable |
| `montoConvertido` con semántica inconsistente | Corregir escritura antes de migrar lecturas |
| Reconciliaciones legacy sin estado confiable | Clasificación explícita y cola de revisión |
| Balance histórico sin stock de cierre | Solo ofrecer cierres con snapshot v2 completo |
| Cambio masivo altera reportes existentes | Migración progresiva con tests de paridad |
| Tests actuales consagran fórmulas defectuosas | Sustituir expectativas únicamente después de observar RED correcto |
| Diferencias reales de contabilidad | Mostrar la diferencia; no compensarla con patrimonio artificial |

## Orden De Ejecución

```text
Fase 0 -> Fase 1 -> Fase 2 -> Fase 3 -> Fase 4 -> Fase 5
       -> Fase 6 -> Fase 7 -> Fase 8 -> Fase 9 -> Fase 10
```

No se debe comenzar el rediseño visual antes de cerrar las fases 0-6. La interfaz necesita un
contrato financiero estable para no diseñar alrededor de cifras que luego cambiarán de significado.
