"use client"

/**
 * @description Renderiza el contenido markdown de un módulo usando react-markdown.
 * Cada elemento HTML tiene sus propias clases Tailwind — no depende de @tailwindcss/typography.
 * Soporta Mermaid, tablas, código, y demás elementos GFM.
 * @param {{ content: string }} props - Contenido markdown a renderizar
 * @returns {JSX.Element} Contenido renderizado
 */
import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { motion } from "framer-motion"
import { MermaidBlock } from "./mermaid-block"
import { resolveDocLink } from "@/features/docs/utils/resolve-doc-link"

import type { Components } from "react-markdown"

interface DocsContentProps {
  content: string
  lastUpdatedLabel?: string | null
}

/**
 * Componentes custom para cada elemento markdown.
 * Reemplazan por completo las clases prose de Tailwind Typography.
 */
const markdownComponents: Components = {
  // ── Headings ──────────────────────────────────────────
  h1({ children, ...props }) {
    return (
      <h1 className="mb-4 mt-0 font-mono text-2xl font-bold tracking-tight" {...props}>
        {children}
      </h1>
    )
  },
  h2({ children, ...props }) {
    return (
      <h2
        className="mb-2 mt-8 border-b border-border/50 pb-2 font-mono text-lg font-semibold tracking-tight"
        {...props}
      >
        {children}
      </h2>
    )
  },
  h3({ children, ...props }) {
    return (
      <h3 className="mb-2 mt-6 font-mono text-base font-medium tracking-tight" {...props}>
        {children}
      </h3>
    )
  },
  h4({ children, ...props }) {
    return (
      <h4 className="mb-1 mt-4 font-mono text-sm font-semibold tracking-tight" {...props}>
        {children}
      </h4>
    )
  },

  // ── Paragraphs ────────────────────────────────────────
  p({ children, ...props }) {
    return (
      <p className="mb-4 leading-relaxed text-foreground/85 last:mb-0" {...props}>
        {children}
      </p>
    )
  },

  // ── Lists ─────────────────────────────────────────────
  ul({ children, ...props }) {
    return (
      <ul className="mb-4 list-disc space-y-1 pl-6 text-foreground/85" {...props}>
        {children}
      </ul>
    )
  },
  ol({ children, ...props }) {
    return (
      <ol className="mb-4 list-decimal space-y-1 pl-6 text-foreground/85" {...props}>
        {children}
      </ol>
    )
  },
  li({ children, ...props }) {
    return <li className="leading-relaxed" {...props}>{children}</li>
  },

  // ── Links ─────────────────────────────────────────────
  a({ href, children, ...props }) {
    const resolved = href ? resolveDocLink(href) : href
    return (
      <a
        href={resolved}
        className="text-primary no-underline hover:underline"
        target={resolved?.startsWith("http") ? "_blank" : undefined}
        rel={resolved?.startsWith("http") ? "noopener noreferrer" : undefined}
        {...props}
      >
        {children}
      </a>
    )
  },

  // ── Code ──────────────────────────────────────────────
  code({ className, children, ...props }) {
    const isMermaid = className === "language-mermaid"
    const match = /language-(\w+)/.exec(className ?? "")
    const code = String(children).replace(/\n$/, "")

    if (isMermaid) {
      return <MermaidBlock chart={code} />
    }

    if (match) {
      // Code block with language label
      return (
        <div className="my-4 overflow-x-auto rounded-lg border border-border/50 bg-muted/60 p-4 text-sm">
          <div className="mb-2 font-mono text-xs text-muted-foreground">{match[1]}</div>
          <pre className="m-0 border-0 bg-transparent p-0">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      )
    }

    // Inline code
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-normal"
        {...props}
      >
        {children}
      </code>
    )
  },

  // ── Blockquotes ───────────────────────────────────────
  blockquote({ children, ...props }) {
    return (
      <blockquote
        className="my-4 border-l-2 border-l-primary bg-muted/20 px-4 py-2 text-foreground/80"
        {...props}
      >
        {children}
      </blockquote>
    )
  },

  // ── Tables ────────────────────────────────────────────
  table({ children }) {
    return (
      <div className="my-4 overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    )
  },
  th({ children, ...props }) {
    return (
      <th
        className="bg-muted/50 px-3 py-2 text-left font-mono text-sm font-semibold"
        {...props}
      >
        {children}
      </th>
    )
  },
  td({ children, ...props }) {
    return (
      <td className="border-b border-border/30 px-3 py-2 text-sm" {...props}>
        {children}
      </td>
    )
  },

  // ── Images ────────────────────────────────────────────
  img({ src, alt, ...props }) {
    return (
      <img
        src={src}
        alt={alt ?? ""}
        className="my-4 rounded-lg border border-border/50"
        loading="lazy"
        {...props}
      />
    )
  },

  // ── Horizontal rule ───────────────────────────────────
  hr(props) {
    return <hr className="my-8 border-border/40" {...props} />
  },
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

      <div className="min-w-0">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    </motion.article>
  )
}
