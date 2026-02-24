-- Categoria
INSERT INTO "Categoria" ("catId", "nombre", "createdAt", "updatedAt") VALUES
('cat1', 'Electrónica', '2024-07-20 22:09:10.605', '2024-07-20 22:09:10.605'),
('cat2', 'Oficina', '2024-07-20 22:09:10.605', '2024-07-20 22:09:10.605'),
('cat3', 'Mercado', '2024-07-20 22:09:10.605', '2024-07-20 22:09:10.605'),
('cat4', 'Carnico', '2024-07-20 22:09:10.605', '2024-07-20 22:09:10.605'),
('cat5', 'Higiene y Salud', '2024-07-20 22:09:10.605', '2024-07-20 22:09:10.605'),
('cat6', 'Bebidas', '2024-07-20 22:09:10.605', '2024-07-20 22:09:10.605')

-- Unidad
INSERT INTO "Unidad" ("unidadId", "nombre", "simbolo", "createdAt", "updatedAt") VALUES
('unid1', 'Unidad', 'u', NOW(), NOW()),
('unid2', 'libras', 'lb', NOW(), NOW()),
('unid3', 'cajas de cervezas', 'c/24', NOW(), NOW()),
('unid4', 'cajas de refrescos', 'c/6', NOW(), NOW()),
('unid5', 'kilogramos', 'kg', NOW(), NOW())

-- Vendor
INSERT INTO "Vendor" ("vendorId", "nombre", "contacto", "createdAt", "updatedAt") VALUES
('vend1', 'HP', 'hp@correo.com', NOW(), NOW()),
('vend2', 'TRD', 'trd@correo.com', NOW(), NOW()),
('vend3', 'Mariel', 'mariel@correo.com', NOW(), NOW()),
('vend4', 'LOL', 'lol@correo.com', NOW(), NOW())

-- Almacen
INSERT INTO "Almacen" ("almacenId", "nombre", "createdAt", "updatedAt") VALUES
('alm1', 'Central', NOW(), NOW()),
('alm2', 'Sur', NOW(), NOW())


-- PuntoDeVenta
INSERT INTO "PuntoDeVenta" ("pvId", "nombre", "ubicacion", "createdAt", "updatedAt") VALUES
('cmdc8bjyl0000u3ywx7nh7et1', 'Tienda Centro', 'Centro', NOW(), NOW()),
('cmdc8bjyl0000u3ywx7nh7et2', 'Tienda Sur', 'Sur', NOW(), NOW())
('cmdc8bjyl0000u3ywx7nh7et3', 'Tienda Norte', 'Norte', NOW(), NOW()),
('cmdc8bjyl0000u3ywx7nh7et4', 'Tienda Este', 'Este', NOW(), NOW())


-- Producto
INSERT INTO "Producto" ("id", "nombre", "descripcion", "precioCosto", "precioVenta", "stock", "categoriaId", "unidadId", "vendorId", "almacenId", "puntoDeVentaId", "createdAt", "updatedAt") VALUES
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());
('prod1', 'Laptop HP', 'Laptop HP Pavilion', 800, 1200, 10, 'cat1', 'unid1', 'vend1', 'alm1', 'pv1', NOW(), NOW());

-- Venta
INSERT INTO "Venta" ("ventaId", "productoId", "cantidad", "total", "puntoDeVentaId", "empleadoId", "createdAt", "updatedAt") VALUES
('v1', 'prod2', 10, 2400, 'pv1', 'emp1', NOW(), NOW());
('v2', 'prod1', 2, 2400, 'pv1', 'emp2', NOW(), NOW());
('v3', 'prod3', 2, 2400, 'pv1', 'emp3', NOW(), NOW());
('v4', 'prod5', 2, 2400, 'pv1', 'emp1', NOW(), NOW());
('v5', 'prod7', 2, 2400, 'pv1', 'emp2', NOW(), NOW());
('v6', 'prod8', 2, 2400, 'pv1', 'emp3', NOW(), NOW());
('v7', 'prod1', 2, 12000, 'pv1', 'emp1', NOW(), NOW()),
('v8', 'prod3', 2, 2400, 'pv1', 'emp2', NOW(), NOW()),
('v9', 'prod4', 2, 2400, 'pv1', 'emp3', NOW(), NOW());
('v10', 'prod5', 2, 2400, 'pv1', 'emp1', NOW(), NOW())


-- Merma
INSERT INTO "Merma" ("mermaId", "productoId", "cantidad", "motivo", "costoTotal", "createdAt", "updatedAt") VALUES
('m1', 'prod1', 1, 'Defecto', 800, NOW(), NOW());

-- Transferencia
INSERT INTO "Transferencia" ("transferenciaId", "productoId", "cantidad", "origenId", "destinoId", "puntoDeVentaOrigenId", "puntoDeVentaDestinoId", "createdAt", "updatedAt") VALUES
('t1', 'prod1', 1, 'alm1', 'alm1', 'pv1', 'pv1', NOW(), NOW());

-- User
INSERT INTO "User" ("userId", "name", "email", "password", "role", "isActive", "avatar", "createdAt", "updatedAt") VALUES
('u1', 'Admin', 'admin@correo.com', '123456', 'admin', true, '', NOW(), NOW()),

-- Notification
INSERT INTO "Notification" ("id", "title", "message", "type", "isRead", "userId", "prioridad", "createdAt", "updatedAt") VALUES
('n1', 'Bienvenido', 'Tu cuenta ha sido creada', 'success', false, 'u1', 'alta', NOW(), NOW());

-- Empleado
INSERT INTO "Empleado" ("empleadoId", "nombre", "apellido", "telefono", "cargo", "salarioBases", "periodo", "bonificaciones", "deducciones", "horasExtras", "createdAt", "updatedAt") VALUES
('emp1', 'Juan', 'Pérez', '555-1234', 'Vendedor', 45000, '2025-07', 100, 50, 10, NOW(), NOW()),
('emp2', 'Pepe', 'Pérez', '555-1234', 'Vendedor', 57000, '2025-07', 100, 50, 10, NOW(), NOW()),
('emp3', 'Orlando', 'Pérez', '555-1234', 'Vendedor', 52000, '2025-07', 100, 50, 10, NOW(), NOW()),
('emp4', 'Ray', 'Pérez', '555-1234', 'Limpieza', 35000, '2025-07', 100, 50, 10, NOW(), NOW()),
('emp5', 'Yansi', 'Pérez', '555-1234', 'Limpieza', 30000, '2025-07', 100, 50, 10, NOW(), NOW())

-- GastoCompra
INSERT INTO "GastoCompra" ("gastoCompraId", "productoId", "vendorId", "cantidad", "precioUnitario", "total", "fechaCompra", "descripcion", "createdAt", "updatedAt") VALUES
('gc1', 'prod1', 'vend1', 2, 800, 1600, NOW(), 'Compra inicial', NOW(), NOW());

-- GastosServicios
INSERT INTO "GastosServicios" ("gastoSId", "tipo", "proveedor", "monto", "periodo", "descripcion", "createdAt", "updatedAt") VALUES
('gs1', 'electricidad', 'Empresa Eléctrica', 2000, '2025-07', 'Pago mensual', NOW(), NOW()),
('gs2', 'alquiler', 'Lenin House', 10000, '2025-07', 'Pago mensual', NOW(), NOW()),
('gs3', 'Internet', 'ETECSA', 5000, '2025-07', 'Pago mensual', NOW(), NOW()),
('gs4', 'Servicio Telefonia', 'ETECSA', 500, '2025-07', 'Pago mensual', NOW(), NOW())

