/**
 * @description Sidebar móvil en forma de drawer deslizable.
 * @param {{ currentSlug?: string; open: boolean; onClose: () => void }} props
 * @returns {JSX.Element} Drawer de navegación móvil
 */
"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { DOC_DOMAINS } from "../data/domains"

export function DocsSidebarMobile({
  currentSlug,
  open,
  onClose,
}: {
  currentSlug?: string
  open: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (open) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={ref}
        className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-border/50 bg-background p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Navegación de documentación"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-mono font-semibold">Módulos</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Módulos">
          <Link
            href="/docs"
            onClick={onClose}
            className={`block rounded-md px-3 py-2 text-sm mb-2 transition-colors ${
              !currentSlug
                ? "bg-primary/10 font-semibold text-primary"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Índice General
          </Link>
          <Link
            href="/docs/modules"
            onClick={onClose}
            className="mb-2 block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          >
            Mapa de módulos
          </Link>

          {DOC_DOMAINS.map((domain) => (
            <div key={domain.name} className="mb-3">
              <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                {domain.icon} {domain.name}
              </h3>
              <ul className="mt-1 space-y-0.5">
                {domain.modules.map((mod) => {
                  const isActive = currentSlug === mod.slug
                  return (
                    <li key={mod.slug}>
                      <Link
                        href={`/docs/${mod.slug}`}
                        onClick={onClose}
                        className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                          isActive
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-muted-foreground hover:bg-muted/50"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {mod.title}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </>
  )
}
