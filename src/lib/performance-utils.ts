// Performance optimization utilities for contabilidad module

interface PerformanceConfig {
  enableProfiling: boolean
  enableCaching: boolean
  enableLazyLoading: boolean
  batchSize: number
  debounceMs: number
}

class PerformanceOptimizer {
  private config: PerformanceConfig
  private performanceMarks: Map<string, number> = new Map()
  private batchQueue: Map<string, any[]> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enableProfiling: process.env.NODE_ENV === 'development',
      enableCaching: true,
      enableLazyLoading: true,
      batchSize: 50,
      debounceMs: 300,
      ...config
    }
  }

  // Performance profiling
  startMark(name: string): void {
    if (!this.config.enableProfiling) return
    this.performanceMarks.set(name, performance.now())
  }

  endMark(name: string): number {
    if (!this.config.enableProfiling) return 0
    
    const startTime = this.performanceMarks.get(name)
    if (!startTime) return 0
    
    const duration = performance.now() - startTime
    this.performanceMarks.delete(name)
    
    if (duration > 100) { // Log slow operations
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`)
    }
    
    return duration
  }

  // Batch processing for bulk operations
  addToBatch<T>(batchKey: string, item: T, processor: (items: T[]) => Promise<void>): void {
    if (!this.batchQueue.has(batchKey)) {
      this.batchQueue.set(batchKey, [])
    }
    
    const batch = this.batchQueue.get(batchKey)!
    batch.push(item)
    
    if (batch.length >= this.config.batchSize) {
      this.processBatch(batchKey, processor)
    } else {
      // Set timeout to process remaining items
      if (this.debounceTimers.has(batchKey)) {
        clearTimeout(this.debounceTimers.get(batchKey)!)
      }
      
      const timer = setTimeout(() => {
        this.processBatch(batchKey, processor)
      }, this.config.debounceMs)
      
      this.debounceTimers.set(batchKey, timer)
    }
  }

  private async processBatch<T>(batchKey: string, processor: (items: T[]) => Promise<void>): Promise<void> {
    const batch = this.batchQueue.get(batchKey)
    if (!batch || batch.length === 0) return
    
    this.batchQueue.set(batchKey, [])
    
    if (this.debounceTimers.has(batchKey)) {
      clearTimeout(this.debounceTimers.get(batchKey)!)
      this.debounceTimers.delete(batchKey)
    }
    
    try {
      await processor(batch)
    } catch (error) {
      console.error(`Batch processing failed for ${batchKey}:`, error)
    }
  }

  // Debounced function execution
  debounce<T extends (...args: any[]) => any>(
    func: T,
    key: string,
    delay: number = this.config.debounceMs
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key)!)
      }
      
      const timer = setTimeout(() => {
        func(...args)
        this.debounceTimers.delete(key)
      }, delay)
      
      this.debounceTimers.set(key, timer)
    }
  }

  // Memory usage monitoring
  getMemoryUsage(): { used: number; total: number; percentage: number } {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize / 1024 / 1024, // MB
        total: memory.totalJSHeapSize / 1024 / 1024, // MB
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      }
    }
    
    return { used: 0, total: 0, percentage: 0 }
  }

  // Cleanup resources
  cleanup(): void {
    this.performanceMarks.clear()
    this.batchQueue.clear()
    
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()
  }
}

// Global performance optimizer instance
export const performanceOptimizer = new PerformanceOptimizer()

// Utility functions for common performance patterns

// Lazy loading with intersection observer
export function createLazyLoader(
  callback: () => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback()
        observer.unobserve(entry.target)
      }
    })
  }, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  })
  
  return observer
}

// Virtual scrolling for large lists
export function calculateVirtualScrolling(
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  scrollTop: number,
  overscan: number = 5
): { startIndex: number; endIndex: number; offsetY: number } {
  const visibleItems = Math.ceil(containerHeight / itemHeight)
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(totalItems - 1, startIndex + visibleItems + overscan * 2)
  const offsetY = startIndex * itemHeight
  
  return { startIndex, endIndex, offsetY }
}

// Memoization with TTL
export function createMemoizedFunction<T extends (...args: any[]) => any>(
  fn: T,
  ttl: number = 5 * 60 * 1000 // 5 minutes
): T {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>()
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args)
    const cached = cache.get(key)
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value
    }
    
    const result = fn(...args)
    cache.set(key, { value: result, timestamp: Date.now() })
    
    // Cleanup expired entries periodically
    if (cache.size > 100) {
      const now = Date.now()
      for (const [k, v] of cache.entries()) {
        if (now - v.timestamp > ttl) {
          cache.delete(k)
        }
      }
    }
    
    return result
  }) as T
}

// Database query optimization helpers
export function optimizeQuery(query: any): any {
  // Add common optimizations
  return {
    ...query,
    // Use select to limit fields
    select: query.select || undefined,
    // Add pagination if not present
    take: query.take || 50,
    skip: query.skip || 0,
    // Optimize includes
    include: query.include ? optimizeIncludes(query.include) : undefined
  }
}

function optimizeIncludes(include: any): any {
  // Recursively optimize nested includes
  const optimized: any = {}
  
  for (const [key, value] of Object.entries(include)) {
    if (typeof value === 'object' && value !== null) {
      optimized[key] = {
        select: (value as any).select || undefined,
        include: (value as any).include ? optimizeIncludes((value as any).include) : undefined
      }
    } else {
      optimized[key] = value
    }
  }
  
  return optimized
}

// Performance monitoring decorator
export function withPerformanceMonitoring<T extends (...args: any[]) => any>(
  fn: T,
  name: string
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    performanceOptimizer.startMark(name)
    
    try {
      const result = fn(...args)
      
      // Handle async functions
      if (result instanceof Promise) {
        return result.finally(() => {
          performanceOptimizer.endMark(name)
        }) as ReturnType<T>
      }
      
      performanceOptimizer.endMark(name)
      return result
    } catch (error) {
      performanceOptimizer.endMark(name)
      throw error
    }
  }) as T
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    performanceOptimizer.cleanup()
  })
}