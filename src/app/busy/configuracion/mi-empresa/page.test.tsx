import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/mi-empresa/server/data', () => ({
  getMiEmpresaPageData: vi.fn().mockResolvedValue({ miEmpresa: null, cuentas: [] }),
}));
vi.mock('@/lib/server-actions', () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/services/tenant-scope', () => ({ hasFeature: vi.fn().mockReturnValue(false) }));
vi.mock('@/features/facturas/actions-fiscal-config', () => ({ getFiscalConfigAction: vi.fn() }));
vi.mock('@/features/facturas/components/fiscal-config-form', () => ({ FiscalConfigForm: () => null }));
vi.mock('@/features/mi-empresa/components/mi-empresa-form', () => ({ MiEmpresaForm: () => null }));

import MiEmpresaConfigPage from './page';

describe('Mi Empresa server-to-client boundary', () => {
  it('keeps the icon component on the client side', async () => {
    const page = await MiEmpresaConfigPage();
    expect(page.props).not.toHaveProperty('icon');
    expect(page.type.name).toBe('MiEmpresaPageShell');
  });
});
