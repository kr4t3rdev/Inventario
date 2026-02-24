-- Script SQL para poblar la base de datos con datos históricos de 2023 y 2024
-- Ejecutar este script directamente en PostgreSQL

-- Fechas específicas para 2023 y 2024
DO $$
DECLARE
    start_date DATE := '2023-01-01';
    current_month DATE;
    i INTEGER;
    j INTEGER;
BEGIN

-- Insertar categorías históricas
INSERT INTO "Categoria" ("catId", "nombre", "createdAt", "updatedAt") VALUES
('cat_hist_1', 'Electrónica Histórica', start_date, start_date),
('cat_hist_2', 'Oficina Histórica', start_date, start_date),
('cat_hist_3', 'Mercado Histórico', start_date, start_date),
('cat_hist_4', 'Carnicería Histórica', start_date, start_date),
('cat_hist_5', 'Higiene Histórica', start_date, start_date)
ON CONFLICT ("catId") DO NOTHING;

-- Insertar unidades históricas
INSERT INTO "Unidad" ("unidadId", "nombre", "simbolo", "createdAt", "updatedAt") VALUES
('unid_hist_1', 'Unidad Histórica', 'u', start_date, start_date),
('unid_hist_2', 'libras Históricas', 'lb', start_date, start_date),
('unid_hist_3', 'cajas de cervezas Históricas', 'c/24', start_date, start_date)
ON CONFLICT ("unidadId") DO NOTHING;

-- Insertar vendors históricos
INSERT INTO "Vendor" ("vendorId", "nombre", "contacto", "createdAt", "updatedAt") VALUES
('vend_hist_1', 'HP Histórico', 'hp@correo.com', start_date, start_date),
('vend_hist_2', 'TRD Histórico', 'trd@correo.com', start_date, start_date),
('vend_hist_3', 'Mariel Histórico', 'mariel@correo.com', start_date, start_date)
ON CONFLICT ("vendorId") DO NOTHING;

-- Insertar almacenes históricos
INSERT INTO "Almacen" ("almacenId", "nombre", "createdAt", "updatedAt") VALUES
('alm_hist_1', 'Central Histórico', start_date, start_date),
('alm_hist_2', 'Sur Histórico', start_date, start_date)
ON CONFLICT ("almacenId") DO NOTHING;

-- Insertar puntos de venta históricos
INSERT INTO "PuntoDeVenta" ("pvId", "nombre", "ubicacion", "createdAt", "updatedAt") VALUES
('pv_hist_1', 'Tienda Centro Histórico', 'Centro', start_date, start_date),
('pv_hist_2', 'Tienda Sur Histórico', 'Sur', start_date, start_date),
('pv_hist_3', 'Tienda Norte Histórico', 'Norte', start_date, start_date)
ON CONFLICT ("pvId") DO NOTHING;

-- Insertar productos históricos
INSERT INTO "Producto" ("id", "nombre", "descripcion", "precioCosto", "precioVenta", "stock", "categoriaId", "unidadId", "vendorId", "almacenId", "puntoDeVentaId", "createdAt", "updatedAt") VALUES
('prod_hist_1', 'Laptop HP Histórica', 'Laptop HP Pavilion Histórica', 700, 1000, 15, 'cat_hist_1', 'unid_hist_1', 'vend_hist_1', 'alm_hist_1', 'pv_hist_1', start_date, start_date),
('prod_hist_2', 'Carne de Res Histórica', 'Carne de res fresca histórica', 50, 80, 20, 'cat_hist_4', 'unid_hist_2', 'vend_hist_2', 'alm_hist_2', 'pv_hist_2', start_date, start_date),
('prod_hist_3', 'Cerveza Histórica', 'Caja de cervezas históricas', 25, 35, 50, 'cat_hist_3', 'unid_hist_3', 'vend_hist_3', 'alm_hist_1', 'pv_hist_3', start_date, start_date)
ON CONFLICT ("id") DO NOTHING;

