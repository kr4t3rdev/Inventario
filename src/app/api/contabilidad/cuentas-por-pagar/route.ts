import { NextRequest, NextResponse } from 'next/server'
import { getCuentasPorPagarHandler, createCuentaPorPagarHandler } from "@/features/contabilidad/api/handlers"

export async function GET(request: NextRequest): Promise<Response> {
  return getCuentasPorPagarHandler(request)
}

export async function POST(request: NextRequest): Promise<Response> {
  return createCuentaPorPagarHandler(request)
}
