'use client';

import React, { useState } from 'react';
import type { JSX } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { ProductoSalidaForm } from './producto-salida-form';

export type RecipeOutputMode = 'existing' | 'create';

interface RecipeOutputSelectorProps {
  createdProductName: string | null;
  onCreatedProduct: (product: { id: string; nombre: string }) => void;
  onModeChange: (mode: RecipeOutputMode) => void;
  onProductChange: (productId: string) => void;
  products: Array<{ id: string; nombre: string }>;
  selectedMode: RecipeOutputMode;
  selectedProductId: string;
}

/**
 * @description Selector de producto final para recetas de producción.
 * @param {RecipeOutputSelectorProps} props - Estado y callbacks del selector.
 * @returns {JSX.Element} Controles para elegir o crear el producto de salida.
 */
export function RecipeOutputSelector({
  createdProductName,
  onCreatedProduct,
  onModeChange,
  onProductChange,
  products,
  selectedMode,
  selectedProductId,
}: RecipeOutputSelectorProps): JSX.Element {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className='grid gap-3'>
      <Label>Producto final de salida</Label>

      <div className='flex gap-2'>
        <Button
          onClick={() => onModeChange('existing')}
          type='button'
          variant={selectedMode === 'existing' ? 'default' : 'outline'}
        >
          Usar producto existente
        </Button>
        <Button
          onClick={() => onModeChange('create')}
          type='button'
          variant={selectedMode === 'create' ? 'default' : 'outline'}
        >
          Crear producto nuevo
        </Button>
      </div>

      {selectedMode === 'existing' ? (
        <Select onValueChange={onProductChange} value={selectedProductId}>
          <SelectTrigger>
            <SelectValue placeholder='Seleccionar producto final' />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className='space-y-2 rounded-md border p-3'>
          {createdProductName ? (
            <p className='text-sm text-muted-foreground'>
              Producto creado y asociado: <strong>{createdProductName}</strong>
            </p>
          ) : (
            <p className='text-sm text-muted-foreground'>
              Creá el producto final y quedará asociado automáticamente a la receta.
            </p>
          )}
          <Button onClick={() => setIsDialogOpen(true)} type='button' variant='secondary'>
            Abrir formulario de producto
          </Button>
        </div>
      )}

      <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Nuevo producto final</DialogTitle>
            <DialogDescription>
              Registrá el producto en catálogo y lo asociamos automáticamente a la receta.
            </DialogDescription>
          </DialogHeader>
          <ProductoSalidaForm
            onCancel={() => setIsDialogOpen(false)}
            onSuccess={(product) => {
              onProductChange(product.id);
              onCreatedProduct(product);
              setIsDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
