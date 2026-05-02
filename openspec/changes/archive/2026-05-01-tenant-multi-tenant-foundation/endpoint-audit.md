# Auditoría de Endpoints - Migración tenantId

## Criterios
- **CRITICAL**: opera con datos de negocio que deben estar aislados por tenant
- **PLATFORM**: opera con datos globales (usuarios, sesiones, planes)
- **MIGRATED**: ya fue modificado para usar contexto tenant

## Endpoints CRÍTICOS (requieren scoping por tenantId)

| Endpoint | Prioridad | Estado | Notas |
|----------|-----------|--------|-------|
| `GET/PUT /api/mi-empresa` | CRITICAL | ✅ MIGRADO | Usa `tenantId` del auth context |
| `GET/POST /api/admin/users` | CRITICAL | ✅ MIGRADO | Lista/crea usuarios por membresías tenant |
| `GET/POST /api/productos` | CRITICAL | 🔲 PENDIENTE | Agregar `scopedWhere(tenantId)` |
| `GET/POST /api/categorias` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/vendors` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/clientes` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/ventas` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/compras-productos` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/almacenes` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/puntos-venta` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/gastos-de-explotacion` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/cuentas-bancarias` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/empleados` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/facturas` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/contratos` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/ofertas` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/produccion/*` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/contabilidad/*` | CRITICAL | 🔲 PENDIENTE | Idem |
| `GET/POST /api/reportes/*` | CRITICAL | 🔲 PENDIENTE | Idem |

## Endpoints de PLATAFORMA (no requieren tenantId)

| Endpoint | Razón |
|----------|-------|
| `POST /api/auth/login` | Autenticación global |
| `POST /api/auth/logout` | Sesión global |
| `GET/POST /api/admin/users/expiring-soon` | Administración de plataforma |
| `GET /api/admin/users/user-metrics` | Métricas de plataforma |
| `GET /api/admin/users/export` | Exportación de plataforma |
| `GET /api/planes` | Catálogo global de planes |
| `GET /api/configuracion` | Configuración de plataforma |

## Patrón de migración para endpoints pendientes

```typescript
import { requireTenant, scopedWhere } from '@/lib/services/tenant-scope'

// En cada handler:
export const GET = withAuth(async (req, ctx, user) => {
  const tenantId = requireTenant(user)

  const productos = await prisma.producto.findMany({
    where: scopedWhere(tenantId, {
      // filtros adicionales específicos del endpoint
      categoriaId: searchParams.get('categoriaId'),
    }),
  })
})
```

## Orden recomendado de migración

1. Tablas maestras: Producto, Categoria, Vendor, Cliente, Almacen, PuntoDeVenta
2. Transacciones: Venta, Compra, GastosDE, Factura
3. Financiero: CuentaBancaria, CuentaPorCobrar, CuentaPorPagar
4. Especializados: Producción, Contratos, Ofertas, Reparaciones
5. Reportes: ReportHistory, ScheduledReport

**Total**: ~30 endpoints CRITICAL pendientes de migrar.
**Esfuerzo estimado**: 2-3 fases adicionales después de endurecer el schema con NOT NULL en tenantId.
