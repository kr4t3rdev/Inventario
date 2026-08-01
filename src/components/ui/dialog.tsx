'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot='dialog' {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot='dialog-trigger' {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot='dialog-portal' {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot='dialog-close' {...props} />
}

type DialogOverlayProps = Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, "className" | "children"> & {
  className?: string
  children?: React.ReactNode
}

function DialogOverlay({ className, children, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      data-slot='dialog-overlay'
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[1px]',
        className
      )}
      {...(props as any)}
    >
      {children}
    </DialogPrimitive.Overlay>
  )
}

type DialogContentProps = Omit<React.ComponentProps<typeof DialogPrimitive.Content>, "children" | "onOpenAutoFocus" | "onCloseAutoFocus" | "className"> & {
  className?: string
  children?: React.ReactNode
  onOpenAutoFocus?: (event: Event) => void
  onCloseAutoFocus?: (event: Event) => void
}

function DialogContent({
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: DialogContentProps) {
  const hasExplicitDescription = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === DialogDescription
  )

  return (
    <DialogPortal data-slot='dialog-portal'>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot='dialog-content'
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border border-border/80 p-6 shadow-xl duration-200 sm:max-w-xl',
          'max-h-[calc(100dvh-2rem)] overflow-y-auto',
          className
        )}
        onOpenAutoFocus={(event: Event) => {
          onOpenAutoFocus?.(event)
        }}
        onCloseAutoFocus={(event: Event) => {
          onCloseAutoFocus?.(event)
        }}
        {...(props as any)}
      >
        {!hasExplicitDescription && (
          // @ts-expect-error -- Radix primitive types omit children but they're accepted at runtime
          <DialogPrimitive.Description className='sr-only'>
            Dialog content
          </DialogPrimitive.Description>
        )}
        {children}
        {/* @ts-expect-error -- Radix primitive types omit children but they're accepted at runtime */}
        <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-muted data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-md border border-transparent p-1 opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
          <XIcon />
          <span className='sr-only'>Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='dialog-header'
      className={cn('flex flex-col gap-2 border-b border-border/70 pb-3 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='dialog-footer'
      className={cn('flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

type DialogTitleProps = Omit<React.ComponentProps<typeof DialogPrimitive.Title>, "children"> & {
  className?: string
  children?: React.ReactNode
}

function DialogTitle({ className, children, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot='dialog-title'
      className={cn('text-lg leading-none font-semibold tracking-tight', className)}
      {...(props as any)}
    >
      {children}
    </DialogPrimitive.Title>
  )
}

type DialogDescriptionProps = Omit<React.ComponentProps<typeof DialogPrimitive.Description>, "children"> & {
  className?: string
  children?: React.ReactNode
}

function DialogDescription({ className, children, ...props }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot='dialog-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...(props as any)}
    >
      {children}
    </DialogPrimitive.Description>
  )
}

DialogDescription.displayName = 'DialogDescription'

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
