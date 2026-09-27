'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateLimiteCreditoClienteAction } from '@/features/clientes/actions';

interface EditarLimiteCreditoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  limiteActual: number | null;
  onActualizado: (nuevoLimite: number | null) => void;
}

/**
 * @description Dialog para editar el límite de crédito del cliente (C-1).
 * Componente controlado: el disparador vive en la vista 360. El gate de
 * permiso lo aplica el servidor (`operaciones.clientes.limite-credito`);
 * ante `FORBIDDEN` se muestra el error vía toast y no se aplica el cambio.
 * @param {boolean} open - Controla la visibilidad del dialog.
 * @param {(open: boolean) => void} onOpenChange - Callback de apertura/cierre.
 * @param {string} clienteId - ID del cliente a editar.
 * @param {number | null} limiteActual - Límite vigente (null = sin tope).
 * @param {(nuevoLimite: number | null) => void} onActualizado - Callback con el valor persistido.
 * @returns {JSX.Element} Dialog de edición.
 */
export function EditarLimiteCreditoDialog({
  open,
  onOpenChange,
  clienteId,
  limiteActual,
  onActualizado,
}: EditarLimiteCreditoDialogProps): JSX.Element {
  const [valor, setValor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValor(limiteActual == null ? '' : String(limiteActual));
      setError(null);
    }
  }, [open, limiteActual]);

  /**
   * @description Valida el valor capturado: vacío = sin tope (null);
   * en caso contrario entero ≥ 0.
   * @returns {number | null} Valor válido o null si hay error (ya notificado).
   */
  const resolverValor = (): number | null | 'invalido' => {
    const limpio = valor.trim();
    if (limpio === '') return null;
    const n = Number(limpio);
    if (!Number.isInteger(n) || n < 0) {
      setError('Ingresa un número entero mayor o igual a 0, o deja el campo vacío para quitar el tope.');
      return 'invalido';
    }
    return n;
  };

  const guardar = async () => {
    setError(null);
    const nuevoLimite = resolverValor();
    if (nuevoLimite === 'invalido') return;
    setIsSaving(true);
    try {
      const r = await updateLimiteCreditoClienteAction({
        clienteId,
        limiteCredito: nuevoLimite,
      });
      if (r.success) {
        toast.success('Límite de crédito actualizado');
        onActualizado(r.data?.limiteCredito ?? nuevoLimite);
        onOpenChange(false);
      } else {
        toast.error(r.error?.message || 'No se pudo actualizar el límite de crédito');
      }
    } catch {
      toast.error('Error de red al actualizar el límite de crédito');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar límite de crédito</DialogTitle>
          <DialogDescription>
            Define el tope de deuda que este cliente puede acumular en ventas a crédito.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="limite-credito-input">Límite de crédito</Label>
          <Input
            id="limite-credito-input"
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            placeholder="Sin tope (campo vacío)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={isSaving}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={isSaving}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
