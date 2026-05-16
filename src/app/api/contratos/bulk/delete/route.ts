import { NextRequest } from 'next/server'
import { bulkDeleteContratosHandler } from '@/features/contratos/api/handlers'

export async function POST(request: NextRequest) {
  return bulkDeleteContratosHandler(request)
}
