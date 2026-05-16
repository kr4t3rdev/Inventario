import { NextRequest } from 'next/server'
import { getContratoByIdHandler, updateContratoHandler, deleteContratoHandler } from '@/features/contratos/api/handlers'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getContratoByIdHandler(request, context)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return updateContratoHandler(request, context)
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return deleteContratoHandler(request, context)
}
