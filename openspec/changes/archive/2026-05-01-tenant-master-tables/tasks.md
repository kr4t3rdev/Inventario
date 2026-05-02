# Tasks: Tenant Master Tables

- [x] 1.1 Schema: tenantId en Producto, Categoria, Vendor, Cliente, Almacen, PuntoDeVenta
- [x] 1.2 Migration SQL con backfill + NOT NULL + indexes + FKs + uniques compuestos
- [x] 1.3 Backfill memberships existentes
- [x] 2.1 Migrar GET /api/productos a scopedWhere(tenantId)
- [x] 2.2 Migrar GET /api/categorias, vendors, almacenes a withAuth + scopedWhere
- [x] 2.3 Migrar POST /api/almacenes, categorias, vendors a withAuthPost + tenantId
- [x] 2.4 Migrar GET/POST/PATCH/DELETE /api/cliente a withAuth + tenant-scoped
