'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategorias } from '@/features/categorias/hooks/use-categorias';
import { useGetUnidadesQuery } from '@/features/unidades/api/unidadesApi';
import { useGetAlmacenesQuery } from '@/features/almacenes/api/almacenesApi';
import { useGetVendorsQuery } from '@/features/vendors/api/vendorsApi';
import { getAuthToken } from '@/lib/token';

interface ProductoSalidaFormValues {
  nombre: string;
  descripcion: string;
  codigoInterno: string;
  categoriaId: string;
  subcategoriaId: string;
  precioCosto: number;
  precioVenta: number;
  stock: number;
  stockMinimo: number;
  unidadId: string;
  almacenId: string;
  vendorId: string;
}

function buildProductoSalidaPayload(values: ProductoSalidaFormValues, _opts: { usaEan13: boolean; proveedorCodigo: string | null }) {
  return {
    nombre: values.nombre,
    descripcion: values.descripcion,
    codigoInterno: values.codigoInterno || undefined,
    categoriaId: values.categoriaId,
    subcategoriaId: values.subcategoriaId || undefined,
    precioCosto: values.precioCosto,
    precioVenta: values.precioVenta,
    stock: values.stock,
    stockMinimo: values.stockMinimo,
    unidadId: values.unidadId,
    almacenId: values.almacenId,
    vendorId: values.vendorId || undefined,
  };
}

function normalizeCreatedProducto(response: unknown): { id: string; nombre: string } {
  const data = response as any;
  const producto = data?.producto ?? data;
  return { id: producto?.id ?? '', nombre: producto?.nombre ?? '' };
}

interface ProductoSalidaFormProps {
  onCancel?: () => void;
  onSuccess: (product: { id: string; nombre: string }) => void;
}

const INITIAL_VALUES: ProductoSalidaFormValues = {
  nombre: '',
  descripcion: '',
  codigoInterno: '',
  categoriaId: '',
  subcategoriaId: '',
  precioCosto: 0,
  precioVenta: 0,
  stock: 0,
  stockMinimo: 0,
  unidadId: '',
  almacenId: '',
  vendorId: '',
};

/**
 * @description Formulario compacto para crear un producto final de producción reutilizando el contrato del catálogo.
 * @param {ProductoSalidaFormProps} props - Callbacks del formulario inline.
 * @returns {JSX.Element} Formulario embebible para crear productos.
 */
