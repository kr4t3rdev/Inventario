import { NextRequest } from "next/server"
import { updateMoneda } from "@/features/contabilidad/api/exchange-handlers"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) { return updateMoneda(request, { params }) }
