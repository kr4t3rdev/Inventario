"use client"

/**
 * @description Renderiza el contenido markdown de un módulo usando react-markdown.
 * Soporta Mermaid, tablas, código, y demás elementos GFM.
 * @param {{ content: string }} props - Contenido markdown a renderizar
 * @returns {JSX.Element} Contenido renderizado
 */
import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { motion } from "framer-motion"
import { MermaidBlock } from "./mermaid-block"

interface DocsContentProps {
  content: string
  lastUpdatedLabel?: string | null
}

export function DocsContent({ content, lastUpdatedLabel }: DocsContentProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 130, damping: 18, delay: 0.05 }}
      className="rounded-2xl border border-border/60 bg-card/85 p-5 shadow-sm backdrop-blur md:p-8"
    >
      {lastUpdatedLabel ? (
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
          Última actualización: {lastUpdatedLabel}
        </p>
      ) : null}
      <div
        className="prose prose-sm prose-zinc max-w-none dark:prose-invert md:prose-base
          prose-headings:font-mono prose-headings:tracking-tight
          prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4
          prose-h2:text-lg prose-h2:font-semibold prose-h2:border-b prose-h2:border-border/50 prose-h2:pb-2 prose-h2:mt-8
          prose-h3:text-base prose-h3:font-medium prose-h3:mt-6
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-normal
          prose-pre:bg-muted/80 prose-pre:border prose-pre:border-border/50
          prose-table:border-collapse prose-table:w-full
          prose-th:bg-muted/50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-sm prose-th:font-semibold
          prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:border-b prose-td:border-border/30
          prose-blockquote:border-l-primary prose-blockquote:bg-muted/20 prose-blockquote:py-1 prose-blockquote:px-4
          prose-img:rounded-lg prose-img:border prose-img:border-border/50
        "
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            code({ className, children, ...props }) {
              const isMermaid = className === "language-mermaid"
              const match = /language-(\w+)/.exec(className ?? "")
              const code = String(children).replace(/\n$/, "")

              if (isMermaid) {
                return <MermaidBlock chart={code} />
              }

              if (match) {
                return (
                  <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border/50 bg-muted/60 p-4 text-sm">
                    <div className="mb-2 text-xs font-mono text-muted-foreground">{match[1]}</div>
                    <pre className="!my-0 !border-0 !bg-transparent !p-0">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  </div>
                )
              }

              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            },
            // Make tables responsive
            table({ children }) {
              return (
                <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border/50">
                  <table className="min-w-full">{children}</table>
                </div>
              )
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </motion.article>
  )
}
