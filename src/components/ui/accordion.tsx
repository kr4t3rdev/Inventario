'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * @description Acordeón simple y accesible para la landing page.
 *              Implementación manual sin Radix UI para evitar dependencias extra.
 */

/* ─── Context ─── */

interface AccordionContextValue {
  value: string | null;
  onValueChange: (value: string | null) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function useAccordion(): AccordionContextValue {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) throw new Error('Accordion components must be used within <Accordion>');
  return ctx;
}

/* ─── Accordion Root ─── */

interface AccordionProps {
  type: 'single' | 'multiple';
  collapsible?: boolean;
  className?: string;
  children: React.ReactNode;
}

function Accordion({ type, collapsible = false, className, children }: AccordionProps): React.JSX.Element {
  const [value, setValue] = React.useState<string | null>(null);

  const onValueChange = React.useCallback(
    (newValue: string | null) => {
      if (type === 'single') {
        if (collapsible) {
          setValue((prev) => (prev === newValue ? null : newValue));
        } else {
          setValue(newValue);
        }
      }
    },
    [type, collapsible],
  );

  return (
    <AccordionContext.Provider value={{ value, onValueChange }}>
      <div className={cn('space-y-2', className)} role="region">
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

/* ─── AccordionItem ─── */

interface AccordionItemProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

interface AccordionItemContextValue {
  value: string;
  triggerId: string;
  contentId: string;
}

function AccordionItem({ value, className, children }: AccordionItemProps): React.JSX.Element {
  const { value: openValue } = useAccordion();
  const isOpen = openValue === value;

  return (
    <div className={cn('', className)} data-state={isOpen ? 'open' : 'closed'} data-value={value}>
      {children}
    </div>
  );
}

/* ─── AccordionTrigger ─── */

interface AccordionTriggerProps {
  className?: string;
  children: React.ReactNode;
}

function AccordionTrigger({ className, children }: AccordionTriggerProps): React.JSX.Element {
  const { value, onValueChange } = useAccordion();
  const itemValue = React.useContext(AccordionItemContext);
  const isOpen = value === itemValue?.value;

  if (!itemValue) throw new Error('AccordionTrigger must be used within <AccordionItem>');

  return (
    <button
      type="button"
      onClick={() => onValueChange(itemValue.value)}
      className={cn(
        'flex w-full items-center justify-between py-4 text-left text-sm font-medium transition-all',
        'hover:underline [&[data-state=open]>svg]:rotate-180',
        className,
      )}
      data-state={isOpen ? 'open' : 'closed'}
      aria-expanded={isOpen}
      aria-controls={itemValue.contentId}
      id={itemValue.triggerId}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
    </button>
  );
}

/* ─── AccordionContent ─── */

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null);

interface AccordionContentProps {
  className?: string;
  children: React.ReactNode;
}

function AccordionContent({ className, children }: AccordionContentProps): React.JSX.Element {
  const { value } = useAccordion();
  const itemValue = React.useContext(AccordionItemContext);
  const isOpen = value === itemValue?.value;

  if (!itemValue) throw new Error('AccordionContent must be used within <AccordionItem>');

  return (
    <div
      className={cn(
        'overflow-hidden text-sm transition-all',
        isOpen ? 'max-h-96 pb-4' : 'max-h-0',
        className,
      )}
      data-state={isOpen ? 'open' : 'closed'}
      role="region"
      id={itemValue.contentId}
      aria-labelledby={itemValue.triggerId}
      hidden={!isOpen}
    >
      {children}
    </div>
  );
}

/* ─── Wrapper to provide item value via context ─── */

function AccordionItemWrapper({ value, className, children }: AccordionItemProps): React.JSX.Element {
  const instanceId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '-');
  const ids = React.useMemo(
    () => ({
      value,
      triggerId: `accordion-trigger-${instanceId}`,
      contentId: `accordion-content-${instanceId}`,
    }),
    [instanceId, value],
  );

  return (
    <AccordionItemContext.Provider value={ids}>
      <AccordionItem value={value} className={className}>
        {children}
      </AccordionItem>
    </AccordionItemContext.Provider>
  );
}

export {
  Accordion,
  AccordionItemWrapper as AccordionItem,
  AccordionTrigger,
  AccordionContent,
};