-- Insertar empleados históricos
INSERT INTO "Empleado" ("empleadoId", "nombre", "apellido", "telefono", "cargo", "salarioBases", "createdAt", "updatedAt") VALUES
('emp_hist_1', 'Juan Histórico', 'Pérez', '555-1234', 'Vendedor', 40000, start_date, start_date),
('emp_hist_2', 'María Histórica', 'González', '555-5678', 'Cajera', 35000, start_date, start_date)
ON CONFLICT ("empleadoId") DO NOTHING;

-- Insertar servicios históricos
INSERT INTO "Servicios" ("servicioId", "nombre", "precio", "descripcion", "createdAt", "updatedAt") VALUES
('serv_hist_1', 'Servicio Técnico', 1500, 'Servicio técnico especializado', start_date, start_date),
('serv_hist_2', 'Consultoría', 2500, 'Consultoría profesional', start_date, start_date)
ON CONFLICT ("servicioId") DO NOTHING;

-- Insertar clientes históricos
INSERT INTO "Cliente" ("clienteId", "nombre", "cargo", "empresa", "createdAt", "updatedAt") VALUES
('cliente_hist_1', 'Empresa ABC', 'Gerente', 'ABC Corp', start_date, start_date),
('cliente_hist_2', 'Empresa XYZ', 'Director', 'XYZ Ltd', start_date, start_date)
ON CONFLICT ("clienteId") DO NOTHING;

-- Generar ventas históricas (múltiples por mes durante 2023 y 2024)
FOR i IN 0..23 LOOP
    current_month := start_date + (i || ' months')::INTERVAL;

    -- Insertar 10 ventas por mes
    FOR j IN 1..10 LOOP
        INSERT INTO "Venta" ("ventaId", "productoId", "cantidad", "total", "descuento", "puntoDeVentaId", "empleadoId", "createdAt", "updatedAt") VALUES
        (
            'v_hist_' || i || '_' || j,
            CASE WHEN j % 3 = 0 THEN 'prod_hist_1' WHEN j % 3 = 1 THEN 'prod_hist_2' ELSE 'prod_hist_3' END,
            (random() * 5 + 1)::INTEGER,
            (random() * 500 + 100)::INTEGER,
            (random() * 50)::INTEGER,
            CASE WHEN j % 3 = 0 THEN 'pv_hist_1' WHEN j % 3 = 1 THEN 'pv_hist_2' ELSE 'pv_hist_3' END,
            CASE WHEN j % 2 = 0 THEN 'emp_hist_1' ELSE 'emp_hist_2' END,
            current_month + ((random() * 27)::INTEGER || ' days')::INTERVAL,
            current_month + ((random() * 27)::INTEGER || ' days')::INTERVAL
        )
        ON CONFLICT ("ventaId") DO NOTHING;
    END LOOP;
END LOOP;

-- Generar gastos de compra históricos
FOR i IN 0..23 LOOP
    current_month := start_date + (i || ' months')::INTERVAL;

    FOR j IN 1..5 LOOP
        INSERT INTO "GastoCompra" ("gastoCompraId", "productoId", "vendorId", "cantidad", "precioUnitario", "total", "fechaCompra", "descripcion", "createdAt", "updatedAt") VALUES
        (
            'gc_hist_' || i || '_' || j,
            CASE WHEN j % 3 = 0 THEN 'prod_hist_1' WHEN j % 3 = 1 THEN 'prod_hist_2' ELSE 'prod_hist_3' END,
            CASE WHEN j % 3 = 0 THEN 'vend_hist_1' WHEN j % 3 = 1 THEN 'vend_hist_2' ELSE 'vend_hist_3' END,
            (random() * 10 + 1)::INTEGER,
            (random() * 100 + 50)::INTEGER,
            (random() * 1000 + 200)::INTEGER,
            current_month + ((random() * 27)::INTEGER || ' days')::INTERVAL,
            'Compra histórica ' || i || '-' || j,
            current_month + ((random() * 27)::INTEGER || ' days')::INTERVAL,
            current_month + ((random() * 27)::INTEGER || ' days')::INTERVAL
        )
        ON CONFLICT ("gastoCompraId") DO NOTHING;
    END LOOP;
