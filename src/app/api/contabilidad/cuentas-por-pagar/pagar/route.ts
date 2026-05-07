import { NextRequest, NextResponse } from 'next/server'
import { pagarCuentaPorPagarHandler } from "@/features/contabilidad/api/handlers"

export async function POST(request: NextRequest): Promise<Response> {
  return pagarCuentaPorPagarHandler(request)
}
