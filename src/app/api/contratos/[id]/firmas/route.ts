import { NextRequest } from 'next/server'
import { getContratoFirmasHandler, createContratoFirmaHandler } from '@/features/contratos/api/handlers'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getContratoFirmasHandler(req, context)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createContratoFirmaHandler(request, { params })
}
