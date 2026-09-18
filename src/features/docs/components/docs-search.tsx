/**
 * @description Búsqueda full-text sobre los módulos de documentación.
 * Recibe el índice pre-generado en build-time desde el server component.
 * @param {{ index: SearchIndexEntry[] }} props - Índice de búsqueda generado en build-time
 * @returns {JSX.Element} Input de búsqueda con resultados en dropdown
 */
"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

import type { SearchIndexEntry } from "../data/types"

interface SearchResult {
  slug: string
  title: string
  domain: string
  description: string
  score: number
}

export function DocsSearch({ index }: { index: SearchIndexEntry[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const search = useCallback(
    (q: string) => {
      if (!q.trim() || index.length === 0) {
        setResults([])
        return
      }

      const lower = q.toLowerCase()
      const scored = index
        .map((entry) => {
          let score = 0
          if (entry.title.toLowerCase().includes(lower)) score += 10
          if (entry.domain.toLowerCase().includes(lower)) score += 5
          if (entry.description.toLowerCase().includes(lower)) score += 3
          if (entry.content.toLowerCase().includes(lower)) score += 1
          return { ...entry, score }
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)

      setResults(scored)
    },
    [index],
  )

  useEffect(() => {
    search(query)
    setSelectedIndex(-1)
  }, [query, search])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen || results.length === 0) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault()
        const result = results[selectedIndex]
        if (result) {
          router.push(`/docs/${result.slug}`)
          setIsOpen(false)
          setQuery("")
          inputRef.current?.blur()
        }
      } else if (e.key === "Escape") {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, results, selectedIndex, router])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Buscar en documentación..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        className="w-full rounded-lg border border-border/50 bg-muted/30 py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Buscar en documentación"
        aria-expanded={isOpen && results.length > 0}
        aria-controls="search-results"
      />

      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          id="search-results"
          role="listbox"
          className="absolute top-full z-50 mt-1 w-full rounded-lg border border-border/50 bg-background shadow-lg"
        >
          {results.map((result, i) => (
            <button
              key={result.slug}
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => {
                router.push(`/docs/${result.slug}`)
                setIsOpen(false)
                setQuery("")
              }}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`flex w-full flex-col items-start px-4 py-2.5 text-left text-sm transition-colors ${
                i === selectedIndex ? "bg-primary/10" : "hover:bg-muted/50"
              } ${i > 0 ? "border-t border-border/30" : ""}`}
            >
              <span className="font-medium">{result.title}</span>
              <span className="text-xs text-muted-foreground/70">
                {result.domain} — {result.description.slice(0, 80)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
