# FinanceMDM — Documentación del Sistema

> **Sistema de Gestión de Inventario, Ventas, Finanzas y Contabilidad**
> Stack: Next.js 16.2 + TypeScript + Prisma + PostgreSQL

---

## Arquitectura y Referencias

| Documento | Propósito |
|-----------|-----------|
| [Arquitectura del Sistema](ARCHITECTURE.md) | Stack, patrones, multi-tenant, flujo de datos, estructura del proyecto |
| [Reglas de Frontera Arquitectónica](ARCHITECTURE-RULES.md) | Cuándo usar Actions, Routes, Services, adapters y cómo avanzar hacia hexagonal |
| [Modelo de Datos](DATA_MODEL.md) | Diagramas ER, modelos Prisma por dominio, convenciones |
| [Glosario de Términos](GLOSSARY.md) | Definiciones de términos de negocio y técnicos |

## Navegacion Rapida

- [Mapa de módulos por dominio](../content/docs/modules/INDEX.md)

Usa `../content/docs/modules/INDEX.md` si querés navegar la documentación funcional por áreas del negocio en vez de recorrer el listado completo.

## Módulos del Sistema

### 🔐 Fundación

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Autenticación](../content/docs/modules/auth/README.md) | Login web/mobile, refresh, onboarding y cambio de tenant | ✅ Documentado |
| [Administración](../content/docs/modules/admin/README.md) | Panel global de tenants, licencias, finanzas y auditoría | ✅ Documentado |
| [Mi Empresa](../content/docs/modules/mi-empresa/README.md) | Configuración del negocio, perfil del tenant | ✅ Documentado |
| [Configuración](../content/docs/modules/configuracion/README.md) | Hub de ajustes del tenant: usuarios, contratos, series y catálogos | ✅ Documentado |
| [Planes y Licencias](../content/docs/modules/planes/README.md) | Planes de suscripción, feature flags, licenciamiento | ✅ Documentado |

### 📦 Inventario

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Categorías](../content/docs/modules/categorias/README.md) | Taxonomía jerárquica de productos | ✅ Documentado |
| [Unidades](../content/docs/modules/unidades/README.md) | Unidades de medida | ✅ Documentado |
| [Productos](../content/docs/modules/productos/README.md) | Catálogo, stock, costos, códigos EAN-13 | ✅ Documentado |
| [Proveedores](../content/docs/modules/vendors/README.md) | Gestión de proveedores | ✅ Documentado |
| [Listas de Precios](../content/docs/modules/listas-precios/README.md) | Pricing, listas diferenciadas | ✅ Documentado |

### 🏪 Operaciones

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Almacenes](../content/docs/modules/almacenes/README.md) | Almacenes y ubicaciones de stock | ✅ Documentado |
| [Puntos de Venta](../content/docs/modules/puntos-venta/README.md) | Sucursales y puntos de venta | ✅ Documentado |
| [Transferencias](../content/docs/modules/transferencias/README.md) | Movimientos de stock entre almacenes y puntos de venta | ✅ Documentado |
| [Mermas](../content/docs/modules/mermas/README.md) | Control de pérdidas y ajustes | ✅ Documentado |

### 💰 Ventas y Facturación

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Ventas](../content/docs/modules/ventas/README.md) | Ventas POS, registro, anulación | ✅ Documentado |
| [Venta de Servicios](../content/docs/modules/venta-servicios/README.md) | Ventas de servicios (simple y mixta) | ✅ Documentado |
| [Facturas](../content/docs/modules/facturas/README.md) | Consulta, actualización y exportación de facturas emitidas | ✅ Documentado |
| [Series de Facturación](../content/docs/modules/series-facturacion/README.md) | Series, prefijos y numeración fiscal | ✅ Documentado |
| [Ofertas](../content/docs/modules/ofertas/README.md) | Cotizaciones comerciales con facturación posterior | ✅ Documentado |
| [Clientes](../content/docs/modules/clientes/README.md) | Cartera de clientes, historial | ✅ Documentado |
| [Turnos POS](../content/docs/modules/turnos-pos/README.md) | Turnos de empleados por punto de venta | ✅ Documentado |
| [Arqueo de Caja](../content/docs/modules/arqueo-caja/README.md) | Arqueo y cierre de caja por turno | ✅ Documentado |
| [Cuadre Diario](../content/docs/modules/cuadre-diario/README.md) | Cuadre diario consolidado | ✅ Documentado |

