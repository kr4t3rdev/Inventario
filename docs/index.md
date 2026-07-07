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

- [Mapa de módulos por dominio](modules/INDEX.md)

Usa `modules/INDEX.md` si querés navegar la documentación funcional por áreas del negocio en vez de recorrer el listado completo.

## Módulos del Sistema

### 🔐 Fundación

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Autenticación](modules/auth/README.md) | Login web/mobile, refresh, onboarding y cambio de tenant | ✅ Documentado |
| [Administración](modules/admin/README.md) | Panel global de tenants, licencias, finanzas y auditoría | ✅ Documentado |
| [Mi Empresa](modules/mi-empresa/README.md) | Configuración del negocio, perfil del tenant | ✅ Documentado |
| [Configuración](modules/configuracion/README.md) | Hub de ajustes del tenant: usuarios, contratos, series y catálogos | ✅ Documentado |
| [Planes y Licencias](modules/planes/README.md) | Planes de suscripción, feature flags, licenciamiento | ✅ Documentado |

### 📦 Inventario

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Categorías](modules/categorias/README.md) | Taxonomía jerárquica de productos | ✅ Documentado |
| [Unidades](modules/unidades/README.md) | Unidades de medida | ✅ Documentado |
| [Productos](modules/productos/README.md) | Catálogo, stock, costos, códigos EAN-13 | ✅ Documentado |
| [Proveedores](modules/vendors/README.md) | Gestión de proveedores | ✅ Documentado |
| [Listas de Precios](modules/listas-precios/README.md) | Pricing, listas diferenciadas | ✅ Documentado |

### 🏪 Operaciones

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Almacenes](modules/almacenes/README.md) | Almacenes y ubicaciones de stock | ✅ Documentado |
| [Puntos de Venta](modules/puntos-venta/README.md) | Sucursales y puntos de venta | ✅ Documentado |
| [Transferencias](modules/transferencias/README.md) | Movimientos de stock entre almacenes y puntos de venta | ✅ Documentado |
| [Mermas](modules/mermas/README.md) | Control de pérdidas y ajustes | ✅ Documentado |

### 💰 Ventas y Facturación

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Ventas](modules/ventas/README.md) | Ventas POS, registro, anulación | ✅ Documentado |
| [Venta de Servicios](modules/venta-servicios/README.md) | Ventas de servicios (simple y mixta) | ✅ Documentado |
| [Facturas](modules/facturas/README.md) | Consulta, actualización y exportación de facturas emitidas | ✅ Documentado |
| [Series de Facturación](modules/series-facturacion/README.md) | Series, prefijos y numeración fiscal | ✅ Documentado |
| [Ofertas](modules/ofertas/README.md) | Cotizaciones comerciales con facturación posterior | ✅ Documentado |
| [Clientes](modules/clientes/README.md) | Cartera de clientes, historial | ✅ Documentado |
| [Turnos POS](modules/turnos-pos/README.md) | Turnos de empleados por punto de venta | ✅ Documentado |
| [Arqueo de Caja](modules/arqueo-caja/README.md) | Arqueo y cierre de caja por turno | ✅ Documentado |
| [Cuadre Diario](modules/cuadre-diario/README.md) | Cuadre diario consolidado | ✅ Documentado |

### 📥 Compras

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Compras de Productos](modules/compras-productos/README.md) | Compras, documentos, FIFO, gastos asociados | ✅ Documentado |
| [Compras de Servicios](modules/compras-servicios/README.md) | Compras de servicios a proveedores | ✅ Documentado |
| [Servicios](modules/servicios/README.md) | Catálogo de servicios ofrecidos | ✅ Documentado |

### 👥 Recursos Humanos

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Empleados](modules/empleados/README.md) | Gestión de empleados, datos laborales | ✅ Documentado |
| [Pago de Salario](modules/pago-salario/README.md) | Registro de pagos de salario, bonificaciones y deducciones | ✅ Documentado |
| [Perfil](modules/profile/README.md) | Perfil de usuario | ✅ Documentado |

### 📊 Contabilidad y Finanzas

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Contabilidad](modules/contabilidad/README.md) | Reconciliación, cuentas, periodos, reportes y módulos financieros avanzados | ✅ Documentado |
| [Periodos Contables](modules/contabilidad/periodos-contables.md) | Apertura, cierre, snapshots | ✅ Documentado |
| [Reconciliación Bancaria](modules/contabilidad/reconciliacion.md) | Conciliación de ventas, servicios y gastos | ✅ Documentado |
| [Ajustes Bancarios](modules/contabilidad/ajustes-bancarios.md) | Ajustes, anticipos, deudas, préstamos | ✅ Documentado |
| [Anticipos](modules/contabilidad/ajustes-bancarios.md) | Anticipos a proveedores | ✅ Documentado |
| [Deudas y Préstamos Cash](modules/contabilidad/ajustes-bancarios.md) | Deudas y préstamos | ✅ Documentado |
| [Gastos D/E](modules/gastosDE/README.md) | Gastos de distribución y explotación | ✅ Documentado |
| [Reportes Financieros](modules/reportes-financieros/README.md) | Indicadores, balances, reportes exportables | ✅ Documentado |

### 🏭 Producción

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Producción](modules/produccion/README.md) | Recetas, órdenes y validación de materiales de producción | ✅ Documentado |
| [Reparaciones](modules/reparaciones/README.md) | Taller de reparaciones | ✅ Documentado |
| [Ficha de Costo](modules/ficha-costo/README.md) | Costo, margen, merma y rentabilidad de productos y servicios | ✅ Documentado |

### ⚙️ Infraestructura

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| [Backups](modules/backups/README.md) | Backups, restore, import y planes automáticos | ✅ Documentado |
| [Notificaciones](modules/notificaciones/README.md) | Centro de notificaciones | ✅ Documentado |
| [Dashboard](modules/dashboard/README.md) | Panel ejecutivo e indicadores | ✅ Documentado |
| [Contratos](modules/contratos/README.md) | Gestión de contratos | ✅ Documentado |
| [Reviews](modules/reviews/README.md) | Reseñas del tenant, moderación y prueba social pública | ✅ Documentado |
| [Landing Page](modules/landing/README.md) | Página pública de aterrizaje | ✅ Documentado |
| [Licencias](modules/licencias/README.md) | Gestión de licencias por tenant, demos y overrides | ✅ Documentado |

## Guías de Operación

| Guía | Propósito |
|------|-----------|
| [Resumen de Documentación](README.md) | Punto de entrada resumido de la documentación del proyecto |
| [Guía de Despliegue](DEPLOYMENT_GUIDE.md) | Deploy en Railway y operación básica de despliegue |

---

**Leyenda**: ✅ Documentado | 📝 Pendiente

> Documentación generada siguiendo el template estándar del sistema.
> Última actualización: 2026-07-07 (navegación y módulos normalizados)
