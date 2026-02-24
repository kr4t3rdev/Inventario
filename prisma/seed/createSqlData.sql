CREATE TABLE "Categoria" (
  "catId" VARCHAR PRIMARY KEY,
  "nombre" VARCHAR NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Unidad" (
  "unidadId" VARCHAR PRIMARY KEY,
  "nombre" VARCHAR NOT NULL,
  "simbolo" VARCHAR NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Vendor" (
  "vendorId" VARCHAR PRIMARY KEY,
  "nombre" VARCHAR NOT NULL,
  "contacto" VARCHAR,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Almacen" (
  "almacenId" VARCHAR PRIMARY KEY,
  "nombre" VARCHAR NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "PuntoDeVenta" (
  "pvId" VARCHAR PRIMARY KEY,
  "nombre" VARCHAR NOT NULL,
  "ubicacion" VARCHAR,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Producto" (
  "id" VARCHAR PRIMARY KEY,
  "nombre" VARCHAR NOT NULL,
  "descripcion" VARCHAR,
  "precioCosto" INT NOT NULL,
  "precioVenta" INT NOT NULL,
  "stock" INT NOT NULL,
  "categoriaId" VARCHAR NOT NULL,
  "unidadId" VARCHAR,
  "vendorId" VARCHAR NOT NULL,
  "almacenId" VARCHAR NOT NULL,
  "puntoDeVentaId" VARCHAR,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("catId") ON DELETE CASCADE,
  FOREIGN KEY ("unidadId") REFERENCES "Unidad"("unidadId") ON DELETE CASCADE,
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("vendorId") ON DELETE CASCADE,
  FOREIGN KEY ("almacenId") REFERENCES "Almacen"("almacenId") ON DELETE CASCADE,
  FOREIGN KEY ("puntoDeVentaId") REFERENCES "PuntoDeVenta"("pvId") ON DELETE CASCADE
);

CREATE TABLE "Venta" (
  "ventaId" VARCHAR PRIMARY KEY,
  "productoId" VARCHAR NOT NULL,
  "cantidad" INT NOT NULL,
  "total" INT,
  "puntoDeVentaId" VARCHAR NOT NULL,
  "empleadoId" VARCHAR,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE,
  FOREIGN KEY ("puntoDeVentaId") REFERENCES "PuntoDeVenta"("pvId"),
  FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("empleadoId")
);

CREATE TABLE "Merma" (
  "mermaId" VARCHAR PRIMARY KEY,
  "productoId" VARCHAR NOT NULL,
  "cantidad" INT NOT NULL,
  "motivo" VARCHAR,
  "costoTotal" INT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE
);

CREATE TABLE "Transferencia" (
  "transferenciaId" VARCHAR PRIMARY KEY,
  "productoId" VARCHAR NOT NULL,
  "cantidad" INT NOT NULL,
  "origenId" VARCHAR,
  "destinoId" VARCHAR,
  "puntoDeVentaOrigenId" VARCHAR,
  "puntoDeVentaDestinoId" VARCHAR,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE,
  FOREIGN KEY ("origenId") REFERENCES "Almacen"("almacenId"),
  FOREIGN KEY ("destinoId") REFERENCES "Almacen"("almacenId"),
  FOREIGN KEY ("puntoDeVentaOrigenId") REFERENCES "PuntoDeVenta"("pvId"),
  FOREIGN KEY ("puntoDeVentaDestinoId") REFERENCES "PuntoDeVenta"("pvId")
);

CREATE TABLE "User" (
  "userId" VARCHAR PRIMARY KEY,
  "name" VARCHAR NOT NULL,
  "email" VARCHAR UNIQUE NOT NULL,
  "password" VARCHAR NOT NULL,
  "role" VARCHAR DEFAULT 'regularUser' NOT NULL,
  "isActive" BOOLEAN DEFAULT TRUE NOT NULL,
  "avatar" VARCHAR,
  "activatedAt" TIMESTAMP,
  "expiresAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Notification" (
  "id" VARCHAR PRIMARY KEY,
  "title" VARCHAR NOT NULL,
  "message" VARCHAR NOT NULL,
  "type" VARCHAR DEFAULT 'info' NOT NULL,
  "isRead" BOOLEAN DEFAULT FALSE NOT NULL,
  "userId" VARCHAR NOT NULL,
  "prioridad" VARCHAR NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE
);

CREATE TABLE "Empleado" (
  "empleadoId" VARCHAR PRIMARY KEY,
  "nombre" VARCHAR NOT NULL,
  "apellido" VARCHAR NOT NULL,
  "telefono" VARCHAR,
  "cargo" VARCHAR NOT NULL,
  "salarioBases" INT NOT NULL,
  "periodo" VARCHAR NOT NULL,
  "bonificaciones" INT DEFAULT 0,
  "deducciones" INT DEFAULT 0,
  "horasExtras" INT DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "GastoCompra" (
  "gastoCompraId" VARCHAR PRIMARY KEY,
  "productoId" VARCHAR NOT NULL,
  "vendorId" VARCHAR NOT NULL,
  "cantidad" INT NOT NULL,
  "precioUnitario" INT NOT NULL,
  "total" INT NOT NULL,
  "fechaCompra" TIMESTAMP DEFAULT NOW(),
  "descripcion" VARCHAR,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE,
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("vendorId") ON DELETE CASCADE
);

CREATE TABLE "GastosServicios" (
  "gastoSId" VARCHAR PRIMARY KEY,
  "tipo" VARCHAR NOT NULL,
  "proveedor" VARCHAR NOT NULL,
  "monto" INT NOT NULL,
  "periodo" VARCHAR NOT NULL,
  "descripcion" VARCHAR,
  "isPagado" VARCHAR,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "ReporteFinanciero" (
  "reporteId" VARCHAR PRIMARY KEY,
  "periodo" VARCHAR NOT NULL,
  "tipoReporte" VARCHAR NOT NULL,
  "ingresosVentas" INT DEFAULT 0,
  "cantidadVentas" INT DEFAULT 0,
  "gastosCompras" INT DEFAULT 0,
  "gastosSalarios" INT DEFAULT 0,
  "gastosServicios" INT DEFAULT 0,
  "gastosMermas" INT DEFAULT 0,
  "gastosOtros" INT DEFAULT 0,
  "totalIngresos" INT DEFAULT 0,
  "totalGastos" INT DEFAULT 0,
  "utilidadBruta" INT DEFAULT 0,
  "utilidadNeta" INT DEFAULT 0,
  "margenUtilidad" INT DEFAULT 0,
  "fechaGeneracion" TIMESTAMP DEFAULT NOW(),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);