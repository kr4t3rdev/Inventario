import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const tenantId = "cmr0wejm40008t101cc3xt3gm";
  
  // Find existing records
  const categorias = await prisma.categoria.findMany({ where: { tenantId } });
  const unidades = await prisma.unidad.findMany({ where: { tenantId } });
  const almacenes = await prisma.almacen.findMany({ where: { tenantId } });
  const vendors = await prisma.vendor.findMany({ where: { tenantId } });
  
  console.log("Categorías:", categorias.map(c => c.nombre).join(", "));
  console.log("Unidades:", unidades.map(u => `${u.nombre} (${u.simbolo})`).join(", "));
  console.log("Almacenes:", almacenes.map(a => a.nombre).join(", "));
  console.log("Vendors:", vendors.map(v => v.nombre).join(", "));
  
  if (categorias.length === 0 || unidades.length === 0 || almacenes.length === 0) {
    console.error("Faltan datos maestros. Creando los necesarios...");
    await prisma.$disconnect();
    return;
  }
  
  const alimentosCat = categorias.find(c => c.nombre === "Alimentos")!;
  const bebidasCat = categorias.find(c => c.nombre === "Bebidas")!;
  const aseoCat = categorias.find(c => c.nombre === "Aseo y Limpieza")!;
  const kg = unidades.find(u => u.simbolo === "kg")!;
  const litro = unidades.find(u => u.simbolo === "L")!;
  const unidad = unidades.find(u => u.simbolo === "u")!;
  const almacen = almacenes[0]!;
  const vendor = vendors[0]!;
  
  const productos = [
    { nombre: "Arroz Diana", descripcion: "Arroz grano largo 1kg", codigoInterno: "ARR-001", precioCosto: 15.50, precioVenta: 22.00, stock: 100, stockMinimo: 10, categoriaId: alimentosCat.catId, unidadId: kg.unidadId, almacenId: almacen.almacenId, vendorId: vendor.vendorId },
    { nombre: "Aceite de Oliva", descripcion: "Aceite de oliva extra virgen 500ml", codigoInterno: "ACE-001", precioCosto: 45.00, precioVenta: 65.00, stock: 50, stockMinimo: 5, categoriaId: alimentosCat.catId, unidadId: litro.unidadId, almacenId: almacen.almacenId, vendorId: vendor.vendorId },
    { nombre: "Jugo de Naranja", descripcion: "Jugo de naranja natural 1L", codigoInterno: "JGO-001", precioCosto: 8.00, precioVenta: 12.00, stock: 80, stockMinimo: 10, categoriaId: bebidasCat.catId, unidadId: litro.unidadId, almacenId: almacen.almacenId, vendorId: vendor.vendorId },
    { nombre: "Detergente Líquido", descripcion: "Detergente líquido para ropa 1L", codigoInterno: "DTG-001", precioCosto: 25.00, precioVenta: 38.00, stock: 40, stockMinimo: 5, categoriaId: aseoCat.catId, unidadId: litro.unidadId, almacenId: almacen.almacenId, vendorId: vendor.vendorId },
    { nombre: "Refresco Cola", descripcion: "Refresco cola 355ml", codigoInterno: "REF-001", precioCosto: 5.00, precioVenta: 10.00, stock: 200, stockMinimo: 20, categoriaId: bebidasCat.catId, unidadId: unidad.unidadId, almacenId: almacen.almacenId, vendorId: vendor.vendorId },
  ];
  
  let count = 0;
  for (const p of productos) {
    const existing = await prisma.producto.findFirst({ 
      where: { tenantId, codigoInterno: p.codigoInterno } 
    });
    if (existing) {
      console.log(`  → ${p.nombre} ya existe, saltando`);
      continue;
    }
    await prisma.producto.create({
      data: { ...p, tenantId, fotos: [] }
    });
    console.log(`  ✅ ${p.nombre}`);
    count++;
  }
  
  console.log(`\n${count} producto(s) creado(s)`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error("ERROR:", e.message || e);
  process.exit(1);
});
