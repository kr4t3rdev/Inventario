import { NextRequest } from 'next/server'
import { getContratosHandler, createContratoHandler } from '@/features/contratos/api/handlers'

export async function GET(request: NextRequest) {
  return getContratosHandler(request)
}

export async function POST(request: NextRequest) {
  return createContratoHandler(request)
}
