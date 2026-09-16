import { NextResponse } from 'next/server';

/**
 * @description Endpoint de health check para Docker y monitoreo
 * @returns {NextResponse} Estado de salud de la aplicación
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Verificar que la app está respondiendo
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'unknown',
      deploymentEnvironment:
        process.env.DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || '1.0.0',
    };

    return NextResponse.json(healthStatus, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
