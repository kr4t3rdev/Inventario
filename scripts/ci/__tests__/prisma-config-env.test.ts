import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('prisma/config', () => ({ defineConfig: vi.fn((config: unknown) => config) }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('configuración Prisma con variables inyectadas por el despliegue', () => {
  it('permite generar el cliente sin archivo .env y conserva las URLs inyectadas', async () => {
    vi.resetModules();
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5114/config_test');
    vi.stubEnv('DIRECT_URL', 'postgresql://localhost:5114/config_direct_test');
    vi.spyOn(process, 'loadEnvFile').mockImplementation(() => {
      throw Object.assign(new Error('archivo ausente'), { code: 'ENOENT' });
    });
    const { default: config } = await import('../../../prisma.config');
    expect(config.datasource).toMatchObject({
      url: 'postgresql://localhost:5114/config_test',
      directUrl: 'postgresql://localhost:5114/config_direct_test',
    });
  });

  it('propaga errores de acceso distintos de un archivo ausente', async () => {
    vi.resetModules();
    const failure = Object.assign(new Error('acceso denegado'), { code: 'EACCES' });
    vi.spyOn(process, 'loadEnvFile').mockImplementation(() => { throw failure; });
    await expect(import('../../../prisma.config')).rejects.toBe(failure);
  });
});
