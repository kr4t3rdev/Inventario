import { NextRequest } from 'next/server'
import { getContratoByIdHandler, updateContratoHandler, deleteContratoHandler } from '@/features/contratos/api/handlers'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getContratoByIdHandler(req, context)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return updateContratoHandler(request, { params })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return deleteContratoHandler(request, { params })
}
