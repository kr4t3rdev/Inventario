import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    empleado: { findUnique: vi.fn(), update: vi.fn() },
    vacationAccrual: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { VacationAccrualService } from '../vacation-accrual-service';

function schemaModel(name: string): string {
  const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Missing Prisma model ${name}`);
  return match[1];
}

describe('fractional vacation accrual contract', () => {
  beforeEach(() => vi.resetAllMocks());

  it('keeps employee accumulated and used day totals as Float', () => {
    const employee = schemaModel('Empleado');
    expect(employee).toMatch(/vacationDaysAccrued\s+Float\s+@default\(0\)/);
    expect(employee).toMatch(/vacationDaysUsed\s+Float\s+@default\(0\)/);
  });

  it('keeps persisted accrual quantities fractional while seniority days remain integer', () => {
    const accrual = schemaModel('VacationAccrual');
    expect(accrual).toMatch(/diasAcumulados\s+Float/);
    expect(accrual).toMatch(/diasPorTiempoTrabajado\s+Float/);
    expect(accrual).toMatch(/diasPorAntiguedad\s+Int/);
  });

  it('persists and totals fractional accrual without rounding', async () => {
    const employee = {
      empleadoId: 'employee-1',
      fechaContratacion: new Date('2025-10-01T00:00:00.000Z'),
      vacationDaysAccrued: 0.5,
      nombre: 'Ana',
      apellido: 'Perez',
    };
    prismaMock.empleado.findUnique.mockResolvedValue(employee);
    prismaMock.vacationAccrual.findFirst.mockResolvedValue(null);
    prismaMock.vacationAccrual.create.mockImplementation(({ data }) => Promise.resolve({ accrualId: 'accrual-1', ...data }));
    prismaMock.empleado.update.mockResolvedValue({});

    const service = new VacationAccrualService({
      diasAnualesBase: 15,
      diasMaximosPorAntiguedad: 0,
      incrementoAnual: 0,
    });
    await service.calculateAccrualForEmployee('employee-1', new Date('2026-10-01T00:00:00.000Z'), '2026-10');

    expect(prismaMock.vacationAccrual.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ diasAcumulados: 1.25, diasPorTiempoTrabajado: 1.25 }),
    }));
    expect(prismaMock.empleado.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ vacationDaysAccrued: 1.75 }),
    }));
  });
});
