import { NextRequest, NextResponse } from 'next/server'
import { metricsRegistry } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

/**
 * @description Endpoint para exponer métricas de Prometheus
 * @param {NextRequest} request
 * @returns {Promise<NextResponse>} Respuesta con las métricas en formato texto
 */
export async function GET(request: NextRequest) {
  try {
    const metrics = await metricsRegistry.metrics()
    
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': metricsRegistry.contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  } catch (error) {
    console.error('Error generando métricas:', error)
    return NextResponse.json(
      { error: 'Error interno al generar métricas' },
      { status: 500 }
    )
  }
}