export function ProductoSalidaForm({
  onCancel,
  onSuccess,
}: ProductoSalidaFormProps): JSX.Element {
  const [values, setValues] = useState<ProductoSalidaFormValues>(INITIAL_VALUES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usaEan13, setUsaEan13] = useState(false);

  const { categorias: allCategorias } = useCategorias();
  const categorias = allCategorias;
  const subcategorias = React.useMemo(() => {
    return allCategorias.filter((cat) => cat.parentId === values.categoriaId);
  }, [allCategorias, values.categoriaId]);
  const { data: unidades = [] } = useGetUnidadesQuery();
  const { data: almacenes = [] } = useGetAlmacenesQuery();
  const { data: vendors = [] } = useGetVendorsQuery();

  useEffect(() => {
    const token = getAuthToken();
    fetch('/api/mi-empresa', {
      headers: token ? { Authorization: token } : undefined,
      cache: 'no-store',
    })
      .then((response) => response.json())
      .then((data) => setUsaEan13(data?.usaCodigoEan13 ?? false))
      .catch(() => setUsaEan13(false));
  }, []);

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.vendorId === values.vendorId),
    [vendors, values.vendorId]
  );

  const updateField = <K extends keyof ProductoSalidaFormValues>(
    field: K,
    _fieldValue: ProductoSalidaFormValues[K]
  ) => {
    setValues((current: ProductoSalidaFormValues) => ({ ...current, [field]: _fieldValue }));
  };

  const validate = (): boolean => {
    if (!values.nombre.trim()) {
      toast.error('El nombre del producto es obligatorio.');
      return false;
    }
    if (!values.categoriaId || !values.unidadId || !values.almacenId) {
      toast.error('Categoría, unidad y almacén son obligatorios.');
      return false;
    }
    if (values.precioCosto <= 0 || values.precioVenta <= 0) {
      toast.error('Los precios deben ser mayores que cero.');
      return false;
    }
    if (usaEan13 && !values.vendorId) {
      toast.error('Seleccioná un proveedor para generar el EAN-13.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const payload = buildProductoSalidaPayload(values, {
        usaEan13,
        proveedorCodigo: selectedVendor?.vendorCode ?? null,
      });

      const result = await createProductoAction(payload as any)
      if (!result.success) {
        throw new Error(result.error?.message || 'Error al crear producto')
      }
      const producto = normalizeCreatedProducto(result.data)

      toast.success('Producto creado y asociado a la receta.');
      onSuccess(producto);
      setValues(INITIAL_VALUES);
    } catch (error: any) {
      toast.error(error?.data?.error || 'No se pudo crear el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='grid gap-2'>
        <Label htmlFor='producto-salida-nombre'>Nombre</Label>
        <Input
          id='producto-salida-nombre'
          onChange={(event) => updateField('nombre', event.target.value)}
          placeholder='Ej: Refresco Instantáneo 1L'
          value={values.nombre}
        />
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='producto-salida-descripcion'>Descripción</Label>
        <Input
          id='producto-salida-descripcion'
          onChange={(event) => updateField('descripcion', event.target.value)}
          placeholder='Descripción corta'
          value={values.descripcion}
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-2'>
          <Label>Categoría</Label>
          <Select
            onValueChange={(value) => {
              updateField('categoriaId', value);
              updateField('subcategoriaId', '');
            }}
            value={values.categoriaId}
          >
            <SelectTrigger>
              <SelectValue placeholder='Seleccionar categoría' />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((categoria) => (
                <SelectItem key={categoria.catId} value={categoria.catId}>
                  {categoria.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-2'>
          <Label>Subcategoría</Label>
          <Select
            disabled={!values.categoriaId}
            onValueChange={(value) => updateField('subcategoriaId', value)}
            value={values.subcategoriaId || ''}
          >
            <SelectTrigger>
              <SelectValue placeholder='Seleccionar subcategoría' />
            </SelectTrigger>
            <SelectContent>
              {subcategorias.map((subcategoria) => (
                <SelectItem key={subcategoria.catId} value={subcategoria.catId}>
                  {subcategoria.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-2'>
          <Label htmlFor='producto-salida-precio-costo'>Precio costo</Label>
          <Input
            id='producto-salida-precio-costo'
            min={1}
            onChange={(event) => updateField('precioCosto', Number(event.target.value || 0))}
            type='number'
            value={values.precioCosto || ''}
          />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='producto-salida-precio-venta'>Precio venta</Label>
          <Input
            id='producto-salida-precio-venta'
            min={1}
            onChange={(event) => updateField('precioVenta', Number(event.target.value || 0))}
            type='number'
            value={values.precioVenta || ''}
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-2'>
          <Label>Unidad</Label>
          <Select onValueChange={(value) => updateField('unidadId', value)} value={values.unidadId}>
            <SelectTrigger>
              <SelectValue placeholder='Seleccionar unidad' />
            </SelectTrigger>
            <SelectContent>
              {unidades.map((unidad) => (
                <SelectItem key={unidad.unidadId} value={unidad.unidadId}>
                  {unidad.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-2'>
          <Label>Almacén</Label>
          <Select onValueChange={(value) => updateField('almacenId', value)} value={values.almacenId}>
            <SelectTrigger>
              <SelectValue placeholder='Seleccionar almacén' />
            </SelectTrigger>
            <SelectContent>
              {almacenes.map((almacen) => (
                <SelectItem key={almacen.almacenId} value={almacen.almacenId}>
                  {almacen.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-2'>
          <Label htmlFor='producto-salida-stock'>Stock inicial</Label>
          <Input
            id='producto-salida-stock'
            min={0}
            onChange={(event) => updateField('stock', Number(event.target.value || 0))}
            type='number'
            value={values.stock}
          />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='producto-salida-stock-minimo'>Stock mínimo</Label>
          <Input
            id='producto-salida-stock-minimo'
            min={0}
            onChange={(event) => updateField('stockMinimo', Number(event.target.value || 0))}
            type='number'
            value={values.stockMinimo}
          />
        </div>
      </div>

      <div className='grid gap-2'>
        <Label>Proveedor</Label>
        <Select onValueChange={(value) => updateField('vendorId', value)} value={values.vendorId || ''}>
          <SelectTrigger>
            <SelectValue placeholder='Seleccionar proveedor' />
          </SelectTrigger>
          <SelectContent>
            {vendors.map((vendor) => (
              <SelectItem key={vendor.vendorId} value={vendor.vendorId}>
                {vendor.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='flex justify-end gap-2'>
        {onCancel ? (
          <Button onClick={onCancel} type='button' variant='outline'>
            Cancelar
          </Button>
        ) : null}
        <Button disabled={isSubmitting} onClick={handleSubmit} type='button'>
          Crear producto
        </Button>
      </div>
    </div>
  );
}
