/**
 * @description Tests del enforcement compartido del límite de crédito (C-2):
 * `exigirLimiteCredito` reutiliza las reglas puras del CRM y el permiso
 * `ventas.venta.credito-override`; el caller audita el override.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { exigirLimiteCredito } from '@/features/crm/services/credito-enforcement';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

type ClientCredito = Parameters<typeof exigirLimiteCredito>[0]['client'];

function crearClient(cuentas: Array<Record<string, unknown>> = []) {
  const findCliente = vi.fn().mockResolvedValue({ clienteId: 'cli-1', limiteCredito: 1000 });
  const findCuentas = vi.fn().mockResolvedValue(cuentas);
  const client = {
    cliente: { findFirst: findCliente },
    cuentaPorCobrar: { findMany: findCuentas },
  } as unknown as ClientCredito;
  return { client, findCliente, findCuentas };
}

const managerUser = {
  userId: 'user-manager',
  name: 'Manager',
  email: 'manager@test.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'manager',
} as unknown as AuthenticatedUser;

const dependienteUser = {
  ...managerUser,
  userId: 'user-dependiente',
  tenantRole: 'dependiente',
} as unknown as AuthenticatedUser;

const base = {
  tenantId: 'tenant-test',
  clienteId: 'cli-1',
  user: managerUser,
};

describe('exigirLimiteCredito (C-2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin tope (null) pasa sin consultar CxC ni permiso', async () => {
    const { client, findCliente, findCuentas } = crearClient();
    findCliente.mockResolvedValue({ clienteId: 'cli-1', limiteCredito: null });

    const r = await exigirLimiteCredito({ ...base, client, montoRequerido: 5000 });

    expect(r).toMatchObject({ overrideUsado: false, limiteCredito: null });
    expect(findCuentas).not.toHaveBeenCalled();
  });

  it('montoRequerido 0 o negativo hace fast-path sin tocar la base', async () => {
    const { client, findCliente, findCuentas } = crearClient();

    const r = await exigirLimiteCredito({ ...base, client, montoRequerido: 0 });

    expect(r.overrideUsado).toBe(false);
    expect(findCliente).not.toHaveBeenCalled();
    expect(findCuentas).not.toHaveBeenCalled();
  });

  it('dentro del límite pasa sin override', async () => {
    const { client } = crearClient([
      { id: 'cxc-1', montoDeuda: 300, montoPagado: 0, estado: 'PENDIENTE' },
    ]);

    const r = await exigirLimiteCredito({ ...base, client, montoRequerido: 500 });

    expect(r).toMatchObject({ overrideUsado: false, saldoVivo: 300, limiteCredito: 1000 });
  });

  it('sobre el tope sin permiso lanza CREDITO_EXCEDIDO con saldo, requerido y límite', async () => {
    const { client } = crearClient([
      { id: 'cxc-1', montoDeuda: 900, montoPagado: 0, estado: 'PENDIENTE' },
    ]);

    await expect(
      exigirLimiteCredito({
        ...base,
        client,
        montoRequerido: 500,
        user: dependienteUser,
      }),
    ).rejects.toMatchObject({
      code: 'CREDITO_EXCEDIDO',
      message: expect.stringContaining('Saldo: 900, requerido: 500, límite: 1000'),
    });
  });

  it('sobre el tope con permiso retorna overrideUsado sin auditar (lo hace el caller)', async () => {
    const { client } = crearClient([
      { id: 'cxc-1', montoDeuda: 900, montoPagado: 0, estado: 'PENDIENTE' },
    ]);

    const r = await exigirLimiteCredito({ ...base, client, montoRequerido: 500 });

    expect(r.overrideUsado).toBe(true);
  });

  it('CxC ANULADA no cuenta en el saldo vivo', async () => {
    const { client } = crearClient([
      { id: 'cxc-1', montoDeuda: 900, montoPagado: 0, estado: 'ANULADA' },
    ]);

    const r = await exigirLimiteCredito({ ...base, client, montoRequerido: 500 });

    expect(r).toMatchObject({ overrideUsado: false, saldoVivo: 0 });
  });

  it('cuentaExcluidaId saca la cuenta propia del saldo; el requerido es el nuevo monto completo', async () => {
    // Límite 1000. Cuentas: propia 800 (la que se va a reemplazar) y otra 300.
    // Con exclusión: saldo vivo = 300; requerido nuevo = 700 → 1000 ≤ 1000 pasa (igualdad no bloquea).
    const { client } = crearClient([
      { id: 'cxc-propia', montoDeuda: 800, montoPagado: 0, estado: 'PENDIENTE' },
      { id: 'cxc-otra', montoDeuda: 300, montoPagado: 0, estado: 'PENDIENTE' },
    ]);

    const r = await exigirLimiteCredito({
      ...base,
      client,
      montoRequerido: 700,
      cuentaExcluidaId: 'cxc-propia',
    });

    expect(r).toMatchObject({ overrideUsado: false, saldoVivo: 300, limiteCredito: 1000 });
  });

  it('con exclusión, un requerido mayor al tope bloquea evaluando solo el saldo de terceros', async () => {
    const { client } = crearClient([
      { id: 'cxc-propia', montoDeuda: 800, montoPagado: 0, estado: 'PENDIENTE' },
      { id: 'cxc-otra', montoDeuda: 300, montoPagado: 0, estado: 'PENDIENTE' },
    ]);

    await expect(
      exigirLimiteCredito({
        ...base,
        client,
        montoRequerido: 900,
        cuentaExcluidaId: 'cxc-propia',
        user: dependienteUser,
      }),
    ).rejects.toMatchObject({
      code: 'CREDITO_EXCEDIDO',
      message: expect.stringContaining('Saldo: 300, requerido: 900, límite: 1000'),
    });
  });

  it('cliente de otro tenant lanza NOT_FOUND', async () => {
    const { client, findCliente } = crearClient();
    findCliente.mockResolvedValue(null);

    await expect(
      exigirLimiteCredito({ ...base, client, montoRequerido: 100 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
