'use client';

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { dismissReviewPromptAction, submitReviewAction } from '@/features/reviews/actions';
import { ReviewStars } from '@/features/reviews/components/review-stars';

/**
 * @description Dialog de calificación del sistema. Aparece para usuarios activos
 *              sin reseña previa. Ofrece calificación 1-5 y comentario opcional.
 * @param {{ open: boolean; onClose: () => void; onSubmitted?: () => void }} props
 * @returns {JSX.Element} Modal de reseña
 */
export function ReviewDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}): React.JSX.Element {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: 'Seleccioná una calificación', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitReviewAction({
        rating,
        comment: comment.trim() || undefined,
      });

      if (!result.success) {
        toast({
          title: result.error?.message || 'No se pudo enviar tu reseña',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: '¡Gracias por tu reseña! Será visible tras revisión.' });
      onSubmitted?.();
      onClose();
    } catch {
      toast({ title: 'Error al enviar reseña', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissReviewPromptAction(undefined);
    } catch {
      // silencioso — no es crítico
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl">¿Cómo calificás tu experiencia?</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Tu opinión nos ayuda a mejorar FinanceMDM para todos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <ReviewStars
            rating={rating}
            size="lg"
            interactive
            onChange={setRating}
          />

          <Textarea
            placeholder="Contanos qué te gusta o qué te gustaría mejorar..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[80px] resize-none"
            maxLength={500}
          />

          <p className="self-end text-xs text-muted-foreground font-mono">
            {comment.length}/500
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleDismiss} disabled={isSubmitting}>
            Ahora no
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
            {isSubmitting ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
