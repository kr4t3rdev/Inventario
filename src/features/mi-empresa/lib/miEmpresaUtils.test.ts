import { describe, expect, it } from 'vitest'

import {
  filterActiveCuentasBancarias,
  mapMiEmpresaApiToFormValues,
  normalizeMiEmpresaFormValues,
} from './miEmpresaUtils'

describe('miEmpresaUtils', () => {
  it('normaliza valores del formulario antes de enviarlos al servidor', () => {
    const result = normalizeMiEmpresaFormValues({
      nombre: '  Mi Empresa  ',
      propietario: ' ',
      direccion: '  Calle 123  ',
      telefono: '',
      email: '  info@empresa.com ',
      carnetIdentidad: ' 01010101010 ',
      nit: undefined,
      licenciaOperacion: '  LIC-001 ',
      logoUrl: '  https://cdn.example.com/logo.png  ',
      cuentaBancariaId: 'none',
      usaCodigoEan13: undefined,
    })

    expect(result).toEqual({
      nombre: 'Mi Empresa',
      propietario: null,
      direccion: 'Calle 123',
      telefono: null,
      email: 'info@empresa.com',
      carnetIdentidad: '01010101010',
      nit: null,
      licenciaOperacion: 'LIC-001',
      logoUrl: 'https://cdn.example.com/logo.png',
      cuentaBancariaId: null,
      usaCodigoEan13: false,
    })
  })

  it('convierte la respuesta API al shape del formulario', () => {
    const result = mapMiEmpresaApiToFormValues({
      nombre: 'Mi Empresa',
      propietario: null,
      direccion: 'Calle 1',
      telefono: null,
      email: 'info@empresa.com',
      carnetIdentidad: null,
      nit: '123',
      licenciaOperacion: null,
      logoUrl: null,
      cuentaBancariaId: 'cuenta-1',
      usaCodigoEan13: true,
    })

    expect(result).toEqual({
      nombre: 'Mi Empresa',
      propietario: '',
      direccion: 'Calle 1',
      telefono: '',
      email: 'info@empresa.com',
      carnetIdentidad: '',
      nit: '123',
      licenciaOperacion: '',
      logoUrl: '',
      cuentaBancariaId: 'cuenta-1',
      usaCodigoEan13: true,
    })
  })

  it('filtra solo las cuentas bancarias activas', () => {
    const result = filterActiveCuentasBancarias([
      { cuentaId: '1', nombreBanco: 'Banco 1', isActive: true },
      { cuentaId: '2', nombreBanco: 'Banco 2', isActive: false },
      { cuentaId: '3', nombreBanco: 'Banco 3' },
    ])

    expect(result).toEqual([
      { cuentaId: '1', nombreBanco: 'Banco 1', isActive: true },
      { cuentaId: '3', nombreBanco: 'Banco 3' },
    ])
  })
})
