import { NextRequest } from 'next/server'
import { getContratoAprobacionesHandler, createContratoAprobacionHandler } from '@/features/contratos/api/handlers'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getContratoAprobacionesHandler(req, context)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createContratoAprobacionHandler(request, { params })
}
