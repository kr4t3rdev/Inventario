import { describe, expect, it } from 'vitest';

import {
  buildProductoSalidaPayload,
  normalizeCreatedProducto,
} from '../producto-salida-form.helpers';

describe('producto-salida-form.helpers', () => {
  it('buildProductoSalidaPayload usa el proveedor derivado cuando EAN-13 está activo', () => {
    const payload = buildProductoSalidaPayload(
      {
        nombre: 'Jarabe 1L',
        descripcion: 'Producción interna',
        codigoInterno: '12345678901',
        categoriaId: 'cat-1',
        subcategoriaId: 'sub-1',
        precioCosto: 100,
        precioVenta: 140,
        stock: 0,
        stockMinimo: 2,
        unidadId: 'uni-1',
        almacenId: 'alm-1',
        vendorId: 'vendor-1',
      },
      {
        usaEan13: true,
        proveedorCodigo: '07',
      }
    );

    expect(payload).toMatchObject({
      proveedorCodigo: '07',
      vendorId: 'vendor-1',
      fotos: [],
      precios: [],
      categoriaId: 'cat-1',
      subcategoriaId: 'sub-1',
    });
  });

  it('buildProductoSalidaPayload limpia proveedorCodigo cuando EAN-13 está desactivado', () => {
    const payload = buildProductoSalidaPayload(
      {
        nombre: 'Jarabe 1L',
        descripcion: '',
        codigoInterno: '',
        categoriaId: 'cat-1',
        subcategoriaId: '',
        precioCosto: 100,
        precioVenta: 140,
        stock: 0,
        stockMinimo: 0,
        unidadId: 'uni-1',
        almacenId: 'alm-1',
        vendorId: '',
      },
      {
        usaEan13: false,
        proveedorCodigo: '07',
      }
    );

    expect(payload).toMatchObject({
      proveedorCodigo: null,
      codigoInterno: null,
      vendorId: null,
      subcategoriaId: null,
    });
  });

  it('normalizeCreatedProducto soporta respuestas envueltas y planas', () => {
    expect(
      normalizeCreatedProducto({
        producto: {
          id: 'prod-1',
          nombre: 'Jarabe 1L',
        },
      })
    ).toEqual({
      id: 'prod-1',
      nombre: 'Jarabe 1L',
    });

    expect(
      normalizeCreatedProducto({
        id: 'prod-2',
        nombre: 'Refresco 1L',
      })
    ).toEqual({
      id: 'prod-2',
      nombre: 'Refresco 1L',
    });
  });
});
