import { PrismaClient } from '../src/generated/prisma';
import { calculateEan13CheckDigit } from '../src/lib/ean13-utils';

const prisma = new PrismaClient();

interface LegacyProductoRow {
  id: string;
  codigoNegocio: string | null;
  proveedorCodigo: string | null;
  idSeccionCodigo: string | null;
  especificoCodigo: string | null;
  surtidoCodigo: string | null;
  dcCodigo: string | null;
}

/**
 * @description Intenta extraer segmentos desde un código EAN13 ya existente.
 * @param {string} codigo - Código EAN13 completo.
 * @returns {{ proveedorCodigo: string; idSeccionCodigo: string; especificoCodigo: string; surtidoCodigo: string; dcCodigo: string; codigoNegocio: string } | null}
 */
function splitFromEan13(codigo: string) {
  if (!/^\d{13}$/.test(codigo)) return null;
  const base12 = codigo.slice(0, 12);
  const dc = codigo.slice(12);
  const calculated = calculateEan13CheckDigit(base12);
  if (dc !== calculated) return null;

  return {
    proveedorCodigo: base12.slice(0, 2),
    idSeccionCodigo: base12.slice(2, 4),
    especificoCodigo: base12.slice(4, 8),
    surtidoCodigo: base12.slice(8, 12),
    dcCodigo: dc,
    codigoNegocio: codigo,
  };
}

/**
 * @description Ejecuta el backfill de columnas EAN13 legacy cuando esas columnas existen físicamente en DB.
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  const requiredColumns = [
    'codigoNegocio',
    'proveedorCodigo',
    'idSeccionCodigo',
    'especificoCodigo',
    'surtidoCodigo',
    'dcCodigo',
  ];

  const existingColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'Producto'
  `;

  const existingSet = new Set(existingColumns.map((c) => c.column_name));
  const missing = requiredColumns.filter((col) => !existingSet.has(col));

  if (missing.length > 0) {
    console.warn(
      `[backfill-ean13-segments] Se omite ejecución: columnas no presentes en schema físico (${missing.join(', ')})`,
    );
    return;
  }

  const productos = await prisma.$queryRaw<LegacyProductoRow[]>`
    SELECT
      id,
      "codigoNegocio",
      "proveedorCodigo",
      "idSeccionCodigo",
      "especificoCodigo",
      "surtidoCodigo",
      "dcCodigo"
    FROM "Producto"
  `;

  const pendientes: string[] = [];
  let updated = 0;

  for (const p of productos) {
    if (
      p.proveedorCodigo &&
      p.idSeccionCodigo &&
      p.especificoCodigo &&
      p.surtidoCodigo &&
      p.dcCodigo
    ) {
      continue;
    }

    if (!p.codigoNegocio) {
      pendientes.push(p.id);
      continue;
    }

    const extracted = splitFromEan13(p.codigoNegocio);
    if (!extracted) {
      pendientes.push(p.id);
      continue;
    }

    await prisma.$executeRaw`
      UPDATE "Producto"
      SET
        "proveedorCodigo" = ${extracted.proveedorCodigo},
        "idSeccionCodigo" = ${extracted.idSeccionCodigo},
        "especificoCodigo" = ${extracted.especificoCodigo},
        "surtidoCodigo" = ${extracted.surtidoCodigo},
        "dcCodigo" = ${extracted.dcCodigo},
        "codigoNegocio" = ${extracted.codigoNegocio}
      WHERE id = ${p.id}
    `;
    updated += 1;
  }

  console.log(
    JSON.stringify(
      { total: productos.length, updated, pendientes: pendientes.length, pendientesIds: pendientes },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