END LOOP;

-- Generar gastos DE históricos
FOR i IN 0..23 LOOP
    current_month := start_date + (i || ' months')::INTERVAL;
    DECLARE
        tipos_gasto TEXT[] := ARRAY['electricidad', 'agua', 'gas', 'internet', 'telefono', 'alquiler', 'limpieza', 'seguridad'];
        periodo TEXT := EXTRACT(YEAR FROM current_month) || '-' || LPAD(EXTRACT(MONTH FROM current_month)::TEXT, 2, '0');
        tipo_gasto TEXT;
    BEGIN
        FOREACH tipo_gasto IN ARRAY tipos_gasto LOOP
            INSERT INTO "GastosDE" ("gastosDEId", "tipo", "proveedor", "monto", "periodo", "descripcion", "isPagado", "createdAt", "updatedAt") VALUES
            (
                'gde_hist_' || i || '_' || array_position(tipos_gasto, tipo_gasto),
                tipo_gasto,
                'Proveedor ' || tipo_gasto || ' Histórico',
                (random() * 5000 + 1000)::INTEGER,
                periodo,
                'Gasto ' || tipo_gasto || ' histórico',
                CASE WHEN random() > 0.3 THEN 'sí' ELSE 'no' END,
                current_month,
                current_month
            )
            ON CONFLICT ("gastosDEId") DO NOTHING;
        END LOOP;
    END;
END LOOP;

-- Generar pagos de salario históricos
FOR i IN 0..23 LOOP
    current_month := start_date + (i || ' months')::INTERVAL;
    DECLARE
        periodo TEXT := EXTRACT(YEAR FROM current_month) || '-' || LPAD(EXTRACT(MONTH FROM current_month)::TEXT, 2, '0');
    BEGIN
        -- Pago para Juan Histórico
        INSERT INTO "Pagosalario" ("pgId", "empleadoId", "salario", "bonificaciones", "deducciones", "horasExtras", "observaciones", "periodo", "createdAt", "updatedAt") VALUES
        (
            'pg_hist_' || i || '_emp_hist_1',
            'emp_hist_1',
            40000,
            (random() * 5000)::INTEGER,
            (random() * 2000)::INTEGER,
            (random() * 20)::INTEGER,
            'Pago histórico ' || periodo,
            periodo,
            current_month,
            current_month
        )
        ON CONFLICT ("pgId") DO NOTHING;

        -- Pago para María Histórica
        INSERT INTO "Pagosalario" ("pgId", "empleadoId", "salario", "bonificaciones", "deducciones", "horasExtras", "observaciones", "periodo", "createdAt", "updatedAt") VALUES
        (
            'pg_hist_' || i || '_emp_hist_2',
            'emp_hist_2',
            35000,
            (random() * 5000)::INTEGER,
            (random() * 2000)::INTEGER,
            (random() * 20)::INTEGER,
            'Pago histórico ' || periodo,
            periodo,
            current_month,
            current_month
        )
        ON CONFLICT ("pgId") DO NOTHING;
    END;
END LOOP;

-- Generar mermas históricas
FOR i IN 0..23 LOOP
    current_month := start_date + (i || ' months')::INTERVAL;

    FOR j IN 1..3 LOOP
        INSERT INTO "Merma" ("mermaId", "productoId", "cantidad", "motivo", "costoTotal", "createdAt", "updatedAt") VALUES
        (
            'm_hist_' || i || '_' || j,
            CASE WHEN j % 3 = 0 THEN 'prod_hist_1' WHEN j % 3 = 1 THEN 'prod_hist_2' ELSE 'prod_hist_3' END,
            (random() * 5 + 1)::INTEGER,
            (ARRAY['Defecto', 'Vencimiento', 'Robo', 'Daño'])[(random() * 4 + 1)::INTEGER],
            (random() * 500 + 50)::INTEGER,
            current_month + ((random() * 27)::INTEGER || ' days')::INTERVAL,
            current_month + ((random() * 27)::INTEGER || ' days')::INTERVAL
        )
        ON CONFLICT ("mermaId") DO NOTHING;
    END LOOP;
