'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmSalesAgentPayoutAction } from '@/features/sales-agent/actions';

export interface SalesAgentPayoutTarget {
  userId: string;
  name: string;
  phone: string | null;
  availableUsd: number;
}

interface SalesAgentPayoutDialogProps {
  open: boolean;
  agent: SalesAgentPayoutTarget | null;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void | Promise<void>;
}

/**
 * @description Diálogo compartido para confirmar un payout presencial en CUP.
 * @param {SalesAgentPayoutDialogProps} props - Gestor, apertura y callbacks.
 * @returns {React.JSX.Element} Formulario con preview no autoritativo.
 */
export function SalesAgentPayoutDialog({
  open,
  agent,
  onOpenChange,
  onConfirmed,
}: SalesAgentPayoutDialogProps): React.JSX.Element {
  const [amountUsd, setAmountUsd] = useState('');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const preview = useMemo(() => Number(amountUsd) * Number(rate) || 0, [amountUsd, rate]);
  const amountExceedsBalance = Number(amountUsd) > (agent?.availableUsd ?? 0);

  useEffect(() => {
    if (open && idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    if (!open) {
      idempotencyKeyRef.current = null;
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [open]);

  const submit = async () => {
    if (!agent || submittingRef.current) return;
    const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await confirmSalesAgentPayoutAction({
        userId: agent.userId,
        amountUsd: Number(amountUsd),
        exchangeRateCupPerUsd: Number(rate),
        notes: notes || undefined,
        idempotencyKey,
      });
      if (!result.success) {
        toast.error(result.error?.message ?? 'No se pudo confirmar el pago');
        return;
      }
      idempotencyKeyRef.current = null;
      toast.success(`Pago confirmado: ${result.data?.amountCup} CUP`);
      onOpenChange(false);
      await onConfirmed();
    } catch {
      toast.error('No se pudo confirmar el pago');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar pago</DialogTitle>
          <DialogDescription>
            {agent?.name} · {agent?.phone ?? 'Sin teléfono'} · Disponible USD{' '}
            {agent?.availableUsd.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="sales-agent-payout-amount">Monto USD</Label>
              <Input id="sales-agent-payout-amount" type="number" min="0.01" step="0.01"
                value={amountUsd} onChange={(event) => setAmountUsd(event.target.value)} />
            </div>
            <Button type="button" variant="outline"
              onClick={() => setAmountUsd(String(agent?.availableUsd ?? 0))}>
              Usar saldo total
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sales-agent-payout-rate">Tasa CUP/USD</Label>
            <Input id="sales-agent-payout-rate" type="number" min="0.0001" step="0.0001"
              value={rate} onChange={(event) => setRate(event.target.value)} />
          </div>
          <p className="rounded-md bg-muted p-3 font-medium">
            Preview: {preview.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} CUP
          </p>
          <div className="space-y-2">
            <Label htmlFor="sales-agent-payout-notes">Notas</Label>
            <Input id="sales-agent-payout-notes" maxLength={500} value={notes}
              onChange={(event) => setNotes(event.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            El servidor volverá a validar saldo, identidad y conversión al confirmar.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={submit}
            disabled={submitting || Number(amountUsd) <= 0 || Number(rate) <= 0 || amountExceedsBalance}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
