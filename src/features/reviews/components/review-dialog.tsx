'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { dismissReviewPromptAction, submitReviewAction } from '@/features/reviews/actions';
import { ReviewStars } from '@/features/reviews/components/review-stars';

/**
 * @description Panel de calificación del sistema para usuarios activos sin reseña.
 *              Anteriormente era un Dialog modal que bloqueaba la app al entrar a
 *              cualquier página de /busy; ahora es un panel flotante no-modal en la
 *              esquina inferior derecha que no interrumpe el trabajo (se cierra con
 *              Escape, "Ahora no" o al enviar). La cadencia (máx. 1 prompt/día) la
 *              controla canPromptReviewAction en el servidor.
 * @param {{ open: boolean; onClose: () => void; onSubmitted?: () => void }} props
 * @returns {JSX.Element | null} Panel flotante de reseña o null si está cerrado
 */
export function ReviewDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}): React.JSX.Element | null {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Selecciona una calificación');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitReviewAction({
        rating,
        comment: comment.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error?.message || 'No se pudo enviar tu reseña');
        return;
      }

      toast.success('¡Gracias por tu reseña! Será visible tras revisión.');
      onSubmitted?.();
      onClose();
    } catch {
      toast.error('Error al enviar reseña');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = useCallback(async () => {
    try {
      await dismissReviewPromptAction(undefined);
    } catch {
      // silencioso — no es crítico
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void handleDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, handleDismiss]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="review-dialog-title"
      className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border bg-background p-5 shadow-lg animate-in fade-in-0 slide-in-from-bottom-4 duration-200"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-1 pr-8">
        <h2 id="review-dialog-title" className="font-mono text-lg font-semibold">
          ¿Cómo calificas tu experiencia?
        </h2>
        <p className="text-sm text-muted-foreground">
          Tu opinión nos ayuda a mejorar FinanceMDM para todos.
        </p>
      </div>

      <div className="flex flex-col gap-4 py-2">
        <ReviewStars
          rating={rating}
          size="lg"
          interactive
          onChange={setRating}
        />

        <Textarea
          placeholder="Cuéntanos qué te gusta o qué te gustaría mejorar..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="min-h-[72px] resize-none"
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
    </div>
  );
}