### 📥 Compras

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Compras de Productos](../content/docs/modules/compras-productos/README.md) | Compras, documentos, FIFO, gastos asociados | ✅ Documentado |
| [Compras de Servicios](../content/docs/modules/compras-servicios/README.md) | Compras de servicios a proveedores | ✅ Documentado |
| [Servicios](../content/docs/modules/servicios/README.md) | Catálogo de servicios ofrecidos | ✅ Documentado |

### 👥 Recursos Humanos

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Empleados](../content/docs/modules/empleados/README.md) | Gestión de empleados, datos laborales | ✅ Documentado |
| [Pago de Salario](../content/docs/modules/pago-salario/README.md) | Registro de pagos de salario, bonificaciones y deducciones | ✅ Documentado |
| [Perfil](../content/docs/modules/profile/README.md) | Perfil de usuario | ✅ Documentado |

### 📊 Contabilidad y Finanzas

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Contabilidad](../content/docs/modules/contabilidad/README.md) | Reconciliación, cuentas, periodos, reportes y módulos financieros avanzados | ✅ Documentado |
| [Periodos Contables](../content/docs/modules/contabilidad/periodos-contables.md) | Apertura, cierre, snapshots | ✅ Documentado |
| [Reconciliación Bancaria](../content/docs/modules/contabilidad/reconciliacion.md) | Conciliación de ventas, servicios y gastos | ✅ Documentado |
| [Ajustes Bancarios](../content/docs/modules/contabilidad/ajustes-bancarios.md) | Ajustes, anticipos, deudas, préstamos | ✅ Documentado |
| [Anticipos](../content/docs/modules/contabilidad/ajustes-bancarios.md) | Anticipos a proveedores | ✅ Documentado |
| [Deudas y Préstamos Cash](../content/docs/modules/contabilidad/ajustes-bancarios.md) | Deudas y préstamos | ✅ Documentado |
| [Gastos D/E](../content/docs/modules/gastosDE/README.md) | Gastos de distribución y explotación | ✅ Documentado |
| [Reportes Financieros](../content/docs/modules/reportes-financieros/README.md) | Indicadores, balances, reportes exportables | ✅ Documentado |

### 🏭 Producción

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Producción](../content/docs/modules/produccion/README.md) | Recetas, órdenes y validación de materiales de producción | ✅ Documentado |
| [Reparaciones](../content/docs/modules/reparaciones/README.md) | Taller de reparaciones | ✅ Documentado |
| [Ficha de Costo](../content/docs/modules/ficha-costo/README.md) | Costo, margen, merma y rentabilidad de productos y servicios | ✅ Documentado |

### ⚙️ Infraestructura

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Backups](../content/docs/modules/backups/README.md) | Backups, restore, import y planes automáticos | ✅ Documentado |
| [Notificaciones](../content/docs/modules/notificaciones/README.md) | Centro de notificaciones | ✅ Documentado |
| [Dashboard](../content/docs/modules/dashboard/README.md) | Panel ejecutivo e indicadores | ✅ Documentado |
| [Contratos](../content/docs/modules/contratos/README.md) | Gestión de contratos | ✅ Documentado |
| [Reviews](../content/docs/modules/reviews/README.md) | Reseñas del tenant, moderación y prueba social pública | ✅ Documentado |
| [Landing Page](../content/docs/modules/landing/README.md) | Página pública de aterrizaje | ✅ Documentado |
| [Licencias](../content/docs/modules/licencias/README.md) | Gestión de licencias por tenant, demos y overrides | ✅ Documentado |

## Guías de Operación

| Guía | Propósito |
|------|-----------|
| [Resumen de Documentación](README.md) | Punto de entrada resumido de la documentación del proyecto |
| [Guía de Despliegue](DEPLOYMENT_GUIDE.md) | Deploy en Railway y operación básica de despliegue |

---

**Leyenda**: ✅ Documentado | 📝 Pendiente

> Documentación generada siguiendo el template estándar del sistema.
> Última actualización: 2026-07-07 (navegación y módulos normalizados)
