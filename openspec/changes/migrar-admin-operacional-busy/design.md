# Design: Salud Operativa por Feature en /busy

## Decisión

La salud operativa deja de ser una matriz global de todos los tenants y se convierte en una tarjeta
de métricas del tenant autenticado dentro de cada feature operativa de `/busy/`.

La tarjeta se muestra únicamente cuando el usuario tiene `role === 'admin'`. Esta regla se aplica
en dos niveles: la page decide no incorporar el componente para roles no-admin y la Server Action
vuelve a verificarla. La UI no constituye el control de acceso.

## Arquitectura

```text
Admin del tenant abre /busy/<feature>
        |
        |-- RSC page: obtiene el usuario actual y pasa userRole
        |-- <FeatureHealthCard userRole="admin" />
                  |
                  |-- useEffect
                  |-- get<Feature>HealthAction()
                            |
                            |-- withAction autentica usuario
                            |-- requireTenant(user) limita tenantId
                            |-- user.role === 'admin' o ActionError(FORBIDDEN)
                            |-- Prisma count/aggregate por tenant
                            |
                            +-- { metrics }
                  |
                  +-- Card con KPIs + badge de estado
```

`/busy/contabilidad/page.tsx` ya es Client Component y obtiene `user` mediante `useAuth`; en esa
ruta el gate de presentación se hace usando ese contexto. Las otras siete pages son Server
Components: obtienen el usuario con `getCurrentUser()` y solo incluyen la tarjeta para admin.

## Actions y Contratos

Cada action nueva está junto al feature propietario, en `actions-health.ts`, para no mezclar
consultas de salud con el CRUD establecido en `actions.ts`.

| Feature propietario | Action | Contrato `metrics` |
|---|---|---|
| `productos` | `getMastersHealthAction` | `productos`, `categorias`, `unidades`, `proveedores`, `puntosDeVenta`, `listasPrecio` |
| `ventas` | `getSalesHealthAction` | `ventasCount`, `ventasTotal`, `facturasCount`, `ofertasCount`, `serviciosCount` |
| `compras-productos` | `getPurchaseHealthAction` | `comprasCount`, `comprasTotal`, `itemsCount`, `vendorActiveCount` |
| `mermas` | `getWastageHealthAction` | `mermasCount`, `mermasTotalValue` |
| `facturas` | `getBillingHealthAction` | `facturasCount`, `ventasCount`, `formalizationRate` |
| `ofertas` | `getOffersServicesHealthAction` | `ofertasCount`, `serviciosCount` |
| `gastosDE` | `getExpenseHealthAction` | `gastosCount`, `gastosTotal` |
| `contabilidad` | `getAccountingHealthAction` | `hasActivePeriod`, `currentPeriodStatus`, `lastClosedPeriod`, `totalPeriods` |

Todas siguen este contrato de autorización:

```ts
export const getFeatureHealthAction = withAction(async (_, user) => {
  const tenantId = requireTenant(user)

  if (user.role !== 'admin') {
    throw new ActionError('No tienes permisos para consultar la salud operativa.', 'FORBIDDEN')
  }

  // consulta Prisma limitada por tenantId
  return { metrics }
})
```

No se devuelve `tenantId`, nombre, slug ni plan: esos campos solo tenían sentido en las matrices
globales y no son datos necesarios dentro del tenant dueño.

## Consultas Prisma

- Counts simples: usar `_count` o `Promise.all` de `count` con `where: { tenantId }`.
- Sumas: usar `aggregate({ where: { tenantId }, _sum: { campo: true } })` y normalizar con
  `Number(sum ?? 0)`.
- Contabilidad: resolver en paralelo count total, periodo abierto y último periodo cerrado;
  conservar el orden de `fechaFin: 'desc'` para el cierre.
- Nunca consultar `prisma.tenant.findMany()` desde las nuevas actions. La consulta global queda
  eliminada.

## Componentes

Cada componente `components/<feature>-health-card.tsx` es Client Component y tiene una única
responsabilidad: solicitar y presentar el contrato de salud de su feature.

Props comunes:

```ts
interface FeatureHealthCardProps {
  userRole?: string
}
```

Comportamiento común:

