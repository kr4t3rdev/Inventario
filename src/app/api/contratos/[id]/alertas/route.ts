import { NextRequest } from 'next/server'
import { getContratoAlertasHandler, createContratoAlertaHandler } from '@/features/contratos/api/handlers'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getContratoAlertasHandler(req, context)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createContratoAlertaHandler(request, { params })
}
