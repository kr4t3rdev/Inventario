"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...(props as any)}
    >
      {children}
    </AvatarPrimitive.Root>
  )
}

function AvatarImage({
  className,
  children,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { children?: React.ReactNode }) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...(props as any)}
    >
      {children}
    </AvatarPrimitive.Image>
  )
}

function AvatarFallback({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...(props as any)}
    >
      {children}
    </AvatarPrimitive.Fallback>
  )
}

export { Avatar, AvatarImage, AvatarFallback }
