/**
 * @description Renderiza diagramas Mermaid de forma lazy y respeta el tema oscuro/claro.
 * @param {{ chart: string }} props - Código del diagrama Mermaid
 * @returns {JSX.Element} Contenedor con el diagrama renderizado
 */
"use client"

import { useEffect, useRef, useState } from "react"

export function MermaidBlock({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let mounted = true
    async function render() {
      const { default: mermaid } = await import("mermaid")
      if (!mounted) return

      const isDark = document.documentElement.classList.contains("dark")
      mermaid.initialize({
        theme: isDark ? "dark" : "default",
        startOnLoad: false,
        securityLevel: "loose",
      })

      if (ref.current) {
        try {
          await mermaid.run({ nodes: [ref.current] })
          setIsLoaded(true)
        } catch {
          // Silently fail — raw code will show
        }
      }
    }
    render()
    return () => {
      mounted = false
    }
  }, [chart])

  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-border/50 bg-white/50 p-4 dark:bg-black/20">
      <div
        ref={ref}
        className="mermaid min-h-[60px]"
        style={{ opacity: isLoaded ? 1 : 0, transition: "opacity 0.2s" }}
      >
        {chart}
      </div>
    </div>
  )
}
