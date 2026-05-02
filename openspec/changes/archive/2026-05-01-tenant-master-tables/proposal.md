# Proposal: Tenant Master Tables

## Intent
Agregar `tenantId` a las tablas maestras (Producto, Categoria, Vendor, Cliente, Almacen, PuntoDeVenta) y scopear sus endpoints GET. Sin estas tablas migradas, el aislamiento tenant no es real: un producto se ve entre empresas.

## Capabilities
- **Modified**: `multi-tenant-platform` (se extiende el modelo a tablas maestras)
- **Modified**: `catalogo` (endpoints y queries con scoping por tenantId)

## Scope
- Schema: tenantId nullable → backfill → NOT NULL en 6 tablas
- Uniques compuestos: codigoInterno, codigoNegocio, vendorCode pasan a @@unique([tenantId, ...])
- Endpoints GET migrados a scopedWhere(tenantId)
- Backfill script con tenant default

## Risks
- Queries existentes sin tenantId en el where hasta que se migren todos los endpoints
- Uniques globales temporalmente hasta que el backfill esté completo
