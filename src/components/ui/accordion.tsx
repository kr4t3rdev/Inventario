'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface AccordionProps {
  type?: 'single' | 'multiple'
  className?: string
  children: React.ReactNode
}

interface AccordionItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

interface AccordionTriggerProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

interface AccordionContentProps {
  children: React.ReactNode
  className?: string
}

const AccordionContext = React.createContext<{
  openItems: Set<string>
  toggle: (value: string) => void
}>({ openItems: new Set(), toggle: () => {} })

function Accordion({ type = 'multiple', className, children }: AccordionProps) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(new Set())

  const toggle = React.useCallback((value: string) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        if (type === 'single') next.clear()
        next.add(value)
      }
      return next
    })
  }, [type])

  return (
    <AccordionContext.Provider value={{ openItems, toggle }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  )
}

function AccordionItem({ value, children, className }: AccordionItemProps) {
  const { openItems } = React.useContext(AccordionContext)
  const isOpen = openItems.has(value)

  return (
    <div className={cn('border-b', className)} data-state={isOpen ? 'open' : 'closed'}>
      {children}
    </div>
  )
}

function AccordionTrigger({ children, className, onClick }: AccordionTriggerProps) {
  const { toggle } = React.useContext(AccordionContext)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const item = (e.currentTarget.closest('[data-state]') as HTMLElement | null)
    const value = item?.getAttribute('data-value') ?? ''
    toggle(value)
    onClick?.()
  }

  return (
    <button
      className={cn(
        'flex flex-1 items-center justify-between w-full py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180',
        className
      )}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}

function AccordionContent({ children, className }: AccordionContentProps) {
  return (
    <div className={cn('overflow-hidden text-sm pb-4 pt-0', className)}>
      {children}
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }