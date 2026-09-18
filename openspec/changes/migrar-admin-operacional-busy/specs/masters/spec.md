# Spec: Salud operativa de Datos Maestros en /busy/products

## Purpose

Exponer la salud operativa del propio tenant (Cantidad de Productos, Categorías, Unidades,
Proveedores, Puntos de Venta, Listas de Precio) en `/busy/products`, **visible solo para admin**.

## Requirements

### Requirement: Action `getMastersHealthAction` por-tenant

En `src/features/productos/actions-health.ts` retorna
`metrics: { productos, categorias, unidades, proveedores, puntosDeVenta, listasPrecio }`.

#### Scenario: Admin lee salud

- GIVEN admin logueado
- WHEN llama `getMastersHealthAction()`
- THEN retorna counts de `prisma.producto`, `prisma.categoria`, `prisma.unidad`,
  `prisma.vendor`, `prisma.puntoDeVenta`, `prisma.listaPrecio` filtrados por tenant

#### Scenario: No admin

- GIVEN role !== 'admin'
- WHEN llama
- THEN retorna `{ success: false, error: { code: "FORBIDDEN" } }`

#### Scenario: Sin tenant

- GIVEN user sin tenantId
- WHEN llama
- THEN retorna error de `requireTenant`

#### Scenario: Cobertura 100%

- WHEN se ejecuta la suite de tests de la action
- THEN cobertura de líneas = 100%

---

### Requirement: Componente `<MastersHealthCard />`

En `src/features/productos/components/masters-health-card.tsx`.

#### Scenario: Crítico (sin categorías o sin unidades)

- GIVEN `counts.categorias === 0 || counts.unidades === 0`
- WHEN renderiza
- THEN muestra badge rojo con texto "Crítico"
- AND icono `AlertCircle`

#### Scenario: Bajo (pocos productos)

- GIVEN `categorias > 0 && unidades > 0 && productos < 10`
- WHEN renderiza
- THEN muestra badge amarillo con texto "Bajo"
- AND icono `Info`

#### Scenario: Saludable

- GIVEN `categorias > 0 && unidades > 0 && productos >= 10`
- WHEN renderiza
- THEN muestra badge verde con texto "Saludable"
- AND icono `CheckCircle2`

#### Scenario: Tabla con 6 columnas de counts

- GIVEN métricas válidas
- WHEN renderiza
- THEN la tabla muestra columnas: Productos, Categorías, Unidades, Proveedores, Ptos Venta,
  Listas Precio

#### Scenario: role no-admin

- GIVEN `userRole !== 'admin'`
- WHEN renderiza
- THEN retorna `null`

#### Scenario: Cobertura ≥ 80%

---

### Requirement: Card integrada en `/busy/products`

#### Scenario: Admin en /busy/products

- GIVEN admin logueado
- WHEN navega a `/busy/products`
- THEN ve `<MastersHealthCard />` con métricas propias del tenant
- AND la tabla de productos existente sigue funcionando

#### Scenario: Manager en /busy/products

- GIVEN manager logueado
- WHEN navega a `/busy/products`
- THEN la card de salud NO se renderiza
