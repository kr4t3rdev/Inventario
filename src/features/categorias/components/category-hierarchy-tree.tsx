"use client"

import React, { useState, useEffect } from "react"
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getCategoriaHierarchyAction } from "@/features/categorias/actions"
import type { CategoriaHierarchy } from "@/app/models/model"
import { cn } from "@/lib/utils"
import { LazyMotion, m as motion, AnimatePresence, useReducedMotion } from "framer-motion"

interface CategoryHierarchyTreeProps {
  onCategorySelect?: (category: CategoriaHierarchy) => void
  selectedCategoryId?: string
  showProductCount?: boolean
  className?: string
}

interface TreeNodeProps {
  category: CategoriaHierarchy
  level: number
  onSelect?: (category: CategoriaHierarchy) => void
  selectedId?: string
  showProductCount?: boolean
}

// Loading spinner component
function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <motion.div
      className="border-2 border-primary border-t-transparent rounded-full"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  )
}

function TreeNode({ 
  category, 
  level, 
  onSelect, 
  selectedId, 
  showProductCount = true 
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0) // Root categories expanded by default
  const hasSubcategories = category.subcategorias && category.subcategorias.length > 0
  const isSelected = selectedId === category.catId

  const handleToggle = () => {
    if (hasSubcategories) {
      setIsExpanded(!isExpanded)
    }
  }

  const handleSelect = () => {
    onSelect?.(category)
  }

  return (
    <div className="w-full">
      <motion.div 
        className={cn(
          "flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer transition-colors",
          isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
          level > 0 && "ml-4"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: level * 0.05, duration: 0.3 }}
        whileHover={{ x: 4 }}
      >
        {/* Expand/Collapse Button */}
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleToggle}
            disabled={!hasSubcategories}
          >
            {hasSubcategories ? (
              <motion.div
                initial={false}
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4" />
              </motion.div>
            ) : (
              <div className="h-4 w-4" /> // Spacer for alignment
            )}
          </Button>
        </motion.div>

        {/* Category Icon */}
        <motion.div 
          className="flex items-center"
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {hasSubcategories ? (
              isExpanded ? (
                <motion.div
                  key="open"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  transition={{ duration: 0.2 }}
                >
                  <FolderOpen className="h-4 w-4 text-primary" />
                </motion.div>
              ) : (
                <motion.div
                  key="closed"
                  initial={{ scale: 0, rotate: 180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -180 }}
                  transition={{ duration: 0.2 }}
                >
                  <Folder className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              )
            ) : (
              <motion.div 
                className="h-4 w-4 rounded-sm bg-muted-foreground/20"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 }}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Category Name and Details */}
        <motion.div 
          className="flex-1 flex items-center justify-between"
          onClick={handleSelect}
          whileHover={{ x: 2 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-medium",
              level === 0 && "font-semibold"
            )}>
              {category.nombre}
            </span>
            {category.descripcion && (
              <span className="text-xs text-muted-foreground">
                ({category.descripcion})
              </span>
            )}
          </div>
          
          {showProductCount && (
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              <Badge variant="secondary" className="text-xs">
                {category.productCount} productos
              </Badge>
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Subcategories */}
      <AnimatePresence>
        {hasSubcategories && isExpanded && (
          <motion.div 
            className="ml-2 overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {category.subcategorias.map((subcategory, index) => (
              <motion.div
                key={subcategory.catId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
              >
                <TreeNode
                  category={subcategory}
                  level={level + 1}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  showProductCount={showProductCount}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Pulse skeleton
function PulseSkeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={`bg-muted rounded ${className}`}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  )
}

/**
 * @description Árbol jerárquico de categorías con expandir/colapsar.
 * Usa getCategoriaHierarchyAction (Server Action) en lugar de RTK Query.
 *
 * @param {CategoryHierarchyTreeProps} props - Props del árbol.
 * @returns {JSX.Element} Árbol de categorías.
 */
export function CategoryHierarchyTree({
  onCategorySelect,
  selectedCategoryId,
  showProductCount = true,
  className
}: CategoryHierarchyTreeProps) {
  const [hierarchy, setHierarchy] = useState<CategoriaHierarchy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    getCategoriaHierarchyAction().then(result => {
      if (result.success) {
        setHierarchy(result.data ?? [])
      } else {
        setError(true)
      }
      setIsLoading(false)
    })
  }, [])

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <motion.div
              animate={shouldReduceMotion ? { rotate: 0 } : { rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Folder className="h-5 w-5 text-muted-foreground" />
            </motion.div>
            Jerarquía de Categorías
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.div 
                key={i} 
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <PulseSkeleton className="h-6 w-6" />
                <PulseSkeleton className="h-4 w-4" />
                <PulseSkeleton className="h-4 flex-1" />
                <PulseSkeleton className="h-5 w-16" />
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={className}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Folder className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-destructive">
              Error al cargar la jerarquía de categorías
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (hierarchy.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={className}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Jerarquía de Categorías
            </CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div 
              className="text-sm text-muted-foreground text-center py-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Folder className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>No hay categorías disponibles</p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <motion.div
            animate={shouldReduceMotion ? { rotate: 0 } : { rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Folder className="h-5 w-5 text-muted-foreground" />
          </motion.div>
          Jerarquía de Categorías
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hierarchy.map((category, index) => (
          <motion.div
            key={category.catId}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <TreeNode
              category={category}
              level={0}
              onSelect={onCategorySelect}
              selectedId={selectedCategoryId}
              showProductCount={showProductCount}
            />
          </motion.div>
        ))}
      </CardContent>
    </Card>
  )
}