END LOOP;

-- Generar transferencias históricas
FOR i IN 0..23 LOOP
    current_month := start_date + (i || ' months')::INTERVAL;

    FOR j IN 1..5 LOOP
        INSERT INTO "Transferencia" ("transferenciaId", "productoId", "cantidad", "descripcion", "origenId", "destinoId", "puntoDeVentaOrigenId", "puntoDeVentaDestinoId", "createdAt", "updatedAt") VALUES
        (
            't_hist_' || i || '_' || j,
            CASE WHEN j % 3 = 0 THEN 'prod_hist_1' WHEN j % 3 = 1 THEN 'prod_hist_2' ELSE 'prod_hist_3' END,
            (random() * 10 + 1)::INTEGER,
            'Transferencia histórica ' || i || '-' || j,
            CASE WHEN j % 2 = 0 THEN 'alm_hist_1' ELSE 'alm_hist_2' END,
            CASE WHEN j % 2 = 0 THEN 'alm_hist_2' ELSE 'alm_hist_1' END,
            CASE WHEN j % 3 = 0 THEN 'pv_hist_1' WHEN j % 3 = 1 THEN 'pv_hist_2' ELSE 'pv_hist_3' END,
            CASE WHEN j % 3 = 0 THEN 'pv_hist_2' WHEN j % 3 = 1 THEN 'pv_hist_3' ELSE 'pv_hist_1' END,
            current_month + ((random() * 27)::INTEGER || ' days')::INTERVAL,
            current_month + ((random() * 27)::INTEGER || ' days')::INTERVAL
        )
        ON CONFLICT ("transferenciaId") DO NOTHING;
    END LOOP;
END LOOP;

-- Insertar datos de contabilidad históricos
-- Monedas
INSERT INTO "Moneda" ("codigo", "nombre", "simbolo", "esPrincipal", "isActive", "createdAt", "updatedAt") VALUES
('CUP', 'Peso Cubano', 'CUP', true, true, start_date, start_date),
('USD', 'Dólar Americano', '$', false, true, start_date, start_date),
('EUR', 'Euro', '€', false, true, start_date, start_date)
ON CONFLICT ("codigo") DO NOTHING;

-- Tasas de cambio históricas
INSERT INTO "TasaCambio" ("tasaId", "monedaOrigenId", "monedaDestino", "tasa", "fechaVigencia", "createdAt", "updatedAt") VALUES
(gen_random_uuid()::TEXT, 'USD', 'CUP', 120.0, start_date, start_date, start_date),
(gen_random_uuid()::TEXT, 'EUR', 'CUP', 130.0, start_date, start_date, start_date)
ON CONFLICT DO NOTHING;

-- Tipos de pago
INSERT INTO "TipoPago" ("tipoId", "nombre", "descripcion", "requiereCuenta", "isActive", "createdAt", "updatedAt") VALUES
(gen_random_uuid()::TEXT, 'Efectivo', 'Pago en efectivo', false, true, start_date, start_date),
(gen_random_uuid()::TEXT, 'Transferencia Bancaria', 'Transferencia electrónica', true, true, start_date, start_date),
(gen_random_uuid()::TEXT, 'Tarjeta de Débito', 'Pago con tarjeta de débito', true, true, start_date, start_date),
(gen_random_uuid()::TEXT, 'Tarjeta de Crédito', 'Pago con tarjeta de crédito', true, true, start_date, start_date)
ON CONFLICT DO NOTHING;

-- Cuentas bancarias
INSERT INTO "CuentaBancaria" ("cuentaId", "nombreBanco", "numeroCuenta", "tipoCuenta", "saldo", "moneda", "isActive", "createdAt", "updatedAt") VALUES
(gen_random_uuid()::TEXT, 'Banco Popular de Ahorro', '9200-0000-0001', 'corriente', 50000.00, 'CUP', true, start_date, start_date),
(gen_random_uuid()::TEXT, 'Banco Metropolitano', '9210-0000-0001', 'ahorros', 25000.00, 'CUP', true, start_date, start_date),
(gen_random_uuid()::TEXT, 'Banco Internacional de Comercio', '9220-0000-0001', 'empresarial', 1000.00, 'USD', true, start_date, start_date)
ON CONFLICT ("numeroCuenta") DO NOTHING;

