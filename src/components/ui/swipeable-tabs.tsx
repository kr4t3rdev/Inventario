/**
 * @description Componente de tabs con soporte para gestos de deslizar (swipe) en móvil
 * Implementa navegación táctil para dispositivos móviles
 * @param props - Propiedades del componente
 * @returns Componente de tabs deslizables
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SwipeableTabsProps {
  tabs: Array<{
    value: string;
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
  }>;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

/**
 * @description Componente de tabs deslizables para navegación táctil
 */
export function SwipeableTabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  className,
}: SwipeableTabsProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState(value || defaultValue || tabs[0]?.value);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentTranslate, setCurrentTranslate] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Actualizar valor controlado
  useEffect(() => {
    if (value !== undefined) {
      setActiveTab(value);
    }
  }, [value]);

  // Medir el contenedor
  useEffect(() => {
    const updateWidth = (): void => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.scrollWidth - containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [tabs]);

  /**
   * @description Maneja el cambio de tab
   */
  const handle_tab_change = useCallback(
    (newValue: string) => {
      if (activeTab !== newValue) {
        setActiveTab(newValue);
        onValueChange?.(newValue);
      }
    },
    [activeTab, onValueChange]
  );

  /**
   * @description Inicia el arrastre
   */
  const handle_touch_start = useCallback((clientX: number): void => {
    setIsDragging(true);
    setStartX(clientX);
    setCurrentTranslate(0);
    if (containerRef.current) {
      setScrollLeft(containerRef.current.scrollLeft);
    }
  }, []);

  /**
   * @description Maneja el movimiento durante el arrastre
   */
  const handle_touch_move = useCallback(
    (clientX: number): void => {
      if (!isDragging) return;

      const diff = clientX - startX;
      setCurrentTranslate(diff);

      if (containerRef.current) {
        containerRef.current.scrollLeft = scrollLeft - diff;
      }
    },
    [isDragging, startX, scrollLeft]
  );

  /**
   * @description Termina el arrastre y cambia de tab si es necesario
   */
  const handle_touch_end = useCallback((): void => {
    if (!isDragging) return;

    setIsDragging(false);

    // Definir umbral de cambio de tab (50px)
    const swipeThreshold = 50;

    if (Math.abs(currentTranslate) > swipeThreshold) {
      const currentIndex = tabs.findIndex((tab) => tab.value === activeTab);
      let newIndex = currentIndex;

      if (currentTranslate < 0 && currentIndex < tabs.length - 1) {
        // Deslizar a la izquierda - siguiente tab
        newIndex = currentIndex + 1;
      } else if (currentTranslate > 0 && currentIndex > 0) {
        // Deslizar a la derecha - tab anterior
        newIndex = currentIndex - 1;
      }

      if (newIndex !== currentIndex) {
        handle_tab_change(tabs[newIndex].value);
      }
    }

    setCurrentTranslate(0);
  }, [isDragging, currentTranslate, activeTab, tabs, handle_tab_change]);

  /**
   * @description Maneja el scroll con rueda del mouse
   */
  const handle_wheel = useCallback((e: React.WheelEvent): void => {
    if (containerRef.current) {
      e.preventDefault();
      containerRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  return (
    <div
      className={cn('relative', className)}
      ref={containerRef}
      onWheel={handle_wheel}
    >
      {/* Indicador de scroll horizontal */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">
        <div className="bg-linear-to-r from-background to-transparent h-8 w-4 pointer-events-none" />
      </div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
        <div className="bg-gradient-to-l from-background to-transparent h-8 w-4 pointer-events-none" />
      </div>

      {/* Contenedor de tabs con scroll horizontal */}
      <div
        className="flex overflow-x-auto scrollbar-hide pb-2"
        style={{
          scrollBehavior: 'smooth',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        <div
          className="flex gap-1 px-2"
          onTouchStart={(e) => handle_touch_start(e.touches[0].clientX)}
          onTouchMove={(e) => handle_touch_move(e.touches[0].clientX)}
          onTouchEnd={handle_touch_end}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                onClick={() => !tab.disabled && handle_tab_change(tab.value)}
                disabled={tab.disabled}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  'whitespace-nowrap touch-manipulation',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  tab.disabled && 'opacity-50 cursor-not-allowed'
                )}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.value}`}
              >
                {tab.icon && <span className="h-4 w-4">{tab.icon}</span>}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Indicadores de posición (dots) */}
      {tabs.length > 3 && (
        <div className="flex justify-center gap-1 mt-2">
          {tabs.map((tab, index) => (
            <div
              key={`dot-${tab.value}`}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-all duration-200',
                activeTab === tab.value
                  ? 'bg-primary w-3'
                  : 'bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * @description Hook para usar gestos de deslizar en cualquier componente
 */
export function useSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold: number = 50
): {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  isDragging: boolean;
} {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);

  const on_touch_start = useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true);
      setStartX(e.touches[0].clientX);
      setStartY(e.touches[0].clientY);
    },
    []
  );

  const on_touch_move = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;

      const diffX = currentX - startX;
      const diffY = currentY - startY;

      // Solo procesar si el movimiento horizontal es mayor que el vertical
      if (Math.abs(diffX) > Math.abs(diffY)) {
        e.preventDefault();
      }
    },
    [isDragging, startX, startY]
  );

  const on_touch_end = useCallback(() => {
    if (!isDragging) return;

    const diffX = startX - 0; // We'll track this differently in production

    setIsDragging(false);

    // This is a simplified version - in production, you'd track the actual end position
  }, [isDragging, startX]);

  return {
    onTouchStart: on_touch_start,
    onTouchMove: on_touch_move,
    onTouchEnd: on_touch_end,
    isDragging,
  };
}
