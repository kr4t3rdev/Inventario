import { NextRequest } from 'next/server'
import { bulkUpdateContratoStatusHandler } from '@/features/contratos/api/handlers'

export async function POST(request: NextRequest) {
  return bulkUpdateContratoStatusHandler(request)
}