-- Generar datos para 2025 hasta la fecha actual
DECLARE
    current_date_2025 DATE := CURRENT_DATE;
    months_2025 INTEGER := EXTRACT(MONTH FROM current_date_2025)::INTEGER;
    year_2025 INTEGER := EXTRACT(YEAR FROM current_date_2025)::INTEGER;
BEGIN

-- Solo generar datos para 2025 si estamos en 2025
IF year_2025 = 2025 THEN
    -- Generar ventas de productos para 2025
    FOR i IN 1..months_2025 LOOP
        DECLARE
            month_date DATE := DATE_TRUNC('month', MAKE_DATE(2025, i, 1));
        BEGIN
            FOR j IN 1..15 LOOP  -- Más ventas en 2025
                INSERT INTO "Venta" ("ventaId", "productoId", "cantidad", "total", "descuento", "puntoDeVentaId", "empleadoId", "createdAt", "updatedAt") VALUES
                (
                    'v_2025_' || i || '_' || j,
                    CASE WHEN j % 3 = 0 THEN 'prod_hist_1' WHEN j % 3 = 1 THEN 'prod_hist_2' ELSE 'prod_hist_3' END,
                    (random() * 8 + 1)::INTEGER,
                    (random() * 800 + 200)::INTEGER,
                    (random() * 100)::INTEGER,
                    CASE WHEN j % 3 = 0 THEN 'pv_hist_1' WHEN j % 3 = 1 THEN 'pv_hist_2' ELSE 'pv_hist_3' END,
                    CASE WHEN j % 2 = 0 THEN 'emp_hist_1' ELSE 'emp_hist_2' END,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL
                )
                ON CONFLICT ("ventaId") DO NOTHING;
            END LOOP;
        END;
    END LOOP;

    -- Generar ventas de servicios para 2025
    FOR i IN 1..months_2025 LOOP
        DECLARE
            month_date DATE := DATE_TRUNC('month', MAKE_DATE(2025, i, 1));
        BEGIN
            FOR j IN 1..10 LOOP
                INSERT INTO "VentaServicios" ("ventaServicioId", "servicioId", "cantidad", "total", "observaciones", "clienteId", "createdAt", "updatedAt") VALUES
                (
                    'vs_2025_' || i || '_' || j,
                    CASE WHEN j % 2 = 0 THEN 'serv_hist_1' ELSE 'serv_hist_2' END,
                    (random() * 3 + 1)::INTEGER,
                    (random() * 500 + 100)::INTEGER,
                    'Servicio 2025-' || i || '-' || j,
                    CASE WHEN j % 2 = 0 THEN 'cliente_hist_1' ELSE 'cliente_hist_2' END,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL
                )
                ON CONFLICT ("ventaServicioId") DO NOTHING;
            END LOOP;
        END;
    END LOOP;

    -- Generar transferencias bancarias para 2025
    FOR i IN 1..months_2025 LOOP
        DECLARE
            month_date DATE := DATE_TRUNC('month', MAKE_DATE(2025, i, 1));
        BEGIN
            FOR j IN 1..5 LOOP
                INSERT INTO "TransferenciaBancaria" ("transferenciaId", "numeroComprobante", "cuentaOrigenId", "cuentaDestinoId", "montoOrigen", "monedaOrigen", "montoDestino", "monedaDestino", "tasaCambio", "motivo", "descripcion", "fechaTransferencia", "comprobanteGenerado", "rutaComprobante", "existe", "createdAt", "updatedAt") VALUES
                (
                    'tb_2025_' || i || '_' || j,
                    'TB-' || LPAD((i * 100 + j)::TEXT, 6, '0'),
                    CASE WHEN j % 2 = 0 THEN (SELECT "cuentaId" FROM "CuentaBancaria" WHERE "numeroCuenta" = '9200-0000-0001' LIMIT 1) ELSE (SELECT "cuentaId" FROM "CuentaBancaria" WHERE "numeroCuenta" = '9210-0000-0001' LIMIT 1) END,
                    CASE WHEN j % 2 = 0 THEN (SELECT "cuentaId" FROM "CuentaBancaria" WHERE "numeroCuenta" = '9210-0000-0001' LIMIT 1) ELSE (SELECT "cuentaId" FROM "CuentaBancaria" WHERE "numeroCuenta" = '9200-0000-0001' LIMIT 1) END,
                    (random() * 10000 + 1000)::DECIMAL,
                    'CUP',
                    (random() * 10000 + 1000)::DECIMAL,
                    'CUP',
                    NULL,
                    'Transferencia 2025-' || i || '-' || j,
                    'Transferencia bancaria histórica 2025',
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL,
                    true,
                    '/comprobantes/TB-' || LPAD((i * 100 + j)::TEXT, 6, '0') || '.pdf',
                    true,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL
                )
                ON CONFLICT ("numeroComprobante") DO NOTHING;
            END LOOP;
        END;
    END LOOP;

    -- Generar transacciones de moneda para 2025
    FOR i IN 1..months_2025 LOOP
        DECLARE
            month_date DATE := DATE_TRUNC('month', MAKE_DATE(2025, i, 1));
        BEGIN
            FOR j IN 1..8 LOOP
                INSERT INTO "TransaccionMoneda" ("transaccionId", "tipoTransaccion", "referenciaId", "monedaId", "montoOriginal", "tasaCambio", "montoConvertido", "createdAt", "updatedAt") VALUES
                (
                    'tm_2025_' || i || '_' || j,
                    CASE WHEN j % 4 = 0 THEN 'venta' WHEN j % 4 = 1 THEN 'servicio' WHEN j % 4 = 2 THEN 'gasto' ELSE 'compra' END,
                    CASE WHEN j % 4 = 0 THEN 'v_2025_' || i || '_' || j WHEN j % 4 = 1 THEN 'vs_2025_' || i || '_' || j ELSE 'gc_hist_' || (i-1) || '_' || j END,
                    CASE WHEN j % 2 = 0 THEN 'USD' ELSE 'EUR' END,
                    (random() * 1000 + 100)::DECIMAL,
                    CASE WHEN j % 2 = 0 THEN 120.0 ELSE 130.0 END,
                    (random() * 130000 + 13000)::DECIMAL,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL
                )
                ON CONFLICT ("transaccionId") DO NOTHING;
            END LOOP;
        END;
    END LOOP;

    -- Generar reconciliaciones de ventas para 2025
    FOR i IN 1..months_2025 LOOP
        DECLARE
            month_date DATE := DATE_TRUNC('month', MAKE_DATE(2025, i, 1));
        BEGIN
            FOR j IN 1..10 LOOP
                INSERT INTO "ReconciliacionVenta" ("reconciliacionId", "ventaId", "cuentaId", "tipoPagoId", "monto", "moneda", "tasaCambio", "montoConvertido", "fechaReconciliacion", "observaciones", "reconciliadoPor", "createdAt", "updatedAt") VALUES
                (
                    'rv_2025_' || i || '_' || j,
                    'v_2025_' || i || '_' || j,
                    (SELECT "cuentaId" FROM "CuentaBancaria" WHERE "numeroCuenta" = '9200-0000-0001' LIMIT 1),
                    (SELECT "tipoId" FROM "TipoPago" WHERE "nombre" = 'Efectivo' LIMIT 1),
                    (random() * 800 + 200)::DECIMAL,
                    'CUP',
                    NULL,
                    (random() * 800 + 200)::DECIMAL,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL,
                    'Reconciliación venta 2025-' || i || '-' || j,
                    'admin',
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL
                )
                ON CONFLICT ("reconciliacionId") DO NOTHING;
            END LOOP;
        END;
    END LOOP;

    -- Generar reconciliaciones de servicios para 2025
    FOR i IN 1..months_2025 LOOP
        DECLARE
            month_date DATE := DATE_TRUNC('month', MAKE_DATE(2025, i, 1));
        BEGIN
            FOR j IN 1..8 LOOP
                INSERT INTO "ReconciliacionServicio" ("reconciliacionId", "ventaServicioId", "cuentaId", "tipoPagoId", "monto", "moneda", "tasaCambio", "montoConvertido", "fechaReconciliacion", "observaciones", "reconciliadoPor", "createdAt", "updatedAt") VALUES
                (
                    'rs_2025_' || i || '_' || j,
                    'vs_2025_' || i || '_' || j,
                    (SELECT "cuentaId" FROM "CuentaBancaria" WHERE "numeroCuenta" = '9200-0000-0001' LIMIT 1),
                    (SELECT "tipoId" FROM "TipoPago" WHERE "nombre" = 'Transferencia Bancaria' LIMIT 1),
                    (random() * 500 + 100)::DECIMAL,
                    'CUP',
                    NULL,
                    (random() * 500 + 100)::DECIMAL,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL,
                    'Reconciliación servicio 2025-' || i || '-' || j,
                    'admin',
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL
                )
                ON CONFLICT ("reconciliacionId") DO NOTHING;
            END LOOP;
        END;
    END LOOP;

    -- Generar reconciliaciones de gastos para 2025
    FOR i IN 1..months_2025 LOOP
        DECLARE
            month_date DATE := DATE_TRUNC('month', MAKE_DATE(2025, i, 1));
        BEGIN
            FOR j IN 1..6 LOOP
                INSERT INTO "ReconciliacionGasto" ("reconciliacionId", "tipoGasto", "referenciaId", "cuentaId", "tipoPagoId", "monto", "moneda", "tasaCambio", "montoConvertido", "descripcion", "periodo", "fechaReconciliacion", "observaciones", "reconciliadoPor", "isReconciliada", "pgId", "gastosDEId", "gastoCompraId", "createdAt", "updatedAt") VALUES
                (
                    'rg_2025_' || i || '_' || j,
                    CASE WHEN j % 3 = 0 THEN 'salario' WHEN j % 3 = 1 THEN 'gastoDE' ELSE 'compra' END,
                    CASE WHEN j % 3 = 0 THEN 'pg_hist_' || (i-1) || '_emp_hist_1' WHEN j % 3 = 1 THEN 'gde_hist_' || (i-1) || '_' || j ELSE 'gc_hist_' || (i-1) || '_' || j END,
                    (SELECT "cuentaId" FROM "CuentaBancaria" WHERE "numeroCuenta" = '9200-0000-0001' LIMIT 1),
                    (SELECT "tipoId" FROM "TipoPago" WHERE "nombre" = 'Efectivo' LIMIT 1),
                    (random() * 5000 + 1000)::DECIMAL,
                    'CUP',
                    NULL,
                    (random() * 5000 + 1000)::DECIMAL,
                    'Reconciliación gasto 2025-' || i || '-' || j,
                    '2025-' || LPAD(i::TEXT, 2, '0'),
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL,
                    'Reconciliación automática 2025',
                    'admin',
                    true,
                    CASE WHEN j % 3 = 0 THEN 'pg_hist_' || (i-1) || '_emp_hist_1' ELSE NULL END,
                    CASE WHEN j % 3 = 1 THEN 'gde_hist_' || (i-1) || '_' || j ELSE NULL END,
                    CASE WHEN j % 3 = 2 THEN 'gc_hist_' || (i-1) || '_' || j ELSE NULL END,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL,
                    month_date + ((random() * 27)::INTEGER || ' days')::INTERVAL
                )
                ON CONFLICT ("reconciliacionId") DO NOTHING;
            END LOOP;
        END;
    END LOOP;
END IF;

END;

RAISE NOTICE 'Datos históricos y actuales insertados exitosamente';

END $$;