1. Si `userRole !== 'admin'`, retornar `null` sin invocar la action.
2. Al montar, invocar action, manejar `{ success, data, error }`.
3. Mientras carga, mostrar `Loader2` dentro de una `Card`.
4. Ante error, mostrar `toast.error` con el texto ya usado por la matriz original y un estado de
   card recuperable; no ocultar ni romper el contenido CRUD de la feature.
5. Ante éxito, mostrar los KPIs propios y el badge definido por el spec de cada feature.

No se extrae una abstracción genérica de card. Los ocho shapes de datos y las reglas de estado son
distintos; una capa compartida aumentaría condicionales sin reutilización real.

## Integración de Páginas

Para las siete pages Server Component, envolver el resultado actual en un fragmento o contenedor
vertical y renderizar la tarjeta encima del contenido existente. Mantener los props iniciales y los
fetches CRUD sin cambios.

Para `/busy/contabilidad`, insertar `AccountingHealthCard` dentro del layout cliente existente,
adyacente al encabezado/dashboard y gatearlo con el usuario de `useAuth`.

La ruta de ofertas es `/busy/ofertas`; `/busy/oferta` sólo aloja la página de impresión y no se
modifica.

## Eliminación del Panel Global

Una vez integradas y probadas las cards:

1. Eliminar las ocho rutas de `src/app/admin/operaciones/`.
2. Eliminar el grupo y el tono "Administración Operativa" de `AdminSidebar`.
3. Eliminar la card de acceso en `src/app/admin/page.tsx`.
4. Buscar consumidores de `src/features/admin/server/operaciones.ts`.
5. Eliminar ese archivo solo cuando el resultado sea cero; su código no se migra literalmente
   porque contenía `tenant.findMany()` y detalle cruzado entre negocios.

Eliminar al final evita roturas de import durante los lotes TDD.

## TDD Estricto

### Orden RED -> GREEN -> REFACTOR

Para cada feature:

1. RED: crear test unitario de action para éxito, rol prohibido, tenant inexistente y edge cases de
   agregación. El test falla porque aún no existe la action.
2. GREEN: implementar la action mínima hasta lograr **100% de líneas** en ese archivo.
3. RED: crear test de componente para loading, éxito, estados/badges relevantes, error y no-admin.
4. GREEN: implementar el componente mínimo hasta lograr **>=80% de líneas**.
5. Integrar la card en la page y escribir/actualizar un test de integración de la page donde la
   infraestructura existente lo permita.
6. REFACTOR: solo después de pasar tests, eliminar duplicación local sin alterar contratos.

Tests de actions mockean `prisma`, `withAction` y/o el usuario autenticado siguiendo el patrón
actual de tests del feature. Tests de componentes usan Vitest + Testing Library y mockean la action.

## Validación y Toasts

No hay entrada del usuario ni mutación, por lo tanto no se incorpora Zod ni formularios.

El cliente debe mostrar `toast.error` con mensajes específicos por dominio:

| Feature | Toast |
|---|---|
| Datos maestros | `Error cargando datos de salud` |
| Ventas | `Error cargando datos de ventas` |
| Compras | `Error cargando datos de compras` |
| Mermas | `Error cargando datos de mermas` |
| Facturación | `Error cargando datos de facturación` |
| Ofertas y servicios | `Error cargando datos de ofertas y servicios` |
| Gastos | `Error cargando datos de gastos` |
| Contabilidad | `Error cargando datos contables` |

El servidor impone tenant y rol aun si una llamada manual evita el gate de UI.

## Rollout y Rollback

El rollout se hace por lotes independientes de dos features, cada uno con sus tests antes de pasar
al siguiente. La eliminación de admin ocurre sólo después de validar los ocho lotes.

Rollback: revertir el commit completo. No hay migraciones de Prisma, cambios de datos ni contratos
externos, por lo que el rollback es seguro y atómico.

## Riesgos Resueltos

- La ruta correcta de ofertas es `/busy/ofertas`, confirmada en el código.
- El drill-down de Datos Maestros no se porta: su propósito era inspeccionar datos de otros tenants.
- La guardia de autorización se aplica en servidor, no solo en la UI.
- La view de contabilidad es cliente; no debe transformarse de arquitectura para esta migración.
