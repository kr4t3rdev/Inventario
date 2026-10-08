import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('actor del posteo de producción', () => {
  it('usa el usuario autenticado y no acepta identidad del body', () => {
    const source = readFileSync(
      'src/app/api/produccion/ordenes/[id]/completar/route.ts', 'utf8',
    );
    expect(source).not.toMatch(/body\.userId/);
    expect(source).not.toMatch(/\|\| 'system'/);
    expect(source).toMatch(/const userId = user\.userId;/);
  });
});
