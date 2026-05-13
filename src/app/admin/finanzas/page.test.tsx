import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/admin', () => {
  throw new Error('La página no debe depender de server actions directas')
})

describe('/admin/finanzas page', () => {
  it('no importa server actions directas para obtener finanzas', async () => {
    await expect(import('./page')).resolves.toBeTruthy()
  })
})
