# Dashboard

> Muestra el estado operativo del tenant con métricas server-first sobre ingresos, inventario, ventas, transferencias y rentabilidad.

## Qué hace

Este módulo es la vista ejecutiva diaria del negocio. Resume el rendimiento comercial y operativo con cards, gráficos y tablas críticas, usando una consulta agregada server-side para evitar duplicaciones de fetch y mantener consistencia por tenant.

## Qué muestra

- ingresos totales y beneficio
- valor total del inventario
- cantidad total de productos
- ventas diarias y evolución mensual
- productos más vendidos
- distribución de stock
- transferencias entre ubicaciones
- productos con stock bajo
- productos con margen bajo
- rentabilidad por categoría y producto

## Cuándo usarlo

- Cuando arrancás el día y querés una foto rápida del negocio.
- Cuando necesitás detectar alertas de stock o margen sin entrar a cada módulo.
- Cuando querés revisar tendencias antes de decidir compras, precios o transferencias.

## Reglas importantes

- El dashboard operativo requiere un `tenantId`; un admin global sin membresía ve un mensaje y debe usar el panel admin.
- La data principal se obtiene una sola vez con `getDashboardStatsQuery()`.
- Hay mezcla de componentes server/presentational e islas interactivas para gráficos.
- Las métricas de transferencias, stock bajo y rentabilidad no son decorativas: están pensadas para disparar acciones operativas.

## Qué conviene cuidar

- Si una cifra luce rara, conviene revisar el módulo fuente antes de asumir error del dashboard.
- El dashboard resume, no reemplaza, la validación detallada de ventas, inventario o transferencias.
- Un usuario autenticado sin tenant no puede usar esta vista como dashboard de negocio.

## Referencias útiles

- `src/app/busy/dashboard/page.tsx`
- `src/features/dashboard/queries.ts`
- `src/features/dashboard/actions.ts`
- `src/features/dashboard/components/section-cards.tsx`
- `src/features/dashboard/components/rentabilidad-dashboard.tsx`

## En una frase

Es la cabina de mando operativa del tenant para decidir rápido con datos agregados.
