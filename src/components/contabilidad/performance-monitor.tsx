'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Activity, Database, Zap, Clock, RefreshCw } from 'lucide-react'

interface PerformanceMetrics {
  apiResponseTime: number
  databaseQueryTime: number
  cacheHitRate: number
  memoryUsage: number
  activeConnections: number
  lastUpdate: Date
}

interface PerformanceMonitorProps {
  showDetails?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export function PerformanceMonitor({
  showDetails = false,
  autoRefresh = true,
  refreshInterval = 30000
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      // Simulate API call to get performance metrics
      // In a real implementation, this would call an actual metrics endpoint
      await new Promise(resolve => setTimeout(resolve, 500))

      const mockMetrics: PerformanceMetrics = {
        apiResponseTime: Math.random() * 200 + 50, // 50-250ms
        databaseQueryTime: Math.random() * 100 + 20, // 20-120ms
        cacheHitRate: Math.random() * 30 + 70, // 70-100%
        memoryUsage: Math.random() * 40 + 30, // 30-70%
        activeConnections: Math.floor(Math.random() * 50 + 10), // 10-60
        lastUpdate: new Date()
      }

      setMetrics(mockMetrics)
    } catch (error) {
      console.error('Error fetching performance metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'default' // Good performance - use default (usually green/blue)
    if (value <= thresholds.warning) return 'secondary' // Warning - use secondary (usually yellow/gray)
    return 'destructive' // Poor performance - use destructive (red)
  }

  const getCacheStatusColor = (hitRate: number) => {
    if (hitRate >= 90) return 'default' // Good cache hit rate
    if (hitRate >= 75) return 'secondary' // Moderate cache hit rate
    return 'destructive' // Poor cache hit rate
  }

  if (!showDetails && !metrics) return null

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Rendimiento del Sistema
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchMetrics}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {metrics && (
          <>
            {/* Quick Status Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">API</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{metrics.apiResponseTime.toFixed(0)}ms</span>
                  <Badge variant={getStatusColor(metrics.apiResponseTime, { good: 100, warning: 200 })}
                    className="text-xs"
                  >
                    {metrics.apiResponseTime <= 100 ? 'Excelente' :
                      metrics.apiResponseTime <= 200 ? 'Bueno' : 'Lento'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">BD</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{metrics.databaseQueryTime.toFixed(0)}ms</span>
                  <Badge
                    variant={getStatusColor(metrics.databaseQueryTime, { good: 50, warning: 100 })}
                    className="text-xs"
                  >
                    {metrics.databaseQueryTime <= 50 ? 'Rápido' :
                      metrics.databaseQueryTime <= 100 ? 'Normal' : 'Lento'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Cache</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{metrics.cacheHitRate.toFixed(0)}%</span>
                  <Badge
                    variant={getCacheStatusColor(metrics.cacheHitRate)}
                    className="text-xs"
                  >
                    {metrics.cacheHitRate >= 90 ? 'Óptimo' :
                      metrics.cacheHitRate >= 75 ? 'Bueno' : 'Bajo'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Conexiones</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{metrics.activeConnections}</span>
                  <Badge variant="outline" className="text-xs">
                    Activas
                  </Badge>
                </div>
              </div>
            </div>

            {showDetails && (
              <>
                {/* Detailed Metrics */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Uso de Memoria</span>
                      <span>{metrics.memoryUsage.toFixed(1)}%</span>
                    </div>
                    <Progress value={metrics.memoryUsage} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Tasa de Aciertos de Cache</span>
                      <span>{metrics.cacheHitRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={metrics.cacheHitRate} className="h-2" />
                  </div>
                </div>

                {/* Performance Tips */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Recomendaciones</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {metrics.apiResponseTime > 200 && (
                      <p>• Considera optimizar las consultas de API más lentas</p>
                    )}
                    {metrics.cacheHitRate < 75 && (
                      <p>• Mejora la estrategia de cache para mejor rendimiento</p>
                    )}
                    {metrics.memoryUsage > 80 && (
                      <p>• Uso de memoria alto, considera limpiar cache</p>
                    )}
                    {metrics.activeConnections > 50 && (
                      <p>• Alto número de conexiones activas</p>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Última actualización: {metrics.lastUpdate.toLocaleTimeString()}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}