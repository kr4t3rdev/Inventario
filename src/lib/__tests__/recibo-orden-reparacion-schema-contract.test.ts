import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');

/** Extracts a Prisma model block from the checked-in schema. */
function getModelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`^model ${modelName} \\{([\\s\\S]*?)^\\}`, 'm'));
  if (!match) throw new Error(`Prisma model not found: ${modelName}`);
  return match[1];
}

describe('ReciboOrdenReparacion Prisma schema contract', () => {
  it('preserves the historical receipt columns and defaults', () => {
    const recibo = getModelBlock('ReciboOrdenReparacion');
    const fields = recibo
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('@@'))
      .map((line) => line.match(/^(\w+)\s+/)?.[1])
      .filter((field): field is string => field !== undefined)
      .sort();

    expect(fields).toEqual([
      'clienteNombre',
      'createdAt',
      'equipoInfo',
      'estadoInicial',
      'fechaRecepcion',
      'fotosIniciales',
      'id',
      'numeroRecibo',
      'observaciones',
      'orden',
      'ordenId',
      'problema',
      'updatedAt',
    ]);
    expect(recibo).not.toMatch(/\btenantId\b|\bDecimal\b|@unique|^\s*@@/m);

    expect(recibo).toMatch(/^\s*id\s+String\s+@id @default\(cuid\(\)\)$/m);
    expect(recibo).toMatch(/^\s*numeroRecibo\s+Int\s+@default\(autoincrement\(\)\)$/m);
    expect(recibo).toMatch(/^\s*ordenId\s+String$/m);
    expect(recibo).toMatch(/^\s*clienteNombre\s+String$/m);
    expect(recibo).toMatch(/^\s*equipoInfo\s+String$/m);
    expect(recibo).toMatch(/^\s*problema\s+String$/m);
    expect(recibo).toMatch(/^\s*fechaRecepcion\s+DateTime\s+@default\(now\(\)\)$/m);
    expect(recibo).toMatch(/^\s*estadoInicial\s+String$/m);
    expect(recibo).toMatch(/^\s*fotosIniciales\s+String\[\]\s+@default\(\[\]\)$/m);
    expect(recibo).toMatch(/^\s*observaciones\s+String\?$/m);
    expect(recibo).toMatch(/^\s*createdAt\s+DateTime\s+@default\(now\(\)\)$/m);
    expect(recibo).toMatch(/^\s*updatedAt\s+DateTime\s+@updatedAt$/m);
  });

  it('keeps the cascading order relation and its inverse collection', () => {
    const recibo = getModelBlock('ReciboOrdenReparacion');
    const orden = getModelBlock('OrdenReparacion');

    expect(recibo).toMatch(
      /^\s*orden\s+OrdenReparacion\s+@relation\(fields: \[ordenId\], references: \[id\], onDelete: Cascade\)$/m,
    );
    expect(orden).toMatch(/^\s*recibos\s+ReciboOrdenReparacion\[\]$/m);
  });
});
