import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('pv-interface pricing guard', () => {
  it('no debe usar producto.precioVenta directo en POS', () => {
    const filePath = path.resolve(process.cwd(), 'src/components/ventas/pv-interface.tsx');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).not.toMatch(/producto\.precioVenta/);
  });
});
