# Proposal: Tenant Transactional Tables

## Intent
Agregar tenantId a tablas transaccionales (Venta, Factura, GastosDE) y scopear sus endpoints GET. Sin estas, los datos de ventas y finanzas no están aislados entre empresas.

## Scope
- Schema: tenantId + FK en Venta, Factura, GastosDE (nullable → backfill → NOT NULL)
- Endpoints GET migrados a withAuth + scopedWhere
- Migration SQL documentada

## Capabilities
- **Modified**: `multi-tenant-platform` (extiende modelo a tablas transaccionales)
