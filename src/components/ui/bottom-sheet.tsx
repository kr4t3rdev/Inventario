/**
 * @description Componente BottomSheet para mostrar detalles en dispositivos móviles
 * Proporciona una experiencia similar a las apps nativas para ver información adicional
 * @param props - Propiedades del componente
 * @returns Componente BottomSheet
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, ChevronUp, ChevronDown, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  snapPoints?: number[];
  defaultSnap?: number;
}

/**
 * @description Posiciones de snap predefinidas
 */
const DEFAULT_SNAP_POINTS = [0.25, 0.5, 0.75, 1];

/**
 * @description Componente BottomSheet para visualización en móvil
 */
export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className,
  snapPoints = DEFAULT_SNAP_POINTS,
  defaultSnap = 0.5,
}: BottomSheetProps): React.JSX.Element {
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startSnap, setStartSnap] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(false);

  // Cerrar con ESC
  useEffect(() => {
    const handle_esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handle_esc);
    return () => window.removeEventListener('keydown', handle_esc);
  }, [isOpen, onClose]);

  // Prevenir scroll del body cuando está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  /**
   * @description Calcula la posición Y basada en el snap point
   */
  const get_sheet_y = useCallback(
    (snap: number): number => {
      if (!sheetRef.current) return 0;
      const viewportHeight = window.innerHeight;
      return viewportHeight * (1 - snap);
    },
    []
  );

  /**
   * @description Maneja el inicio del arrastre
   */
  const handle_drag_start = useCallback((clientY: number): void => {
    setIsDragging(true);
    setStartY(clientY);
    setStartSnap(currentSnap);
  }, [currentSnap]);

  /**
   * @description Maneja el movimiento durante el arrastre
   */
  const handle_drag_move = useCallback(
    (clientY: number): void => {
      if (!isDragging || maximized) return;

      const diffY = clientY - startY;
      const diffSnap = diffY / window.innerHeight;

      let newSnap = startSnap - diffSnap;
      newSnap = Math.max(0, Math.min(1, newSnap));

      setCurrentSnap(newSnap);
    },
    [isDragging, startY, startSnap, maximized]
  );

  /**
   * @description Termina el arrastre y ajusta al snap point más cercano
   */
  const handle_drag_end = useCallback((): void => {
    if (!isDragging || maximized) {
      setIsDragging(false);
      return;
    }

    setIsDragging(false);

    // Encontrar el snap point más cercano
    const closestSnap = snapPoints.reduce((prev, curr) => {
      return Math.abs(curr - currentSnap) < Math.abs(prev - currentSnap)
        ? curr
        : prev;
    });

    setCurrentSnap(closestSnap);

    // Cerrar si se arrastró casi hasta el fondo
    if (currentSnap < 0.15) {
      onClose();
    }
  }, [isDragging, currentSnap, snapPoints, onClose, maximized]);

  /**
   * @description Calcula la posición de backdrop
   */
  const get_backdrop_translate = useCallback((): string => {
    return `translateY(${Math.max(0, (currentSnap - 1) * 100)}%)`;
  }, [currentSnap]);

  if (!isOpen) return <></>;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        style={{
          opacity: isDragging ? 1 : 0.5,
        }}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-xl transition-transform duration-300 ease-out',
          'max-h-[85vh] overflow-hidden flex flex-col',
          className
        )}
        style={{
          transform: `translateY(${get_sheet_y(currentSnap)}px)`,
          transition: isDragging ? 'none' : 'transform 300ms ease-out',
          height: maximized ? '100vh' : '85vh',
        }}
        onTouchStart={(e) => handle_drag_start(e.touches[0].clientY)}
        onTouchMove={(e) => handle_drag_move(e.touches[0].clientY)}
        onTouchEnd={handle_drag_end}
        onMouseDown={(e) => handle_drag_start(e.clientY)}
        onMouseMove={(e) => {
          if (isDragging) handle_drag_move(e.clientY);
        }}
        onMouseUp={handle_drag_end}
        onMouseLeave={handle_drag_end}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Bottom Sheet'}
      >
        {/* Handle de arrastre */}
        <div className="flex justify-center py-2 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 border-b">
          <div className="flex items-center gap-2">
            {title && (
              <h2 className="text-lg font-semibold">{title}</h2>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMaximized(!maximized)}
              aria-label={maximized ? 'Minimizar' : 'Maximizar'}
            >
              {maximized ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Indicadores de snap points */}
        {!maximized && snapPoints.length > 1 && (
          <div className="flex justify-center gap-1 py-1">
            {snapPoints.map((snap, index) => (
              <div
                key={index}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all',
                  Math.abs(snap - currentSnap) < 0.1
                    ? 'bg-primary'
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * @description Hook para gestionar el estado del BottomSheet
 */
export function useBottomSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<unknown>(null);

  const open = useCallback((data?: unknown) => {
    setData(data ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(null);
  }, []);

  return {
    isOpen,
    data,
    open,
    close,
  };
}

export type { BottomSheetProps };
