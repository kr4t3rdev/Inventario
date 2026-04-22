import { describe, expect, it } from 'vitest'

import { formatAnticipoCliente, formatAnticipoProveedor } from '../anticipos-columns'

describe('anticipos columns display helpers', () => {
  it('muestra el nombre del cliente cuando viene embebido', () => {
    expect(
      formatAnticipoCliente({
        clienteId: 'cli-1',
        cliente: { clienteId: 'cli-1', nombre: 'Cliente Demo' },
      })
    ).toBe('Cliente Demo')
  })

  it('muestra el nombre del proveedor cuando viene embebido', () => {
    expect(
      formatAnticipoProveedor({
        proveedorId: 'prov-1',
        proveedor: { vendorId: 'prov-1', nombre: 'Proveedor Demo' },
      })
    ).toBe('Proveedor Demo')
  })
})
