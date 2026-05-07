import { NextRequest, NextResponse } from 'next/server'
import { getCuentasPorCobrarHandler, createCuentaPorCobrarHandler } from "@/features/contabilidad/api/handlers"

export async function GET(request: NextRequest) {
  return getCuentasPorCobrarHandler(request)
}

export async function POST(request: NextRequest) {
  return createCuentaPorCobrarHandler(request)
}
